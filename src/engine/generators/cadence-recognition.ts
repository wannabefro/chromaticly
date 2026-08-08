// Grade 5 cadence_recognition generator (chromaticly-e3z.5) — the syllabus's
// Grade 5 item 4, and the largest hole the audit found: cadences are their own
// exam question and the course had nothing behind them.
//
// The scope is narrower than "cadences" in general, and the narrowness is the
// syllabus's, quoted verbatim:
//
//   "The choice of suitable chords at cadential points of a simple melody in
//    the major key of C, G, D or F. Perfect, plagal and imperfect cadences in
//    the major keys of C, G, D or F."
//
// So: three cadence types, four keys, no minor. The interrupted cadence (V-vi)
// is Grade 6 and is deliberately absent — including it as a distractor would
// teach a name the learner has no way to place.
//
// Three variants. 'name' shows both chords and asks what the cadence is called.
// The other two are the "choice of a suitable chord at a cadential point",
// reduced to the point itself: 'complete' shows the approach chord and asks
// what finishes the named cadence, and 'approach' shows the final chord and
// asks what precedes it.
//
// 'approach' is the one that discriminates. A perfect and a plagal cadence both
// END on I, so a learner who only knows "it finishes on the tonic" can answer
// 'complete' for either and still not tell them apart. Asking what comes BEFORE
// the tonic is the question that has a different answer for each.
//
// The stimulus is a keyboard-style reduction: the triad on the treble staff
// over its root on the bass staff. The bass is not decoration — the fall of a
// 5th (V-I) against the rise of a 4th (IV-I) is how a cadence is recognised by
// eye, and a treble-only voicing would hide it.

