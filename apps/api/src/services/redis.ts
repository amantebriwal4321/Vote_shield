import Redis from 'ioredis';
import { logger } from '../utils/logger';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (redis) return redis;
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    lazyConnect: true,
  });
  redis.on('error', (err) => logger.error({ err }, 'Redis error'));
  redis.on('connect', () => logger.info('Redis connected'));
  return redis;
}

export async function connectRedis(): Promise<void> {
  const r = getRedis();
  await r.connect().catch(() => { /* may already be connected */ });
}

// ─── Session helpers ─────────────────────────────────────────────
const SESSION_TTL = 1800; // 30 minutes

export interface SessionData {
  language?: string;
  intent?: string;
  step?: number;
  voterId?: string;
  history?: Array<{ role: string; content: string }>;
  [key: string]: unknown;
}

export async function getSession(phone: string): Promise<SessionData> {
  const r = getRedis();
  try {
    const data = await r.get(`session:${phone}`);
    return data ? JSON.parse(data) as SessionData : {};
  } catch { return {}; }
}

export async function setSession(phone: string, data: SessionData): Promise<void> {
  const r = getRedis();
  try {
    await r.set(`session:${phone}`, JSON.stringify(data), 'EX', SESSION_TTL);
  } catch (err) { logger.error({ err }, 'setSession failed'); }
}

export async function deleteSession(phone: string): Promise<void> {
  const r = getRedis();
  try { await r.del(`session:${phone}`); } catch { /* ignore */ }
}

// ─── Priority queue helpers ──────────────────────────────────────
const QUEUE_KEY = 'incidents:queue';

export async function pushToQueue(ticket: string, urgency: number): Promise<void> {
  const r = getRedis();
  try { await r.zadd(QUEUE_KEY, urgency, ticket); }
  catch (err) { logger.error({ err }, 'pushToQueue failed'); }
}

export async function popFromQueue(): Promise<string | null> {
  const r = getRedis();
  try {
    const result = await r.zpopmax(QUEUE_KEY);
    return result?.[0] ?? null;
  } catch { return null; }
}

export async function getQueueLength(): Promise<number> {
  const r = getRedis();
  try { return await r.zcard(QUEUE_KEY); }
  catch { return 0; }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) { await redis.quit(); redis = null; }
}
