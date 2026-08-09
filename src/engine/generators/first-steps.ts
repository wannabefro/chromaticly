// The five First steps generators (grade 0, chromaticly-dhe).
//
// They live in one file because they share one shape and one job: each is a
// small MCQ that DRILLS something Grade 1 states once and never practises. The
// level's whole constraint is practice-heavy and exposition-light, so these are
// deliberately the simplest generators in the engine.
//
// Every one of them reads its material from `scopeForGrade(opts.grade)` and is
// valid at every grade 0-5, never grade 0 alone. That is what lets them sit in
// the three generator ledgers unmodified: grade2-smoke.test.ts hands EVERY
// registered generator grade 2 and expects grade-2-valid content, and a
// grade-0-only generator would fail it and force a ledger exclusion list.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Duration, Music, Pitch } from '../../music/types';
import {
  ALPHABET_LETTERS,
  alphabetAtom,
  keyboardAtom,
  noteShapeAtom,
  pulseAtom,
  staveAnatomyAtom,
} from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Draw `count` distinct members of `pool` with the seeded RNG.
 *
 *  Never `.slice()`. Slicing a fixed list takes the same members every time, so
 *  the option SET leaks the answer however well assembleOptions shuffles the
 *  display: a value that can only appear when it is correct is a free mark. */
function sampleDistinct<T>(rng: () => number, pool: readonly T[], count: number): T[] {
  const remaining = [...pool];
  const drawn: T[] = [];
  while (drawn.length < count && remaining.length > 0) {
    drawn.push(remaining.splice(Math.floor(rng() * remaining.length), 1)[0]);
  }
  return drawn;
}

/** Pick from `pool`, falling back to the whole set when the caller's atom scope
 *  names nothing this template can serve. Practice hands a single due atom, so
 *  every one of these must survive a one-element pool. */
function scopeTo<T extends string>(atoms: string[], kind: string, all: readonly T[]): T[] {
  const named = atoms
    .filter((a) => a.startsWith(`${kind}:`))
    .map((a) => a.slice(kind.length + 1) as T)
    .filter((v) => all.includes(v));
  return named.length > 0 ? named : [...all];
}

// --- Lesson 1: pulse -------------------------------------------------------

/** Beats per bar the pulse question can ask about, intersected with the grade's
 *  own metres so the played bar is always one the grade actually teaches. */
function beatsPerBarFor(grade: number): number[] {
  const numerators = scopeForGrade(grade)
    .timeSignatures.map((sig) => Number(sig.split('/')[0]))
    .filter((n) => n >= 2 && n <= 4);
  return numerators.length > 0 ? [...new Set(numerators)].sort() : [4];
}

/** Lesson 1. Aural and notation-free by design: `stimulus.music` is null and the
 *  bar travels in `config.played_music`, so the learner counts what they hear
 *  rather than reading it. Grade 1 counts a beat before the learner has felt one;
 *  this is where they feel one. */
function buildPulseCount(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const scope = scopeForGrade(grade);
  const beats = pick(rng, beatsPerBarFor(grade));
  const pitch = pick(rng, diatonicPitchesInRange('treble', grade));

  const played: Music = {
    clef: 'treble',
    key_sig: null,
    time_sig: `${beats}/4`,
    voices: [{ events: Array.from({ length: beats }, () => ({ type: 'note' as const, pitch, dur: 'crotchet' as Duration })) }],
  };

  const distractors = [beats - 1, beats + 1].filter((n) => n >= 1 && n !== beats).map(String);

  return {
    id: makeInstanceId('pulse_count', grade, idSeed),
    template_id: 'pulse_count',
    grade,
    strand: 'rhythm',
    prompt: 'How many beats did you count?',
    stimulus: { music: null, text: null },
    interaction: {
      type: 'aural_mcq',
      config: { played_music: played, listen_prompt: 'Tap play and count the steady beats.' },
    },
    answer: { canonical: String(beats), accepted_alternatives: [] },
    distractors,
    hints: ['Tap your hand on each beat as it goes by, then count your taps.'],
    feedback: {
      correct: `Yes — ${beats} beats, each one the same length.`,
      incorrect: `There were ${beats} beats. Play it again and tap along before you count.`,
      by_distractor: Object.fromEntries(
        distractors.map((d) => [d, `That is one ${Number(d) < beats ? 'short' : 'too many'} — count again from the first beat.`]),
      ),
    },
    srs_tags: [pulseAtom()],
    kb_version: KB_VERSION,
  };
}

