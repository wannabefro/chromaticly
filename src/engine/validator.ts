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

import type { ChordEvent, Clef, Music, MusicEvent, NoteEvent, OrnamentKind } from '../music/types';
import { barUnitsFor } from './generators/bar-math';
import { CHORD_NUMERALS, ORNAMENT_KINDS, parseAtom } from './atoms';
import { CHORD_DEGREE_STEPS } from './generators/chord-recognition';
import { CLEFS_DISPLAY, DIRECTION_TABLE, FAMILIES, INSTRUMENT_TABLE } from './generators/instrument-knowledge';
import { ORNAMENT_NAMES } from './generators/ornament-recognition';
import { CHROMATIC_TONICS, chromaticPositionLabel, chromaticScaleAscending } from './generators/chromatic-scale';
import { DEGREE_ORDER, DISPLAY_NAMES, nameFromDisplay, nameFromOrdinal, ordinalOf, ORDINALS } from './generators/degree-name-id';
import { spellInKeySig } from './generators/key-spelling';
import { naturalPitchStepsAbove } from './generators/pitch-math';
import { diatonicIntervalNumber, intervalLabel, intervalQuality, parseIntervalLabel, pitchSemitone } from './interval-quality';
import { displayNote, ENHARMONIC_PARTNER } from './generators/enharmonic-recognition';
import { classifyMetre, isCompoundTimeSignature } from './metre';
import { musicEventUnits } from './music-event-units';
import { comfortablePitchRange, pitchRange, renderableTimeSignatures, scopeForGrade } from './scope';
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

  // Grades outside GRADE_SCOPES (0, 4, 99…) are a clean validation failure,
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

// Enharmonic-of-a-natural spellings: Cb, Fb, B#, E#. Cb/Fb are never taught
// through this slice — Cb first appears at Gb major, grade 5 — so they stay
// rejected at every grade (D6). B#/E# are grade-aware (D6): they hold
// through Grade 2 (Eb major is 3 flats Bb/Eb/Ab, and G2 harmonic-minor raised
// 7ths are G#/D#/C#; none of those spell a natural) but become LEGAL at
// Grade 3, where they're required — C# minor's raised 7th is B#, F# minor's
// is E# (both harmonic and melodic-ascending).
const NEVER_SPELLINGS_ALWAYS = new Set(['Cb', 'Fb']);
const NEVER_SPELLINGS_THROUGH_G2 = new Set(['B#', 'E#']);

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

function checkPitchScope(
  pitch: string,
  range: { low: string; high: string } | null,
  grade: number,
  errors: string[],
): void {
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
  // that regresses is caught at generation time via generateValidated. B#/E# are
  // grade-aware (D6) — legal from Grade 3, where they're the raised-7th spelling
  // of F#/C# minor.
  const spelling = `${parsed.letter}${parsed.accidental ?? ''}`;
  if (NEVER_SPELLINGS_ALWAYS.has(spelling) || (grade <= 2 && NEVER_SPELLINGS_THROUGH_G2.has(spelling))) {
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
        checkPitchScope(pitch, range, inst.grade, errors);
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
        checkPitchScope(pitch, pitchRange(music.clef, inst.grade), inst.grade, errors);
      }
    }
    if (typeof dur !== 'string' || !(scope.noteValues as readonly string[]).includes(dur)) {
      errors.push('interval_naming: stave_input canonical duration is outside G1 scope');
    }
    return errors;
  }

  // Grade is guaranteed valid here — validate() already rejected unsupported
  // grades before any hook runs.
  if (scopeForGrade(inst.grade).intervalRule.namingStyle === 'number_and_type') {
    return intervalNamingQualityErrors(inst, canonical);
  }

  const num = typeof canonical === 'number' ? canonical : typeof canonical === 'string' ? Number(canonical) : NaN;
  if (!Number.isInteger(num) || num < 1 || num > 8) {
    return ['interval_naming: canonical answer must be an interval number 1..8'];
  }
  return [];
}

