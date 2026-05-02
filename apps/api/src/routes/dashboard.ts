import { Router, Request, Response } from 'express';
import { db } from '../db';
import { incidents, misinfoChecks } from '../db/schema';
import { eq, desc, sql, count } from 'drizzle-orm';
import { addSSEClient, removeSSEClient } from '../services/incidentRouter';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

// ─── Simple JWT auth middleware ──────────────────────────────────
function authMiddleware(req: Request, res: Response, next: () => void): void {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const secret = process.env['JWT_SECRET'] ?? 'demo-secret';

  // In demo mode, allow all requests
  if (process.env['DEMO_MODE'] === 'true' || !token) {
    next();
    return;
  }

  // Simple token check (for hackathon — not production-grade)
  const expectedToken = crypto.createHash('sha256').update(secret).digest('hex');
  if (token === expectedToken) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// ─── GET /api/dashboard/incidents — List incidents ───────────────
router.get('/incidents', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await db.select().from(incidents).orderBy(desc(incidents.urgency), desc(incidents.createdAt)).limit(100);
    res.json({ incidents: result });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch incidents');
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// ─── GET /api/dashboard/incidents/stream — SSE ───────────────────
router.get('/incidents/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write('data: {"type":"CONNECTED"}\n\n');
  addSSEClient(res);

  req.on('close', () => {
    removeSSEClient(res);
  });
});

// ─── PATCH /api/dashboard/incidents/:ticket — Update status ──────
router.patch('/incidents/:ticket', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ticketParam = req.params['ticket'] as string;
    const { status, assignedSquad } = req.body as { status?: string; assignedSquad?: string };

    if (!ticketParam) { res.status(400).json({ error: 'Missing ticket' }); return; }

    const updates: Record<string, unknown> = {};
    if (status) updates['status'] = status;
    if (assignedSquad) updates['assignedSquad'] = assignedSquad;
    if (status === 'RESOLVED') updates['resolvedAt'] = new Date();

    await db.update(incidents)
      .set(updates as Partial<typeof incidents.$inferInsert>)
      .where(eq(incidents.ticket, ticketParam));

    const updated = await db.select().from(incidents).where(eq(incidents.ticket, ticketParam)).limit(1);
    res.json({ incident: updated[0] });
  } catch (err) {
    logger.error({ err }, 'Failed to update incident');
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

// ─── GET /api/dashboard/stats — Aggregated stats ─────────────────
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const totalIncidents = await db.select({ count: count() }).from(incidents);
    const openIncidents = await db.select({ count: count() }).from(incidents).where(eq(incidents.status, 'OPEN'));
    const resolvedIncidents = await db.select({ count: count() }).from(incidents).where(eq(incidents.status, 'RESOLVED'));
    const totalMisinfo = await db.select({ count: count() }).from(misinfoChecks);

    // Category breakdown
    const categoryBreakdown = await db.select({
      category: incidents.category,
      count: count(),
    }).from(incidents).groupBy(incidents.category);

    // Misinfo verdict breakdown
    const verdictBreakdown = await db.select({
      verdict: misinfoChecks.verdict,
      count: count(),
    }).from(misinfoChecks).groupBy(misinfoChecks.verdict);

    res.json({
      incidents: {
        total: totalIncidents[0]?.count ?? 0,
        open: openIncidents[0]?.count ?? 0,
        resolved: resolvedIncidents[0]?.count ?? 0,
        byCategory: categoryBreakdown,
      },
      misinfo: {
        total: totalMisinfo[0]?.count ?? 0,
        byVerdict: verdictBreakdown,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch stats');
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── GET /api/dashboard/misinfo — Misinfo check results ──────────
router.get('/misinfo', async (_req: Request, res: Response) => {
  try {
    const result = await db.select().from(misinfoChecks).orderBy(desc(misinfoChecks.createdAt)).limit(50);
    res.json({ checks: result });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch misinfo checks');
    res.status(500).json({ error: 'Failed to fetch misinfo checks' });
  }
});

// ─── GET /api/dashboard/transparency — Public view ───────────────
router.get('/transparency', async (_req: Request, res: Response) => {
  try {
    // Incident stats by constituency
    const byConstituency = await db.select({
      constituency: incidents.constituency,
      total: count(),
      // We'll compute open/resolved in the app
    }).from(incidents).groupBy(incidents.constituency);

    const verdictBreakdown = await db.select({
      verdict: misinfoChecks.verdict,
      count: count(),
    }).from(misinfoChecks).groupBy(misinfoChecks.verdict);

    const totalMisinfo = await db.select({ count: count() }).from(misinfoChecks);

    res.json({
      incidentsByConstituency: byConstituency,
      misinfoStats: { total: totalMisinfo[0]?.count ?? 0, byVerdict: verdictBreakdown },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch transparency data');
    res.status(500).json({ error: 'Failed to fetch transparency data' });
  }
});

export default router;
