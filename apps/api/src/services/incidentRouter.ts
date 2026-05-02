import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { incidents } from '../db/schema';
import { triageIncident } from './claude';
import { pushToQueue } from './redis';
import { logger } from '../utils/logger';
import { eq } from 'drizzle-orm';

// ─── SSE clients for live updates ────────────────────────────────
import type { Response } from 'express';
const sseClients: Set<Response> = new Set();

export function addSSEClient(res: Response): void { sseClients.add(res); }
export function removeSSEClient(res: Response): void { sseClients.delete(res); }

export function broadcastIncident(data: Record<string, unknown>): void {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}

// ─── Hash helper ─────────────────────────────────────────────────
export function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(phone).digest('hex');
}

// ─── Generate ticket ─────────────────────────────────────────────
function generateTicket(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VS-${date}-${rand}`;
}

// ─── Report Incident ─────────────────────────────────────────────
export async function reportIncident(
  description: string,
  phone: string,
  location?: string,
): Promise<{ ticket: string; category: string; urgency: number }> {
  const ticket = generateTicket();
  const reporterHash = hashPhone(phone);

  // AI triage
  const triage = await triageIncident(description, location);

  // Geocoordinates for demo (major Indian cities)
  const demoCoords: Record<string, { lat: string; lng: string }> = {
    'delhi': { lat: '28.6139', lng: '77.2090' },
    'mumbai': { lat: '19.0760', lng: '72.8777' },
    'bangalore': { lat: '12.9716', lng: '77.5946' },
    'chennai': { lat: '13.0827', lng: '80.2707' },
    'kolkata': { lat: '22.5726', lng: '88.3639' },
    'hyderabad': { lat: '17.3850', lng: '78.4867' },
    'lucknow': { lat: '26.8467', lng: '80.9462' },
    'jaipur': { lat: '26.9124', lng: '75.7873' },
    'patna': { lat: '25.6093', lng: '85.1376' },
  };

  let lat: string | undefined;
  let lng: string | undefined;
  if (location) {
    const lower = location.toLowerCase();
    for (const [city, coords] of Object.entries(demoCoords)) {
      if (lower.includes(city)) { lat = coords.lat; lng = coords.lng; break; }
    }
  }
  if (!lat) { lat = '28.6139'; lng = '77.2090'; } // Default to Delhi

  try {
    await db.insert(incidents).values({
      id: uuidv4(),
      ticket,
      reporterHash,
      category: triage.category,
      urgency: triage.urgency,
      summary: triage.summary,
      requiredAction: triage.requiredAction,
      constituency: location ?? 'Unknown',
      latitude: lat,
      longitude: lng,
      status: 'OPEN',
    });
  } catch (err) {
    logger.error({ err }, 'Failed to insert incident');
  }

  // Push to priority queue
  await pushToQueue(ticket, triage.urgency);

  // Broadcast to dashboard
  broadcastIncident({
    type: 'NEW_INCIDENT',
    ticket,
    category: triage.category,
    urgency: triage.urgency,
    summary: triage.summary,
    constituency: location ?? 'Unknown',
    latitude: lat,
    longitude: lng,
  });

  logger.info({ ticket, category: triage.category, urgency: triage.urgency }, 'Incident reported');
  return { ticket, category: triage.category, urgency: triage.urgency };
}

// ─── Get Ticket Status ───────────────────────────────────────────
export async function getTicketStatus(ticket: string): Promise<{
  found: boolean;
  ticket?: string;
  status?: string;
  category?: string;
  urgency?: number;
  createdAt?: Date | null;
}> {
  try {
    const result = await db.select().from(incidents).where(eq(incidents.ticket, ticket.toUpperCase())).limit(1);
    const incident = result[0];
    if (!incident) return { found: false };
    return {
      found: true,
      ticket: incident.ticket,
      status: incident.status ?? 'OPEN',
      category: incident.category,
      urgency: incident.urgency,
      createdAt: incident.createdAt,
    };
  } catch (err) {
    logger.error({ err }, 'getTicketStatus failed');
    return { found: false };
  }
}