// D5/D6/ORC(R6): the grade-3 mcq's canonical is a "<quality> <ordinal>" string
// label (e.g. "major 3rd"). Well-formedness alone (parseIntervalLabel not
// throwing) is not enough — a generator bug could emit a well-formed but
// WRONG label, so this independently RECOMPUTES {number, quality} from the
// stimulus chord's two rendered pitches and asserts the label matches; it
// never trusts the label itself for the number/quality it names.
function intervalNamingQualityErrors(inst: ExerciseInstance, canonical: unknown): string[] {
  const errors: string[] = [];

  if (typeof canonical !== 'string') {
    return ['interval_naming: number+type canonical answer must be a string label'];
  }
  try {
    parseIntervalLabel(canonical);
  } catch (err) {
    errors.push(`interval_naming: ${err instanceof Error ? err.message : String(err)}`);
  }

  const music = inst.stimulus.music as Music | null;
  const pitches = music ? music.voices.flatMap((voice) => voice.events).flatMap(eventPitches) : [];
  if (pitches.length !== 2) {
    errors.push('interval_naming: number+type stimulus must render exactly two pitches as a chord');
    return errors;
  }
  const [lower, upper] = pitches;

  try {
    const number = diatonicIntervalNumber(lower, upper);
    const quality = intervalQuality(lower, upper, number);
    const recomputed = intervalLabel(quality, number);
    if (canonical !== recomputed) {
      errors.push(
        `interval_naming: canonical "${canonical}" does not match the interval recomputed from the stimulus ("${recomputed}" for ${lower}->${upper})`,
      );
    }
  } catch (err) {
    errors.push(`interval_naming: ${err instanceof Error ? err.message : String(err)}`);
  }

  for (const d of inst.distractors) {
    if (typeof d !== 'string') {
      errors.push(`interval_naming: distractor "${String(d)}" is not a grade-3 interval label`);
      continue;
    }
    try {
      parseIntervalLabel(d);
    } catch (err) {
      errors.push(`interval_naming: distractor "${d}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return errors;
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

// scaleConstructionHook: D7's spot-the-wrong-note MCQ. Scope stays
// HARMONIC-ONLY this slice: this hook, together with checkScope on the
// stimulus (above), rejects anything the grade's minorForms doesn't list —
// neither checks the FORM directly (Music carries no form field), but a
// corrupted note outside the grade's key/pitch scope is caught by checkScope,
// and the generator's own form-keyed rule table (scale-construction.ts) is
// what keeps melodic unreachable at grade 2 structurally.
const ORDINAL_POSITION_RE = /^(1st|2nd|3rd|[4-8]th) note$/;

function scaleConstructionHook(inst: ExerciseInstance): string[] {
  const errors: string[] = [];
  const canonical = inst.answer.canonical;
  if (typeof canonical !== 'string' || !ORDINAL_POSITION_RE.test(canonical)) {
    errors.push('scale_construction: canonical answer must be an ordinal note position ("2nd note".."8th note")');
  }

  const answerMusic = inst.interaction.config?.answer_music as Music | undefined;
  if (!answerMusic || typeof answerMusic !== 'object') {
    errors.push('scale_construction: interaction.config.answer_music is required');
  } else {
    // Grade is guaranteed valid here — validate() already rejected unsupported
    // grades before any hook runs.
    const scope = scopeForGrade(inst.grade);
    const keySig = answerMusic.key_sig;
    const tonic = typeof keySig === 'string' ? keySig.split('_')[0] : null;
    if (!tonic || !scope.keysMinor.includes(tonic)) {
      errors.push(
        `scale_construction: answer_music key signature "${String(keySig)}" is not a grade ${inst.grade} minor key`,
      );
    }
  }

  const music = inst.stimulus.music as Music | null;
  const noteCount = music
    ? music.voices.flatMap((voice) => voice.events).filter((ev) => ev.type === 'note').length
    : 0;
  if (noteCount !== 8) {
    errors.push(`scale_construction: stimulus music must have exactly 8 note events (found ${noteCount})`);
  }

  return errors;
}

// chromaticScaleHook (fyu.4): recomputes the true 13-note chromatic scale
// from the srs_tag's tonic and the stimulus's own first note (never
// corrupted — tonic is always an interior-degree-only corruption target), so
// this never trusts the generator's own canonical/distractor picks.
function chromaticScaleHook(inst: ExerciseInstance): string[] {
  const errors: string[] = [];

  const tag = inst.srs_tags.find((t) => t.startsWith('scale:') && t.endsWith('_chromatic'));
  if (!tag) {
    errors.push('chromatic_scale: missing a scale:*_chromatic srs_tag');
    return errors;
  }
  const tonic = tag.slice('scale:'.length, tag.length - '_chromatic'.length);
  if (!CHROMATIC_TONICS.includes(tonic)) {
    errors.push(`chromatic_scale: tonic "${tonic}" is not an allowed chromatic tonic`);
    return errors;
  }

  const music = inst.stimulus.music as Music | null;
  if (!music) {
    errors.push('chromatic_scale: stimulus music is required');
    return errors;
  }
  const notes = music.voices
    .flatMap((v) => v.events)
    .filter((ev): ev is NoteEvent => ev.type === 'note')
    .map((ev) => ev.pitch);
  if (notes.length !== 13) {
    errors.push(`chromatic_scale: stimulus must have exactly 13 note events (found ${notes.length})`);
    return errors;
  }

  let trueScale: string[];
  try {
    trueScale = chromaticScaleAscending(notes[0]);
  } catch (err) {
    errors.push(`chromatic_scale: ${err instanceof Error ? err.message : String(err)}`);
    return errors;
  }

  const diffIndices = notes.reduce<number[]>((acc, note, i) => {
    if (note !== trueScale[i]) acc.push(i);
    return acc;
  }, []);
  if (diffIndices.length !== 1) {
    errors.push(`chromatic_scale: expected exactly one wrong note against the tonic-${tonic} true scale, found ${diffIndices.length}`);
    return errors;
  }

  const expectedCanonical = chromaticPositionLabel(diffIndices[0]);
  if (inst.answer.canonical !== expectedCanonical) {
    errors.push(
      `chromatic_scale: canonical "${String(inst.answer.canonical)}" does not name the actual wrong note "${expectedCanonical}"`,
    );
  }

  return errors;
}

// degreeNameIdHook (fyu.4): the prompt names the QUESTION direction
// unambiguously (name->ordinal vs ordinal->name), so the hook parses it back
// out and recomputes the expected canonical/distractor shape from the shared
// DEGREE_ORDER/ORDINALS/DISPLAY_NAMES map — never trusting the generator's
// own picks.
const NAME_TO_ORDINAL_PROMPT_RE = /^Which degree of a scale is the (.+)\?$/;
const ORDINAL_TO_NAME_PROMPT_RE = /^What is the technical name for the (\d+(?:st|nd|rd|th)) degree of a scale\?$/;

function degreeNameIdHook(inst: ExerciseInstance): string[] {
  const errors: string[] = [];
  const canonical = inst.answer.canonical;
  if (typeof canonical !== 'string') {
    errors.push('degree_name_id: canonical answer must be a string');
    return errors;
  }

  const nameMatch = NAME_TO_ORDINAL_PROMPT_RE.exec(inst.prompt);
  const ordinalMatch = ORDINAL_TO_NAME_PROMPT_RE.exec(inst.prompt);

  if (nameMatch) {
    const displayName = nameMatch[1];
    const name = nameFromDisplay(displayName);
    if (!name) {
      errors.push(`degree_name_id: prompt names an unknown degree "${displayName}"`);
      return errors;
    }
    const expectedOrdinal = ordinalOf(name);
    if (canonical !== expectedOrdinal) {
      errors.push(`degree_name_id: canonical "${canonical}" does not match the expected ordinal "${expectedOrdinal}"`);
    }
    for (const d of inst.distractors) {
      if (typeof d !== 'string' || !(ORDINALS as readonly string[]).includes(d)) {
        errors.push(`degree_name_id: distractor "${String(d)}" is not a valid ordinal`);
      }
    }
  } else if (ordinalMatch) {
    const ordinal = ordinalMatch[1];
    const name = nameFromOrdinal(ordinal);
    if (!name) {
      errors.push(`degree_name_id: prompt names an unknown ordinal "${ordinal}"`);
      return errors;
    }
    const expectedName = DISPLAY_NAMES[name];
    if (canonical !== expectedName) {
      errors.push(`degree_name_id: canonical "${canonical}" does not match the expected name "${expectedName}"`);
    }
    for (const d of inst.distractors) {
      if (typeof d !== 'string' || !DEGREE_ORDER.some((n) => DISPLAY_NAMES[n] === d)) {
        errors.push(`degree_name_id: distractor "${String(d)}" is not a valid degree name`);
      }
    }
  } else {
    errors.push('degree_name_id: prompt does not match either question direction');
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
    const durWord = words[0] === 'dotted' || words[0] === 'double-dotted' ? words[1] : words[0];
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

  // D6: distractors must be the SAME family (simple/compound) as the
  // canonical — vacuous-true for every grade-1/2 instance (all-simple).
  const canonicalFamily = classifyMetre(canonical).division;
  for (const d of inst.distractors) {
    if (classifyMetre(d as string).division !== canonicalFamily) {
      return [`add_time_signature: distractor "${String(d)}" is not the same family (simple/compound) as canonical "${canonical}"`];
    }
  }

  // D6/D5: when the stimulus carries a (hidden) time_sig, it must agree with
  // the canonical answer — the rendered bar must be a true bar of the answer
  // signature, not just a total that happens to match. Vacuous-true for
  // every grade-1/2 instance (time_sig: null).
  const stimulusTimeSig = (inst.stimulus.music as Music | null)?.time_sig;
  if (stimulusTimeSig != null && stimulusTimeSig !== canonical) {
    return [`add_time_signature: stimulus time_sig "${stimulusTimeSig}" does not match canonical answer "${canonical}"`];
  }

  return [];
}

// metreClassificationHook (D7): canonical must be one of the six legal
// {Simple,Compound} x {duple,triple,quadruple} labels AND must equal the
// label classifyMetre computes for the STIMULUS's own (printed, D8) time
// signature — the invariant that a generated instance can never mislabel the
// bar it renders. Distractors must also be legal labels, and distinct from
// the canonical and from each other.
const LEGAL_METRE_LABELS = new Set([
  'Simple duple',
  'Simple triple',
  'Simple quadruple',
  'Compound duple',
  'Compound triple',
  'Compound quadruple',
]);

function metreLabel(cls: { division: string; beats: string }): string {
  return `${cls.division === 'simple' ? 'Simple' : 'Compound'} ${cls.beats}`;
}

function metreClassificationHook(inst: ExerciseInstance): string[] {
  const canonical = inst.answer.canonical;
  if (typeof canonical !== 'string' || !LEGAL_METRE_LABELS.has(canonical)) {
    return [`metre_classification: canonical answer "${String(canonical)}" is not a legal metre label`];
  }

  const sig = (inst.stimulus.music as Music | null)?.time_sig;
  if (typeof sig !== 'string') {
    return ['metre_classification: stimulus must carry a time signature to classify'];
  }
  const expected = metreLabel(classifyMetre(sig));
  if (canonical !== expected) {
    return [
      `metre_classification: canonical answer "${canonical}" does not match the rendered signature "${sig}" (expected "${expected}")`,
    ];
  }

  const errors: string[] = [];
  const seen = new Set<string>([canonical]);
  for (const d of inst.distractors) {
    if (typeof d !== 'string' || !LEGAL_METRE_LABELS.has(d)) {
      errors.push(`metre_classification: distractor "${String(d)}" is not a legal metre label`);
      continue;
    }
    if (seen.has(d)) {
      errors.push(`metre_classification: distractor "${d}" duplicates the canonical answer or another distractor`);
      continue;
    }
    seen.add(d);
  }
  return errors;
}

// anacrusisRecognitionHook (D7, U3) — landed BEFORE the generator exists so
// the generator is born under it. Independently RECOMPUTES the pickup from
// the rendered stimulus stream rather than trusting the generator's own
// canonical/distractor labels (the intervalNamingQualityErrors/
// metreClassificationHook discipline).
const ANACRUSIS_OPTION_RE = /^\d+ beats?$/;

/** Splits a voice's events into bar-groups on barline events. Codex
 *  correction 2: the generator OMITS the trailing barline, so this never
 *  produces an empty trailing group for a well-formed instance — a stream
 *  ending in a barline would leave the empty group as-is, which the
 *  min-group-count/positive-pickup checks below then reject. */
function splitIntoBarGroups(events: MusicEvent[]): MusicEvent[][] {
  const groups: MusicEvent[][] = [[]];
  for (const ev of events) {
    if (ev.type === 'barline') {
      groups.push([]);
    } else {
      groups[groups.length - 1].push(ev);
    }
  }
  return groups;
}

function groupUnits(group: MusicEvent[]): number {
  return group.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
}

function beatsLabel(n: number): string {
  return `${n} beat${n === 1 ? '' : 's'}`;
}

function anacrusisRecognitionHook(inst: ExerciseInstance): string[] {
  const music = inst.stimulus.music as Music | null;
  const sig = music?.time_sig;

  // Self-consistency (D7 point 5): the marker + a printed (not hidden) simple
  // renderable metre — the learner must be able to see the signature they're
  // counting the upbeat against.
  if (!music || typeof sig !== 'string') {
    return ['anacrusis_recognition: stimulus must carry a time signature'];
  }
  if (music.anacrusis !== true) {
    return ['anacrusis_recognition: stimulus music must be marked anacrusis: true'];
  }
  if (music.time_sig_hidden) {
    return ['anacrusis_recognition: the time signature must be printed, not hidden'];
  }
  if (isCompoundTimeSignature(sig) || !renderableTimeSignatures(inst.grade).includes(sig)) {
    return [`anacrusis_recognition: "${sig}" is not a renderable simple time signature`];
  }

  const barUnits = barUnitsFor(sig);
  const groups = splitIntoBarGroups(music.voices[0]?.events ?? []);
  if (groups.length < 2) {
    return ['anacrusis_recognition: stimulus must render at least a pickup bar and a final bar'];
  }

  const totals = groups.map(groupUnits);
  const first = totals[0];
  const last = totals[totals.length - 1];
  const middles = totals.slice(1, -1);

  const errors: string[] = [];

  // Pickup correctness: a positive whole-beat partial bar, strictly short of a full bar.
  if (!(first > 0 && first < barUnits && first % 8 === 0)) {
    errors.push('anacrusis_recognition: the pickup bar is not a positive whole-beat partial bar');
  }

  // The ABRSM rule this lesson teaches: first + last bar = one whole bar.
  if (first + last !== barUnits) {
    errors.push('anacrusis_recognition: the first and last bars do not sum to one whole bar');
  }

  // Metrical validity: every middle bar is a full bar.
  if (middles.some((units) => units !== barUnits)) {
    errors.push('anacrusis_recognition: a middle bar is not a full bar for the stimulus time signature');
  }

  // Can never mislabel the rendered upbeat: canonical must equal the recomputed pickup label.
  const canonical = inst.answer.canonical;
  if (first > 0 && first % 8 === 0) {
    const expected = beatsLabel(first / 8);
    if (canonical !== expected) {
      errors.push(
        `anacrusis_recognition: canonical "${String(canonical)}" does not match the rendered pickup (expected "${expected}")`,
      );
    }
  }

  if (typeof canonical !== 'string' || !ANACRUSIS_OPTION_RE.test(canonical)) {
    errors.push(`anacrusis_recognition: canonical answer "${String(canonical)}" is not an "N beat(s)" label`);
  }

  const seen = new Set<string>([String(canonical)]);
  for (const d of inst.distractors) {
    if (typeof d !== 'string' || !ANACRUSIS_OPTION_RE.test(d)) {
      errors.push(`anacrusis_recognition: distractor "${String(d)}" is not an "N beat(s)" label`);
      continue;
    }
    if (seen.has(d)) {
      errors.push(`anacrusis_recognition: distractor "${d}" duplicates the canonical answer or another distractor`);
      continue;
    }
    seen.add(d);
  }

  return errors;
}

/** Strips a scientific pitch's accidental, keeping letter+octave — a
 *  validator-local duplicate of StaveInput's naturalOf (UI and engine stay
 *  decoupled per the portable-core boundary, so this isn't shared code). */
function naturalLetterOf(pitch: string): string {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(pitch);
  return m ? `${m[1]}${m[3]}` : pitch;
}

// CLEF_RANK orders clefs by pitch height (bass lowest, treble highest) so the
// expected up/down direction is a lookup, not a ternary. Deliberately NOT
// imported from octave-transposition.ts — this is an independent recompute,
// so a generator/validator disagreement fails loud instead of silently
// agreeing with itself (must be kept in sync by hand).
const CLEF_RANK: Record<Clef, number> = { treble: 2, alto: 1, bass: 0 };

// octaveTranspositionHook (D1/D4/D8, Codex findings 1/2, widened to alto by
// fyu.5) — independently RECOMPUTES each per_item target from the stimulus,
// never trusting the generator's own per_item array (the
// intervalNamingQualityErrors/metreClassificationHook recompute-don't-trust
// discipline): target pitch = spellInKeySig(naturalPitchStepsAbove(natural
// (source), direction === 'down' ? -7 : +7), music.key_sig) — NOT
// spellInKey(natural, tonic), which would double-append "_major" onto the
// already-full-form key_sig (Codex finding 2). Target (dur, dots) must equal
// the source's exactly (Codex finding 1: dots live apart from dur on
// NoteEvent, so a {pitch,dur}-only recompute would silently pass a dropped
// dot).
function octaveTranspositionHook(inst: ExerciseInstance): string[] {
  const music = inst.stimulus.music as Music | null;
  if (!music) return ['octave_transposition: stimulus.music is required'];
  if (typeof music.key_sig !== 'string') return ['octave_transposition: stimulus.music.key_sig is required'];

  const config = inst.interaction.config as { answerClef?: unknown; direction?: unknown } | undefined;
  const answerClef = config?.answerClef;
  const direction = config?.direction;
  if (answerClef !== 'treble' && answerClef !== 'bass' && answerClef !== 'alto') {
    return ['octave_transposition: interaction.config.answerClef must be "treble", "bass", or "alto"'];
  }
  if (direction !== 'up' && direction !== 'down') {
    return ['octave_transposition: interaction.config.direction must be "up" or "down"'];
  }
  const givenClef = music.clef;
  if (givenClef !== 'treble' && givenClef !== 'bass' && givenClef !== 'alto') {
    return [`octave_transposition: stimulus.music.clef "${String(givenClef)}" is not a recognized clef`];
  }

  const errors: string[] = [];

  // D1: the answer stave is a DIFFERENT clef, and direction is coupled to
  // the clef pair — same-clef octave is explicitly NOT this template.
  if (answerClef === givenClef) {
    errors.push('octave_transposition: answerClef must be different from the given clef');
  }
  const expectedDirection: 'up' | 'down' = CLEF_RANK[answerClef] < CLEF_RANK[givenClef] ? 'down' : 'up';
  if (direction !== expectedDirection) {
    errors.push(
      `octave_transposition: direction "${String(direction)}" does not match the given clef "${givenClef}" (expected "${expectedDirection}")`,
    );
  }

  const sourceNotes = music.voices.flatMap((v) => v.events).filter((ev): ev is NoteEvent => ev.type === 'note');
  const perItem = inst.answer.per_item;
  if (!Array.isArray(perItem)) {
    errors.push('octave_transposition: answer.per_item must be an array');
    return errors;
  }
  if (perItem.length !== sourceNotes.length) {
    errors.push(
      `octave_transposition: per_item length (${perItem.length}) does not match the stimulus note count (${sourceNotes.length})`,
    );
    return errors;
  }

  // inst.grade, mirroring the generator (octave-transposition.ts's build()) —
  // grade 3 samples treble<->bass, grade 4 always includes alto; the
  // generator now samples content from inst.grade's own scope directly (no
  // fixed GENERATOR_GRADE constant), so the validator must match.
  const givenRange = comfortablePitchRange(givenClef, inst.grade);
  const answerRange = comfortablePitchRange(answerClef, inst.grade);
  const delta = direction === 'down' ? -7 : 7;

  sourceNotes.forEach((source, i) => {
    const item = perItem[i] as { pitch?: unknown; dur?: unknown; dots?: unknown } | null;
    if (!item || typeof item.pitch !== 'string' || typeof item.dur !== 'string') {
      errors.push(`octave_transposition: per_item[${i}] must be a {pitch, dur} object`);
      return;
    }

    const natural = naturalLetterOf(source.pitch);
    const expectedTarget = spellInKeySig(naturalPitchStepsAbove(natural, delta), music.key_sig as string);
    if (item.pitch !== expectedTarget) {
      errors.push(
        `octave_transposition: per_item[${i}].pitch "${item.pitch}" does not match the recomputed octave target ` +
          `"${expectedTarget}" (a 7th, not an octave, is the exact misconception this rejects)`,
      );
    }
    if (item.dur !== source.dur) {
      errors.push(
        `octave_transposition: per_item[${i}].dur "${String(item.dur)}" does not match the source rhythm "${source.dur}"`,
      );
    }
    const sourceDots = source.dots ?? 0;
    const itemDots = typeof item.dots === 'number' ? item.dots : 0;
    if (itemDots !== sourceDots) {
      errors.push(
        `octave_transposition: per_item[${i}].dots (${itemDots}) does not match the source rhythm's dots (${sourceDots})`,
      );
    }

    checkPitchScope(source.pitch, givenRange, inst.grade, errors);
    checkPitchScope(item.pitch, answerRange, inst.grade, errors);
  });

  if (typeof music.time_sig !== 'string') {
    errors.push('octave_transposition: stimulus must carry a time signature');
    return errors;
  }
  const barUnits = barUnitsFor(music.time_sig);
  const groups = splitIntoBarGroups(music.voices[0]?.events ?? []).filter((g) => g.length > 0);
  if (groups.length !== 2) {
    errors.push(`octave_transposition: stimulus must render exactly 2 bars (found ${groups.length})`);
  }
  for (const group of groups) {
    const units = group.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
    if (units !== barUnits) {
      errors.push(
        `octave_transposition: a bar sums to ${units} units, not a full bar of ${music.time_sig} (${barUnits} units)`,
      );
    }
  }

  return errors;
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

