import { firstVoterStep as claudeFirstVoterStep } from './claude';
import { getSession, setSession } from './redis';
import { detectLanguageFromName } from './translate';
import { logger } from '../utils/logger';

export interface FirstVoterSession {
  step: number;
  language: string;
  voterId?: string;
}

const SESSION_KEY = (phone: string) => phone; // Redis key includes prefix in redis.ts

export async function handleFirstVoter(
  phone: string,
  userInput: string,
): Promise<string> {
  // Get or create session
  const session = await getSession(phone);
  const fvSession: FirstVoterSession = {
    step: typeof session['firstVoterStep'] === 'number' ? session['firstVoterStep'] as number : 0,
    language: (session['language'] as string) ?? 'en',
    voterId: session['voterId'] as string | undefined,
  };

  // Handle language selection on step 0
  if (fvSession.step === 0 || fvSession.step === 1) {
    const langCode = detectLanguageFromName(userInput);
    if (langCode !== 'en' || userInput.toLowerCase() === 'english') {
      fvSession.language = langCode;
    }
  }

  // Handle voter ID on step 1
  if (fvSession.step === 1 && userInput.toUpperCase() !== 'NO') {
    const voterIdMatch = userInput.match(/[A-Z]{3}\d{7}/i);
    if (voterIdMatch) {
      fvSession.voterId = voterIdMatch[0]?.toUpperCase();
    }
  }

  try {
    const result = await claudeFirstVoterStep(fvSession.step, userInput, fvSession.language);

    // Update session
    if (result.nextStep !== null) {
      await setSession(phone, {
        ...session,
        intent: 'FIRST_VOTER',
        firstVoterStep: result.nextStep,
        language: fvSession.language,
        voterId: fvSession.voterId,
      });
    } else {
      // Flow complete — clear first voter session but keep language
      await setSession(phone, {
        ...session,
        intent: undefined,
        firstVoterStep: undefined,
        language: fvSession.language,
      });
    }

    return result.message + (result.options ? '\n\n' + result.options.join(' | ') : '');
  } catch (err) {
    logger.error({ err }, 'First voter guide error');
    return 'Sorry, something went wrong. Please try again by sending "NEW VOTER".';
  }
}
