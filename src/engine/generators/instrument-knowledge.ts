// Grade 4 instrument_knowledge generator (instruments-4, KB grade4Adds
// instrument-facts content) — text-only recognition: name an instrument's
// family, name its usual clef, or match orchestral directions to their
// meanings. No notation (fixed music-fact recall, not a reading skill), so
// stimulus.music/text stay null for every instance — the question lives in
// `prompt` (term-meaning.ts's text-only pattern).
//
// Mirrors chord-recognition.ts's atom-scoped selection (one atom pins the
// question) and its own exported fixed-knowledge tables (INSTRUMENT_TABLE,
// FAMILIES, CLEFS_DISPLAY, DIRECTION_TABLE) for the validator to recompute
// against, never trusting the generator's own picks.

import { KB_VERSION } from '../../content/knowledge-base';
import {
  DIRECTIONS,
  directionAtom,
  INSTRUMENTS,
  instrumentClefAtom,
  instrumentClefUpperAtom,
  instrumentFamilyAtom,
  instrumentSoundAtom,
  parseAtom,
  VOICE_TYPES,
  voiceTypeAtom,
} from '../atoms';
import { int, mulberry32, pick } from '../rng';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

export const INSTRUMENT_TABLE: Record<string, { family: 'Strings' | 'Woodwind' | 'Brass' | 'Percussion'; clef: 'Treble' | 'Alto' | 'Bass' }> = {
  violin: { family: 'Strings', clef: 'Treble' },
  viola: { family: 'Strings', clef: 'Alto' },
  cello: { family: 'Strings', clef: 'Bass' },
  'double bass': { family: 'Strings', clef: 'Bass' },
  flute: { family: 'Woodwind', clef: 'Treble' },
  oboe: { family: 'Woodwind', clef: 'Treble' },
  clarinet: { family: 'Woodwind', clef: 'Treble' },
  bassoon: { family: 'Woodwind', clef: 'Bass' },
  trumpet: { family: 'Brass', clef: 'Treble' },
  horn: { family: 'Brass', clef: 'Treble' },
  trombone: { family: 'Brass', clef: 'Bass' },
  tuba: { family: 'Brass', clef: 'Bass' },
  timpani: { family: 'Percussion', clef: 'Bass' },
};

export const FAMILIES = ['Strings', 'Woodwind', 'Brass', 'Percussion'] as const;
export const CLEFS_DISPLAY = ['Treble', 'Alto', 'Bass'] as const;

// Grade 5 (chromaticly-ic5.3). Kept out of INSTRUMENT_TABLE's `clef`, so the
// grade-4 question is unchanged.
export const UPPER_CLEF_TABLE: Record<string, 'Tenor'> = {
  cello: 'Tenor',
  bassoon: 'Tenor',
  trombone: 'Tenor',
};

export const CLEFS_DISPLAY_G5 = ['Treble', 'Alto', 'Tenor', 'Bass'] as const;

// Grade 5 (chromaticly-e3z.16): "the basic way by which they produce sound".
export const SOUND_TABLE: Record<string, string> = {
  violin: 'a bowed string',
  viola: 'a bowed string',
  cello: 'a bowed string',
  'double bass': 'a bowed string',
  flute: 'air blown across an edge',
  oboe: 'a double reed',
  clarinet: 'a single reed',
  bassoon: 'a double reed',
  trumpet: 'lips buzzing into a mouthpiece',
  horn: 'lips buzzing into a mouthpiece',
  trombone: 'lips buzzing into a mouthpiece',
  tuba: 'lips buzzing into a mouthpiece',
  timpani: 'a struck skin',
};

/** An instrument that really uses each mechanism — the wrong answer's owner. */
export const MECHANISM_EXAMPLE: Record<string, string> = {
  'a bowed string': 'violin',
  'air blown across an edge': 'flute',
  'a single reed': 'clarinet',
  'a double reed': 'oboe',
  'lips buzzing into a mouthpiece': 'trumpet',
  'a struck skin': 'timpani',
};

export const SOUND_MECHANISMS = [
  'a bowed string',
  'air blown across an edge',
  'a single reed',
  'a double reed',
  'lips buzzing into a mouthpiece',
  'a struck skin',
] as const;

