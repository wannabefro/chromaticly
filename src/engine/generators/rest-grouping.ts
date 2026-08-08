// rest_grouping generator (chromaticly-6xs.3). G3 item 1 asks for the grouping
// of notes AND rests in compound time. note_grouping covered quaver beaming and
// rests-3 covered rest values in isolation, so nothing asked how a silence is
// written against a dotted-crotchet beat.
//
// Every option is the same bar and the same silence, written three ways: the
// one that shows the beat, and two real misreadings — a rest that crosses a
// beat boundary, and a beat broken up when one rest would do.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Duration, Music, MusicEvent } from '../../music/types';
import { parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInComfortableRange, metreRenderableTimeSignatures, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** A rest as quaver-count plus how it is written. */
interface Rest {
  quavers: number;
  dur: Duration;
  dots: 0 | 1;
}

const RESTS: readonly Rest[] = [
  { quavers: 1, dur: 'quaver', dots: 0 },
  { quavers: 2, dur: 'crotchet', dots: 0 },
  { quavers: 3, dur: 'crotchet', dots: 1 },
  { quavers: 4, dur: 'minim', dots: 0 },
  { quavers: 6, dur: 'minim', dots: 1 },
];

const REST_WORD: Record<string, string> = {
  '1': 'quaver rest',
  '2': 'crotchet rest',
  '3': 'dotted crotchet rest',
  '4': 'minim rest',
  '6': 'dotted minim rest',
};

export function restGroupingAtom(timeSig: string): string {
  return `rest_grouping:${timeSig}`;
}

/** The compound signatures the lesson names, in atom order. */
function timeSignaturesFromAtoms(atoms: string[], grade: number): string[] {
  const renderable = metreRenderableTimeSignatures(grade);
  const sigs: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'rest_grouping' || parts.length !== 1) continue;
    if (renderable.includes(parts[0]) && !sigs.includes(parts[0])) sigs.push(parts[0]);
  }
  return sigs;
}

/** Compound beats of three quavers each. 6/8 has two, 12/8 has four. */
export function compoundBeats(timeSig: string): number {
  const [num, den] = timeSig.split('/').map(Number);
  if (den !== 8 || num % 3 !== 0 || num <= 3) throw new Error(`rest_grouping: ${timeSig} is not a compound signature`);
  return num / 3;
}

/** Where the silence sits, in quavers from the start of the bar. */
export interface Silence {
  from: number;
  to: number;
}

/** Three shapes, so the correct label cannot be memorised. */
export function silencesFor(timeSig: string): Silence[] {
  const beats = compoundBeats(timeSig);
  const shapes: Silence[] = [{ from: 2, to: 6 }, { from: 0, to: 3 }];
  if (beats >= 3) shapes.push({ from: 3, to: 9 });
  return shapes;
}

/** THE rule: a rest never crosses a beat, and a silent beat is one rest. */
export function correctRests(silence: Silence): Rest[] {
  const out: Rest[] = [];
  for (let at = silence.from; at < silence.to; ) {
    const beatEnd = (Math.floor(at / 3) + 1) * 3;
    const span = Math.min(beatEnd, silence.to) - at;
    const rest = RESTS.find((r) => r.quavers === span);
    if (!rest) throw new Error(`rest_grouping: no single rest spans ${span} quavers`);
    out.push(rest);
    at += span;
  }
  return out;
}

/** One rest for the whole silence, so no beat is visible at all. */
function oneRest(silence: Silence): Rest[] | null {
  const rest = RESTS.find((r) => r.quavers === silence.to - silence.from);
  return rest ? [rest] : null;
}

/** Every beat of the silence broken into single quaver rests. */
function allQuavers(silence: Silence): Rest[] {
  return Array.from({ length: silence.to - silence.from }, () => RESTS[0]);
}

/** Grouped in twos, the simple-time habit — it crosses the dotted beat. */
function inTwos(silence: Silence): Rest[] | null {
  const length = silence.to - silence.from;
  if (length % 2 !== 0) return null;
  return Array.from({ length: length / 2 }, () => RESTS[1]);
}

/** Each whole silent beat split 2 + 1 instead of written as one rest. */
function unevenBeats(silence: Silence): Rest[] {
  return correctRests(silence).flatMap((r) => (r.quavers === 3 ? [RESTS[1], RESTS[0]] : [r]));
}

