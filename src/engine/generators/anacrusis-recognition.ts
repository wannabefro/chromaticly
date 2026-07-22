// Grade 3 anacrusis_recognition generator (D1-D7) — mirrors
// metre-classification.ts's structure. Renders a melody that begins with a
// partial (upbeat) bar and closes with a complementary partial bar so the
// first + last bar sum to exactly one full bar (the ABRSM anacrusis rule);
// the learner answers "How many beats are in the upbeat (anacrusis)?" via a
// generic MCQ. Simple time only (2/4, 3/4, 4/4 — D3); whole-beat pickups only
// (D2), so option labels stay clean integers.
//
// Codex correction 2: the trailing barline is OMITTED, so splitting the
// event stream on barline events yields exactly [pickup, full, full, closing]
// — no empty trailing group — matching anacrusisRecognitionHook's
// (validator.ts) own split-on-barline discipline.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Duration, Music, MusicEvent } from '../../music/types';
import { anacrusisAtom, parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInComfortableRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { barUnitsFor, buildBarDurations, type SimpleDuration } from './bar-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** The atom-named signatures (anacrusis:<sig>) — mirrors
 *  metre-classification.ts's metreSignaturesFromAtoms. */
function anacrusisSignaturesFromAtoms(atoms: string[]): string[] {
  const sigs: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'anacrusis' || parts.length !== 1) continue;
    const [sig] = parts;
    if (!sigs.includes(sig)) sigs.push(sig);
  }
  if (sigs.length === 0) {
    throw new Error('anacrusis_recognition: needs at least one anacrusis:<sig> atom');
  }
  return sigs;
}

function beatsLabel(n: number): string {
  return `${n} beat${n === 1 ? '' : 's'}`;
}

/** Whole-beat pickup choices for a `beats`-beat bar: 1..beats-1 (D2). */
function pickupBeatChoices(beats: number): number[] {
  return Array.from({ length: beats - 1 }, (_, i) => i + 1);
}

/** D4's diagnostic distractor set: complement, p-1, p+1, 0 — filtered to a
 *  legal beat count distinct from both the canonical (p) and the full-bar
 *  miscount (beats). Codex correction 3: this can have more than one
 *  survivor (e.g. 3/4 p=1 -> {0,2}; 4/4 -> up to 3), so the caller must
 *  rng-pick exactly ONE, never offer the whole set. */
function d2Candidates(p: number, beats: number): number[] {
  const raw = [beats - p, p - 1, p + 1, 0];
  const filtered = raw.filter((x) => x >= 0 && x <= beats && x !== p && x !== beats);
  return [...new Set(filtered)];
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const sig = pick(rng, anacrusisSignaturesFromAtoms(atoms));
  const barUnits = barUnitsFor(sig);
  const beats = barUnits / 8;
  const p = pick(rng, pickupBeatChoices(beats));

  const clef = pick(rng, [...scope.clefs]);
  const pitch = pick(rng, diatonicPitchesInComfortableRange(clef, grade));
  const pool = scope.noteValues as readonly SimpleDuration[];

  const events: MusicEvent[] = [];
  const pushBar = (units: number) => {
    for (const dur of buildBarDurations(rng, units, pool)) {
      events.push({ type: 'note', pitch, dur: dur as Duration });
    }
  };

  pushBar(p * 8);
  events.push({ type: 'barline', style: 'single' });
  pushBar(barUnits);
  events.push({ type: 'barline', style: 'single' });
  pushBar(barUnits);
  events.push({ type: 'barline', style: 'single' });
  pushBar((beats - p) * 8);
  // No trailing barline (Codex correction 2) — see module header.

  const music: Music = { clef, key_sig: null, time_sig: sig, anacrusis: true, voices: [{ events }] };

  const canonical = beatsLabel(p);
  const d1 = beatsLabel(beats); // full-bar miscount — the headline anacrusis misconception
  const d2 = beatsLabel(pick(rng, d2Candidates(p, beats)));

  return {
    id: makeInstanceId('anacrusis_recognition', grade, idSeed),
    template_id: 'anacrusis_recognition',
    grade,
    strand: 'rhythm',
    prompt: 'How many beats are in the upbeat (anacrusis)?',
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors: [d1, d2],
    hints: [
      'Count backwards from the first barline to see how many beats the upbeat takes — the final bar completes what the upbeat borrowed.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Count the beats before the first barline, then check: the first and last bars together make one whole bar.',
    },
    srs_tags: [anacrusisAtom(sig)],
    kb_version: KB_VERSION,
  };
}

export const anacrusisRecognition: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