// dupletRecognitionHook (fyu.7) — recompute-don't-trust: the stimulus must
// carry exactly one duplet (two tuplet-marked notes, size 2, start on the
// first), sit in a compound signature, sum to a whole number of compound
// beats, and its canonical/distractors must match the two legal question
// variants ("three" / "one").
function dupletRecognitionHook(inst: ExerciseInstance): string[] {
  const errors: string[] = [];
  const music = inst.stimulus.music as Music | null;
  if (!music) return ['duplet_recognition: stimulus music is required'];
  if (!music.time_sig || !isCompoundTimeSignature(music.time_sig)) {
    return [`duplet_recognition: "${String(music.time_sig)}" is not a compound time signature`];
  }

  const events = music.voices.flatMap((v) => v.events);
  const tupletNotes = events.filter((ev): ev is NoteEvent => ev.type === 'note' && ev.tuplet !== undefined);
  if (tupletNotes.length !== 2 || tupletNotes.some((n) => n.tuplet!.size !== 2 || n.tuplet!.inTimeOf !== 3)) {
    errors.push('duplet_recognition: stimulus must contain exactly one duplet (two 2-in-3 notes)');
  } else if (!tupletNotes[0].tuplet!.start || tupletNotes[1].tuplet!.start) {
    errors.push('duplet_recognition: the duplet must mark its first note as the group start');
  }

  const total = events.reduce((sum, ev: MusicEvent) => sum + musicEventUnits(ev), 0);
  if (total !== barUnitsFor(music.time_sig)) {
    errors.push(`duplet_recognition: bar sums to ${total}, not a full ${music.time_sig} bar`);
  }

  const canonical = inst.answer.canonical;
  const legal: Record<string, string[]> = { three: ['two', 'four'], one: ['two', 'three'] };
  if (typeof canonical !== 'string' || !(canonical in legal)) {
    errors.push(`duplet_recognition: canonical "${String(canonical)}" is not a legal duplet answer`);
  } else if (JSON.stringify([...inst.distractors].sort()) !== JSON.stringify([...legal[canonical]].sort())) {
    errors.push(`duplet_recognition: distractors do not match the "${canonical}" variant`);
  }

  return errors;
}