// Grade 5: "the types of voice". Three per group, highest first.
export const VOICE_TABLE: Record<string, { group: 'female' | 'male'; rank: 0 | 1 | 2 }> = {
  soprano: { group: 'female', rank: 0 },
  'mezzo-soprano': { group: 'female', rank: 1 },
  contralto: { group: 'female', rank: 2 },
  tenor: { group: 'male', rank: 0 },
  baritone: { group: 'male', rank: 1 },
  bass: { group: 'male', rank: 2 },
};

export const VOICE_RANK_WORD = ['highest', 'middle', 'lowest'] as const;

export const DIRECTION_TABLE: Record<string, string> = {
  arco: 'with the bow',
  pizzicato: 'plucked',
  'con sordino': 'with the mute',
  'senza sordino': 'without the mute',
  'col legno': 'with the wood of the bow',
  tremolo: 'rapidly repeated',
};

type QuestionAtom =
  | { kind: 'instrument_family'; instrument: string }
  | { kind: 'instrument_clef'; instrument: string }
  | { kind: 'instrument_clef_upper'; instrument: string }
  | { kind: 'instrument_sound'; instrument: string }
  | { kind: 'voice_type'; voice: string }
  | { kind: 'direction'; term: string };

/** The instrument_family:<x>, instrument_clef:<x>, and direction:<x> atoms in
 *  `atoms`, in atom order — mirrors chord-recognition.ts's numeralsFromAtoms,
 *  but keeps each atom's own kind rather than collapsing to one vocabulary. */
function questionAtomsFrom(atoms: string[]): QuestionAtom[] {
  const result: QuestionAtom[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind === 'instrument_clef_upper') {
      if (!(parts[0] in UPPER_CLEF_TABLE)) {
        throw new Error(`instrument_knowledge: the ${parts[0]} reads no second clef`);
      }
      result.push({ kind, instrument: parts[0] });
      continue;
    }
    if (kind === 'instrument_family' || kind === 'instrument_clef' || kind === 'instrument_sound') {
      const [inst] = parts;
      if (!(INSTRUMENTS as readonly string[]).includes(inst)) {
        throw new Error(`instrument_knowledge: atom "${atom}" names an unknown instrument`);
      }
      result.push({ kind, instrument: inst });
    } else if (kind === 'voice_type') {
      const [voice] = parts;
      if (!(VOICE_TYPES as readonly string[]).includes(voice)) {
        throw new Error(`instrument_knowledge: atom "${atom}" names an unknown voice`);
      }
      result.push({ kind, voice });
    } else if (kind === 'direction') {
      const [term] = parts;
      if (!(DIRECTIONS as readonly string[]).includes(term)) {
        throw new Error(`instrument_knowledge: atom "${atom}" names an unknown direction`);
      }
      result.push({ kind, term });
    }
  }
  if (result.length === 0) {
    throw new Error(
      'instrument_knowledge: needs at least one instrument_family:*, instrument_clef:*, instrument_sound:*, voice_type:*, or direction:* atom',
    );
  }
  return result;
}

/** The direction:* atoms in `atoms`, deduplicated in atom order, capped at 4
 *  (the drag_match's LOCKED UI contract caps the match at 4 pairs). */
function directionsFromAtoms(atoms: string[]): string[] {
  const terms: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'direction') continue;
    const [term] = parts;
    if (!(DIRECTIONS as readonly string[]).includes(term)) {
      throw new Error(`instrument_knowledge: atom "${atom}" names an unknown direction`);
    }
    if (!terms.includes(term)) terms.push(term);
  }
  return terms.slice(0, 4);
}

/** Fisher-Yates, driven by the generator's own seeded rng — no repo-wide
 *  shuffle helper exists yet (rng.ts only has pick/int/weighted), so this
 *  stays local, built on `int` the same way every other generator's small
 *  sampling helpers (e.g. ornament-recognition.ts's sampleDistinct) are. */
