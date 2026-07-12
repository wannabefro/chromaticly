// Pure grading + option-assembly core for the exercise loop (U10). Kept free of
// React/RN so the correctness rules — how each of the five G1 answer shapes is
// labelled, matched, and turned into a mastery result — are unit-testable
// without rendering. The UI layer (ExerciseLoop) is a thin shell over this.

import { mulberry32 } from '../engine/rng';
import type { ExerciseInstance } from '../engine/schema';
import type { Music } from '../music/types';

export interface Option {
  label: string;
  value: unknown;
  correct: boolean;
  /** Render-only payload (AD5): a notation-answer option's rendered stave
   *  (e.g. a key signature). Never participates in grading — `value` stays
   *  the semantic answer compared by `gradeMcq`. */
  music?: Music;
}

export interface AttemptResult {
  atom: string | null;
  correct: boolean;
  hintsUsed: number;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** Human-readable label for any G1 answer value: note name / key ("D major") as-is,
 *  interval number stringified, a rhythm {dur,dots} as "dotted crotchet", a
 *  term {value,category} as its value. */
export function optionLabel(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.dur === 'string') {
      const dots = typeof obj.dots === 'number' ? obj.dots : 0;
      if (dots === 1) return `dotted ${obj.dur}`;
      if (dots > 1) return `${dots}-dotted ${obj.dur}`;
      return obj.dur;
    }
    if (typeof obj.value === 'string') return obj.value;
  }
  return JSON.stringify(value);
}

function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A generator's optional per-value render payload (AD5), e.g. key_signature_id's
 *  `interaction.config.option_music: Record<string, Music>` keyed by the same
 *  semantic string used as `answer.canonical`/each distractor. */
function optionMusicFor(instance: ExerciseInstance, value: unknown): Music | undefined {
  if (typeof value !== 'string') return undefined;
  const map = instance.interaction.config?.option_music;
  if (!map || typeof map !== 'object') return undefined;
  return (map as Record<string, Music>)[value];
}

/** A notation option's label is never shown (its NotationCard renders instead),
 *  so `optionLabel` — which formats rhythm/term shapes into display text — is
 *  skipped entirely rather than computed and discarded. */
function buildOption(value: unknown, correct: boolean, music: Music | undefined): Option {
  return music ? { label: '', value, correct, music } : { label: optionLabel(value), value, correct };
}

/** Answer + distractors as labelled options in a deterministic (id-seeded) order,
 *  so the correct option is not always first but the same instance always shuffles
 *  the same way (KTD4 reproducibility carries into presentation). */
export function assembleOptions(instance: ExerciseInstance): Option[] {
  const options: Option[] = [
    buildOption(instance.answer.canonical, true, optionMusicFor(instance, instance.answer.canonical)),
    ...instance.distractors.map((d) => buildOption(d, false, optionMusicFor(instance, d))),
  ];
  const rng = mulberry32(seedFromId(instance.id));
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

/** An MCQ pick is correct iff it deep-equals the canonical answer. */
export function gradeMcq(instance: ExerciseInstance, selected: unknown): boolean {
  return deepEqual(selected, instance.answer.canonical);
}

/** A per-bar true/false attempt is correct only when EVERY verdict matches
 *  answer.per_item, in bar order — one wrong bar fails the whole item, there
 *  is no partial credit (U5 test scenario). */
export function gradeTrueFalse(instance: ExerciseInstance, response: boolean[]): boolean {
  const perItem = instance.answer.per_item;
  if (!Array.isArray(perItem) || perItem.length !== response.length) return false;
  return response.every((v, i) => v === perItem[i]);
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Free-text grading: case/space-insensitive match against the canonical answer or
 *  any accepted alternative (e.g. "Eb"/"E♭" for "E flat"). */
export function gradeText(instance: ExerciseInstance, input: string): boolean {
  const accepted = [instance.answer.canonical, ...instance.answer.accepted_alternatives]
    .filter((v): v is string => typeof v === 'string')
    .map(normalize);
  return accepted.includes(normalize(input));
}

/** The mastery signal the loop emits upward: which atom, right/wrong, and whether
 *  a hint was used (a hint-assisted correct must not advance mastery — U11/KTD10). */
export function toResult(instance: ExerciseInstance, correct: boolean, hintsUsed: number): AttemptResult {
  return { atom: instance.srs_tags[0] ?? null, correct, hintsUsed };
}
