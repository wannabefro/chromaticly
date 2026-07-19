// Tier-A validator (spec §5 commandments 1/3/4/6, §6 checklist) — the quality
// gate every generated instance must pass before being served (KTD5).
//
// Pure TypeScript, no DOM. Deliberately does NOT check ABC parseability:
// abcjs is DOM/Web-Audio-only and can only run inside the music-surface
// WebView (KTD2), never on the RN JS thread this module runs on. "ABC
// compiles" is covered elsewhere — the emitter's own tests, and the WebView's
// runtime `error` event as a backstop — not here.
//
// accepted_alternatives (commandment 5) are computed by each generator, not
// hand-listed or computed here; this validator only avoids ever rejecting an
// answer that already appears in that list — it does not grade.

import type { Music } from '../music/types';
import { pitchRange, scopeForGrade } from './scope';
import type { GradeScope } from './scope';
import type { ExerciseInstance } from './schema';
import { ExerciseInstanceSchema } from './schema';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validate(instance: ExerciseInstance): ValidationResult {
  const parsed = ExerciseInstanceSchema.safeParse(instance);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `schema: ${issue.path.join('.') || '(root)'}: ${issue.message}`),
    };
  }

  const inst = parsed.data;

  // Grades outside GRADE_SCOPES (0, 3, 99…) are a clean validation failure,
  // not a thrown exception — generateValidated's retry loop must be able to
  // treat "unsupported grade" like any other rejected instance.
  let scope: GradeScope;
  try {
    scope = scopeForGrade(inst.grade);
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)] };
  }

  const errors: string[] = [];

  checkScope(inst, scope, errors);
  checkClosedItemDistractors(inst, errors);

  const hook = TEMPLATE_HOOKS[inst.template_id];
  if (hook) errors.push(...hook(inst));

  return { ok: errors.length === 0, errors };
}

// --- Shared check: commandment 1 (scope is law) --------------------------

const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

// Enharmonic-of-a-natural spellings: Cb, Fb, B#, E#. Still holds through
// Grade 2 — Eb major is 3 flats (Bb/Eb/Ab), and G2 harmonic-minor raised 7ths
// are G#/D#/C#; none of those spell a natural. Cb first appears at Gb major,
// grade 5.
const NEVER_SPELLINGS_THROUGH_G2 = new Set(['Cb', 'Fb', 'B#', 'E#']);

interface ParsedPitch {
  letter: string;
  accidental: string | null; // '#' | '##' | 'b' | 'bb' | null
  octave: number;
}

