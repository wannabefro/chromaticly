// note_grouping generator, Grades 1 to 5 (chromaticly-18o). The ABRSM outline
// names "the grouping of the notes and rests within these times" at every grade
// from 1 to 5, and nothing in the course asked for it.
//
// A bar of equal beamable notes has exactly one correct beaming, and the metre
// alone decides it. So the stimulus is the time signature and the options are
// the same bar beamed three different ways — the correct one, and two real
// misreadings. Music.beam_groups renders a deliberately wrong beaming; the
// correct option leaves it unset, so it beams from the metre like every other
// stimulus in the course.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Duration, Music, MusicEvent } from '../../music/types';
import { groupingAtom, parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInComfortableRange, metreRenderableTimeSignatures, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { barUnitsFor } from './bar-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** Crotchet-beats per undotted value, matching the emitter's own table. */
const BEATS: Record<'quaver' | 'semiquaver', number> = { quaver: 0.5, semiquaver: 0.25 };

const NOTE_PLURAL: Record<'quaver' | 'semiquaver', string> = {
  quaver: 'quavers',
  semiquaver: 'semiquavers',
};

function timeSignaturesFromAtoms(atoms: string[], grade: number): string[] {
  const renderable = metreRenderableTimeSignatures(grade);
  const sigs: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'grouping' || parts.length !== 1) continue;
    const [sig] = parts;
    if (renderable.includes(sig) && !sigs.includes(sig)) sigs.push(sig);
  }
  return sigs;
}

/** Quavers, unless the smallest group would hold fewer than two of them. */
function fillValue(spans: number[]): 'quaver' | 'semiquaver' {
  return Math.min(...spans) / BEATS.quaver >= 2 ? 'quaver' : 'semiquaver';
}

/** Crotchet-beat spans, restated independently so an emitter mismatch fails loud. */
function correctSpans(timeSig: string): number[] {
  const [num, den] = timeSig.split('/').map(Number);
  const unit = 4 / den;
  const compound = num % 3 === 0 && num > 3;
  if (num === 5) return [3 * unit, 2 * unit];
  if (num === 7) return [3 * unit, 2 * unit, 2 * unit];
  const beats = compound ? num / 3 : num;
  return Array.from({ length: beats }, () => (compound ? 3 * unit : unit));
}

/** Real misreadings, in preference order. */
function wrongGroupings(correct: number[], total: number): number[][] {
  const candidates: number[][] = [];
  const evenSplit = (size: number): number[] | null =>
    total % size === 0 ? Array.from({ length: total / size }, () => size) : null;

  if (correct.length > 1) candidates.push([...correct].reverse());
  const twos = evenSplit(2);
  const threes = evenSplit(3);
  if (threes) candidates.push(threes);
  if (twos) candidates.push(twos);
  candidates.push([total]);
  candidates.push(Array.from({ length: total }, () => 1));

  const seen = new Set([correct.join('+')]);
  const out: number[][] = [];
  for (const c of candidates) {
    const key = c.join('+');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function label(groups: number[]): string {
  return groups.join(' + ');
}

function barFor(
  clef: string,
  timeSig: string,
  value: 'quaver' | 'semiquaver',
  count: number,
  pitch: string,
  groups?: number[],
): Music {
  const events: MusicEvent[] = Array.from({ length: count }, () => ({
    type: 'note',
    pitch,
    dur: value as Duration,
  }));
  events.push({ type: 'barline', style: 'double' });
  const music: Music = {
    clef: clef as Music['clef'],
    key_sig: null,
    time_sig: timeSig,
    voices: [{ events }],
  };
  if (groups) music.beam_groups = groups.map((n) => n * BEATS[value]);
  return music;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const scope = scopeForGrade(grade);
  const sigs = timeSignaturesFromAtoms(atoms, grade);
  if (sigs.length === 0) {
    throw new Error('note_grouping: needs a renderable "grouping:<time signature>" atom');
  }
  const timeSig = pick(rng, sigs);
  const clef = pick(rng, [...scope.clefs]);
  const pitch = pick(rng, diatonicPitchesInComfortableRange(clef, grade));

  const spans = correctSpans(timeSig);
  const value = fillValue(spans);
  const count = barUnitsFor(timeSig) / (BEATS[value] * 8);
  const correct = spans.map((span) => span / BEATS[value]);
  if (!correct.every(Number.isInteger) || correct.reduce((a, b) => a + b, 0) !== count) {
    throw new Error(`note_grouping: ${timeSig} groups ${correct.join('+')}, but the bar holds ${count}`);
  }

  const wrong = wrongGroupings(correct, count).slice(0, 2);
  if (wrong.length < 2) throw new Error(`note_grouping: ${timeSig} has too few wrong groupings`);

  const optionMusic: Record<string, Music> = {
    [label(correct)]: barFor(clef, timeSig, value, count, pitch),
  };
  for (const w of wrong) optionMusic[label(w)] = barFor(clef, timeSig, value, count, pitch, w);

  const noun = NOTE_PLURAL[value];
  const [num] = timeSig.split('/').map(Number);
  const compound = num % 3 === 0 && num > 3;
  const irregular = num === 5 || num === 7;
  const beatWord = compound ? 'dotted beat' : irregular ? 'group' : 'beat';

  return {
    id: makeInstanceId('note_grouping', grade, idSeed),
    template_id: 'note_grouping',
    grade,
    strand: 'rhythm',
    // 5/8 and 7/8 only: the lesson says a composer may beam 2 + 3, so there
    // only the NORMAL grouping is unique.
    prompt: `A bar of ${timeSig} is filled with ${noun}. Which beaming ${irregular ? 'shows the normal grouping' : 'groups them correctly'}?`,
    stimulus: { music: null, text: timeSig },
    interaction: { type: 'mcq', config: { option_music: optionMusic } },
    answer: { canonical: label(correct), accepted_alternatives: [] },
    distractors: wrong.map(label),
    hints: [`Work out how many ${noun} fill one ${beatWord} of ${timeSig}. The beams show the beats.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `${timeSig} ${irregular ? 'normally groups' : 'groups'} its ${noun} as ${label(correct)}. Beams show the beat, so a reader can see it without counting.`,
      by_distractor: Object.fromEntries(
        wrong.map((w) => [
          label(w),
          w.length === 1
            ? `Beaming the whole bar as one group hides the beat. ${timeSig} is ${label(correct)}.`
            : w.every((n) => n === 1)
              ? `Leaving every note unbeamed shows no beat at all. ${timeSig} is ${label(correct)}.`
              : irregular
                ? `A composer may beam ${label(w)}, but the normal grouping of ${timeSig} is ${label(correct)}.`
                : `That is ${label(w)}, which is a different metre's beat. ${timeSig} is ${label(correct)}.`,
        ]),
      ),
    },
    srs_tags: [groupingAtom(timeSig)],
    kb_version: KB_VERSION,
  };
}

