// Grade 5 transposing_instrument generator (G5-4, chromaticly-wz1) — the learner
// is shown a concert-pitch line and writes the part a named transposing
// instrument must READ so it sounds at concert pitch. A transposing instrument
// SOUNDS LOWER than written, so the written part is HIGHER than concert pitch:
// Bb clarinet sounds a M2 lower -> write UP a M2; A clarinet sounds a m3 lower
// -> write UP a m3; F horn sounds a P5 lower -> write UP a P5 (mappings
// confirmed in Codex review).
//
// Unlike octave_transposition (which shifts by ±7 diatonic steps and keeps the
// SAME key), this shifts by a real interval AND changes key: the written part
// is notated in the *transposed* key, so its spelling falls out of the written
// key signature rather than stray accidentals against the concert key (plan U3
// / Codex key-signature finding). The core trick: transposition preserves scale
// degree, so a concert line diatonic in key K, written up interval I, is
// diatonic in key K+I — advancing each natural letter by the interval's
// letter-span and spelling it in the WRITTEN key sig yields the correct
// enharmonic spelling automatically (C major up a M2 -> D major: E natural ->
// F#, spelled by D's signature, not an accidental).
//
// Both staves render in the treble clef (all three instruments read treble),
// and the concert line is bounded so the WRITTEN pitches (concert + interval)
// stay inside the treble comfortable range for the answer stave — reusing
// transposition-core's two-endpoint clamp (sourceOrdinalRange) with the
// interval's letter-span as delta.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Clef, Dots, Duration, Music, MusicEvent, NoteEvent } from '../../music/types';
import { INSTRUMENT_TRANSPOSITIONS, type TransposingInstrument, transposeInstrumentAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import type { ExerciseInstance } from '../schema';
import { spellInKeySig } from './key-spelling';
import { naturalPitchAtOrdinal, naturalPitchStepsAbove } from './pitch-math';
import { generateValidated, makeInstanceId } from './retry';
import { PATTERNS, type SourceNote, sourceOrdinalRange, TIME_SIGS } from './transposition-core';
import type { GenerateOptions, Generator } from './types';

/** The instrument:* atoms in `atoms`, in atom order — mirrors
 *  chord-recognition.ts's numeralsFromAtoms; only the transpose_instrument kind
 *  is recognised, and an unknown instrument code fails loud. */
function instrumentsFromAtoms(atoms: string[]): TransposingInstrument[] {
  const result: TransposingInstrument[] = [];
  for (const atom of atoms) {
    const [kind, code] = atom.split(':');
    if (kind !== 'transpose_instrument') continue;
    if (!(code in INSTRUMENT_TRANSPOSITIONS)) {
      throw new Error(`transposing_instrument: atom "${atom}" names an unknown instrument`);
    }
    result.push(code as TransposingInstrument);
  }
  if (result.length === 0) {
    throw new Error('transposing_instrument: needs at least one transpose_instrument:* atom');
  }
  return result;
}

const ANSWER_CLEF: Clef = 'treble';

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  if (grade !== 5) {
    throw new Error(`transposing_instrument: grade ${grade} is not supported (only 5)`);
  }
  const rng = mulberry32(contentSeed);

  const instrument = pick(rng, instrumentsFromAtoms(atoms));
  const spec = INSTRUMENT_TRANSPOSITIONS[instrument];
  const { concert, written } = pick(rng, [...spec.keys]);
  const concertKeySig = `${concert}_major`;
  const writtenKeySig = `${written}_major`;

  const timeSig = pick(rng, [...TIME_SIGS]);
  const bar1 = pick(rng, [...PATTERNS[timeSig]]);
  const bar2 = pick(rng, [...PATTERNS[timeSig]]);
  const barNotes = [...bar1, ...bar2];
  if (barNotes.length < 3 || barNotes.length > 6) {
    throw new Error(`transposing_instrument: ${barNotes.length} notes is outside the 3-6 range`);
  }

  // Bound the concert line so both the concert pitch AND the written pitch
  // (concert + interval letter-span) stay inside the treble comfortable range.
  const { low, high } = sourceOrdinalRange(ANSWER_CLEF, ANSWER_CLEF, spec.letterSteps, grade);
  if (low > high) {
    throw new Error(`transposing_instrument: no concert pitch keeps the written line in range for ${instrument}`);
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
  [bar1, bar2].forEach((bar, barIndex) => {
    const offset = barIndex === 0 ? 0 : bar1.length;
    for (let i = 0; i < bar.length; i++) {
      const n = sourceNotes[offset + i];
      stimulusEvents.push(noteEvent(n, spellInKeySig(n.natural, concertKeySig)));
    }
    stimulusEvents.push({ type: 'barline', style: barIndex === 1 ? 'double' : 'single' });
  });

  const music: Music = { clef: ANSWER_CLEF, key_sig: concertKeySig, time_sig: timeSig, voices: [{ events: stimulusEvents }] };

  const perItem = sourceNotes.map((n) => {
    const writtenNatural = naturalPitchStepsAbove(n.natural, spec.letterSteps);
    const item: { pitch: string; dur: Duration; dots?: Dots } = { pitch: spellInKeySig(writtenNatural, writtenKeySig), dur: n.dur };
    if (n.dots) item.dots = n.dots;
    return item;
  });

  return {
    id: makeInstanceId('transposing_instrument', grade, idSeed),
    template_id: 'transposing_instrument',
    grade,
    strand: 'pitch',
    prompt: `Write this line for the ${spec.name} so it sounds at concert pitch.`,
    stimulus: { music, text: null },
    interaction: {
      type: 'transposition_input',
      config: {
        answerClef: ANSWER_CLEF,
        direction: 'up',
        answerKeySig: writtenKeySig,
        answerCaption: `Written up a ${spec.intervalName} — in ${written} major`,
        banner: {
          instrument: spec.name,
          sounds: `Sounds a ${spec.intervalName} lower than written`,
          write: `Write the part up a ${spec.intervalName}`,
          interval: spec.intervalPill,
          intervalName: spec.intervalName,
        },
      },
    },
    answer: { canonical: perItem, accepted_alternatives: [], per_item: perItem },
    distractors: [],
    hints: [`The ${spec.name} sounds a ${spec.intervalName} lower than written, so write every note a ${spec.intervalName} HIGHER than concert pitch — in ${written} major, its key signature does the spelling.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `Not quite — every note goes UP a ${spec.intervalName} from the concert line, written in ${written} major.`,
    },
    srs_tags: [transposeInstrumentAtom(instrument)],
    kb_version: KB_VERSION,
  };
}

export const transposingInstrument: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
