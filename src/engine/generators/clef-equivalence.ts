// Grade 4 clef_equivalence generator (chromaticly-ra3, KB grade_scopes["4"]
// pitch_knowledge "same pitch across treble/alto/bass"). The learner rewrites a
// given melody in a DIFFERENT clef at the SAME octave — the pitches are
// identical, only the notation (clef, and therefore each note's line/space)
// changes. It shares octave_transposition's clef/range/rhythm machinery
// (transposition-core.ts) and its transposition_input interaction, differing in
// exactly one number: the octave delta is 0, not ±7.
//
// The source pitches are clamped to the intersection of both clefs' comfortable
// ranges (sourceOrdinalRange with delta 0), i.e. the pitches legible on both
// staves — for treble<->bass that is the middle-C region, which is precisely
// where the "same pitch, two clefs" idea lives. per_item carries the target
// pitches (equal to the source pitches, re-spelled for the answer clef via
// spellInKeySig), and the validator's clefEquivalenceHook recomputes them.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Clef, Dots, Duration, Music, MusicEvent, NoteEvent } from '../../music/types';
import { clefEquivAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { spellInKeySig } from './key-spelling';
import { naturalPitchAtOrdinal } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import { PATTERNS, type SourceNote, sourceOrdinalRange, TIME_SIGS } from './transposition-core';
import type { GenerateOptions, Generator } from './types';

// Same-octave rewrite: the target pitch IS the source pitch, so the natural-step
// shift between them is zero.
const DELTA = 0;

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  if (grade !== 4) {
    throw new Error(`clef_equivalence: grade ${grade} is not supported (only 4)`);
  }
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);

  const key = pick(rng, [...scope.keysMajor]);
  const keySig = `${key}_major`;

  // Any two distinct clefs — the point is that treble, alto and bass all name
  // the same sounding pitch differently, so no clef is privileged.
  const givenClef: Clef = pick(rng, [...scope.clefs]);
  const answerClef: Clef = pick(rng, scope.clefs.filter((c) => c !== givenClef));

  const timeSig = pick(rng, [...TIME_SIGS]);
  const bar1 = pick(rng, [...PATTERNS[timeSig]]);
  const bar2 = pick(rng, [...PATTERNS[timeSig]]);
  const barNotes = [...bar1, ...bar2];

  // 3-6 notes across the 2 bars — two 1-note bars can fall below 3; reject and
  // let generateValidated resample (mirrors octave_transposition).
  if (barNotes.length < 3 || barNotes.length > 6) {
    throw new Error(`clef_equivalence: ${barNotes.length} notes is outside the 3-6 range`);
  }

  const { low, high } = sourceOrdinalRange(givenClef, answerClef, DELTA, grade);
  if (low > high) {
    throw new Error(`clef_equivalence: no pitch is legible in both ${givenClef} and ${answerClef} at the same octave`);
  }
  const candidateOrdinals = Array.from({ length: high - low + 1 }, (_, i) => low + i);

  const sourceNotes: SourceNote[] = barNotes.map((note) => ({
    natural: naturalPitchAtOrdinal(pick(rng, candidateOrdinals)),
    dur: note.dur,
    dots: note.dots,
  }));

  const noteEvent = (n: SourceNote, pitch: string): NoteEvent =>
    n.dots ? { type: 'note', pitch, dur: n.dur, dots: n.dots } : { type: 'note', pitch, dur: n.dur };

  const stimulusEvents: MusicEvent[] = [];
  let cursor = 0;
  [bar1, bar2].forEach((bar, barIndex) => {
    for (let i = 0; i < bar.length; i++) {
      const n = sourceNotes[cursor + i];
      stimulusEvents.push(noteEvent(n, spellInKeySig(n.natural, keySig)));
    }
    cursor += bar.length;
    stimulusEvents.push({ type: 'barline', style: barIndex === 1 ? 'double' : 'single' });
  });

  const music: Music = { clef: givenClef, key_sig: keySig, time_sig: timeSig, voices: [{ events: stimulusEvents }] };

  // delta 0 → same sounding pitch, re-spelled for the answer clef's key sig.
  const perItem = sourceNotes.map((n) => {
    const item: { pitch: string; dur: Duration; dots?: Dots } = { pitch: spellInKeySig(n.natural, keySig), dur: n.dur };
    if (n.dots) item.dots = n.dots;
    return item;
  });

  return {
    id: makeInstanceId('clef_equivalence', grade, idSeed),
    template_id: 'clef_equivalence',
    grade,
    strand: 'pitch',
    prompt: `Rewrite this melody in the ${answerClef} clef — the same notes, at the same pitch, with the same rhythm.`,
    stimulus: { music, text: null },
    interaction: { type: 'transposition_input', config: { answerClef } },
    answer: { canonical: perItem, accepted_alternatives: [], per_item: perItem },
    distractors: [],
    hints: ['The pitch never changes — only the clef. Each note keeps its exact sound, so it lands on a different line or space in the new clef.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — every note keeps its exact pitch; only the clef changes, so each note sits on a different line or space. Place each at the same sounding pitch.',
    },
    srs_tags: [clefEquivAtom()],
    kb_version: KB_VERSION,
  };
}

export const clefEquivalence: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed));