/** Wrong writings in preference order, the correct one and repeats removed. */
export function wrongWritings(silence: Silence, correctLabel: string): { label: string; rests: Rest[] }[] {
  const candidates = [inTwos(silence), oneRest(silence), unevenBeats(silence), allQuavers(silence)];
  const seen = new Set([correctLabel]);
  const out: { label: string; rests: Rest[] }[] = [];
  for (const rests of candidates) {
    if (rests === null) continue;
    const label = restLabel(rests);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, rests });
  }
  return out;
}

export function restLabel(rests: Rest[]): string {
  const words = rests.map((r) => REST_WORD[String(r.quavers)]);
  if (words.length === 1) return `One ${words[0]}`;
  if (new Set(words).size === 1) return `${words.length} ${words[0]}s`;
  return words.map((w, i) => (i === 0 ? `A ${w}` : `then a ${w}`)).join(', ');
}

function barFor(clef: string, timeSig: string, pitch: string, silence: Silence, rests: Rest[]): Music {
  const events: MusicEvent[] = [];
  const note = (): MusicEvent => ({ type: 'note', pitch, dur: 'quaver' });
  for (let at = 0; at < silence.from; at++) events.push(note());
  for (const r of rests) events.push(r.dots === 0 ? { type: 'rest', dur: r.dur } : { type: 'rest', dur: r.dur, dots: r.dots });
  for (let at = silence.to; at < compoundBeats(timeSig) * 3; at++) events.push(note());
  events.push({ type: 'barline', style: 'double' });
  return { clef: clef as Music['clef'], key_sig: null, time_sig: timeSig, voices: [{ events }] };
}

/** Copy is chosen from the rests, never from the label — two labels that read
 *  alike must still name different mistakes. */
function distractorCopy(rests: Rest[], timeSig: string, correctLabel: string): string {
  const beat = 'dotted crotchet beat';
  if (rests.length === 1) return `One rest for the whole silence hides every beat under it. Break it at each ${beat}: ${correctLabel.toLowerCase()}.`;
  if (rests.every((r) => r.quavers === 1)) return `Separate quaver rests show no beat at all. A ${beat} that is silent throughout takes one dotted crotchet rest.`;
  if (rests.every((r) => r.quavers === 2)) return `Crotchet rests group the silence in twos, which is a simple-time habit. ${timeSig} counts in threes, so a rest here runs past the beat.`;
  return `That splits a beat that is silent all the way through. One dotted crotchet rest covers it, and shows the beat while it does.`;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const rng = mulberry32(contentSeed);
  const sigs = timeSignaturesFromAtoms(atoms, grade);
  if (sigs.length === 0) throw new Error('rest_grouping: needs a renderable "rest_grouping:<time signature>" atom');

  const timeSig = pick(rng, sigs);
  const clef = pick(rng, [...scopeForGrade(grade).clefs]);
  const pitch = pick(rng, diatonicPitchesInComfortableRange(clef, grade));
  const silence = pick(rng, silencesFor(timeSig));

  const correct = correctRests(silence);
  const correctLabel = restLabel(correct);
  const wrong = wrongWritings(silence, correctLabel).slice(0, 2);
  if (wrong.length < 2) throw new Error(`rest_grouping: ${timeSig} has too few wrong writings`);

  const optionMusic: Record<string, Music> = { [correctLabel]: barFor(clef, timeSig, pitch, silence, correct) };
  for (const w of wrong) optionMusic[w.label] = barFor(clef, timeSig, pitch, silence, w.rests);

  const beatWord = `dotted crotchet beat`;
  return {
    id: makeInstanceId('rest_grouping', grade, idSeed),
    template_id: 'rest_grouping',
    grade,
    strand: 'rhythm',
    prompt: `Each bar of ${timeSig} below holds the same rhythm. Which one writes the rests correctly?`,
    stimulus: { music: null, text: timeSig },
    interaction: { type: 'mcq', config: { option_music: optionMusic } },
    answer: { canonical: correctLabel, accepted_alternatives: [] },
    distractors: wrong.map((w) => w.label),
    hints: [`${timeSig} counts in ${beatWord}s. A rest stops at the end of a beat, and a whole silent beat is written as one rest.`],
    feedback: {
      correct: 'Correct!',
      incorrect: `In ${timeSig} a rest never runs past the end of a ${beatWord}, and a beat that is silent all the way through is written as one dotted crotchet rest. That gives ${correctLabel.toLowerCase()}.`,
      by_distractor: Object.fromEntries(
        wrong.map(({ label, rests }) => [label, distractorCopy(rests, timeSig, correctLabel)]),
      ),
    },
    srs_tags: [restGroupingAtom(timeSig)],
    kb_version: KB_VERSION,
  };
}

export const restGrouping: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