export const noteGrouping: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));

// Second shape (chromaticly-lgi): the beams are printed, the metre is read off
// them. The signature is hidden, not absent, so the bar beams honestly.

/** How many notes of `value` fill one bar of `sig`, or null when they do not. */
function noteCountFor(sig: string, value: 'quaver' | 'semiquaver'): number | null {
  const count = barUnitsFor(sig) / (BEATS[value] * 8);
  return Number.isInteger(count) ? count : null;
}

/** Nearest note count first: a same-count option cannot be answered by counting. */
function metreDistractors(sig: string, grade: number, value: 'quaver' | 'semiquaver', count: number): string[] {
  const correctLabel = label(correctSpans(sig).map((s) => s / BEATS[value]));
  const others = metreRenderableTimeSignatures(grade).filter((t) => t !== sig);
  const grouping = (t: string) => {
    const spans = correctSpans(t).map((s) => s / BEATS[value]);
    return spans.every(Number.isInteger) ? label(spans) : null;
  };
  const distance = (t: string) => Math.abs((noteCountFor(t, value) ?? Infinity) - count);
  return others
    .filter((t) => grouping(t) !== null && grouping(t) !== correctLabel)
    .sort((a, b) => distance(a) - distance(b) || others.indexOf(a) - others.indexOf(b))
    .slice(0, 2);
}

function buildMetreId(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const scope = scopeForGrade(grade);
  const sigs = timeSignaturesFromAtoms(atoms, grade);
  if (sigs.length === 0) throw new Error('note_grouping_metre_id: needs a renderable "grouping:<time signature>" atom');
  const timeSig = pick(rng, sigs);
  const clef = pick(rng, [...scope.clefs]);
  const pitch = pick(rng, diatonicPitchesInComfortableRange(clef, grade));

  const spans = correctSpans(timeSig);
  const value = fillValue(spans);
  const count = noteCountFor(timeSig, value);
  const groups = spans.map((s) => s / BEATS[value]);
  if (count === null || !groups.every(Number.isInteger)) {
    throw new Error(`note_grouping_metre_id: ${timeSig} does not fill with ${value}s`);
  }
  const distractors = metreDistractors(timeSig, grade, value, count);
  if (distractors.length < 2) throw new Error(`note_grouping_metre_id: ${timeSig} has too few sibling metres at grade ${grade}`);

  const music = barFor(clef, timeSig, value, count, pitch);
  music.time_sig_hidden = true;
  const noun = NOTE_PLURAL[value];

  return {
    id: makeInstanceId('note_grouping_metre_id', grade, idSeed),
    template_id: 'note_grouping_metre_id',
    grade,
    strand: 'rhythm',
    prompt: 'Read the beams. Which time signature is this bar in?',
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: timeSig, accepted_alternatives: [] },
    distractors,
    hints: [`Count the ${noun} inside each beam. The beam groups are the beats.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `These ${noun} are beamed ${label(groups)}, which is how ${timeSig} groups them.`,
      by_distractor: Object.fromEntries(
        distractors.map((t) => [
          t,
          `${t} would beam these ${noun} as ${label(correctSpans(t).map((s) => s / BEATS[value]))}. This bar is beamed ${label(groups)}.`,
        ]),
      ),
    },
    srs_tags: [groupingAtom(timeSig)],
    kb_version: KB_VERSION,
  };
}

export const noteGroupingMetreId: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => buildMetreId(candidateSeed, opts.grade, opts.seed, opts.atoms));