export const pulseCount: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildPulseCount(candidateSeed, opts.grade, opts.seed));

// --- Lesson 2: the musical alphabet ----------------------------------------

/** Lesson 2. Grade 1 states the wrap after G in a subordinate clause; this
 *  drills it. The wrap case is reachable from the ordinary question rather than
 *  special-cased, so a learner meets it as one letter among seven. */
function buildAlphabetStep(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const letters = scopeTo(atoms, 'alphabet', ALPHABET_LETTERS);
  const letter = pick(rng, letters);
  const index = ALPHABET_LETTERS.indexOf(letter);
  const up = rng() < 0.5;
  const answer = ALPHABET_LETTERS[(index + (up ? 1 : ALPHABET_LETTERS.length - 1)) % ALPHABET_LETTERS.length];

  // The two real mistakes: read the row backwards, or step twice.
  const step = (n: number) => ALPHABET_LETTERS[(index + n + ALPHABET_LETTERS.length * 2) % ALPHABET_LETTERS.length];
  const reversed = step(up ? -1 : 1);
  const overshot = step(up ? 2 : -2);
  const distractors = [reversed, overshot];

  return {
    id: makeInstanceId('alphabet_step', grade, idSeed),
    template_id: 'alphabet_step',
    grade,
    strand: 'pitch',
    prompt: `Which letter comes ${up ? 'after' : 'before'} ${letter}?`,
    stimulus: { music: null, text: ALPHABET_LETTERS.join(' ') },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: answer, accepted_alternatives: [] },
    distractors: [...distractors],
    hints: ['The letters run A to G and then start again at A — there is no H.'],
    feedback: {
      correct:
        letter === 'G' && up
          ? 'Yes — after G the letters start again at A. There is no H in music.'
          : `Yes — ${answer} comes ${up ? 'after' : 'before'} ${letter}.`,
      incorrect: `The letters run A B C D E F G and then back to A, so ${answer} comes ${up ? 'after' : 'before'} ${letter}.`,
      by_distractor: {
        [reversed]: `${reversed} comes ${up ? 'before' : 'after'} ${letter}. You read the row the wrong way.`,
        [overshot]: `${overshot} is two places ${up ? 'forward' : 'back'} from ${letter}. Step one, not two.`,
      },
    },
    srs_tags: [alphabetAtom(letter)],
    kb_version: KB_VERSION,
  };
}

export const alphabetStep: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildAlphabetStep(candidateSeed, opts.grade, opts.seed, opts.atoms ?? []));

// --- Lesson 3: the keyboard ------------------------------------------------

/** The white-key letters, in keyboard order from C — the order the learner sees
 *  them, not alphabetical order. */
