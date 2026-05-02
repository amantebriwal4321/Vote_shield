import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { getRedis } from '../services/redis';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = { api: 'ok', db: 'unknown', redis: 'unknown' };

  // Check PostgreSQL
  try {
    await pool.query('SELECT 1');
    checks['db'] = 'ok';
  } catch (err) {
    checks['db'] = 'error';
    logger.error({ err }, 'Health check: DB failed');
  }

  // Check Redis
  try {
    const redis = getRedis();
    await redis.ping();
    checks['redis'] = 'ok';
  } catch (err) {
    checks['redis'] = 'error';
    logger.error({ err }, 'Health check: Redis failed');
  }

  const healthy = Object.values(checks).every(v => v === 'ok');
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

export default router;