/** Asserts `pitches` is a root-position MAJOR triad (root-third a major 3rd,
 *  third-fifth a minor 3rd) — pushed onto `errors` with the given `label`
 *  prefix rather than thrown, so a caller checking several triads (the
 *  stimulus chord, then each of config.triads' three entries) collects every
 *  failure in one pass. */
function assertMajorTriad(pitches: unknown, label: string, errors: string[]): void {
  if (!Array.isArray(pitches) || pitches.length !== 3 || pitches.some((p) => typeof p !== 'string')) {
    errors.push(`chord_recognition: ${label} must be exactly 3 spelled pitches`);
    return;
  }
  const [root, third, fifth] = pitches as string[];
  try {
    const thirdNumber = diatonicIntervalNumber(root, third);
    const thirdQuality = intervalQuality(root, third, thirdNumber);
    if (thirdNumber !== 3 || thirdQuality !== 'major') {
      errors.push(`chord_recognition: ${label} root-third is not a major 3rd (got number ${thirdNumber}, quality ${thirdQuality})`);
    }
    const fifthNumber = diatonicIntervalNumber(third, fifth);
    const fifthQuality = intervalQuality(third, fifth, fifthNumber);
    if (fifthNumber !== 3 || fifthQuality !== 'minor') {
      errors.push(`chord_recognition: ${label} third-fifth is not a minor 3rd (got number ${fifthNumber}, quality ${fifthQuality})`);
    }
  } catch (err) {
    errors.push(`chord_recognition: ${label}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// chordRecognitionHook (fyu.10) — recompute-don't-trust: the numeral is
// recomputed from the stimulus chord's ROOT LETTER's diatonic distance above
// the key's tonic (CHORD_DEGREE_STEPS, shared with the generator as fixed
// music theory — not a trust of the generator's own srs_tags/canonical pick),
// the stimulus chord and every entry of interaction.config.triads must each
// independently be a root-position major triad, and config.triads[canonical]
// must be the exact stimulus chord (the UI replays a tapped chip's chord from
// this map, so it must never disagree with what's actually notated).
function chordRecognitionHook(inst: ExerciseInstance): string[] {
  const errors: string[] = [];
  const music = inst.stimulus.music as Music | null;
  if (!music) return ['chord_recognition: stimulus music is required'];
  if (typeof music.key_sig !== 'string') return ['chord_recognition: stimulus must carry a key signature'];
  const [tonic, mode] = music.key_sig.split('_');
  if (mode !== 'major') return [`chord_recognition: key signature "${music.key_sig}" is not a major key`];

  const chordEvents = music.voices.flatMap((v) => v.events).filter((ev): ev is ChordEvent => ev.type === 'chord');
  if (chordEvents.length !== 1 || chordEvents[0].pitches.length !== 3) {
    return ['chord_recognition: stimulus must contain exactly one chord event with exactly 3 pitches'];
  }
  const stimulusPitches = chordEvents[0].pitches;
  const [root] = stimulusPitches;

  const rootLetterMatch = /^([A-G])/.exec(root);
  if (!rootLetterMatch) {
    errors.push(`chord_recognition: chord root "${root}" is not a spelled pitch`);
  } else {
    const steps = (LETTER_ORDER.indexOf(rootLetterMatch[1] as (typeof LETTER_ORDER)[number]) -
      LETTER_ORDER.indexOf(tonic[0] as (typeof LETTER_ORDER)[number]) +
      7) %
      7;
    const recomputedNumeral = Object.entries(CHORD_DEGREE_STEPS).find(([, s]) => s === steps)?.[0];
    if (!recomputedNumeral) {
      errors.push(`chord_recognition: chord root "${root}" does not sit on a primary-triad degree (I/IV/V) of ${music.key_sig}`);
    } else if (inst.answer.canonical !== recomputedNumeral) {
      errors.push(
        `chord_recognition: canonical "${String(inst.answer.canonical)}" does not match the numeral recomputed from the stimulus root ("${recomputedNumeral}")`,
      );
    }
  }

  assertMajorTriad(stimulusPitches, 'the stimulus chord', errors);

  if (!(CHORD_NUMERALS as readonly string[]).includes(inst.answer.canonical as string)) {
    errors.push(`chord_recognition: canonical "${String(inst.answer.canonical)}" is not a legal chord numeral`);
  }
  const expectedDistractors = CHORD_NUMERALS.filter((n) => n !== inst.answer.canonical);
  if (JSON.stringify([...inst.distractors].sort()) !== JSON.stringify([...expectedDistractors].sort())) {
    errors.push('chord_recognition: distractors must be exactly the other two primary-triad numerals');
  }

  const triads = inst.interaction.config?.triads as Record<string, unknown> | undefined;
  if (!triads || typeof triads !== 'object') {
    errors.push('chord_recognition: interaction.config.triads is required');
    return errors;
  }
  for (const numeral of CHORD_NUMERALS) {
    assertMajorTriad(triads[numeral], `config.triads.${numeral}`, errors);
  }
  if (!deepEqual(triads[inst.answer.canonical as string], stimulusPitches)) {
    errors.push('chord_recognition: config.triads[answer.canonical] does not match the stimulus chord\'s pitches');
  }

  return errors;
}

// ornamentRecognitionHook (fyu.11) — recompute-don't-trust: reads
// interaction.config.ornament (the kind), asserts exactly one stimulus note
// carries an ornament matching that kind, asserts canonical/distractors
// against ORNAMENT_NAMES (never trusting the generator's own picks), and
// asserts grace kinds (acciaccatura/appoggiatura) carry a grace pitch while
// decoration kinds (trill/turn/mordents) do not.
function ornamentRecognitionHook(inst: ExerciseInstance): string[] {
  const errors: string[] = [];
  const config = inst.interaction.config as { ornament?: unknown } | undefined;
  const kind = config?.ornament;
  if (typeof kind !== 'string' || !(ORNAMENT_KINDS as readonly string[]).includes(kind)) {
    return [`ornament_recognition: interaction.config.ornament "${String(kind)}" is not a legal ornament kind`];
  }

  const music = inst.stimulus.music as Music | null;
  if (!music) return ['ornament_recognition: stimulus music is required'];
  const ornamentedNotes = music.voices
    .flatMap((v) => v.events)
    .filter((ev): ev is NoteEvent => ev.type === 'note' && ev.ornament !== undefined);
  if (ornamentedNotes.length !== 1) {
    return [
      `ornament_recognition: stimulus must contain exactly one note carrying an ornament (found ${ornamentedNotes.length})`,
    ];
  }
  const ornament = ornamentedNotes[0].ornament!;
  if (ornament.kind !== kind) {
    errors.push(
      `ornament_recognition: stimulus ornament kind "${ornament.kind}" does not match config.ornament "${kind}"`,
    );
  }

  const isGrace = kind === 'acciaccatura' || kind === 'appoggiatura';
  if (isGrace && ornament.pitch === undefined) {
    errors.push(`ornament_recognition: grace ornament "${kind}" must carry a grace pitch`);
  }
  if (!isGrace && ornament.pitch !== undefined) {
    errors.push(`ornament_recognition: decoration ornament "${kind}" must not carry a grace pitch`);
  }

  const expectedCanonical = ORNAMENT_NAMES[kind as OrnamentKind];
  if (inst.answer.canonical !== expectedCanonical) {
    errors.push(
      `ornament_recognition: canonical "${String(inst.answer.canonical)}" does not match "${expectedCanonical}" for kind "${kind}"`,
    );
  }

  const nameSet = new Set(Object.values(ORNAMENT_NAMES));
  const seen = new Set<string>([expectedCanonical]);
  for (const d of inst.distractors) {
    if (typeof d !== 'string' || !nameSet.has(d)) {
      errors.push(`ornament_recognition: distractor "${String(d)}" is not a legal ornament name`);
      continue;
    }
    if (seen.has(d)) {
      errors.push(`ornament_recognition: distractor "${d}" duplicates the canonical answer or another distractor`);
      continue;
    }
    seen.add(d);
  }

  return errors;
}

// instrumentKnowledgeHook (grade-4 instrument-knowledge slice) —
// recompute-don't-trust: derives the instrument from the mcq's own srs_tag
// and recomputes canonical/distractors against INSTRUMENT_TABLE/FAMILIES/
// CLEFS_DISPLAY, or (drag_match) recomputes each direction's meaning against
// DIRECTION_TABLE — never trusting the generator's own picks.
function instrumentKnowledgeHook(inst: ExerciseInstance): string[] {
  const errors: string[] = [];

  if (inst.interaction.type === 'mcq') {
    if (inst.srs_tags.length !== 1) {
      return ['instrument_knowledge: mcq srs_tags must name exactly one atom'];
    }
    const tag = inst.srs_tags[0];
    const { kind, parts } = parseAtom(tag);
    const [instrument] = parts;
    if (!(instrument in INSTRUMENT_TABLE)) {
      return [`instrument_knowledge: srs_tag "${tag}" names an unknown instrument`];
    }

    if (kind === 'instrument_family') {
      const family = INSTRUMENT_TABLE[instrument].family;
      if (inst.answer.canonical !== family) {
        errors.push(
          `instrument_knowledge: canonical "${String(inst.answer.canonical)}" does not match ${instrument}'s family "${family}"`,
        );
      }
      const expectedDistractors = FAMILIES.filter((f) => f !== family);
      if (JSON.stringify([...inst.distractors].sort()) !== JSON.stringify([...expectedDistractors].sort())) {
        errors.push('instrument_knowledge: family distractors must be exactly the other three families');
      }
    } else if (kind === 'instrument_clef') {
      const clef = INSTRUMENT_TABLE[instrument].clef;
      if (inst.answer.canonical !== clef) {
        errors.push(
          `instrument_knowledge: canonical "${String(inst.answer.canonical)}" does not match ${instrument}'s clef "${clef}"`,
        );
      }
      const expectedDistractors = CLEFS_DISPLAY.filter((c) => c !== clef);
      if (JSON.stringify([...inst.distractors].sort()) !== JSON.stringify([...expectedDistractors].sort())) {
        errors.push('instrument_knowledge: clef distractors must be exactly the other two clefs');
      }
    } else {
      errors.push(`instrument_knowledge: mcq srs_tag "${tag}" has an unexpected kind "${kind}"`);
    }
    return errors;
  }

  if (inst.interaction.type === 'drag_match') {
    const config = inst.interaction.config as { left?: unknown; right?: unknown } | undefined;
    const left = config?.left;
    if (!Array.isArray(left) || left.length === 0 || left.some((t) => typeof t !== 'string')) {
      return ['instrument_knowledge: drag_match config.left must be a non-empty array of direction terms'];
    }
    for (const term of left as string[]) {
      if (!(term in DIRECTION_TABLE)) {
        errors.push(`instrument_knowledge: config.left term "${term}" is not a known direction`);
      }
    }

    const right = config?.right;
    if (!Array.isArray(right) || right.length !== left.length) {
      errors.push('instrument_knowledge: drag_match config.right must be the same length as config.left');
    } else {
      const expectedMeanings = (left as string[]).map((t) => DIRECTION_TABLE[t]);
      if (JSON.stringify([...right].sort()) !== JSON.stringify([...expectedMeanings].sort())) {
        errors.push("instrument_knowledge: config.right is not a permutation of config.left's meanings");
      }
    }

    const canonical = inst.answer.canonical;
    if (!canonical || typeof canonical !== 'object' || Array.isArray(canonical)) {
      errors.push('instrument_knowledge: drag_match canonical must be a {term: meaning} object');
    } else {
      for (const term of left as string[]) {
        const expected = DIRECTION_TABLE[term];
        if ((canonical as Record<string, unknown>)[term] !== expected) {
          errors.push(`instrument_knowledge: canonical["${term}"] does not match "${expected}"`);
        }
      }
    }

    const expectedTags = (left as string[]).map((t) => `direction:${t}`);
    if (JSON.stringify([...inst.srs_tags].sort()) !== JSON.stringify([...expectedTags].sort())) {
      errors.push('instrument_knowledge: srs_tags must cover exactly the direction terms in the match, no more and no fewer');
    }
    return errors;
  }

  return [`instrument_knowledge: unexpected interaction.type "${inst.interaction.type}"`];
}

