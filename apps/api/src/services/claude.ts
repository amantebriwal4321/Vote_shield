import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

export type Intent = 'CHECK_ROLL' | 'REPORT_INCIDENT' | 'FIRST_VOTER' | 'MISINFO_CHECK' | 'TICKET_STATUS' | 'HELP' | 'UNKNOWN';
export type IncidentCategory = 'INTIMIDATION' | 'CASH_FOR_VOTE' | 'BOOTH_CAPTURE' | 'IMPERSONATION' | 'OTHER';

export interface Message { role: 'user' | 'assistant'; content: string; }
export interface TriageResult { category: IncidentCategory; urgency: 1 | 2 | 3 | 4 | 5; summary: string; requiredAction: string; location?: string; }
export interface MisinfoResult { verdict: 'TRUE' | 'FALSE' | 'MISLEADING' | 'UNVERIFIABLE'; explanation: string; sources: string[]; confidence: number; }
export interface FirstVoterStepResult { message: string; nextStep: number | null; options?: string[]; }

const MODEL = 'claude-sonnet-4-20250514';
let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (client) return client;
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) { logger.warn('ANTHROPIC_API_KEY not set'); return null; }
  client = new Anthropic({ apiKey });
  return client;
}

const useMockAI = (): boolean => process.env['DEMO_MODE'] === 'true' && !process.env['ANTHROPIC_API_KEY'];

function mockDetectIntent(message: string): { intent: Intent; language: string } {
  const l = message.toLowerCase().trim();
  
  // Basic mock language detection
  let lang = 'en';
  if (/pehli baar|mujhe vote|sahayata|madad|sach hai|kya|hai|paise/i.test(l)) lang = 'hi';
  else if (/vannakam|nandri|eppadi/i.test(l)) lang = 'ta';
  else if (/namaskaram|ela/i.test(l)) lang = 'te';
  else if (/nomoshkar|kemon/i.test(l)) lang = 'bn';

  if (/^5|^vs-/i.test(l) || /status.*vs-/i.test(l)) return { intent: 'TICKET_STATUS', language: lang };
  if (/^3|new voter|first time|pehli baar|mujhe vote/i.test(l)) return { intent: 'FIRST_VOTER', language: lang };
  if (/^1|check.*voter|voter.*id|[a-z]{3}\d{7}/i.test(l)) return { intent: 'CHECK_ROLL', language: lang };
  if (/^2|intimidat|bribe|cash.*vote|booth.*captur|threaten|offering money|paise/i.test(l)) return { intent: 'REPORT_INCIDENT', language: lang };
  if (/^4|is this true|fake|forward|rumour|sach hai/i.test(l)) return { intent: 'MISINFO_CHECK', language: lang };
  if (/help|menu|\?\?|sahayata|madad/i.test(l)) return { intent: 'HELP', language: lang };
  
  if (message.length > 100) return { intent: 'MISINFO_CHECK', language: lang };
  return { intent: 'UNKNOWN', language: lang };
}

export async function detectIntent(message: string, history: Message[]): Promise<{ intent: Intent; language: string }> {
  const anthropic = getClient();
  if (!anthropic || useMockAI()) return mockDetectIntent(message);
  try {
    const response = await anthropic.messages.create({
      model: MODEL, max_tokens: 1024,
      system: `You are VoteShield's intent and language classifier. Classify into exactly one intent: CHECK_ROLL, REPORT_INCIDENT, FIRST_VOTER, MISINFO_CHECK, TICKET_STATUS, HELP, UNKNOWN. Also detect the language code (e.g. en, hi, ta). Respond ONLY in JSON: {"intent": "...", "language": "..."}`,
      messages: [...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })), { role: 'user', content: message }],
    });
    const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '{}';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return mockDetectIntent(message);
    const parsed = JSON.parse(m[0]);
    const valid: Intent[] = ['CHECK_ROLL','REPORT_INCIDENT','FIRST_VOTER','MISINFO_CHECK','TICKET_STATUS','HELP','UNKNOWN'];
    return {
      intent: valid.includes(parsed.intent as Intent) ? (parsed.intent as Intent) : 'UNKNOWN',
      language: parsed.language || 'en'
    };
  } catch (err) { logger.error({ err }, 'detectIntent failed'); return mockDetectIntent(message); }
}

