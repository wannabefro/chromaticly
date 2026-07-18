// Pedagogical glosses for the point dynamics (KTD3 stays render-only; this is the
// "what does it mean" the passage runner asks about, e.g. 8d's "what does the 𝆑 in
// bar 2 mean?"). UK terminology (quiet/loud), matching the design voice.

import type { Dynamic } from './types';

export interface DynamicGloss {
  /** The Italian term, spelled out — "forte", "mezzo-piano". */
  italian: string;
  /** Plain-language meaning used as the correct answer / feedback — "loud". */
  meaning: string;
}

export const DYNAMIC_GLOSS: Record<Dynamic, DynamicGloss> = {
  pp: { italian: 'pianissimo', meaning: 'very quiet' },
  p: { italian: 'piano', meaning: 'quiet' },
  mp: { italian: 'mezzo-piano', meaning: 'moderately quiet' },
  mf: { italian: 'mezzo-forte', meaning: 'moderately loud' },
  f: { italian: 'forte', meaning: 'loud' },
  ff: { italian: 'fortissimo', meaning: 'very loud' },
  sfz: { italian: 'sforzando', meaning: 'suddenly, strongly accented' },
};
