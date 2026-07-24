// Pure grading + option-assembly core for the exercise loop (U10). Kept free of
// React/RN so the correctness rules — how each of the five G1 answer shapes is
// labelled, matched, and turned into a mastery result — are unit-testable
// without rendering. The UI layer (ExerciseLoop) is a thin shell over this.

import { scientificPitchOrdinal } from '../engine/generators/pitch-math';
import { mulberry32 } from '../engine/rng';
import type { ExerciseInstance } from '../engine/schema';
import type { Dots, Duration, Music } from '../music/types';

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
      // "double-dotted", matching the generator's own formatValue (rhythm-sum.ts)
      // and standard notation terminology — not the generic "2-dotted".
      if (dots === 2) return `double-dotted ${obj.dur}`;
      if (dots > 2) return `${dots}-dotted ${obj.dur}`;
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
function optionMusicKey(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  // A rhythm {dur,dots} answer (rhythm_sum, chromaticly-f9k) has no string form —
  // key its option_music by "dur:dots" so a note-value option can carry a glyph too.
  if (value && typeof value === 'object' && typeof (value as { dur?: unknown }).dur === 'string') {
    const v = value as { dur: string; dots?: number };
    return `${v.dur}:${v.dots ?? 0}`;
  }
  return undefined;
}

function optionMusicFor(instance: ExerciseInstance, value: unknown): Music | undefined {
  const key = optionMusicKey(value);
  if (key == null) return undefined;
  const map = instance.interaction.config?.option_music;
  if (!map || typeof map !== 'object') return undefined;
  return (map as Record<string, Music>)[key];
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

/** A stave-input placement is correct only when BOTH the placed pitch and
 *  duration match answer.canonical (AE5) — a right pitch at the wrong
 *  duration, or vice versa, is incorrect, with no partial credit. */
export function gradeStaveInput(instance: ExerciseInstance, response: { pitch: string; dur: string } | null): boolean {
  if (!response) return false;
  const canonical = instance.answer.canonical as { pitch?: unknown; dur?: unknown };
  return response.pitch === canonical.pitch && response.dur === canonical.dur;
}

/** A term↔meaning match (design 5f) is correct only when EVERY left term is
 *  paired with its canonical meaning — one wrong pair fails the whole item, no
 *  partial credit (mirrors gradeTrueFalse). `answer.canonical` is the correct
 *  `left -> right` map; the response is the learner's current pairing. */
export function gradeDragMatch(instance: ExerciseInstance, response: Record<string, string | null>): boolean {
  const answer = instance.answer.canonical as Record<string, string>;
  const leftKeys = Object.keys(answer);
  if (leftKeys.length === 0) return false;
  return leftKeys.every((k) => response[k] === answer[k]);
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

// --- transposition_input grading (Grade 3 octave transposition, D4/D5/D6) ---
// Per-note grading: one placement per per_item target, pitch-only (duration is
// copied automatically, never graded). `locked` starts empty and is only
// populated by transpositionBeginFix (D6, fix mode) — every function here
// treats an empty `locked` as "not in fix mode yet", not as a length mismatch.

export interface TranspositionResponse {
  placements: (string | null)[];
  locked: boolean[];
}

export interface TranspositionSummary {
  correct: number;
  total: number;
  message: string;
  fixLabel: string;
}

interface TranspositionTarget {
  pitch: string;
  dur: Duration;
  dots?: Dots;
}

function transpositionTargets(instance: ExerciseInstance): TranspositionTarget[] | null {
  const perItem = instance.answer.per_item;
  return Array.isArray(perItem) ? (perItem as TranspositionTarget[]) : null;
}

function naturalOfPitch(pitch: string): string {
  return pitch.replace(/[#b]/g, '');
}

function diatonicOrdinal(pitch: string): number {
  return scientificPitchOrdinal(naturalOfPitch(pitch));
}

/** The length guard every transposition grading function fails closed on
 *  (Codex finding 7, mirroring the per-item length check at :108 above):
 *  `placements` must line up 1:1 with `per_item`, and `locked` — once
 *  populated by fix mode — must too. Returns the validated targets, or null
 *  when the response is malformed so callers can fail closed. */
function validTranspositionResponse(instance: ExerciseInstance, response: TranspositionResponse): TranspositionTarget[] | null {
  const perItem = transpositionTargets(instance);
  if (!perItem) return null;
  if (response.placements.length !== perItem.length) return null;
  if (response.locked.length !== 0 && response.locked.length !== perItem.length) return null;
  return perItem;
}

/** Per-slot verdicts, in slot order — exact spelling match against per_item
 *  (durations are copied, not graded). Fails closed to `[]` on a malformed
 *  response (length guard) rather than throwing. */
export function transpositionVerdicts(instance: ExerciseInstance, response: TranspositionResponse): boolean[] {
  const perItem = validTranspositionResponse(instance, response);
  if (!perItem) return [];
  return response.placements.map((p, i) => p === perItem[i].pitch);
}

/** Correct only when EVERY slot's placement matches its target pitch exactly
 *  (spelling included — `F#4` is not satisfied by `F4`) — no partial credit. */
export function gradeTransposition(instance: ExerciseInstance, response: TranspositionResponse): boolean {
  const perItem = validTranspositionResponse(instance, response);
  if (!perItem) return false;
  return response.placements.every((p, i) => p === perItem[i].pitch);
}

/** 9b's misconception copy for the first wrong note. A placement exactly one
 *  diatonic step short of the octave reads as "a 7th, not an octave" — the
 *  classic near-miss (this ordinal model already treats one octave as 7
 *  diatonic steps, D8/pitch-math.ts, so a 7th sits exactly one step closer to
 *  the source than the octave-correct target). Anything else wrong — a
 *  different letter entirely, or the right letter at the wrong octave by more
 *  than one step — gets the generic name-the-right-letter message. */
function transpositionMisconceptionMessage(
  direction: 'up' | 'down',
  noteIndex: number,
  placed: string | null,
  targetPitch: string,
  intervalName?: string,
): string {
  const noteNumber = noteIndex + 1;
  if (placed == null) return `Note ${noteNumber} hasn't been placed yet.`;

  // Transposing-instrument mode (G5-4): the written line moves by a real
  // interval, not an octave, so the "7th vs octave" near-miss copy does not
  // apply. The classic error is writing the concert pitch (no transposition).
  if (intervalName) {
    return `Note ${noteNumber} isn't up a ${intervalName} from the concert line — writing it at concert pitch is the trap. The dashed green circle shows where it goes. Hear both to compare.`;
  }

  const diff = diatonicOrdinal(placed) - diatonicOrdinal(targetPitch);
  if (direction === 'down' && diff === 1) {
    return `Note ${noteNumber} is a 7th lower, not an octave — one position too high. The dashed green circle shows the octave spot. Hear both to compare.`;
  }
  if (direction === 'up' && diff === -1) {
    return `Note ${noteNumber} is a 7th higher, not an octave — one position too low. The dashed green circle shows the octave spot. Hear both to compare.`;
  }
  return `Note ${noteNumber} isn't the right letter name — check it against the given melody, one octave away.`;
}

/** The partial-credit summary (D5): non-null ONLY when some but not all notes
 *  are correct — all-right and all-wrong both return null and route to the
 *  existing plain correct/incorrect sheets, not this amber register. */
export function transpositionSummary(instance: ExerciseInstance, response: TranspositionResponse): TranspositionSummary | null {
  const perItem = validTranspositionResponse(instance, response);
  if (!perItem) return null;

  const verdicts = response.placements.map((p, i) => p === perItem[i].pitch);
  const correct = verdicts.filter(Boolean).length;
  const total = verdicts.length;
  if (correct === 0 || correct === total) return null;

  const wrongIndices = verdicts.reduce<number[]>((acc, ok, i) => (ok ? acc : [...acc, i]), []);
  const direction = (instance.interaction.config?.direction as 'up' | 'down' | undefined) ?? 'down';
  const intervalName = (instance.interaction.config?.banner as { intervalName?: string } | undefined)?.intervalName;
  const firstWrong = wrongIndices[0];
  const message = transpositionMisconceptionMessage(direction, firstWrong, response.placements[firstWrong], perItem[firstWrong].pitch, intervalName);
  const fixLabel = wrongIndices.length === 1 ? `Fix note ${firstWrong + 1}` : `Fix ${wrongIndices.length} notes`;

  return { correct, total, message, fixLabel };
}

/** D6 fix-mode re-entry: correct slots are kept and locked (✓, non-editable);
 *  wrong slots are cleared back to unanswered. Fails closed to a no-op
 *  (returns `response` unchanged) on a malformed response. */
export function transpositionBeginFix(instance: ExerciseInstance, response: TranspositionResponse): TranspositionResponse {
  const perItem = validTranspositionResponse(instance, response);
  if (!perItem) return response;

  const verdicts = response.placements.map((p, i) => p === perItem[i].pitch);
  return {
    placements: response.placements.map((p, i) => (verdicts[i] ? p : null)),
    locked: verdicts,
  };
}

/** The shared Check button's label (design's live "Check — 2 notes left"),
 *  falling back to plain "Check" once every slot is filled. */
export function transpositionCheckLabel(instance: ExerciseInstance, response: TranspositionResponse): string {
  const perItem = transpositionTargets(instance);
  const total = perItem ? perItem.length : response.placements.length;
  const remaining = total - response.placements.filter((p) => p !== null).length;
  return remaining <= 0 ? 'Check' : `Check — ${remaining} note${remaining === 1 ? '' : 's'} left`;
}
