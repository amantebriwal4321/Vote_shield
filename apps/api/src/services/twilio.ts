import twilio from 'twilio';
import { logger } from '../utils/logger';

const accountSid = process.env['TWILIO_ACCOUNT_SID'];
const authToken = process.env['TWILIO_AUTH_TOKEN'];
const whatsappNumber = process.env['TWILIO_WHATSAPP_NUMBER'] ?? 'whatsapp:+14155238886';
const smsNumber = process.env['TWILIO_SMS_NUMBER'];
const voiceNumber = process.env['TWILIO_VOICE_NUMBER'];

let twilioClient: twilio.Twilio | null = null;

function getClient(): twilio.Twilio | null {
  if (twilioClient) return twilioClient;
  if (!accountSid || !authToken) {
    logger.warn('Twilio credentials not set — messages will be logged only');
    return null;
  }
  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

export async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  const client = getClient();
  if (!client) {
    logger.info({ to, body }, '[MOCK] WhatsApp message');
    return true;
  }
  try {
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    await client.messages.create({ from: whatsappNumber, to: toNumber, body });
    logger.info({ to }, 'WhatsApp sent');
    return true;
  } catch (err) {
    logger.error({ err, to }, 'WhatsApp send failed');
    return false;
  }
}

export async function sendSMS(to: string, body: string): Promise<boolean> {
  const client = getClient();
  if (!client || !smsNumber) {
    logger.info({ to, body }, '[MOCK] SMS message');
    return true;
  }
  try {
    await client.messages.create({ from: smsNumber, to, body });
    logger.info({ to }, 'SMS sent');
    return true;
  } catch (err) {
    logger.error({ err, to }, 'SMS send failed');
    return false;
  }
}

export function validateTwilioSignature(url: string, params: Record<string, string>, signature: string): boolean {
  if (!authToken) return true; // skip validation in demo mode
  try {
    return twilio.validateRequest(authToken, signature, url, params);
  } catch {
    return false;
  }
}

export function getVoiceNumber(): string {
  return voiceNumber ?? '';
}

export { twilio };
