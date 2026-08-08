// rest_completion generator (chromaticly-gni, curriculum/exercise-templates.json
// template_id "rest_completion"). "Which rest completes this bar?" — the stimulus
// is a bar with a time signature and sounding notes filling PART of it; each
// option is a rendered rest; the answer is the rest whose length fills the gap
// (required silence = bar total − sounding values). The spec names a stave_input
// editor, but the app's interaction model is MCQ, so this renders candidate rests
// as option_music (the key_signature_id pattern) — a documented deviation (KTD1).
//
// Distractors are synthesized from the GRADE's rest scope, not the lesson atom
// pool (KTD6), so a single-atom Practice due-path (e.g. a due `rest:breve`) still
// yields a valid closed MCQ.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Clef, Music } from '../../music/types';
import { parseAtom, restAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, scopeForGrade } from '../scope';
import { barUnitsFor, buildBarDurations, UNITS, type SimpleDuration } from './bar-math';
import {
  dottedRestsInScope,
  hostableTimeSigs,
  parseRestToken,
  restLabel,
  restUnits,
  type RestValue,
} from './rest-math';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

const OPTION_COUNT = 4; // answer + 3 distractors — a clean closed MCQ

const LONGER = ['twice', 'four times', 'eight times', 'sixteen times', 'thirty-two times', 'sixty-four times'];
const SHORTER = ['half', 'a quarter', 'an eighth', 'a sixteenth', 'a thirty-second', 'a sixty-fourth'];

/** Plain rests are a power of two apart; a dotted one is not, and falls back. */
function ratioWords(wrong: RestValue, answer: RestValue): string {
  const steps = Math.log2(restUnits(wrong) / restUnits(answer));
  if (!Number.isInteger(steps) || steps === 0) {
    return restUnits(wrong) > restUnits(answer) ? 'longer than' : 'shorter than';
  }
  return steps > 0 ? `${LONGER[steps - 1]} as long as` : `${SHORTER[-steps - 1]} as long as`;
}

/** The lesson's `rest:*` atoms as rest values, e.g. rest:dotted_crotchet. */
function restsFromAtoms(atoms: string[]): RestValue[] {
  const rests: RestValue[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'rest') continue;
    const value = parseRestToken(parts[0]);
    if (value && !rests.some((r) => sameRest(r, value))) rests.push(value);
  }
  if (rests.length === 0) throw new Error('rest_completion: needs at least one rest:* atom');
  return rests;
}

function sameRest(a: RestValue, b: RestValue): boolean {
  return a.dur === b.dur && a.dots === b.dots;
}

/** A plain answer keeps the grade's plain rests, byte-identical to before dotted
 *  rests existed. A dotted answer adds them, because dropping the dot is the error. */
function distractorPool(grade: number, answer: RestValue): RestValue[] {
  const scope = scopeForGrade(grade);
  const plain: RestValue[] = scope.rests.map((dur) => ({ dur, dots: 0 as const }));
  const pool = answer.dots === 0 ? plain : [...dottedRestsInScope(scope.rests, scope.rhythmDevices), ...plain];
  return pool.filter((r) => !sameRest(r, answer));
}

/** Deterministically draw `n` distinct rests from `pool` (a partial shuffle). */
function sample(rng: () => number, pool: RestValue[], n: number): RestValue[] {
  const copy = [...pool];
  const out: RestValue[] = [];
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
}

function restOptionMusic(clef: Clef, { dur, dots }: RestValue): Music {
  // abcjs cannot lay out a lone breve rest (64 units) in free meter (M:none) —
  // it needs a bar to hang the block in. Give the breve rest option a 4/2 bar
  // (exactly one breve) so it renders; the shorter rests are fine bare.
  const time_sig = dur === 'breve' ? '4/2' : null;
  return {
    clef,
    key_sig: null,
    time_sig,
    voices: [{ events: dots === 0 ? [{ type: 'rest', dur }] : [{ type: 'rest', dur, dots }] }],
  };
}