export async function triageIncident(description: string, location?: string): Promise<TriageResult> {
  const anthropic = getClient();
  const mock = (): TriageResult => {
    const l = description.toLowerCase();
    let cat: IncidentCategory = 'OTHER', urg: TriageResult['urgency'] = 3;
    if (/intimidat|threaten/i.test(l)) { cat = 'INTIMIDATION'; urg = 4; }
    else if (/cash|money|bribe/i.test(l)) { cat = 'CASH_FOR_VOTE'; urg = 3; }
    else if (/booth.*captur/i.test(l)) { cat = 'BOOTH_CAPTURE'; urg = 5; }
    else if (/impersonat|fake.*vot/i.test(l)) { cat = 'IMPERSONATION'; urg = 4; }
    return { category: cat, urgency: urg, summary: `${cat} incident reported`, requiredAction: urg >= 4 ? 'Deploy flying squad immediately' : 'Send patrol to verify', location };
  };
  if (!anthropic || useMockAI()) return mock();
  try {
    const r = await anthropic.messages.create({
      model: MODEL, max_tokens: 1024,
      system: `Classify this election incident. Respond JSON only: {"category":"INTIMIDATION|CASH_FOR_VOTE|BOOTH_CAPTURE|IMPERSONATION|OTHER","urgency":1-5,"summary":"...","requiredAction":"...","location":"..."}`,
      messages: [{ role: 'user', content: `Report: ${description}${location ? ` Location: ${location}` : ''}` }],
    });
    const t = r.content[0]?.type === 'text' ? r.content[0].text : '';
    const m = t.match(/\{[\s\S]*\}/);
    if (!m?.[0]) return mock();
    const p = JSON.parse(m[0]) as TriageResult;
    return { category: p.category || 'OTHER', urgency: (Math.min(5, Math.max(1, p.urgency || 3)) as TriageResult['urgency']), summary: p.summary || 'Incident reported', requiredAction: p.requiredAction || 'Investigate', location: p.location || location };
  } catch (err) { logger.error({ err }, 'triageIncident failed'); return mock(); }
}

export async function checkMisinfo(forwardedMessage: string, language: string): Promise<MisinfoResult> {
  const mock = (): MisinfoResult => {
    const l = forwardedMessage.toLowerCase();
    if (/online.*vot|phone.*vot/i.test(l)) return { verdict: 'FALSE', explanation: '❌ FALSE. India uses EVMs only. No online voting.', sources: ['https://eci.gov.in/faqs'], confidence: 0.95 };
    if (/holiday.*cancel|election.*postpone/i.test(l)) return { verdict: 'MISLEADING', explanation: '⚠️ MISLEADING. Verify from official ECI website.', sources: ['https://eci.gov.in/schedule'], confidence: 0.7 };
    return { verdict: 'UNVERIFIABLE', explanation: '🔍 Could not verify. Check official ECI website.', sources: ['https://eci.gov.in'], confidence: 0.3 };
  };
  const anthropic = getClient();
  if (!anthropic || useMockAI()) return mock();
  try {
    const r = await anthropic.messages.create({
      model: MODEL, max_tokens: 2048,
      system: `Fact-check this election message for India. Respond JSON: {"verdict":"TRUE|FALSE|MISLEADING|UNVERIFIABLE","explanation":"in ${language}","sources":["urls"],"confidence":0-1}`,
      messages: [{ role: 'user', content: forwardedMessage }],
    });
    const t = r.content[0]?.type === 'text' ? r.content[0].text : '';
    const m = t.match(/\{[\s\S]*\}/);
    if (!m?.[0]) return mock();
    const p = JSON.parse(m[0]) as MisinfoResult;
    return { verdict: p.verdict || 'UNVERIFIABLE', explanation: p.explanation || 'Unable to verify.', sources: p.sources || [], confidence: Math.min(1, Math.max(0, p.confidence || 0.5)) };
  } catch (err) { logger.error({ err }, 'checkMisinfo failed'); return mock(); }
}

