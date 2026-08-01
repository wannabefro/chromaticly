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
import type { Clef, Duration, Music } from '../../music/types';
import { parseAtom, restAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, scopeForGrade } from '../scope';
import { barUnitsFor, buildBarDurations, UNITS, type SimpleDuration } from './bar-math';
import { hostableTimeSigs, REST_UNITS, restLabel } from './rest-math';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

const OPTION_COUNT = 4; // answer + 3 distractors — a clean closed MCQ

const LONGER = ['twice', 'four times', 'eight times', 'sixteen times', 'thirty-two times', 'sixty-four times'];
const SHORTER = ['half', 'a quarter', 'an eighth', 'a sixteenth', 'a thirty-second', 'a sixty-fourth'];

/** Every rest value is a power of two apart, so the gap is stated as a ratio. */
function ratioWords(wrong: Duration, answer: Duration): string {
  const steps = Math.round(Math.log2(REST_UNITS[wrong] / REST_UNITS[answer]));
  return steps > 0 ? `${LONGER[steps - 1]} as long as` : `${SHORTER[-steps - 1]} as long as`;
}

/** The lesson's `rest:*` atoms as bare durations, e.g. rest:crotchet -> "crotchet". */
function restsFromAtoms(atoms: string[]): Duration[] {
  const rests: Duration[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'rest') continue;
    const dur = parts[0] as Duration;
    if (!rests.includes(dur)) rests.push(dur);
  }
  if (rests.length === 0) throw new Error('rest_completion: needs at least one rest:* atom');
  return rests;
}

/** Deterministically draw `n` distinct rests from `pool` (a partial shuffle). */
function sample(rng: () => number, pool: Duration[], n: number): Duration[] {
  const copy = [...pool];
  const out: Duration[] = [];
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
}

function restOptionMusic(clef: Clef, dur: Duration): Music {
  // abcjs cannot lay out a lone breve rest (64 units) in free meter (M:none) —
  // it needs a bar to hang the block in. Give the breve rest option a 4/2 bar
  // (exactly one breve) so it renders; the shorter rests are fine bare.
  const time_sig = dur === 'breve' ? '4/2' : null;
  return {
    clef,
    key_sig: null,
    time_sig,
    voices: [{ events: [{ type: 'rest', dur }] }],
  };
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);

  // Answer from the lesson atoms; distractors from the grade's rest scope (KTD6)
  // so a single-atom due-path still forms a full MCQ.
  const answer = pick(rng, restsFromAtoms(atoms));
  const distractors = sample(
    rng,
    scope.rests.filter((r) => r !== answer),
    OPTION_COUNT - 1,
  );

  // Prefer a bar STRICTLY larger than the answer rest so the stimulus always
  // has at least one sounding note (an empty bar reads as "nothing here" to a
  // beginner). Fall back to an exactly-equal bar only when none is larger — that
  // is the whole-bar rest itself (e.g. the semibreve rest in 4/4), which is
  // legitimately a silent whole bar.
  const larger = hostableTimeSigs(grade, REST_UNITS[answer] + 1);
  const sig = pick(rng, larger.length > 0 ? larger : hostableTimeSigs(grade, REST_UNITS[answer]));
  const fillUnits = barUnitsFor(sig) - REST_UNITS[answer];
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
  for (const r of optionRests) optionMusic[restLabel(r)] = restOptionMusic(clef, r);

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
    answer: { canonical: restLabel(answer), accepted_alternatives: [] },
    distractors: distractors.map(restLabel),
    hints: ['Add up the notes already in the bar, then find the rest that fills what is left.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — count the beats already used, then subtract from the bar to find the missing rest.',
      by_distractor: Object.fromEntries(
        distractors.map((d) => [
          restLabel(d),
          `A ${d} rest is ${ratioWords(d, answer)} the gap, so the bar would not add up.`,
        ]),
      ),
    },
    srs_tags: [restAtom(answer)],
    kb_version: KB_VERSION,
  };
}

export const restCompletion: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));

// Second shape (chromaticly-lgi): the rest is printed and named, rather than
// worked out from what a bar is missing. Recognising the glyph and doing the
// arithmetic are different skills.

/** Length in crotchet beats, the unit every grade counts in. */
const BEATS_LABEL: Record<Duration, string> = {
  demisemiquaver: 'an eighth of a beat',
  semiquaver: 'a quarter of a beat',
  quaver: 'half a beat',
  crotchet: '1 beat',
  minim: '2 beats',
  semibreve: '4 beats',
  breve: '8 beats',
};

function buildRestValueId(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);
  const answer = pick(rng, restsFromAtoms(atoms));
  const distractors = sample(
    rng,
    scope.rests.filter((r) => r !== answer),
    OPTION_COUNT - 1,
  );
  if (distractors.length < 2) throw new Error(`rest_value_id: grade ${grade} has too few rests for a closed item`);

  return {
    id: makeInstanceId('rest_value_id', grade, idSeed),
    template_id: 'rest_value_id',
    grade,
    strand: 'rhythm',
    prompt: 'Which rest is this?',
    stimulus: { music: restOptionMusic(clef, answer), text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: restLabel(answer), accepted_alternatives: [] },
    distractors: distractors.map(restLabel),
    hints: ['A minim rest sits ON the middle line; a semibreve rest hangs BELOW the line above it. The tails count for the shorter ones.'],
    feedback: {
      correct: 'Correct!',
      incorrect: `That is a ${answer} rest, so it lasts ${BEATS_LABEL[answer]}.`,
      by_distractor: Object.fromEntries(
        distractors.map((d) => [
          restLabel(d),
          `A ${d} rest lasts ${BEATS_LABEL[d]}, ${ratioWords(d, answer)} this one.`,
        ]),
      ),
    },
    srs_tags: [restAtom(answer)],
    kb_version: KB_VERSION,
  };
}

export const restValueId: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildRestValueId(candidateSeed, opts.grade, opts.seed, opts.atoms));
