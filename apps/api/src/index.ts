import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import { connectRedis, disconnectRedis } from './services/redis';
import { pool } from './db';
import { startVoterRollCron } from './jobs/voterRollCron';
import { startLiveActivityGenerator } from './jobs/liveActivityGenerator';

// Routes
import whatsappRouter from './routes/whatsapp';
import smsRouter from './routes/sms';
import ivrRouter from './routes/ivr';
import dashboardRouter from './routes/dashboard';
import healthRouter from './routes/health';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

// ─── Middleware ───────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Request');
  next();
});

// ─── Routes ──────────────────────────────────────────────────────
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/sms', smsRouter);
app.use('/api/ivr', ivrRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/health', healthRouter);

// Root route
app.get('/', (_req, res) => {
  res.json({
    name: 'VoteShield API',
    version: '1.0.0',
    description: 'AI-powered voter protection platform for India',
    endpoints: {
      health: '/health',
      whatsapp: '/api/whatsapp',
      sms: '/api/sms',
      ivr: '/api/ivr',
      dashboard: '/api/dashboard/*',
    },
  });
});

// ─── Error handler ───────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ───────────────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    // Connect to Redis
    await connectRedis().catch((err) => {
      logger.warn({ err }, 'Redis connection failed — continuing without cache');
    });

    // Test DB connection
    await pool.query('SELECT 1').catch((err) => {
      logger.warn({ err }, 'Database connection failed — some features will be unavailable');
    });

    // Start cron jobs
    startVoterRollCron();
    startLiveActivityGenerator();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info({ port: PORT, demoMode: process.env['DEMO_MODE'] }, '🛡️ VoteShield API is running');
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// ─── Graceful shutdown ───────────────────────────────────────────
const shutdown = async (): Promise<void> => {
  logger.info('Shutting down...');
  await disconnectRedis();
  await pool.end();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
