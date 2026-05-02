import cron from 'node-cron';
import { runVoterRollDiff } from '../services/voterRoll';
import { logger } from '../utils/logger';

// Schedule at 02:00 IST (20:30 UTC previous day)
export function startVoterRollCron(): void {
  logger.info('Scheduling voter roll cron job at 02:00 IST');

  cron.schedule('30 20 * * *', async () => {
    logger.info('Voter roll cron job started');
    try {
      const results = await runVoterRollDiff();
      logger.info({ results }, 'Voter roll cron job complete');
    } catch (err) {
      logger.error({ err }, 'Voter roll cron job failed');
    }
  }, { timezone: 'Asia/Kolkata' });

  // Also run immediately in demo mode
  if (process.env['DEMO_MODE'] === 'true') {
    logger.info('Demo mode: running voter roll diff on startup');
    setTimeout(async () => {
      try {
        const results = await runVoterRollDiff();
        logger.info({ results }, 'Initial voter roll diff complete');
      } catch (err) {
        logger.error({ err }, 'Initial voter roll diff failed');
      }
    }, 5000); // Wait 5s for DB to be ready
  }
}