// enharmonicRecognitionHook (grade-4 enharmonic-equivalents slice, chromaticly-xbu)
// — reads the enharmonic:<note> atom from srs_tags and recomputes the answer's
// validity from PITCH SEMITONES (not the ENHARMONIC_PARTNER table): the canonical
// must be the same pitch class and a different letter, and the distractors must be
// exactly the two pair-member natural letters.
function enharmonicRecognitionHook(inst: ExerciseInstance): string[] {
  if (inst.interaction.type !== 'mcq') {
    return [`enharmonic_recognition: unexpected interaction.type "${inst.interaction.type}"`];
  }
  if (inst.srs_tags.length !== 1) {
    return ['enharmonic_recognition: srs_tags must name exactly one atom'];
  }
  const { kind, parts } = parseAtom(inst.srs_tags[0]);
  const [note] = parts;
  if (kind !== 'enharmonic' || !(note in ENHARMONIC_PARTNER)) {
    return [`enharmonic_recognition: srs_tag "${inst.srs_tags[0]}" does not name a known enharmonic note`];
  }

  const canonical = inst.answer.canonical;
  if (typeof canonical !== 'string') {
    return ['enharmonic_recognition: mcq canonical must be a string'];
  }

  const errors: string[] = [];
  const answerAscii = canonical.replace('♯', '#').replace('♭', 'b');
  const pitchClass = (n: string) => (((pitchSemitone(`${n}4`) % 12) + 12) % 12);
  if (pitchClass(answerAscii) !== pitchClass(note)) {
    errors.push(`enharmonic_recognition: canonical "${canonical}" is not the same pitch as "${displayNote(note)}"`);
  }
  if (answerAscii[0] === note[0]) {
    errors.push(`enharmonic_recognition: canonical "${canonical}" must be spelled with a different letter from "${displayNote(note)}"`);
  }

  const expectedDistractors = [displayNote(note[0]), displayNote(ENHARMONIC_PARTNER[note][0])];
  if (JSON.stringify([...inst.distractors].sort()) !== JSON.stringify([...expectedDistractors].sort())) {
    errors.push('enharmonic_recognition: distractors must be exactly the two pair-member natural letters');
  }
  return errors;
}

const TEMPLATE_HOOKS: Record<string, TemplateHook> = {
  note_naming: noteNamingHook,
  interval_naming: intervalNamingHook,
  interval_naming_stave_input: intervalNamingHook,
  key_signature_id: keySignatureIdHook,
  mode_swap: modeSwapHook,
  scale_construction: scaleConstructionHook,
  rhythm_sum: rhythmSumHook,
  term_meaning: termMeaningHook,
  bar_validity: barValidityHook,
  add_time_signature: addTimeSignatureHook,
  metre_classification: metreClassificationHook,
  anacrusis_recognition: anacrusisRecognitionHook,
  duplet_recognition: dupletRecognitionHook,
  octave_transposition: octaveTranspositionHook,
  chromatic_scale: chromaticScaleHook,
  degree_name_id: degreeNameIdHook,
  chord_recognition: chordRecognitionHook,
  ornament_recognition: ornamentRecognitionHook,
  instrument_knowledge: instrumentKnowledgeHook,
  enharmonic_recognition: enharmonicRecognitionHook,
};
