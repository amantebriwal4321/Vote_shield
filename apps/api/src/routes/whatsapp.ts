import { Router, Request, Response } from 'express';
import { detectIntent } from '../services/claude';
import type { Message } from '../services/claude';
import { getSession, setSession } from '../services/redis';
import { validateTwilioSignature } from '../services/twilio';
import { checkVoterRegistration } from '../services/voterRoll';
import { reportIncident, getTicketStatus } from '../services/incidentRouter';
import { checkForwardedMessage } from '../services/misinfoChecker';
import { handleFirstVoter } from '../services/firstVoterGuide';
import { logger } from '../utils/logger';

const router = Router();

const HELP_MESSAGE = `🛡️ *VoteShield* — Your Election Guardian

Choose an option:
1️⃣ *CHECK ROLL* — Verify your voter registration
2️⃣ *REPORT* — Report an election violation
3️⃣ *NEW VOTER* — First-time voter guide
4️⃣ *FACT CHECK* — Forward a message to verify
5️⃣ *VS-XXXXXX* — Check complaint status

Just type your choice or send any message!
🇮🇳 Available in 12 Indian languages`;

router.post('/', async (req: Request, res: Response) => {
  try {
    const { Body: body, From: from, To: to, Language: reqLanguage } = req.body as { Body?: string; From?: string; To?: string; Language?: string };

    if (!body || !from) {
      res.status(400).send('<Response><Message>Invalid request</Message></Response>');
      return;
    }

    // Validate Twilio signature (skip in demo)
    const sig = req.headers['x-twilio-signature'] as string;
    if (sig && process.env['TWILIO_AUTH_TOKEN']) {
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      if (!validateTwilioSignature(url, req.body as Record<string, string>, sig)) {
        res.status(403).send('<Response><Message>Unauthorized</Message></Response>');
        return;
      }
    }

    // Get session & history
    const session = await getSession(from);
    const history: Message[] = (session['history'] as Message[]) ?? [];
    let language = reqLanguage || ((session['language'] as string) ?? 'en');
    
    // Save language to session if passed via Simulator UI
    if (reqLanguage) {
      await setSession(from, { ...session, language });
    }

    // Check if in first-voter flow
    if (session['intent'] === 'FIRST_VOTER' && typeof session['firstVoterStep'] === 'number') {
      const response = await handleFirstVoter(from, body);
      await updateHistory(from, session, body, response);
      sendTwiml(res, response);
      return;
    }

    // Detect intent & language
    const { intent, language: detectedLang } = await detectIntent(body, history);
    logger.info({ from: from.slice(-4), intent, lang: detectedLang }, 'Intent detected');
    
    // Override language if detected naturally from text
    if (detectedLang !== 'en' && !reqLanguage) {
      language = detectedLang;
      await setSession(from, { ...session, language });
    }

    let response: string;

    switch (intent) {
      case 'CHECK_ROLL': {
        const voterIdMatch = body.match(/[A-Z]{3}\d{7}/i);
        if (voterIdMatch?.[0]) {
          const result = await checkVoterRegistration(voterIdMatch[0]);
          response = result.message;
        } else {
          response = '📋 Please send your Voter ID (EPIC number) to check.\nFormat: ABC1234567';
          await setSession(from, { ...session, intent: 'CHECK_ROLL' });
        }
        break;
      }
      case 'REPORT_INCIDENT': {
        const result = await reportIncident(body, from);
        response = `🚨 *Incident Reported*\n\nTicket: *${result.ticket}*\nCategory: ${result.category}\nUrgency: ${'🔴'.repeat(result.urgency)}\n\nYour report has been sent to the nearest flying squad. Save your ticket number to check status.\n\n_Your identity is protected — we store no personal information._`;
        break;
      }
      case 'FIRST_VOTER': {
        const fvResponse = await handleFirstVoter(from, body);
        response = fvResponse;
        break;
      }
      case 'MISINFO_CHECK': {
        response = '🔍 Checking... Please wait up to 30 seconds.';
        const result = await checkForwardedMessage(body, language);
        const verdictEmoji: Record<string, string> = { TRUE: '✅', FALSE: '❌', MISLEADING: '⚠️', UNVERIFIABLE: '🔍' };
        response = `${verdictEmoji[result.verdict] ?? '🔍'} *Verdict: ${result.verdict}*\n\n${result.explanation}\n\n📊 Confidence: ${Math.round(result.confidence * 100)}%\n⏱️ Checked in ${result.responseMs}ms\n\n📎 Sources: ${result.sources.join(', ') || 'N/A'}`;
        break;
      }
      case 'TICKET_STATUS': {
        const ticketMatch = body.match(/VS-[\w-]+/i);
        if (ticketMatch?.[0]) {
          const status = await getTicketStatus(ticketMatch[0]);
          response = status.found
            ? `📋 *Ticket: ${status.ticket}*\nStatus: ${status.status}\nCategory: ${status.category}\nUrgency: ${status.urgency}/5`
            : `❌ Ticket ${ticketMatch[0]} not found. Please check the number.`;
        } else {
          response = '📋 Please send your ticket number (format: VS-XXXXXXXX-XXXXXX)';
        }
        break;
      }
      case 'HELP':
      default:
        response = HELP_MESSAGE;
        break;
    }

    // Translate if necessary (except first voter and misinfo which handle their own translation)
    if (intent !== 'FIRST_VOTER' && intent !== 'MISINFO_CHECK' && language !== 'en') {
      const { generateLocalResponse } = await import('../services/claude');
      response = await generateLocalResponse(response, {}, language);
    }

    await updateHistory(from, session, body, response);
    sendTwiml(res, response);
  } catch (err) {
    logger.error({ err }, 'WhatsApp webhook error');
    sendTwiml(res, 'Sorry, something went wrong. Please try again.');
  }
});

async function updateHistory(phone: string, session: Record<string, unknown>, userMsg: string, botMsg: string): Promise<void> {
  const history = (session['history'] as Message[]) ?? [];
  history.push({ role: 'user', content: userMsg }, { role: 'assistant', content: botMsg });
  // Keep last 10 messages
  const trimmed = history.slice(-10);
  await setSession(phone, { ...session, history: trimmed });
}

function sendTwiml(res: Response, message: string): void {
  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`);
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default router;
