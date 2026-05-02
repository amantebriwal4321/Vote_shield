import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { voters, voterAlerts, rollSnapshots } from '../db/schema';
import { sendSMS } from './twilio';
import { logger } from '../utils/logger';
import { eq } from 'drizzle-orm';

// ─── Mock voter data for demo ────────────────────────────────────
interface MockVoter {
  voterId: string;
  name: string;
  constituency: string;
  status: 'ACTIVE' | 'DELETED' | 'MODIFIED';
}

const MOCK_CONSTITUENCIES = [
  { code: 'DL-01', name: 'New Delhi', state: 'Delhi' },
  { code: 'MH-24', name: 'Mumbai North', state: 'Maharashtra' },
  { code: 'KA-28', name: 'Bangalore South', state: 'Karnataka' },
  { code: 'TN-39', name: 'Chennai Central', state: 'Tamil Nadu' },
  { code: 'WB-22', name: 'Kolkata North', state: 'West Bengal' },
];

function generateMockVoterRoll(): MockVoter[] {
  const mockVoters: MockVoter[] = [];
  const constituencies = MOCK_CONSTITUENCIES;
  for (let i = 0; i < 100; i++) {
    const cons = constituencies[i % constituencies.length]!;
    mockVoters.push({
      voterId: `${cons.code.slice(0,2)}${String(i).padStart(7, '0')}`,
      name: `Voter_${i}`,
      constituency: cons.code,
      status: i % 15 === 0 ? 'DELETED' : i % 20 === 0 ? 'MODIFIED' : 'ACTIVE',
    });
  }
  return mockVoters;
}

// ─── Check voter registration ────────────────────────────────────
export async function checkVoterRegistration(voterId: string): Promise<{
  found: boolean;
  status?: string;
  constituency?: string;
  message: string;
}> {
  // In demo mode, check against mock data
  const mockRoll = generateMockVoterRoll();
  const voter = mockRoll.find(v => v.voterId.toUpperCase() === voterId.toUpperCase());

  if (voter) {
    return {
      found: true,
      status: voter.status,
      constituency: voter.constituency,
      message: voter.status === 'ACTIVE'
        ? `✅ Your voter registration is *ACTIVE*.\nConstituency: ${voter.constituency}\nYou are all set to vote!`
        : voter.status === 'DELETED'
        ? `⚠️ Your voter registration has been *DELETED*.\nPlease visit eronet.eci.gov.in to file an appeal.\nOr call ECI helpline: 1800-111-950`
        : `⚠️ Your voter registration has been *MODIFIED*.\nPlease verify your details at electoralsearch.eci.gov.in`,
    };
  }

  return {
    found: false,
    message: '❌ Voter ID not found. Please check the number and try again.\nTo register: visit https://nvsp.in and fill Form 6.',
  };
}

// ─── Run nightly diff ────────────────────────────────────────────
export async function runVoterRollDiff(): Promise<{
  constituency: string;
  changes: number;
  alerts: number;
}[]> {
  logger.info('Starting voter roll diff...');
  const results: { constituency: string; changes: number; alerts: number }[] = [];

  const mockRoll = generateMockVoterRoll();
  const changedVoters = mockRoll.filter(v => v.status !== 'ACTIVE');

  for (const cons of MOCK_CONSTITUENCIES) {
    const consChanges = changedVoters.filter(v => v.constituency === cons.code);
    let alertsSent = 0;

    // Store snapshot
    const snapshotHash = crypto.createHash('sha256')
      .update(JSON.stringify(mockRoll.filter(v => v.constituency === cons.code)))
      .digest('hex');

    try {
      await db.insert(rollSnapshots).values({
        id: uuidv4(),
        constituencyCode: cons.code,
        snapshotHash,
        voterCount: mockRoll.filter(v => v.constituency === cons.code).length,
        changesCount: consChanges.length,
      });
    } catch (err) {
      logger.error({ err, constituency: cons.code }, 'Failed to store snapshot');
    }

    // Check enrolled voters for changes
    for (const changed of consChanges) {
      try {
        const voterIdHash = crypto.createHash('sha256').update(changed.voterId).digest('hex');
        const enrolled = await db.select().from(voters)
          .where(eq(voters.voterIdHash, voterIdHash)).limit(1);

        if (enrolled[0]) {
          const ticket = `VS-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

          await db.insert(voterAlerts).values({
            id: uuidv4(),
            voterId: enrolled[0].id,
            changeType: changed.status,
            oldStatus: 'ACTIVE',
            newStatus: changed.status,
            alertSentAt: new Date(),
            ticket,
          });

          // Send SMS alert (will be mocked if no Twilio creds)
          await sendSMS('+910000000000', // Can't reverse hash in production
            `VoteShield Alert: Your voter registration status changed to ${changed.status}. Visit eronet.eci.gov.in to appeal. Reply HELP for assistance. Ticket: ${ticket}`);

          alertsSent++;
        }
      } catch (err) {
        logger.error({ err, voterId: changed.voterId }, 'Alert processing failed');
      }
    }

    results.push({ constituency: cons.code, changes: consChanges.length, alerts: alertsSent });
  }

  logger.info({ results }, 'Voter roll diff complete');
  return results;
}