export async function firstVoterStep(step: number, userInput: string, language: string): Promise<FirstVoterStepResult> {
  const anthropic = getClient();
  if (!anthropic || useMockAI()) return mockFirstVoterStep(step, language);
  try {
    const steps: Record<number, string> = { 0:'Welcome + language selection', 1:'Ask for Voter ID', 2:'Registration help', 3:'Booth finder', 4:'What to bring', 5:'How to use EVM', 6:'Name missing help', 7:'Completion' };
    const r = await anthropic.messages.create({
      model: MODEL, max_tokens: 1024,
      system: `You are VoteShield first-voter guide, step ${step}/7: ${steps[step] || ''}. Language: ${language}. JSON: {"message":"...","nextStep":N|null,"options":["..."]}`,
      messages: [{ role: 'user', content: userInput || 'start' }],
    });
    const t = r.content[0]?.type === 'text' ? r.content[0].text : '';
    const m = t.match(/\{[\s\S]*\}/);
    if (!m?.[0]) return mockFirstVoterStep(step, language);
    return JSON.parse(m[0]) as FirstVoterStepResult;
  } catch (err) { logger.error({ err }, 'firstVoterStep failed'); return mockFirstVoterStep(step, language); }
}

function mockFirstVoterStep(step: number, language: string): FirstVoterStepResult {
  const hi = language === 'hi';
  const s: Record<number, FirstVoterStepResult> = {
    0: { message: hi ? '🗳️ VoteShield में स्वागत है! भाषा चुनें:' : '🗳️ Welcome to VoteShield! Choose your language:', nextStep: 1, options: ['Hindi','English','Tamil','Telugu','Bengali','Marathi','Kannada','Malayalam','Gujarati','Odia','Punjabi','Assamese'] },
    1: { message: hi ? '📋 क्या आप मतदाता सूची में पंजीकृत हैं? Voter ID भेजें या NO लिखें।' : '📋 Are you registered? Send your Voter ID or type NO.', nextStep: 2 },
    2: { message: hi ? '📝 पंजीकरण: nvsp.in पर Form 6 भरें।' : '📝 Register at nvsp.in using Form 6.', nextStep: 3 },
    3: { message: hi ? '📍 अपना पता भेजें, हम मतदान केंद्र बताएंगे।' : '📍 Send your address to find your polling booth.', nextStep: 4 },
    4: { message: hi ? '🪪 Voter ID या आधार/पासपोर्ट/ड्राइविंग लाइसेंस लाएं।' : '🪪 Bring Voter ID or Aadhaar/Passport/DL.', nextStep: 5 },
    5: { message: hi ? '🖲️ EVM पर उम्मीदवार के नाम के आगे नीला बटन दबाएं।' : '🖲️ Press the blue button next to your candidate on the EVM.', nextStep: 6 },
    6: { message: hi ? '🆘 Presiding Officer से Form 7 मांगें। हेल्पलाइन: 1800-111-950' : '🆘 Ask Presiding Officer for Form 7. Helpline: 1800-111-950', nextStep: 7 },
    7: { message: hi ? '🎉 तैयार हैं! लोकतंत्र को आपकी ज़रूरत है! 🇮🇳' : '🎉 You\'re all set! Democracy needs YOU! 🇮🇳', nextStep: null },
  };
  return s[step] || s[7]!;
}

