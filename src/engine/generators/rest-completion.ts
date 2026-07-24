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
  return {
    clef,
    key_sig: null,
    time_sig: null,
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

  // Pick a bar large enough to host the answer rest, then fill the remainder
  // with sounding notes so the gap is exactly the answer rest's length.
  const sig = pick(rng, hostableTimeSigs(grade, REST_UNITS[answer]));
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
    },
    srs_tags: [restAtom(answer)],
    kb_version: KB_VERSION,
  };
}

export const restCompletion: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
