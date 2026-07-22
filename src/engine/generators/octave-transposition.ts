// Grade 3 octave_transposition generator (D1/D3/D4/D8) — the learner rewrites
// a given melody one octave away, in the OPPOSITE clef (D1, user decision
// 2026-07-22): given treble -> answer bass, one octave LOWER; given bass ->
// answer treble, one octave HIGHER. Direction is fixed per clef pair for MVP
// determinism (D8) — both directions are eventually in scope, but this slice
// only needs one per pair to teach the octave-not-7th rule.
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
import { comfortablePitchRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { spellInKeySig } from './key-spelling';
import { naturalPitchAtOrdinal, naturalPitchStepsAbove, scientificPitchOrdinal } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type TimeSig = '3/4' | '4/4';
type Direction = 'up' | 'down';

interface BarNote {
  dur: Duration;
  dots?: Dots;
}

// Full-bar patterns, unbeamed durations only (D8) — each entry sums exactly
// to its time signature's bar total (checked independently by
// octaveTranspositionHook), so "bars are metrically full" holds by
// construction, not by luck.
const PATTERNS: Record<TimeSig, readonly BarNote[][]> = {
  '3/4': [
    [{ dur: 'minim', dots: 1 }],
    [{ dur: 'minim' }, { dur: 'crotchet' }],
    [{ dur: 'crotchet' }, { dur: 'minim' }],
    [{ dur: 'crotchet' }, { dur: 'crotchet' }, { dur: 'crotchet' }],
  ],
  '4/4': [
    [{ dur: 'semibreve' }],
    [{ dur: 'minim' }, { dur: 'minim' }],
    [{ dur: 'minim' }, { dur: 'crotchet' }, { dur: 'crotchet' }],
    [{ dur: 'crotchet' }, { dur: 'crotchet' }, { dur: 'minim' }],
    [{ dur: 'minim', dots: 1 }, { dur: 'crotchet' }],
    [{ dur: 'crotchet' }, { dur: 'minim', dots: 1 }],
  ],
};

const TIME_SIGS: readonly TimeSig[] = ['3/4', '4/4'];

interface SourceNote {
  natural: string; // natural-letter scientific pitch, e.g. "F3" — spelled in key at emission time
  dur: Duration;
  dots?: Dots;
}

/** The natural-pitch ordinal band a source note may occupy: within the given
 *  clef's comfortable range AND whose octave-transposed target also fits the
 *  answer clef's comfortable range (D8's "both endpoints" clamp). */
function sourceOrdinalRange(givenClef: Clef, answerClef: Clef, direction: Direction): { low: number; high: number } {
  const given = comfortablePitchRange(givenClef, GENERATOR_GRADE);
  const answer = comfortablePitchRange(answerClef, GENERATOR_GRADE);
  const delta = direction === 'down' ? -7 : 7;
  const givenLow = scientificPitchOrdinal(given.low);
  const givenHigh = scientificPitchOrdinal(given.high);
  const answerLow = scientificPitchOrdinal(answer.low) - delta;
  const answerHigh = scientificPitchOrdinal(answer.high) - delta;
  return { low: Math.max(givenLow, answerLow), high: Math.min(givenHigh, answerHigh) };
}

// D8 samples content from the grade-3 scope specifically (scopeForGrade(3),
// comfortablePitchRange(clef, 3)) rather than the generic opts.grade every
// other generator reads — this template's KB fact (transposition,
// treble<->bass, knowledge-base.json:99) only exists at grade 3, and grades
// 4/5 reuse the transposition_input INTERACTION, not this generator (a
// different template, interval_transposition, per the plan's "out of scope").
// The instance's own `grade` field still carries the caller's opts.grade
// (schema-required, and what makeInstanceId keys off).
const GENERATOR_GRADE = 3;

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  const scope = scopeForGrade(GENERATOR_GRADE);
  const rng = mulberry32(contentSeed);

  const key = pick(rng, [...scope.keysMajor]);
  const keySig = `${key}_major`;

  const givenClef = pick(rng, [...scope.clefs]);
  const answerClef: Clef = givenClef === 'treble' ? 'bass' : 'treble';
  const direction: Direction = givenClef === 'treble' ? 'down' : 'up';
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

  const { low, high } = sourceOrdinalRange(givenClef, answerClef, direction);
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
