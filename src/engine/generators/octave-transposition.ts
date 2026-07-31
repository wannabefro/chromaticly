// Grade 3/4 octave_transposition generator (D1/D3/D4/D8, widened to alto by
// fyu.5) — the learner rewrites a given melody one octave away, in a
// DIFFERENT clef (D1, user decision 2026-07-22): direction is derived from
// CLEF_RANK (pitch height), fixed per clef pair for MVP determinism (D8) —
// both directions are eventually in scope, but this slice only needs one per
// pair to teach the octave-not-7th rule. Grade 3 stays treble<->bass exactly
// as before (byte-identical); grade 4 always pairs alto with another clef,
// since alto transposition is the new skill that grade introduces.
//
// Rhythm copies note-for-note, dur AND dots (Codex finding 1): `Music` stores
// dots separately from dur (types.ts:23; emitter reads
// durationToAbc(ev.dur, ev.dots ?? 0)), so a dotted minim in the melody would
// silently lose its dot if the target shape were {pitch,dur} alone.
//
// Pitch is spelled via spellInKeySig(natural, music.key_sig) — NOT
// spellInKey(natural, key) — because key_sig is already the full form
// ("G_major"); spellInKey would append "_major" a second time (Codex
// finding 2, key-spelling.ts:24).
//
// Melody shape (D8): one grade-3 major key, 2 bars in 3/4 or 4/4, 3-6
// unbeamed notes from a small per-time-signature full-bar pattern table
// ({semibreve, minim, crotchet, dotted minim}) — no beaming machinery needed
// for the bespoke answer stave (a later unit) to draw. Both the source
// (given clef) and the octave-transposed target (answer clef) are clamped to
// comfortablePitchRange so neither stave crowds its ledger-line ceiling —
// transposition's subject is the octave relationship, not extreme reading
// (scope.ts's incidental-vs-subject rule, same reasoning as
// anacrusis-recognition.ts's incidental pitch).

import { KB_VERSION } from '../../content/knowledge-base';
import type { Clef, Dots, Duration, Music, MusicEvent, NoteEvent } from '../../music/types';
import { transposeAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { spellInKeySig } from './key-spelling';
import { naturalPitchAtOrdinal, naturalPitchStepsAbove } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import { CLEF_RANK, PATTERNS, type SourceNote, sourceOrdinalRange, TIME_SIGS } from './transposition-core';
import type { GenerateOptions, Generator } from './types';

type Direction = 'up' | 'down';

// D8 originally sampled content from the grade-3 scope specifically
// (scopeForGrade(3), comfortablePitchRange(clef, 3)) rather than the generic
// opts.grade every other generator reads, since this template's KB fact
// (transposition, treble<->bass, knowledge-base.json:99) only existed at
// grade 3. The alto-clef slice (fyu.5) widens this to grade 4 too — grade 4's
// pair always includes alto (the new skill), grade 3 stays treble<->bass, and
// grade 5 (chromaticly-e3z.7) always includes tenor for the same reason.
// Only grades 3, 4 and 5 are supported; the instance's own `grade` field still
// carries the caller's opts.grade (schema-required, and what makeInstanceId
// keys off). CLEF_RANK (pitch-height clef ordering, kept in sync by hand with
// validator.ts's independent copy) now lives in transposition-core.ts.

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  if (grade !== 3 && grade !== 4 && grade !== 5) {
    throw new Error(`octave_transposition: grade ${grade} is not supported (only 3, 4 and 5)`);
  }
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);

  const key = pick(rng, [...scope.keysMajor]);
  const keySig = `${key}_major`;

  let givenClef: Clef;
  let answerClef: Clef;
  if (scope.clefs.includes('tenor')) {
    // Grade 5: "transposition at the octave of a simple melody from any clef to
    // another". Tenor is the new clef, so it is forced into every pair for the
    // same reason alto is at grade 4 — left to compete on equal odds among four
    // clefs, most instances would never exercise it.
    const other = pick(rng, scope.clefs.filter((c) => c !== 'tenor'));
    const pairs: [Clef, Clef][] = [
      ['tenor', other],
      [other, 'tenor'],
    ];
    [givenClef, answerClef] = pick(rng, pairs);
  } else if (scope.clefs.includes('alto')) {
    // Grade 4: alto transposition is the new skill this template teaches at
    // this grade, so alto is forced into every pair rather than competing on
    // equal odds with treble/bass (which would make most instances not
    // exercise alto at all).
    const other = pick(rng, scope.clefs.filter((c) => c !== 'alto'));
    const pairs: [Clef, Clef][] = [
      ['alto', other],
      [other, 'alto'],
    ];
    [givenClef, answerClef] = pick(rng, pairs);
  } else {
    // Grade 3: preserve the exact original RNG draw sequence (a single pick
    // call) for byte-identical seed-stability output — the answer clef is
    // derived from the scope's other clef, not drawn with a second rng call.
    givenClef = pick(rng, [...scope.clefs]);
    answerClef = scope.clefs.find((c) => c !== givenClef)!;
  }
  const direction: Direction = CLEF_RANK[answerClef] < CLEF_RANK[givenClef] ? 'down' : 'up';
  const delta = direction === 'down' ? -7 : 7;

  const timeSig = pick(rng, [...TIME_SIGS]);
  const bar1 = pick(rng, [...PATTERNS[timeSig]]);
  const bar2 = pick(rng, [...PATTERNS[timeSig]]);
  const barNotes = [...bar1, ...bar2];

  // D8: 3-6 notes across the 2 bars — the pattern table's per-bar note counts
  // (1..3) can occasionally combine below 3 (two 1-note bars); reject and let
  // generateValidated resample rather than special-casing the pattern draw.
  if (barNotes.length < 3 || barNotes.length > 6) {
    throw new Error(`octave_transposition: ${barNotes.length} notes is outside the 3-6 range`);
  }

  const { low, high } = sourceOrdinalRange(givenClef, answerClef, delta, grade);
  if (low > high) {
    throw new Error(`octave_transposition: no source pitch fits both ${givenClef} and ${answerClef} comfortable ranges`);
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

  const perItem = sourceNotes.map((n) => {
    const targetNatural = naturalPitchStepsAbove(n.natural, delta);
    const item: { pitch: string; dur: Duration; dots?: Dots } = { pitch: spellInKeySig(targetNatural, keySig), dur: n.dur };
    if (n.dots) item.dots = n.dots;
    return item;
  });

  return {
    id: makeInstanceId('octave_transposition', grade, idSeed),
    template_id: 'octave_transposition',
    grade,
    strand: 'pitch',
    prompt: `Rewrite this melody one octave ${direction === 'down' ? 'lower' : 'higher'}, in the ${answerClef} clef — same letter names, same rhythm.`,
    stimulus: { music, text: null },
    interaction: { type: 'transposition_input', config: { answerClef, direction } },
    answer: { canonical: perItem, accepted_alternatives: [], per_item: perItem },
    distractors: [],
    hints: ['Keep the same letter name for every note — only the octave changes. Copy the rhythm exactly, note for note.'],
    feedback: {
      correct: 'Correct!',
      incorrect: 'Not quite — check each note is the SAME letter name, one octave away, on the new clef.',
    },
    srs_tags: [transposeAtom()],
    kb_version: KB_VERSION,
  };
}

export const octaveTransposition: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed));