export async function generateLocalResponse(template: string, data: Record<string, string>, language: string): Promise<string> {
  let response = template;
  for (const [key, value] of Object.entries(data)) { response = response.replace(new RegExp(`\\{${key}\\}`, 'g'), value); }
  
  if (language !== 'en') {
    const anthropic = getClient();
    if (anthropic && !useMockAI()) {
      try {
        const r = await anthropic.messages.create({ model: MODEL, max_tokens: 1024, system: `Translate to ${language}. Return only translated text.`, messages: [{ role: 'user', content: response }] });
        return r.content[0]?.type === 'text' ? r.content[0].text : response;
      } catch (err) { logger.error({ err }, 'translation failed'); }
    } else {
      // Mock translation fallbacks for demo
      const t: Record<string, Record<string, string>> = {
        'hi': {
          'Choose an option': 'एक विकल्प चुनें',
          'CHECK ROLL': 'वोटर लिस्ट चेक करें',
          'REPORT': 'शिकायत दर्ज करें',
          'NEW VOTER': 'नया वोटर',
          'FACT CHECK': 'फैक्ट चेक',
          'Please send your Voter ID': 'कृपया अपना वोटर आईडी भेजें',
          'Incident Reported': 'शिकायत दर्ज हो गई',
          'Your report has been sent': 'आपकी रिपोर्ट भेज दी गई है',
          'Checking... Please wait': 'जांच कर रहे हैं... कृपया प्रतीक्षा करें'
        },
        'ta': {
          'Choose an option': 'ஒரு விருப்பத்தை தேர்ந்தெடுக்கவும்',
          'CHECK ROLL': 'வாக்காளர் பட்டியல் சரிபார்க்கவும்',
          'REPORT': 'புகார் அளிக்க',
          'NEW VOTER': 'புதிய வாக்காளர்',
          'FACT CHECK': 'உண்மை சரிபார்ப்பு',
          'Please send your Voter ID': 'உங்கள் வாக்காளர் அடையாளத்தை அனுப்பவும்',
          'Incident Reported': 'புகார் பதிவு செய்யப்பட்டது',
          'Your report has been sent': 'உங்கள் அறிக்கை அனுப்பப்பட்டது',
          'Checking... Please wait': 'சரிபார்க்கிறது... காத்திருக்கவும்'
        },
        'te': {
          'Choose an option': 'ఒక ఎంపికను ఎంచుకోండి',
          'CHECK ROLL': 'ఓటరు జాబితా తనిఖీ చేయండి',
          'REPORT': 'ఫిర్యాదు చేయండి',
          'NEW VOTER': 'కొత్త ఓటరు',
          'FACT CHECK': 'వాస్తవ తనిఖీ',
          'Please send your Voter ID': 'దయచేసి మీ ఓటరు ID ని పంపండి',
          'Incident Reported': 'ఫిర్యాదు నమోదైంది',
          'Your report has been sent': 'మీ నివేదిక పంపబడింది',
          'Checking... Please wait': 'తనిఖీ చేస్తోంది... దయచేసి వేచి ఉండండి'
        },
        'bn': {
          'Choose an option': 'একটি বিকল্প চয়ন করুন',
          'CHECK ROLL': 'ভোটার তালিকা চেক করুন',
          'REPORT': 'অভিযোগ করুন',
          'NEW VOTER': 'নতুন ভোটার',
          'FACT CHECK': 'তথ্য যাচাই',
          'Please send your Voter ID': 'অনুগ্রহ করে আপনার ভোটার আইডি পাঠান',
          'Incident Reported': 'অভিযোগ দায়ের করা হয়েছে',
          'Your report has been sent': 'আপনার রিপোর্ট পাঠানো হয়েছে',
          'Checking... Please wait': 'চেক করা হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন'
        }
      };

      if (t[language]) {
        for (const [eng, loc] of Object.entries(t[language])) {
          response = response.replace(new RegExp(eng, 'gi'), loc);
        }
      }
    }
  }
  return response;
}