function parseScientificPitch(pitch: string): ParsedPitch | null {
  const match = /^([A-G])(##|#|bb|b)?(-?\d+)$/.exec(pitch);
  if (!match) return null;
  const [, letter, symbol, octave] = match;
  return { letter, accidental: symbol ?? null, octave: Number(octave) };
}

function pitchOrdinal(letter: string, octave: number): number {
  return octave * 7 + LETTER_ORDER.indexOf(letter as (typeof LETTER_ORDER)[number]);
}

function checkPitchScope(pitch: string, range: { low: string; high: string } | null, errors: string[]): void {
  const parsed = parseScientificPitch(pitch);
  if (!parsed) {
    errors.push(`scope: "${pitch}" is not a valid pitch`);
    return;
  }
  if (parsed.accidental === '##' || parsed.accidental === 'bb') {
    errors.push(`scope: pitch "${pitch}" uses a double accidental, outside G1 scope`);
  }
  // The four accidental spellings that name a natural (Cb=B, Fb=E, B#=C, E#=F)
  // are never taught at Grade 1. Reject them as defence-in-depth so any generator
  // that regresses is caught at generation time via generateValidated.
  if (NEVER_SPELLINGS_THROUGH_G2.has(`${parsed.letter}${parsed.accidental ?? ''}`)) {
    errors.push(`scope: pitch "${pitch}" spells a natural (never used at Grade 1)`);
  }
  if (!range) return;
  const low = parseScientificPitch(range.low);
  const high = parseScientificPitch(range.high);
  if (!low || !high) return;
  const ord = pitchOrdinal(parsed.letter, parsed.octave);
  if (ord < pitchOrdinal(low.letter, low.octave) || ord > pitchOrdinal(high.letter, high.octave)) {
    errors.push(`scope: pitch "${pitch}" is outside the G1 range (${range.low}-${range.high})`);
  }
}

function eventPitches(ev: Music['voices'][number]['events'][number]): string[] {
  if (ev.type === 'note') return [ev.pitch];
  if (ev.type === 'chord') return ev.pitches;
  return [];
}

function checkScope(inst: ExerciseInstance, scope: GradeScope, errors: string[]): void {
  const music = inst.stimulus.music as Music | null;
  if (!music) return;

  const clefInScope = scope.clefs.includes(music.clef);
  if (!clefInScope) {
    errors.push(`scope: clef "${music.clef}" is outside G1 scope`);
  }
  const range = clefInScope ? scope.pitchRanges[music.clef] : null;

  if (music.key_sig != null) {
    const [tonic, mode] = music.key_sig.split('_');
    const tonicInScope =
      (mode === 'major' && scope.keysMajor.includes(tonic)) || (mode === 'minor' && scope.keysMinor.includes(tonic));
    if (!tonicInScope) {
      errors.push(`scope: key signature "${music.key_sig}" is outside G1 scope`);
    }
  }

  if (music.time_sig != null && !scope.timeSignatures.includes(music.time_sig)) {
    errors.push(`scope: time signature "${music.time_sig}" is outside G1 scope`);
  }

  for (const voice of music.voices) {
    for (const ev of voice.events) {
      if (ev.type === 'note' || ev.type === 'chord' || ev.type === 'rest') {
        if (!scope.noteValues.includes(ev.dur)) {
          errors.push(`scope: note value "${ev.dur}" is outside G1 scope`);
        }
      }
      for (const pitch of eventPitches(ev)) {
        checkPitchScope(pitch, range, errors);
      }
    }
  }
}

// --- Shared check: commandments 3/4 (diagnostic distractors, one answer) --

const CLOSED_INTERACTION_TYPES = new Set(['mcq', 'multi_select', 'true_false']);

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

function checkClosedItemDistractors(inst: ExerciseInstance, errors: string[]): void {
  if (!CLOSED_INTERACTION_TYPES.has(inst.interaction.type)) return;

  // A per-item instance (e.g. bar_validity's per-bar tick/cross) has no single
  // canonical answer + distractor pool — it's N independent true/false verdicts,
  // not "exactly one defensible answer among several options" (commandment 3/4
  // is about that latter shape). answer.per_item marks that different shape;
  // its own count/type coverage is barValidityHook's job, not this check's.
  if (inst.answer.per_item !== undefined) return;

  const distractors = inst.distractors;
  if (distractors.length === 0) {
    errors.push('closed item has no distractors (commandment 3)');
    return;
  }

  if (distractors.some((d) => deepEqual(d, inst.answer.canonical))) {
    errors.push('a distractor equals the canonical answer — not exactly one defensible answer (commandment 4)');
  }

  outer: for (let i = 0; i < distractors.length; i++) {
    for (let j = i + 1; j < distractors.length; j++) {
      if (deepEqual(distractors[i], distractors[j])) {
        errors.push('duplicate distractors present (commandment 3)');
        break outer;
      }
    }
  }
}

// --- Per-template hooks ----------------------------------------------------
// Thin, defensive stubs (missing optional fields → no error, not a crash).
// U6-U8 strengthen these as the generators land; the registry shape is the
// point here.

type TemplateHook = (instance: ExerciseInstance) => string[];

const NOTE_NAME_RE = /^[A-G]\s*(flat|sharp|#|b|♭|♯)?$/i;

function noteNamingHook(inst: ExerciseInstance): string[] {
  const errors: string[] = [];
  const canonical = inst.answer.canonical;
  if (typeof canonical !== 'string' || !NOTE_NAME_RE.test(canonical.trim())) {
    errors.push('note_naming: canonical answer is not a note name');
  }
  for (const d of inst.distractors) {
    if (typeof d !== 'string' || !NOTE_NAME_RE.test(d.trim())) {
      errors.push(`note_naming: distractor "${String(d)}" is not a note name`);
    }
  }
  return errors;
}

// U8/RD2: the stave_input variant's canonical answer is the SEMANTIC target
// { pitch, dur } (AD5) — a different shape from the mcq variant's interval
// number — so this hook branches on interaction.type rather than assuming a
// number. Both variants share one hook (registered under both template_ids
// below), matching the plan's "extend intervalNamingHook" instruction.
function intervalNamingHook(inst: ExerciseInstance): string[] {
  const canonical = inst.answer.canonical;

  if (inst.interaction.type === 'stave_input') {
    if (!canonical || typeof canonical !== 'object' || Array.isArray(canonical)) {
      return ['interval_naming: stave_input canonical answer must be a {pitch, dur} object'];
    }
    // Grade is guaranteed valid here — validate() already rejected unsupported
    // grades before any hook runs.
    const scope = scopeForGrade(inst.grade);
    const { pitch, dur } = canonical as { pitch?: unknown; dur?: unknown };
    const errors: string[] = [];
    if (typeof pitch !== 'string' || !/^[A-G](#|b)?-?\d+$/.test(pitch)) {
      errors.push('interval_naming: stave_input canonical pitch is not a valid scientific pitch');
    } else {
      const music = inst.stimulus.music as Music | null;
      if (music && scope.clefs.includes(music.clef)) {
        checkPitchScope(pitch, pitchRange(music.clef, inst.grade), errors);
      }
    }
    if (typeof dur !== 'string' || !(scope.noteValues as readonly string[]).includes(dur)) {
      errors.push('interval_naming: stave_input canonical duration is outside G1 scope');
    }
    return errors;
  }

  const num = typeof canonical === 'number' ? canonical : typeof canonical === 'string' ? Number(canonical) : NaN;
  if (!Number.isInteger(num) || num < 1 || num > 8) {
    return ['interval_naming: canonical answer must be an interval number 1..8'];
  }
  return [];
}

function extractKeyTonic(raw: string): string | null {
  // Capture the accidental too: a flat/sharp key's tonic is "Bb"/"Eb", not the
  // bare letter — grade-2 keysMajor holds "Bb", so dropping the "b" rejects every
  // flat-key candidate. Grade-1 keys are all single-letter, so this is a no-op there.
  const match = /^([A-G][b#]?)/.exec(raw.trim());
  return match ? match[1] : null;
}

// D10 (review finding 2): a bare key signature is ambiguous between its
// relative major and minor (A minor and C major share one signature), so
// key_signature_id — which names only the signature, not a tonic-context clue
// — must never accept a minor canonical or offer a minor distractor. This is
// defence in depth alongside the generator-layer guard
// (key-signature-id.ts:34): a future generator change cannot reintroduce the
// ambiguity past this validator. `mode_swap` exists precisely to test the
// relative relationship instead of the bare signature.
function keySignatureIdHook(inst: ExerciseInstance): string[] {
  const canonical = inst.answer.canonical;
  if (typeof canonical !== 'string') {
    return ['key_signature_id: canonical answer must be a key name string'];
  }
  // Grade is guaranteed valid here — validate() already rejected unsupported
  // grades before any hook runs.
  const scope = scopeForGrade(inst.grade);
  const tonic = extractKeyTonic(canonical);
  if (/minor/i.test(canonical)) {
    return [
      `key_signature_id: canonical key "${canonical}" names a minor key — a bare key signature cannot ` +
        'unambiguously name a minor key (D10); use mode_swap to test the relative relationship instead',
    ];
  }
  const tonicInScope = !!tonic && scope.keysMajor.includes(tonic);
  if (!tonicInScope) {
    return [`key_signature_id: canonical key "${canonical}" is outside grade ${inst.grade} scope`];
  }
  const errors: string[] = [];
  for (const d of inst.distractors) {
    if (typeof d === 'string' && /minor/i.test(d)) {
      errors.push(
        `key_signature_id: distractor "${d}" names a minor key — a bare key signature cannot unambiguously ` +
          'name a minor key (D10)',
      );
    }
  }
  return errors;
}

// modeSwapHook: canonical/distractors are "<Tonic> major"/"<Tonic> minor"
// strings whose tonic is in the grade's matching same-mode scope list —
// commandment 1 (scope is law) applied to a key-NAME MCQ rather than a
// notated stave, since mode_swap's stimulus is text-only (D3). Every
// distractor must also be the SAME mode as the canonical (D4: asking for a
// relative minor never offers a major-key distractor, and vice versa).
function modeSwapHook(inst: ExerciseInstance): string[] {
  const canonical = inst.answer.canonical;
  if (typeof canonical !== 'string') {
    return ['mode_swap: canonical answer must be a key name string'];
  }
  // Grade is guaranteed valid here — validate() already rejected unsupported
  // grades before any hook runs.
  const scope = scopeForGrade(inst.grade);
  const tonic = extractKeyTonic(canonical);
  const isMinor = /minor/i.test(canonical);
  const tonicInScope = !!tonic && (isMinor ? scope.keysMinor.includes(tonic) : scope.keysMajor.includes(tonic));
  if (!tonicInScope) {
    return [`mode_swap: canonical key "${canonical}" is outside grade ${inst.grade} scope`];
  }

  const errors: string[] = [];
  for (const d of inst.distractors) {
    if (typeof d !== 'string') {
      errors.push(`mode_swap: distractor "${String(d)}" is not a key name string`);
      continue;
    }
    const dIsMinor = /minor/i.test(d);
    if (dIsMinor !== isMinor) {
      errors.push(`mode_swap: distractor "${d}" is a different mode than the canonical answer`);
      continue;
    }
    const dTonic = extractKeyTonic(d);
    const dInScope = !!dTonic && (dIsMinor ? scope.keysMinor.includes(dTonic) : scope.keysMajor.includes(dTonic));
    if (!dInScope) {
      errors.push(`mode_swap: distractor "${d}" is outside grade ${inst.grade} scope`);
    }
  }
  return errors;
}

function rhythmSumHook(inst: ExerciseInstance): string[] {
  // Grade is guaranteed valid here — validate() already rejected unsupported
  // grades before any hook runs.
  const scope = scopeForGrade(inst.grade);
  const canonical = inst.answer.canonical;

  if (typeof canonical === 'object' && canonical !== null && 'dur' in canonical) {
    const dur = (canonical as { dur: unknown }).dur;
    if (typeof dur !== 'string' || !(scope.noteValues as readonly string[]).includes(dur)) {
      return ['rhythm_sum: canonical duration is outside G1 scope'];
    }
    return [];
  }

  if (typeof canonical === 'string') {
    const words = canonical.trim().toLowerCase().split(/\s+/);
    const durWord = words[0] === 'dotted' ? words[1] : words[0];
    if (!durWord || !(scope.noteValues as readonly string[]).includes(durWord)) {
      return [`rhythm_sum: canonical value "${canonical}" is not a single G1 note value`];
    }
    return [];
  }

  return ['rhythm_sum: canonical answer must name a single note value'];
}

// F10: the bar-identity metadata (interaction.config.bars) and the per-bar
// verdict array must agree on how many bars the item has — a mismatch means
// the UI would render the wrong number of controls or misalign a control to
// the wrong bar. Per-bar correctness itself (does the bar's rhythm actually
// sum right) is the generator's own responsibility/tests, not this hook's.
function barValidityHook(inst: ExerciseInstance): string[] {
  const perItem = inst.answer.per_item;
  if (!Array.isArray(perItem) || perItem.length === 0) {
    return ['bar_validity: answer.per_item must be a non-empty array of per-bar verdicts'];
  }
  if (!perItem.every((v) => typeof v === 'boolean')) {
    return ['bar_validity: every per_item entry must be a boolean'];
  }

  const bars = inst.interaction.config?.bars;
  if (!Array.isArray(bars)) {
    return ['bar_validity: interaction.config.bars metadata is missing'];
  }
  if (bars.length !== perItem.length) {
    return [
      `bar_validity: answer.per_item length (${perItem.length}) does not match interaction.config.bars length (${bars.length})`,
    ];
  }
  return [];
}

function addTimeSignatureHook(inst: ExerciseInstance): string[] {
  // Grade is guaranteed valid here — validate() already rejected unsupported
  // grades before any hook runs.
  const scope = scopeForGrade(inst.grade);
  const canonical = inst.answer.canonical;
  if (typeof canonical !== 'string' || !scope.timeSignatures.includes(canonical)) {
    return [`add_time_signature: canonical answer "${String(canonical)}" is not a G1 time signature`];
  }
  for (const d of inst.distractors) {
    if (typeof d !== 'string' || !scope.timeSignatures.includes(d)) {
      return [`add_time_signature: distractor "${String(d)}" is not a G1 time signature`];
    }
  }
  return [];
}

function termMeaningHook(inst: ExerciseInstance): string[] {
  const category = inst.interaction.config?.category;
  if (category === undefined) return []; // no category info carried — skip gracefully

  const errors: string[] = [];
  for (const d of inst.distractors) {
    if (d && typeof d === 'object' && 'category' in d) {
      if ((d as { category: unknown }).category !== category) {
        errors.push('term_meaning: distractor category does not match the answer category');
      }
    }
  }
  return errors;
}

const TEMPLATE_HOOKS: Record<string, TemplateHook> = {
  note_naming: noteNamingHook,
  interval_naming: intervalNamingHook,
  interval_naming_stave_input: intervalNamingHook,
  key_signature_id: keySignatureIdHook,
  mode_swap: modeSwapHook,
  rhythm_sum: rhythmSumHook,
  term_meaning: termMeaningHook,
  bar_validity: barValidityHook,
  add_time_signature: addTimeSignatureHook,
};