const WHITE_LETTERS: readonly string[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Where each white key sits relative to the black-key groups. This is the
 *  landmark lesson 3 teaches: you find a note by the black keys around it, not by
 *  counting from the end of the keyboard. */
const KEYBOARD_LANDMARK: Record<string, string> = {
  C: 'just left of the group of two black keys',
  D: 'between the two black keys',
  E: 'just right of the group of two black keys',
  F: 'just left of the group of three black keys',
  G: 'between the first two of the three black keys',
  A: 'between the last two of the three black keys',
  B: 'just right of the group of three black keys',
};

/** Lesson 3. The only genuinely new material in the level — nothing in Grades
 *  1-5 shows where a note physically lives. Answered on the keyboard itself. */
function buildKeyboardFind(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const letter = pick(rng, scopeTo(atoms, 'keyboard', WHITE_LETTERS));
  const pitch = `${letter}4`;
  // The keyboard component draws C4..F5, so C D E F appear TWICE and both are
  // live keys. The atom is keyed by letter precisely because C4 and C5 are the
  // same answer to "where does C live", so the upper octave must be accepted —
  // otherwise a learner follows the hint, taps the nearer D, and is marked wrong
  // while being read back the exact landmark they used.
  const upperOctave = ['C', 'D', 'E', 'F'].includes(letter) ? [`${letter}5`] : [];

  return {
    id: makeInstanceId('keyboard_find', grade, idSeed),
    template_id: 'keyboard_find',
    grade,
    strand: 'pitch',
    prompt: `Find ${letter} on the keyboard.`,
    stimulus: { music: null, text: letter },
    interaction: { type: 'keyboard_tap', config: {} },
    answer: { canonical: pitch, accepted_alternatives: upperOctave },
    distractors: [],
    hints: [`${letter} is ${KEYBOARD_LANDMARK[letter]}.`],
    feedback: {
      correct: `That is ${letter} — ${KEYBOARD_LANDMARK[letter]}.`,
      incorrect: `${letter} is ${KEYBOARD_LANDMARK[letter]}. Find the black-key group first, then the white key beside it.`,
    },
    srs_tags: [keyboardAtom(letter)],
    kb_version: KB_VERSION,
  };
}

export const keyboardFind: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildKeyboardFind(candidateSeed, opts.grade, opts.seed, opts.atoms ?? []));

// --- Lesson 4: the stave ---------------------------------------------------

/** Whether a pitch sits ON a line or IN a space, for a given clef. Derived from
 *  the pitch's own position rather than a table, so it cannot drift from what the
 *  emitter draws: in treble the bottom line is E4, and every second diatonic step
 *  up from there is a line. */
function staveStep(pitch: Pitch, bottomLine: Pitch): number {
  const ord = (p: string) => Number(p[1]) * 7 + ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(p[0]);
  return ord(pitch) - ord(bottomLine);
}

function isOnLine(pitch: Pitch, bottomLine: Pitch): boolean {
  return staveStep(pitch, bottomLine) % 2 === 0;
}

/** Lesson 4. Grade 1 assumes you know what a stave is. Two question shapes: on a
 *  line or in a space, and which of two notes is higher.
 *
 *  The higher/lower question is always asked WITHIN ONE CLEF, and the copy says
 *  so. Unqualified, "higher on the stave means higher in pitch" is false the
 *  moment the learner meets the bass clef in Grade 1. */