function labelOf({ dur, dots }: RestValue): string {
  return restLabel(dur, dots);
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);

  // Answer from the lesson atoms; distractors from the grade's rest scope (KTD6)
  // so a single-atom due-path still forms a full MCQ. A rest no bar at this
  // grade can host is dropped before the draw rather than left to fail `pick`.
  const answerable = restsFromAtoms(atoms).filter((r) => hostableTimeSigs(grade, restUnits(r)).length > 0);
  if (answerable.length === 0) throw new Error(`rest_completion: grade ${grade} has no bar that fits these rests`);
  const answer = pick(rng, answerable);
  const distractors = sample(rng, distractorPool(grade, answer), OPTION_COUNT - 1);

  // Prefer a bar STRICTLY larger than the answer rest so the stimulus always
  // has at least one sounding note (an empty bar reads as "nothing here" to a
  // beginner). Fall back to an exactly-equal bar only when none is larger — that
  // is the whole-bar rest itself (e.g. the semibreve rest in 4/4), which is
  // legitimately a silent whole bar.
  const answerUnits = restUnits(answer);
  const larger = hostableTimeSigs(grade, answerUnits + 1);
  const sig = pick(rng, larger.length > 0 ? larger : hostableTimeSigs(grade, answerUnits));
  const fillUnits = barUnitsFor(sig) - answerUnits;
  const soundingPool = scope.noteValues.filter(
    (d): d is SimpleDuration => UNITS[d as SimpleDuration] !== undefined && UNITS[d as SimpleDuration] <= fillUnits,
  );
  const durations = fillUnits > 0 ? buildBarDurations(rng, fillUnits, soundingPool) : [];

  // Pitch is irrelevant to a rhythm/rest question — use a fixed in-range note so
  // the sounding notes never stray outside the clef's range.
  const inRange = diatonicPitchesInRange(clef, grade);
  const pitch = inRange[Math.floor(inRange.length / 2)];
  const soundingEvents = durations.map((dur) => ({ type: 'note' as const, pitch, dur }));

  const optionRests = [answer, ...distractors];
  const optionMusic: Record<string, Music> = {};
  for (const r of optionRests) optionMusic[labelOf(r)] = restOptionMusic(clef, r);

  return {
    id: makeInstanceId('rest_completion', grade, idSeed),
    template_id: 'rest_completion',
    grade,
    strand: 'rhythm',
    prompt: 'Which rest completes this bar?',
    stimulus: {
      music: { clef, key_sig: null, time_sig: sig, voices: [{ events: soundingEvents }] },
      text: null,
    },
    interaction: { type: 'mcq', config: { option_music: optionMusic } },
    answer: { canonical: labelOf(answer), accepted_alternatives: [] },
    distractors: distractors.map(labelOf),
    hints: ['Add up the notes already in the bar, then find the rest that fills what is left.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — count the beats already used, then subtract from the bar to find the missing rest.',
      by_distractor: Object.fromEntries(
        distractors.map((d) => [
          labelOf(d),
          `A ${labelOf(d)} is ${ratioWords(d, answer)} the gap, so the bar would not add up.`,
        ]),
      ),
    },
    srs_tags: [restAtom(answer.dur, answer.dots)],
    kb_version: KB_VERSION,
  };
}

export const restCompletion: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));

// Second shape (chromaticly-lgi): the rest is printed and named, rather than
// worked out from what a bar is missing. Recognising the glyph and doing the
// arithmetic are different skills.

// Length in crotchet beats, keyed by bar-math units (crotchet = 8) rather than
// by duration, so a dotted rest reads in the same voice as a plain one.
const BEATS_LABEL: Record<number, string> = {
  1: 'an eighth of a beat',
  2: 'a quarter of a beat',
  3: 'three eighths of a beat',
  4: 'half a beat',
  6: 'three quarters of a beat',
  7: 'seven eighths of a beat',
  8: '1 beat',
  12: '1 and a half beats',
  14: '1 and three quarter beats',
  16: '2 beats',
  24: '3 beats',
  28: '3 and a half beats',
  32: '4 beats',
  48: '6 beats',
  56: '7 beats',
  64: '8 beats',
  96: '12 beats',
  112: '14 beats',
};

function beatsLabel(rest: RestValue): string {
  return BEATS_LABEL[restUnits(rest)] ?? `${restUnits(rest) / 8} beats`;
}

function buildRestValueId(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);
  const answer = pick(rng, restsFromAtoms(atoms));
  const distractors = sample(rng, distractorPool(grade, answer), OPTION_COUNT - 1);
  if (distractors.length < 2) throw new Error(`rest_value_id: grade ${grade} has too few rests for a closed item`);

  return {
    id: makeInstanceId('rest_value_id', grade, idSeed),
    template_id: 'rest_value_id',
    grade,
    strand: 'rhythm',
    prompt: 'Which rest is this?',
    stimulus: { music: restOptionMusic(clef, answer), text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: labelOf(answer), accepted_alternatives: [] },
    distractors: distractors.map(labelOf),
    hints: ['A minim rest sits ON the middle line; a semibreve rest hangs BELOW the line above it. The tails count for the shorter ones.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `That is a ${labelOf(answer)}, so it lasts ${beatsLabel(answer)}.`,
      by_distractor: Object.fromEntries(
        distractors.map((d) => [
          labelOf(d),
          `A ${labelOf(d)} lasts ${beatsLabel(d)}, ${ratioWords(d, answer)} this one.`,
        ]),
      ),
    },
    srs_tags: [restAtom(answer.dur, answer.dots)],
    kb_version: KB_VERSION,
  };
}

export const restValueId: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildRestValueId(candidateSeed, opts.grade, opts.seed, opts.atoms));
