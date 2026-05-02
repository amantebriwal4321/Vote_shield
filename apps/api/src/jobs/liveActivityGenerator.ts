import { db } from '../db';
import { incidents } from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { broadcastIncident } from '../services/incidentRouter';
import { logger } from '../utils/logger';

const CATEGORIES = ['INTIMIDATION', 'CASH_FOR_VOTE', 'BOOTH_CAPTURE', 'IMPERSONATION', 'OTHER'];
const CONSTITUENCIES = ['DL-01', 'MH-24', 'KA-28', 'TN-39', 'WB-22', 'UP-15', 'RJ-05', 'AP-09', 'GJ-12'];
const CITIES = [
  { lat: 28.7041, lng: 77.1025 },
  { lat: 19.0760, lng: 72.8777 },
  { lat: 12.9716, lng: 77.5946 },
  { lat: 13.0827, lng: 80.2707 },
  { lat: 22.5726, lng: 88.3639 }
];

function getRandomCityGeo() {
  const city = CITIES[Math.floor(Math.random() * CITIES.length)]!;
  const latJitter = (Math.random() - 0.5) * 1.0; 
  const lngJitter = (Math.random() - 0.5) * 1.0;
  return {
    latitude: (city.lat + latJitter).toFixed(6),
    longitude: (city.lng + lngJitter).toFixed(6)
  };
}

export function startLiveActivityGenerator() {
  if (process.env['DEMO_MODE'] !== 'true') return;

  logger.info('Starting Live Activity Generator (Mock data will flow every 15-30s)');

  const generate = async () => {
    try {
      const geo = getRandomCityGeo();
      const ticket = `TKT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const newIncident = {
        ticket,
        reporterHash: crypto.createHash('sha256').update(Math.random().toString()).digest('hex'),
        category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]!,
        urgency: Math.floor(Math.random() * 5) + 1,
        summary: "Live simulated incident report from field.",
        constituency: CONSTITUENCIES[Math.floor(Math.random() * CONSTITUENCIES.length)]!,
        latitude: geo.latitude,
        longitude: geo.longitude,
        status: 'OPEN'
      };

      await db.insert(incidents).values(newIncident);
      
      // Broadcast to dashboard map
      const inserted = await db.select().from(incidents).where(eq(incidents.ticket, ticket)).limit(1);
      if (inserted[0]) {
        broadcastIncident(inserted[0]);
        logger.info({ ticket }, 'Live activity generated');
      }
    } catch (err) {
      logger.error({ err }, 'Failed to generate live activity');
    }

    // Schedule next one between 2 and 4 seconds
    const nextTimeout = Math.floor(Math.random() * 2000) + 2000;
    setTimeout(generate, nextTimeout);
  };

  // Start loop
  setTimeout(generate, 10000);
}