function buildStavePosition(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scopeForGrade(grade).clefs]);
  const bottomLine: Pitch = clef === 'treble' ? 'E4' : clef === 'bass' ? 'G2' : 'F3';
  const pitches = diatonicPitchesInRange(clef, grade);
  const kinds = scopeTo(atoms, 'stave_anatomy', ['line_or_space', 'higher_lower', 'earlier_later'] as const);
  const kind = pick(rng, kinds);

  if (kind === 'line_or_space') {
    // Five lines and four spaces only. A note below the stave sits in no gap,
    // and the feedback claimed one.
    const onStave = pitches.filter((p) => staveStep(p, bottomLine) >= 0 && staveStep(p, bottomLine) <= 8);
    const pitch = pick(rng, onStave);
    const onLine = isOnLine(pitch, bottomLine);
    const music: Music = { clef, key_sig: null, time_sig: null, voices: [{ events: [{ type: 'note', pitch, dur: 'semibreve' }] }] };
    return {
      id: makeInstanceId('stave_position', grade, idSeed),
      template_id: 'stave_position',
      grade,
      strand: 'pitch',
      prompt: 'Is this note on a line, or in a space?',
      stimulus: { music, text: null },
      interaction: { type: 'mcq', config: {} },
      answer: { canonical: onLine ? 'On a line' : 'In a space', accepted_alternatives: [] },
      distractors: [onLine ? 'In a space' : 'On a line'],
      hints: ['A note on a line has the line running straight through the middle of it.'],
      feedback: {
        correct: onLine ? 'Yes — the line runs through the middle of it.' : 'Yes — it sits in the gap between two lines.',
        incorrect: onLine
          ? 'That one is on a line: the line runs straight through the middle of the note.'
          : 'That one is in a space: it sits in the gap between two lines.',
        by_distractor: onLine
          ? { 'In a space': 'A space note sits in the gap. This one has a line running straight through its middle, so it is on a line.' }
          : { 'On a line': 'A line note has the line running through its middle. This one sits in the gap between two lines, so it is in a space.' },
      },
      srs_tags: [staveAnatomyAtom('line_or_space')],
      kb_version: KB_VERSION,
    };
  }

  // The other axis (chromaticly-bpu.2). The options name the notes by HEIGHT, so
  // the learner has to read left-to-right for time rather than up-the-page — a
  // "which is first" with left/right options would answer itself.
  if (kind === 'earlier_later') {
    const lowIndex = Math.floor(rng() * (pitches.length - 1));
    const high = pick(rng, pitches.slice(lowIndex + 1));
    const low = pitches[lowIndex];
    const highFirst = rng() < 0.5;
    const music: Music = {
      clef,
      key_sig: null,
      time_sig: null,
      voices: [
        {
          events: [
            { type: 'note', pitch: highFirst ? high : low, dur: 'semibreve' },
            { type: 'note', pitch: highFirst ? low : high, dur: 'semibreve' },
          ],
        },
      ],
    };
    const answer = highFirst ? 'The higher one' : 'The lower one';
    const wrong = highFirst ? 'The lower one' : 'The higher one';
    return {
      id: makeInstanceId('stave_position', grade, idSeed),
      template_id: 'stave_position',
      grade,
      strand: 'pitch',
      prompt: 'Which of these two notes do you play first?',
      stimulus: { music, text: null },
      interaction: { type: 'mcq', config: {} },
      answer: { canonical: answer, accepted_alternatives: [] },
      distractors: [wrong],
      hints: ['Music is read left to right, like words on a page. The note on the left is played first.'],
      feedback: {
        correct: 'Yes — the note further left is played first.',
        incorrect: `${answer} comes first: it is further to the LEFT, and music is read left to right.`,
        by_distractor: {
          [wrong]: 'That one is further to the right, so it is played second. Height tells you how high a note sounds, not when it arrives.',
        },
      },
      srs_tags: [staveAnatomyAtom('earlier_later')],
      kb_version: KB_VERSION,
    };
  }

  // diatonicPitchesInRange returns ascending pitch order, so INDEX comparison is
  // the pitch comparison. String comparison is not: 'C5' > 'D4' is false, which
  // would let the question draw a "higher" note that sounds lower.
  const lowIndex = Math.floor(rng() * (pitches.length - 1));
  const high = pick(rng, pitches.slice(lowIndex + 1));
  const low = pitches[lowIndex];
  const first = rng() < 0.5 ? low : high;
  const second = first === low ? high : low;
  const music: Music = {
    clef,
    key_sig: null,
    time_sig: null,
    voices: [{ events: [{ type: 'note', pitch: first, dur: 'semibreve' }, { type: 'note', pitch: second, dur: 'semibreve' }] }],
  };
  const answer = first === high ? 'The first one' : 'The second one';
  const wrong = answer === 'The first one' ? 'The second one' : 'The first one';

  return {
    id: makeInstanceId('stave_position', grade, idSeed),
    template_id: 'stave_position',
    grade,
    strand: 'pitch',
    prompt: 'Which of these two notes sounds higher?',
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: answer, accepted_alternatives: [] },
    distractors: [wrong],
    hints: ['Within one clef, the note further up the stave is the higher sound. Tap play to hear it.'],
    feedback: {
      correct: 'Yes — within one clef, further up the stave is the higher sound.',
      incorrect: `${answer} is higher: it sits further up the stave, and in this clef that means a higher sound.`,
      by_distractor: {
        [wrong]: `That one sits LOWER on the stave, so in this clef it is the lower sound. ${answer} is higher.`,
      },
    },
    srs_tags: [staveAnatomyAtom('higher_lower')],
    kb_version: KB_VERSION,
  };
}