function shuffle<T>(rng: () => number, items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = int(rng, 0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** How each family makes its sound, and who reads each clef — the facts a wrong
 *  option is wrong about. */
const FAMILY_HOW: Record<string, string> = {
  Strings: 'bowed or plucked',
  Woodwind: 'blown through a reed or across an edge',
  Brass: 'blown through a cupped mouthpiece',
  Percussion: 'struck',
};

const CLEF_READERS: Record<string, string> = {
  Treble: 'the violin and the flute',
  Bass: 'the cello and the double bass',
  Alto: 'the viola',
};

// The prompt names the everyday clef, so the copy must not name it back.
const CLEF_READERS_G5: Record<string, string> = {
  Treble: 'the violin and the flute',
  Bass: 'the double bass and the tuba',
  Alto: 'the viola',
};

function buildFamilyMcq(idSeed: number, grade: number, inst: string): ExerciseInstance {
  const family = INSTRUMENT_TABLE[inst].family;
  const distractors = FAMILIES.filter((f) => f !== family);
  return {
    id: makeInstanceId('instrument_knowledge', grade, idSeed),
    template_id: 'instrument_knowledge',
    grade,
    strand: 'terms_signs',
    prompt: `Which family does the ${inst} belong to?`,
    stimulus: { music: null, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: family, accepted_alternatives: [] },
    distractors,
    hints: ['Think about how the sound is produced — bowed or plucked strings, blown reeds/air, brass tubing, or struck.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — the ${inst} is a ${family.toLowerCase()} instrument.`,
      by_distractor: Object.fromEntries(
        distractors.map((f) => [f, `${f} instruments are ${FAMILY_HOW[f]}. The ${inst} is ${family.toLowerCase()}.`]),
      ),
    },
    srs_tags: [instrumentFamilyAtom(inst)],
    kb_version: KB_VERSION,
  };
}

function buildClefMcq(idSeed: number, grade: number, inst: string): ExerciseInstance {
  const clef = INSTRUMENT_TABLE[inst].clef;
  const distractors = CLEFS_DISPLAY.filter((c) => c !== clef);
  return {
    id: makeInstanceId('instrument_knowledge', grade, idSeed),
    template_id: 'instrument_knowledge',
    grade,
    strand: 'terms_signs',
    prompt: `Which clef does the ${inst} usually read?`,
    stimulus: { music: null, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: clef, accepted_alternatives: [] },
    distractors,
    hints: ['Think about the instrument\'s usual pitch range.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — the ${inst} usually reads the ${clef.toLowerCase()} clef.`,
      by_distractor: Object.fromEntries(
        distractors.map((c) => [
          c,
          `The ${c.toLowerCase()} clef suits ${CLEF_READERS[c]}. The ${inst} usually reads ${clef.toLowerCase()}.`,
        ]),
      ),
    },
    srs_tags: [instrumentClefAtom(inst)],
    kb_version: KB_VERSION,
  };
}

// The prompt gives the everyday clef, so this is not the grade-4 question.
function buildUpperClefMcq(idSeed: number, grade: number, inst: string): ExerciseInstance {
  const clef = UPPER_CLEF_TABLE[inst];
  const everyday = INSTRUMENT_TABLE[inst].clef;
  const distractors = CLEFS_DISPLAY_G5.filter((c) => c !== clef && c !== everyday);
  return {
    id: makeInstanceId('instrument_knowledge', grade, idSeed),
    template_id: 'instrument_knowledge',
    grade,
    strand: 'terms_signs',
    prompt: `The ${inst} usually reads the ${everyday.toLowerCase()} clef. Which clef does it also read for its higher passages?`,
    stimulus: { music: null, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: clef, accepted_alternatives: [] },
    distractors,
    hints: ['A second clef exists to keep high notes on the stave instead of on ledger lines.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — the ${inst} reads the tenor clef for its higher passages.`,
      by_distractor: Object.fromEntries(
        distractors.map((c) => [
          c,
          `The ${c.toLowerCase()} clef suits ${CLEF_READERS_G5[c]}. The ${inst} moves to the tenor clef when the notes climb.`,
        ]),
      ),
    },
    srs_tags: [instrumentClefUpperAtom(inst)],
    kb_version: KB_VERSION,
  };
}

function buildDirectionMatch(rng: () => number, idSeed: number, grade: number, terms: string[]): ExerciseInstance {
  const meanings = shuffle(rng, terms.map((t) => DIRECTION_TABLE[t]));
  const canonical: Record<string, string> = {};
  for (const term of terms) canonical[term] = DIRECTION_TABLE[term];

  return {
    id: makeInstanceId('instrument_knowledge', grade, idSeed),
    template_id: 'instrument_knowledge',
    grade,
    strand: 'terms_signs',
    prompt: 'Match each direction to its meaning.',
    stimulus: { music: null, text: null },
    interaction: { type: 'drag_match', config: { left: terms, right: meanings } },
    answer: { canonical, accepted_alternatives: [] },
    distractors: [],
    hints: ['Arco/pizzicato and con sordino/senza sordino are opposite pairs — start there.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — check each direction against its meaning and try again.',
    },
    srs_tags: terms.map((t) => directionAtom(t)),
    kb_version: KB_VERSION,
  };
}

function buildSoundMcq(rng: () => number, idSeed: number, grade: number, inst: string): ExerciseInstance {
  const mechanism = SOUND_TABLE[inst];
  const others = SOUND_MECHANISMS.filter((m) => m !== mechanism);
  const distractors = shuffle(rng, [...others]).slice(0, 3);
  return {
    id: makeInstanceId('instrument_knowledge', grade, idSeed),
    template_id: 'instrument_knowledge',
    grade,
    strand: 'terms_signs',
    prompt: `How does the ${inst} produce its sound?`,
    stimulus: { music: null, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: mechanism, accepted_alternatives: [] },
    distractors,
    hints: ['Picture the player. What is actually vibrating — a string, a reed, a column of air, the lips, or a skin?'],
    feedback: {
      correct: 'Correct!',
      incorrect: `The ${inst} sounds through ${mechanism}.`,
      by_distractor: Object.fromEntries(
        distractors.map((d) => [d, `That is how the ${MECHANISM_EXAMPLE[d]} sounds. The ${inst} uses ${mechanism}.`]),
      ),
    },
    srs_tags: [instrumentSoundAtom(inst)],
    kb_version: KB_VERSION,
  };
}

function buildVoiceMcq(rng: () => number, idSeed: number, grade: number, voice: string): ExerciseInstance {
  const { group, rank } = VOICE_TABLE[voice];
  const sameGroup = VOICE_TYPES.filter((v) => v !== voice && VOICE_TABLE[v].group === group);
  const otherGroup = VOICE_TYPES.filter((v) => VOICE_TABLE[v].group !== group);
  const distractors = [...sameGroup, pick(rng, [...otherGroup])];
  return {
    id: makeInstanceId('instrument_knowledge', grade, idSeed),
    template_id: 'instrument_knowledge',
    grade,
    strand: 'terms_signs',
    prompt: `Which is the ${VOICE_RANK_WORD[rank]} ${group} voice?`,
    stimulus: { music: null, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: voice, accepted_alternatives: [] },
    distractors,
    hints: ['Each group holds three voices. Name them from the top down before you choose.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `The ${VOICE_RANK_WORD[rank]} ${group} voice is the ${voice}.`,
      by_distractor: Object.fromEntries(
        distractors.map((d) => [
          d,
          VOICE_TABLE[d].group === group
            ? `The ${d} is the ${VOICE_RANK_WORD[VOICE_TABLE[d].rank]} ${group} voice, not the ${VOICE_RANK_WORD[rank]}.`
            : `The ${d} is a ${VOICE_TABLE[d].group} voice, so it is in the other group.`,
        ]),
      ),
    },
    srs_tags: [voiceTypeAtom(voice)],
    kb_version: KB_VERSION,
  };
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const selected = pick(rng, questionAtomsFrom(atoms));

  if (selected.kind === 'instrument_family') return buildFamilyMcq(idSeed, grade, selected.instrument);
  if (selected.kind === 'instrument_clef') return buildClefMcq(idSeed, grade, selected.instrument);
  if (selected.kind === 'instrument_clef_upper') return buildUpperClefMcq(idSeed, grade, selected.instrument);
  if (selected.kind === 'instrument_sound') return buildSoundMcq(rng, idSeed, grade, selected.instrument);
  if (selected.kind === 'voice_type') return buildVoiceMcq(rng, idSeed, grade, selected.voice);
  return buildDirectionMatch(rng, idSeed, grade, directionsFromAtoms(atoms));
}

export const instrumentKnowledge: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
