import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { misinfoChecks } from '../db/schema';
import { checkMisinfo } from './claude';
import { logger } from '../utils/logger';

// ─── Known misinfo patterns (seed) ──────────────────────────────
const KNOWN_MISINFO: Array<{ pattern: RegExp; verdict: 'FALSE' | 'MISLEADING'; explanation: string }> = [
  { pattern: /online.*voting|vote.*app|digital.*vote/i, verdict: 'FALSE', explanation: 'India uses EVMs only. No online voting exists.' },
  { pattern: /voting.*mandatory|compulsory.*vote/i, verdict: 'FALSE', explanation: 'Voting in India is a right, not compulsory.' },
  { pattern: /ink.*wash|ink.*remove/i, verdict: 'FALSE', explanation: 'Indelible ink cannot be easily washed off. It lasts 2-4 weeks.' },
  { pattern: /EVM.*hack|EVM.*tamper|machine.*rig/i, verdict: 'MISLEADING', explanation: 'EVMs are standalone devices with no network. ECI conducts rigorous testing.' },
  { pattern: /booth.*closed|polling.*cancel/i, verdict: 'MISLEADING', explanation: 'Verify booth status from official ECI sources only.' },
  { pattern: /aadhaar.*required.*vote|only.*aadhaar/i, verdict: 'FALSE', explanation: 'Voter ID (EPIC) is primary. 11 other IDs are also accepted.' },
  { pattern: /election.*postpone|date.*change/i, verdict: 'MISLEADING', explanation: 'Election dates are announced by ECI only. Verify at eci.gov.in.' },
  { pattern: /NRI.*vote.*online/i, verdict: 'FALSE', explanation: 'NRIs can vote in person at their registered constituency. No online option.' },
  { pattern: /two.*vote|vote.*twice/i, verdict: 'FALSE', explanation: 'Each voter can vote only once. Duplicate voting is a criminal offense.' },
  { pattern: /NOTA.*cancel|NOTA.*invalid/i, verdict: 'FALSE', explanation: 'NOTA is a valid option. If NOTA gets majority, re-election is NOT mandated.' },
  { pattern: /phone.*booth|mobile.*allowed/i, verdict: 'MISLEADING', explanation: 'Mobile phones are not allowed inside polling booths per ECI rules.' },
  { pattern: /free.*gift|muft|freebie/i, verdict: 'MISLEADING', explanation: 'Distributing freebies during elections violates Model Code of Conduct.' },
  { pattern: /voter.*id.*expire/i, verdict: 'FALSE', explanation: 'Voter ID cards (EPIC) do not expire. They remain valid until cancelled.' },
  { pattern: /exit.*poll.*result/i, verdict: 'MISLEADING', explanation: 'Exit polls cannot be published until all phases of voting are complete.' },
  { pattern: /ballot.*paper.*return/i, verdict: 'FALSE', explanation: 'India uses EVMs. Ballot papers are used only in exceptional cases.' },
];

// ─── Check forwarded message ─────────────────────────────────────
export async function checkForwardedMessage(
  message: string,
  language: string,
): Promise<{
  verdict: string;
  explanation: string;
  sources: string[];
  confidence: number;
  responseMs: number;
}> {
  const startTime = Date.now();

  // 28-second timeout with Promise.race
  const timeoutPromise = new Promise<{
    verdict: string;
    explanation: string;
    sources: string[];
    confidence: number;
  }>((resolve) => {
    setTimeout(() => {
      resolve({
        verdict: 'UNVERIFIABLE',
        explanation: '⏰ Verification timed out. Please try again or check official ECI website.',
        sources: ['https://eci.gov.in'],
        confidence: 0,
      });
    }, 28000);
  });

  // Quick check against known patterns first
  for (const known of KNOWN_MISINFO) {
    if (known.pattern.test(message)) {
      const responseMs = Date.now() - startTime;
      const result = {
        verdict: known.verdict,
        explanation: known.explanation,
        sources: ['https://eci.gov.in/faqs'] as string[],
        confidence: 0.9,
        responseMs,
      };
      await logMisinfoCheck(message, result);
      return result;
    }
  }

  // AI-powered check with timeout
  const aiResult = await Promise.race([
    checkMisinfo(message, language),
    timeoutPromise,
  ]);

  const responseMs = Date.now() - startTime;
  const result = { ...aiResult, responseMs };
  await logMisinfoCheck(message, result);
  return result;
}

async function logMisinfoCheck(
  message: string,
  result: { verdict: string; explanation: string; sources: string[]; confidence: number; responseMs: number },
): Promise<void> {
  try {
    await db.insert(misinfoChecks).values({
      id: uuidv4(),
      messageHash: crypto.createHash('sha256').update(message).digest('hex'),
      verdict: result.verdict,
      explanation: result.explanation,
      sources: result.sources,
      language: 'en',
      responseMs: result.responseMs,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to log misinfo check');
  }
}
