import { logger } from '../utils/logger';

const HF_API_URL = 'https://api-inference.huggingface.co/models/ai4bharat/IndicTrans2-en-indic-dist-200M';

export const SUPPORTED_LANGUAGES: Record<string, string> = {
  hi: 'Hindi', en: 'English', ta: 'Tamil', te: 'Telugu',
  bn: 'Bengali', mr: 'Marathi', kn: 'Kannada', ml: 'Malayalam',
  gu: 'Gujarati', or: 'Odia', pa: 'Punjabi', as: 'Assamese',
};

export const LANGUAGE_NAMES_TO_CODES: Record<string, string> = {
  hindi: 'hi', english: 'en', tamil: 'ta', telugu: 'te',
  bengali: 'bn', marathi: 'mr', kannada: 'kn', malayalam: 'ml',
  gujarati: 'gu', odia: 'or', punjabi: 'pa', assamese: 'as',
};

export function detectLanguageFromName(name: string): string {
  const lower = name.toLowerCase().trim();
  return LANGUAGE_NAMES_TO_CODES[lower] ?? 'en';
}

export async function translate(text: string, targetLang: string): Promise<string> {
  if (targetLang === 'en') return text;

  const hfToken = process.env['HF_API_TOKEN'];
  if (!hfToken) {
    logger.warn('HF_API_TOKEN not set — returning original text');
    return text;
  }

  try {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text,
        parameters: { src_lang: 'eng_Latn', tgt_lang: getLangCode(targetLang) },
      }),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Translation API failed');
      return text;
    }

    const result = await response.json() as Array<{ translation_text: string }>;
    return result[0]?.translation_text ?? text;
  } catch (err) {
    logger.error({ err }, 'Translation failed');
    return text;
  }
}

function getLangCode(lang: string): string {
  const map: Record<string, string> = {
    hi: 'hin_Deva', ta: 'tam_Taml', te: 'tel_Telu', bn: 'ben_Beng',
    mr: 'mar_Deva', kn: 'kan_Knda', ml: 'mal_Mlym', gu: 'guj_Gujr',
    or: 'ory_Orya', pa: 'pan_Guru', as: 'asm_Beng',
  };
  return map[lang] ?? 'hin_Deva';
}
