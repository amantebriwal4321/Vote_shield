import { Router, Request, Response } from 'express';
import { detectIntent } from '../services/claude';
import type { Message } from '../services/claude';
import { getSession, setSession } from '../services/redis';
import { checkVoterRegistration } from '../services/voterRoll';
import { reportIncident, getTicketStatus } from '../services/incidentRouter';
import { checkForwardedMessage } from '../services/misinfoChecker';
import { logger } from '../utils/logger';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { Body: body, From: from } = req.body as { Body?: string; From?: string };
    if (!body || !from) { res.status(400).json({ error: 'Missing fields' }); return; }

    const session = await getSession(from);
    const history: Message[] = (session['history'] as Message[]) ?? [];
    const { intent } = await detectIntent(body, history);

    let response: string;

    switch (intent) {
      case 'CHECK_ROLL': {
        const match = body.match(/[A-Z]{3}\d{7}/i);
        if (match?.[0]) {
          const result = await checkVoterRegistration(match[0]);
          response = result.message;
        } else {
          response = 'Send your Voter ID (e.g. ABC1234567) to check status.';
        }
        break;
      }
      case 'REPORT_INCIDENT': {
        const result = await reportIncident(body, from);
        response = `Incident reported! Ticket: ${result.ticket}. Flying squad notified. Your identity is protected.`;
        break;
      }
      case 'MISINFO_CHECK': {
        const result = await checkForwardedMessage(body, 'en');
        response = `Verdict: ${result.verdict}. ${result.explanation}`;
        break;
      }
      case 'TICKET_STATUS': {
        const ticketMatch = body.match(/VS-[\w-]+/i);
        if (ticketMatch?.[0]) {
          const status = await getTicketStatus(ticketMatch[0]);
          response = status.found ? `Ticket ${status.ticket}: ${status.status}` : 'Ticket not found.';
        } else {
          response = 'Send your ticket number (VS-XXXXXX).';
        }
        break;
      }
      default:
        response = 'VoteShield: Reply CHECK to verify voter ID, REPORT for incidents, NEW VOTER for guide. HELP for menu.';
    }

    const hist = (session['history'] as Message[]) ?? [];
    hist.push({ role: 'user', content: body }, { role: 'assistant', content: response });
    await setSession(from, { ...session, history: hist.slice(-10) });

    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${response}</Message></Response>`);
  } catch (err) {
    logger.error({ err }, 'SMS webhook error');
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>Error. Try again.</Message></Response>`);
  }
});

export default router;