export const stavePosition: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildStavePosition(candidateSeed, opts.grade, opts.seed, opts.atoms ?? []));

// --- Lesson 5: note shapes and their lengths -------------------------------

/** Each shape with the length lesson 1's pulse gives it. Shape and meaning
 *  arrive together: a name learned without a meaning is an arbitrary label, and
 *  the original plan's shapes-then-lengths split was rejected for that reason. */
const SHAPE_BEATS: Record<string, string> = {
  semibreve: '4 beats',
  minim: '2 beats',
  crotchet: '1 beat',
  quaver: 'half a beat',
};

const SHAPE_LOOK: Record<string, string> = {
  semibreve: 'an open notehead with no stem',
  minim: 'an open notehead with a stem',
  crotchet: 'a filled notehead with a stem',
  quaver: 'a filled notehead with a tail — or beamed to its neighbour',
};

/** Lesson 5. Grade 1's note-values lesson goes straight to durations and rhythm
 *  sums; this names the four shapes first.
 *
 *  A quaver is drawn BEAMED as well as flagged, on alternate draws. A learner who
 *  only ever meets the flagged form does not recognise a beamed pair as quavers,
 *  which is the first thing Grade 1 shows them.
 *
 *  The copy says "written as" rather than "lasts longer": note type gives
 *  relative NOTATED duration, not which performed sound literally lasts longer. */
function buildNoteShapeLength(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const inScope = scopeForGrade(grade).noteValues.filter((d) => d in SHAPE_BEATS);
  const shapes = scopeTo(atoms, 'note_shape', inScope.length > 0 ? inScope : (['crotchet'] as const));
  const shape = pick(rng, shapes) as Duration;
  const pitch = pick(rng, diatonicPitchesInRange('treble', grade));

  // A quaver drawn alone carries a flag; drawn as a pair in one beat the emitter
  // beams it. Both are the same note value, and the learner must know that.
  const beamed = shape === 'quaver' && rng() < 0.5;
  const events = beamed
    ? [
        { type: 'note' as const, pitch, dur: shape },
        { type: 'note' as const, pitch, dur: shape },
      ]
    : [{ type: 'note' as const, pitch, dur: shape }];
  const music: Music = { clef: 'treble', key_sig: null, time_sig: null, voices: [{ events }] };

  const others = sampleDistinct(rng, Object.keys(SHAPE_BEATS).filter((s) => s !== shape), 2);

  return {
    id: makeInstanceId('note_shape_length', grade, idSeed),
    template_id: 'note_shape_length',
    grade,
    strand: 'rhythm',
    prompt: beamed ? 'What are these two notes called?' : 'What is this note called?',
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: shape, accepted_alternatives: [] },
    distractors: others,
    hints: [`Look at the notehead first: is it open or filled? A ${shape} is ${SHAPE_LOOK[shape]}.`],
    feedback: {
      correct: `Yes — a ${shape} is ${SHAPE_LOOK[shape]}. It is written as ${SHAPE_BEATS[shape]}.`,
      incorrect: `This is a ${shape}: ${SHAPE_LOOK[shape]}. It is written as ${SHAPE_BEATS[shape]}.`,
      by_distractor: Object.fromEntries(
        others.map((o) => [o, `A ${o} is ${SHAPE_LOOK[o]}. It is written as ${SHAPE_BEATS[o]}, and this one is a ${shape}.`]),
      ),
    },
    srs_tags: [noteShapeAtom(shape)],
    kb_version: KB_VERSION,
  };
}

export const noteShapeLength: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildNoteShapeLength(candidateSeed, opts.grade, opts.seed, opts.atoms ?? []));
