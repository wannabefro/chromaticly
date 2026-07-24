// Grade 5 metre_rewrite generator (G5-2, chromaticly-4ak) — rewrite a bar
// between SIMPLE and COMPOUND time (2/4 <-> 6/8) so the beats map across.
//
// Correctness (Codex review): the transform maps BEATS and note values SCALE by
// 3/2 — it does NOT preserve absolute notated durations. A simple crotchet beat
// (2/4) maps to a compound dotted-crotchet beat (6/8); every note within scales
// x3/2, which for a PLAIN note means "add a dot" (crotchet->dotted crotchet,
// quaver->dotted quaver, semiquaver->dotted semiquaver). Going back strips the
// dot. We build the simple bar from plain values only, so its compound image is
// all single dotted notes (no double-dots, no ties) — exactly the pedagogical
// subset that has a clean single-note equivalent in the other metre. The pitch
// sequence is shared: a metre rewrite re-values the rhythm, it never re-pitches,
// so the given and answer bars carry the same notes in the same order.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Dots, Duration, Music, MusicEvent, NoteEvent } from '../../music/types';
import { metreRewriteAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInComfortableRange } from '../scope';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

export const METRE_REWRITE_PAIR = { simple: '2/4', compound: '6/8' } as const;
export type RewriteDirection = 'to_compound' | 'to_simple';

/** Simple-beat (crotchet) plain-value fill patterns; each sums to one crotchet
 *  beat. Plain values only — so the x3/2 compound image is a single dotted note
 *  per note. */
const SIMPLE_BEAT_PATTERNS: readonly Duration[][] = [
  ['crotchet'],
  ['quaver', 'quaver'],
  ['quaver', 'semiquaver', 'semiquaver'],
  ['semiquaver', 'semiquaver', 'quaver'],
  ['semiquaver', 'semiquaver', 'semiquaver', 'semiquaver'],
];

/** The palette note VALUES (undotted names) the learner chooses from; the target
 *  metre decides whether each is placed plain (simple target) or dotted
 *  (compound target). */
export const PALETTE_DURS: readonly Duration[] = ['minim', 'crotchet', 'quaver', 'semiquaver'];

/** x3/2 note-value scaling as a dot toggle: simple->compound adds a dot to a
 *  plain note; to_simple strips the dot from a dotted note. Throws if the source
 *  note isn't in the expected plain/dotted form for its side (the generator only
 *  ever feeds it valid input; the validator relies on the same rule). */
export function rescaleDots(dots: Dots, direction: RewriteDirection): Dots {
  if (direction === 'to_compound') {
    if (dots !== 0) throw new Error(`metre_rewrite: a simple-side note must be plain (got dots ${dots})`);
    return 1;
  }
  if (dots !== 1) throw new Error(`metre_rewrite: a compound-side note must be dotted (got dots ${dots})`);
  return 0;
}

type Item = { pitch: string; dur: Duration; dots?: Dots };

function noteEvent(item: Item): NoteEvent {
  return item.dots ? { type: 'note', pitch: item.pitch, dur: item.dur, dots: item.dots } : { type: 'note', pitch: item.pitch, dur: item.dur };
}

function build(contentSeed: number, grade: number, idSeed: number): ExerciseInstance {
  if (grade !== 5) {
    throw new Error(`metre_rewrite: grade ${grade} is not supported (only 5)`);
  }
  const rng = mulberry32(contentSeed);
  const direction: RewriteDirection = pick(rng, ['to_compound', 'to_simple']);

  const pitchPool = diatonicPitchesInComfortableRange('treble', grade);

  // Canonical SIMPLE bar (2/4 = 2 crotchet beats), plain values, one pitch each.
  const simpleDurs: Duration[] = [];
  for (let beat = 0; beat < 2; beat++) {
    simpleDurs.push(...pick(rng, [...SIMPLE_BEAT_PATTERNS]));
  }
  const pitches = simpleDurs.map(() => pick(rng, pitchPool));

  const simpleItems: Item[] = simpleDurs.map((dur, i) => ({ pitch: pitches[i], dur }));
  const compoundItems: Item[] = simpleDurs.map((dur, i) => ({ pitch: pitches[i], dur, dots: 1 }));

  const givenItems = direction === 'to_compound' ? simpleItems : compoundItems;
  const answerItems = direction === 'to_compound' ? compoundItems : simpleItems;
  const givenSig = direction === 'to_compound' ? METRE_REWRITE_PAIR.simple : METRE_REWRITE_PAIR.compound;
  const answerSig = direction === 'to_compound' ? METRE_REWRITE_PAIR.compound : METRE_REWRITE_PAIR.simple;

  const music: Music = {
    clef: 'treble',
    key_sig: null,
    time_sig: givenSig,
    voices: [{ events: givenItems.map(noteEvent) as MusicEvent[] }],
  };

  const perItem = answerItems.map((it) => (it.dots ? { pitch: it.pitch, dur: it.dur, dots: it.dots } : { pitch: it.pitch, dur: it.dur }));

  // The palette carries every plausible target-metre value (plain or dotted),
  // so the choice is real — the learner must pick the correctly-scaled value.
  const paletteDotted = direction === 'to_compound';
  const palette = PALETTE_DURS.map((dur) => (paletteDotted ? { dur, dots: 1 } : { dur }));

  const givenLabel = direction === 'to_compound' ? 'simple time (2/4)' : 'compound time (6/8)';
  const answerLabel = direction === 'to_compound' ? 'compound time (6/8)' : 'simple time (2/4)';

  return {
    id: makeInstanceId('metre_rewrite', grade, idSeed),
    template_id: 'metre_rewrite',
    grade,
    strand: 'rhythm',
    prompt: `Rewrite this bar in ${answerLabel} so it keeps the same beats — same notes, re-valued rhythm.`,
    stimulus: { music, text: null },
    interaction: {
      type: 'note_value_palette',
      config: { direction, givenTimeSig: givenSig, targetTimeSig: answerSig, palette },
    },
    answer: { canonical: perItem, accepted_alternatives: [], per_item: perItem },
    distractors: [],
    hints: [
      direction === 'to_compound'
        ? 'One simple beat (a crotchet) becomes one compound beat (a dotted crotchet). Give every note a dot — its value grows by half.'
        : 'One compound beat (a dotted crotchet) becomes one simple beat (a crotchet). Take the dot off every note — its value shrinks by a third.',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — from ${givenLabel} to ${answerLabel}, every note ${direction === 'to_compound' ? 'gains' : 'loses'} a dot. Keep the same pitches and order.`,
    },
    srs_tags: [metreRewriteAtom()],
    kb_version: KB_VERSION,
  };
}

export const metreRewrite: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed));