import { KB_VERSION } from '../../content/knowledge-base';
import type { ChordEvent, Music, NoteEvent, Voice } from '../../music/types';
import { cadenceAtom, cadenceChooseAtom, parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import type { ExerciseInstance } from '../schema';
import { buildTriad, raiseOctave } from './chord-recognition';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

export type CadenceKind = 'perfect' | 'plagal' | 'imperfect';

/** The three cadences in scope, each as the chord pair that makes it.
 *
 *  A cadence is defined by where it ENDS, not by a fixed pair: perfect and
 *  plagal both end on I and are told apart by what precedes it, while an
 *  imperfect cadence is any approach that ends on V. `approaches` carries that
 *  — the imperfect entry has two, so the exercise cannot be answered by
 *  memorising one pair of numerals. */
export const CADENCES: Record<CadenceKind, { approaches: readonly string[]; ends: string; label: string }> = {
  perfect: { approaches: ['V'], ends: 'I', label: 'perfect' },
  plagal: { approaches: ['IV'], ends: 'I', label: 'plagal' },
  imperfect: { approaches: ['I', 'IV'], ends: 'V', label: 'imperfect' },
};

export const CADENCE_KINDS: readonly CadenceKind[] = ['perfect', 'plagal', 'imperfect'];

/** The four keys the syllabus names for cadences. Deliberately not
 *  scope.keysMajor: Grade 5 reads key signatures to six accidentals, but its
 *  cadence questions are set in these four only. */
export const CADENCE_KEYS: readonly string[] = ['C', 'G', 'D', 'F'];

/** The skill belongs to the atom, not the pool (chromaticly-2o4). */
function cadencesFromAtoms(atoms: string[]): { kind: CadenceKind; choose: boolean }[] {
  const pairs: { kind: CadenceKind; choose: boolean }[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if ((kind !== 'cadence' && kind !== 'cadence_choose') || parts.length !== 1) continue;
    const name = parts[0] as CadenceKind;
    if (!CADENCE_KINDS.includes(name)) continue;
    const choose = kind === 'cadence_choose';
    if (!pairs.some((p) => p.kind === name && p.choose === choose)) pairs.push({ kind: name, choose });
  }
  if (pairs.length === 0) {
    throw new Error('cadence_recognition: needs at least one cadence:<kind> atom');
  }
  return pairs;
}

/** One chord of the cadence as a treble triad over its own bass root.
 *
 *  The bass root is raised an octave from buildTriad's pick, which returns the
 *  LOWEST in-range occurrence — C2 and D2 sit two ledger lines below the staff
 *  and read as a bass-clef reading exercise rather than a harmony one. Raised,
 *  every root in the four cadence keys lands on or near the staff, an octave
 *  under the treble triad: ordinary keyboard spacing. */
function chordVoicing(grade: number, key: string, numeral: string): { treble: ChordEvent; bass: NoteEvent } {
  const [bassRoot] = buildTriad('bass', grade, key, numeral);
  const triad = buildTriad('treble', grade, key, numeral);
  return {
    treble: { type: 'chord', pitches: triad, dur: 'semibreve' },
    bass: { type: 'note', pitch: raiseOctave(bassRoot), dur: 'semibreve' },
  };
}

/** Renders one chord per bar, in order. Takes a list rather than a pair because
 *  the 'complete' variant shows only the approach chord — the ending is what the
 *  learner supplies, so drawing it would give the answer away. */
function cadenceMusic(grade: number, key: string, numerals: readonly string[]): Music {
  const chords = numerals.map((n) => chordVoicing(grade, key, n));
  const line = (part: 'treble' | 'bass') =>
    chords.flatMap((chord, i) => [
      chord[part],
      { type: 'barline' as const, style: i === chords.length - 1 ? ('double' as const) : ('single' as const) },
    ]);
  const voices: Voice[] = [
    { events: line('treble'), staff: 0, stem: 'up', name: 'soprano' },
    { events: line('bass'), staff: 1, stem: 'down', name: 'bass' },
  ];
  return { clef: 'treble', key_sig: `${key}_major`, time_sig: null, staves: ['treble', 'bass'], voices };
}

/** "an imperfect", "a plagal" — the only cadence name starting with a vowel. */
function article(kind: CadenceKind): string {
  return kind === 'imperfect' ? 'an' : 'a';
}

const WHY: Record<CadenceKind, string> = {
  perfect: 'A perfect cadence is V to I — the dominant falling home to the tonic.',
  plagal: 'A plagal cadence is IV to I — the subdominant stepping up to the tonic.',
  imperfect: 'An imperfect cadence ENDS on V. It does not resolve, which is what leaves it sounding unfinished.',
};

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const { kind, choose } = pick(rng, cadencesFromAtoms(atoms));
  const key = pick(rng, [...CADENCE_KEYS]);
  const spec = CADENCES[kind];
  const approach = pick(rng, [...spec.approaches]);
  const numerals: [string, string] = [approach, spec.ends];

  // A name atom must not be credited by a choosing item. `pick` on one
  // entry still spends its draw.
  const variant = pick(rng, choose ? (['complete', 'approach'] as const) : (['name'] as const));
  const tag = choose ? cadenceChooseAtom(kind) : cadenceAtom(kind);

  if (variant === 'name') {
    const others = CADENCE_KINDS.filter((k) => k !== kind);
    return {
      id: makeInstanceId('cadence_recognition', grade, idSeed),
      template_id: 'cadence_recognition',
      grade,
      strand: 'chords',
      prompt: `These two chords are in ${key} major. Which cadence do they make?`,
      stimulus: { music: cadenceMusic(grade, key, numerals), text: null },
      interaction: { type: 'mcq', config: {} },
      answer: { canonical: spec.label, accepted_alternatives: [] },
      distractors: others.map((k) => CADENCES[k].label),
      hints: [
        'Work out the second chord first. Ending on the tonic means perfect or plagal, and the chord before it tells you which; ending on the dominant means imperfect.',
      ],
      feedback: {
        correct: 'Correct!',
        incorrect: `${WHY[kind]} These chords are ${numerals[0]} then ${numerals[1]}.`,
        by_distractor: Object.fromEntries(others.map((k) => [CADENCES[k].label, `${WHY[k]} This one is ${numerals[0]} to ${numerals[1]}.`])),
      },
      srs_tags: [tag],
      kb_version: KB_VERSION,
    };
  }

  if (variant === 'approach') {
    const wrongApproaches = ['I', 'IV', 'V'].filter((n) => n !== approach);
    return {
      id: makeInstanceId('cadence_recognition', grade, idSeed),
      template_id: 'cadence_recognition',
      grade,
      strand: 'chords',
      prompt: `This chord ends ${article(kind)} ${spec.label} cadence in ${key} major. Which chord comes before it?`,
      stimulus: { music: cadenceMusic(grade, key, [spec.ends]), text: null },
      interaction: { type: 'mcq', config: {} },
      answer: { canonical: approach, accepted_alternatives: [] },
      distractors: wrongApproaches,
      hints: [
        'Perfect and plagal cadences both end on the tonic. What tells them apart is the chord before it.',
      ],
      feedback: {
        correct: 'Correct!',
        incorrect: WHY[kind],
        by_distractor: Object.fromEntries(
          wrongApproaches.map((n) => [
            n,
            `${n} to ${spec.ends} is not ${article(kind)} ${spec.label} cadence. ${WHY[kind]}`,
          ]),
        ),
      },
      srs_tags: [tag],
      kb_version: KB_VERSION,
    };
  }

  // 'complete': the approach chord is shown, the cadence is named, and the
  // learner supplies the chord that ends it.
  const wrongEndings = ['I', 'IV', 'V'].filter((n) => n !== spec.ends);
  return {
    id: makeInstanceId('cadence_recognition', grade, idSeed),
    template_id: 'cadence_recognition',
    grade,
    strand: 'chords',
    prompt: `This is the start of ${article(kind)} ${spec.label} cadence in ${key} major. Which chord ends it?`,
    stimulus: { music: cadenceMusic(grade, key, [approach]), text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: spec.ends, accepted_alternatives: [] },
    distractors: wrongEndings,
    hints: ['Every cadence is named by where it ends. Two of the three end on the tonic; one does not.'],
    feedback: {
      correct: 'Correct!',
      incorrect: WHY[kind],
      by_distractor: Object.fromEntries(
        wrongEndings.map((n) => [
          n,
          n === 'V'
            ? `Ending on V makes an IMPERFECT cadence, not ${article(kind)} ${spec.label} one. ${WHY[kind]}`
            : `${article(kind) === 'an' ? 'An' : 'A'} ${spec.label} cadence does not end on ${n}. ${WHY[kind]}`,
        ]),
      ),
    },
    srs_tags: [tag],
    kb_version: KB_VERSION,
  };
}

export const cadenceRecognition: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
