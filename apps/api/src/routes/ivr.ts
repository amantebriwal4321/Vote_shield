import { Router, Request, Response } from 'express';
import { reportIncident } from '../services/incidentRouter';
import { logger } from '../utils/logger';

const router = Router();

// ─── Incoming call — IVR menu ────────────────────────────────────
router.post('/', (_req: Request, res: Response) => {
  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" action="/api/ivr/handle" method="POST" timeout="10">
    <Say language="hi-IN" voice="Polly.Aditi">
      VoteShield mein aapka swagat hai.
      Shikayat darj karne ke liye 1 dabaye.
      Voter registration check karne ke liye 2 dabaye.
      Pehli baar matdaan guide ke liye 3 dabaye.
    </Say>
  </Gather>
  <Say language="hi-IN" voice="Polly.Aditi">
    Koi input nahi mila. Kripya dobara call karein.
  </Say>
</Response>`);
});

// ─── Handle DTMF input ──────────────────────────────────────────
router.post('/handle', (req: Request, res: Response) => {
  const digits = (req.body as { Digits?: string }).Digits;
  const from = (req.body as { From?: string }).From ?? 'unknown';

  logger.info({ digits, from: from.slice(-4) }, 'IVR input received');

  res.type('text/xml');

  switch (digits) {
    case '1':
      // Record incident via voice
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="hi-IN" voice="Polly.Aditi">
    Kripya apni shikayat record karein. Beep ke baad bolein.
  </Say>
  <Record maxLength="120" action="/api/ivr/incident" method="POST" transcribe="true" transcribeCallback="/api/ivr/transcription" />
  <Say language="hi-IN" voice="Polly.Aditi">
    Koi recording nahi mili. Kripya dobara try karein.
  </Say>
</Response>`);
      break;

    case '2':
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="10" action="/api/ivr/check-voter" method="POST" timeout="15">
    <Say language="hi-IN" voice="Polly.Aditi">
      Kripya apna Voter ID number darj karein.
    </Say>
  </Gather>
</Response>`);
      break;

    case '3':
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="hi-IN" voice="Polly.Aditi">
    Pehli baar matdaan guide: Sabse pehle, nvsp.in par jakar Form 6 bharen.
    Matdaan ke din Voter ID ya Aadhaar card lekar jayen.
    EVM machine par apne candidate ke saamne neela button dabayein.
    Agar aapka naam suchi mein nahi hai, toh Presiding Officer se Form 7 maangein.
    ECI helpline: 1800-111-950. VoteShield aapke saath hai. Jai Hind!
  </Say>
</Response>`);
      break;

    default:
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="hi-IN" voice="Polly.Aditi">
    Galat input. Kripya 1, 2, ya 3 mein se koi ek dabayein.
  </Say>
  <Redirect method="POST">/api/ivr</Redirect>
</Response>`);
  }
});

// ─── Handle voice recording for incident ─────────────────────────
router.post('/incident', async (req: Request, res: Response) => {
  const from = (req.body as { From?: string }).From ?? 'unknown';
  const recordingUrl = (req.body as { RecordingUrl?: string }).RecordingUrl;

  logger.info({ from: from.slice(-4), recordingUrl }, 'Voice incident received');

  // Create incident with recording URL as description
  const result = await reportIncident(
    `[Voice Report] Recording: ${recordingUrl ?? 'unavailable'}`,
    from,
  );

  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="hi-IN" voice="Polly.Aditi">
    Aapki shikayat darj ho gayi hai. Aapka ticket number hai: ${result.ticket.split('').join(' ')}.
    Flying squad ko suchit kar diya gaya hai. Dhanyavaad.
  </Say>
</Response>`);
});

// ─── Handle transcription callback ───────────────────────────────
router.post('/transcription', async (req: Request, res: Response) => {
  const transcriptionText = (req.body as { TranscriptionText?: string }).TranscriptionText;
  const from = (req.body as { From?: string }).From ?? 'unknown';

  if (transcriptionText) {
    logger.info({ from: from.slice(-4) }, 'Transcription received');
    await reportIncident(transcriptionText, from);
  }

  res.status(200).send('OK');
});

// ─── Check voter via IVR ─────────────────────────────────────────
router.post('/check-voter', (_req: Request, res: Response) => {
  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="hi-IN" voice="Polly.Aditi">
    Voter ID check karne ke liye kripya VoteShield WhatsApp number par apna Voter ID bhejein.
    Dhanyavaad.
  </Say>
</Response>`);
});

export default router;
