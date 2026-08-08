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

import type { ChordEvent, Clef, Music, MusicEvent, NoteEvent, OrnamentKind, RestEvent } from '../music/types';
import { barUnitsFor } from './generators/bar-math';
import { parseRestLabel, restToken, restUnits } from './generators/rest-math';
import { CHORD_NUMERALS, CHORD_NUMERALS_G5, CHORD_NUMERALS_MINOR, CHORD_POSITIONS, INSTRUMENT_TRANSPOSITIONS, ORNAMENT_KINDS, parseAtom } from './atoms';
import { CHORD_DEGREE_STEPS } from './generators/chord-recognition';
import {
  CLEFS_DISPLAY,
  DIRECTION_TABLE,
  FAMILIES,
  INSTRUMENT_TABLE,
  SOUND_MECHANISMS,
  SOUND_TABLE,
  VOICE_RANK_WORD,
  VOICE_TABLE,
} from './generators/instrument-knowledge';
import { ORNAMENT_NAMES, realizeOrnament } from './generators/ornament-recognition';
import { ORNAMENT_WRITTEN_TO_SIGN } from './atoms';
import { METRE_REWRITE_PAIR, rescaleDots, type RewriteDirection } from './generators/metre-rewrite';
import { CHROMATIC_TONICS, chromaticPositionLabel, chromaticScaleAscending } from './generators/chromatic-scale';
import { DEGREE_ORDER, DISPLAY_NAMES, nameFromDisplay, nameFromOrdinal, ordinalOf, ORDINALS } from './generators/degree-name-id';
import { spellInKeySig } from './generators/key-spelling';
import { naturalPitchStepsAbove } from './generators/pitch-math';
import {
  COMPOUND_NUMBERS,
  diatonicIntervalNumber,
  intervalLabel,
  intervalQuality,
  parseIntervalLabel,
  pitchSemitone,
  simpleEquivalent,
} from './interval-quality';
import { displayNote, ENHARMONIC_PARTNER } from './generators/enharmonic-recognition';
import { classifyMetre, isCompoundTimeSignature } from './metre';
import { musicEventUnits } from './music-event-units';
import { comfortablePitchRange, diatonicPitchesInRange, pitchRange, renderableTimeSignatures, scopeForGrade } from './scope';
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

// Enharmonic-of-a-natural spellings: Cb, Fb, B#, E#. All four are grade-aware
// (D6), each admitted at the grade whose keys first require it.
//
//  • B#/E# hold through Grade 2 — Eb major is Bb/Eb/Ab and the G2 harmonic-minor
//    raised 7ths are G#/D#/C#, so none of those spells a natural — and become
//    LEGAL at Grade 3, where C# minor's raised 7th is B# and F# minor's is E#.
//  • Cb holds through Grade 4 and becomes LEGAL at Grade 5, where the six-flat
//    keys arrive: it is the 4th of Gb major and the 6th of Eb minor. Eb minor's
//    answer notation already spelled it correctly, so this only stops a Gb major
//    STIMULUS being rejected as out of scope.
//  • Fb stays rejected at every grade. It first appears in Cb major and Ab minor,
//    at seven flats, which this course never reaches.
const NEVER_SPELLINGS_ALWAYS = new Set(['Fb']);
const NEVER_SPELLINGS_THROUGH_G2 = new Set(['B#', 'E#']);
const NEVER_SPELLINGS_THROUGH_G4 = new Set(['Cb']);

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
  // Double accidentals enter scope at Grade 4 (KB grade_scopes["4"].adds.accidentals
  // = [double_sharp, double_flat]; chromaticly-9ig) — rejected below Grade 4.
  if ((parsed.accidental === '##' || parsed.accidental === 'bb') && grade < 4) {
    errors.push(`scope: pitch "${pitch}" uses a double accidental, outside G${grade} scope`);
  }
  // The four accidental spellings that name a natural (Cb=B, Fb=E, B#=C, E#=F)
  // are never taught at Grade 1. Reject them as defence-in-depth so any generator
  // that regresses is caught at generation time via generateValidated. B#/E# are
  // grade-aware (D6) — legal from Grade 3, where they're the raised-7th spelling
  // of F#/C# minor.
  const spelling = `${parsed.letter}${parsed.accidental ?? ''}`;
  if (
    NEVER_SPELLINGS_ALWAYS.has(spelling) ||
    (grade <= 2 && NEVER_SPELLINGS_THROUGH_G2.has(spelling)) ||
    (grade <= 4 && NEVER_SPELLINGS_THROUGH_G4.has(spelling))
  ) {
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

  // Grand-staff (G5-1 SATB, U8): each voice routes to a staff via `voice.staff`
  // and must be range-checked against THAT staff's clef, not the single
  // `music.clef` above — resolved once per staff index (not per voice) so a
  // clef shared by multiple voices isn't flagged twice. When `music.staves`
  // is absent this map stays null and every voice falls back to `range`,
  // which is the exact pre-U8 single-clef path (R7: byte-identical).
  const staveRanges: Map<number, { low: string; high: string } | null> | null = music.staves
    ? new Map(
        music.staves.map((staveClef, i): [number, { low: string; high: string } | null] => {
          const staveClefInScope = scope.clefs.includes(staveClef);
          if (!staveClefInScope) {
            errors.push(`scope: clef "${staveClef}" (staff ${i}) is outside grade ${inst.grade} scope`);
          }
          return [i, staveClefInScope ? scope.pitchRanges[staveClef] : null];
        }),
      )
    : null;

  for (const voice of music.voices) {
    const voiceRange = staveRanges ? staveRanges.get(voice.staff ?? 0) ?? null : range;
    for (const ev of voice.events) {
      if (ev.type === 'note' || ev.type === 'chord' || ev.type === 'rest') {
        if (!scope.noteValues.includes(ev.dur)) {
          errors.push(`scope: note value "${ev.dur}" is outside G1 scope`);
        }
      }
      for (const pitch of eventPitches(ev)) {
        checkPitchScope(pitch, voiceRange, inst.grade, errors);
      }
    }
  }
}

// --- Shared check: commandments 3/4 (diagnostic distractors, one answer) --

// voice_options (G5-1 SATB, U8) joins the closed set: per the U4 generator
// contract, answer.canonical is the target voice's name and distractors are
// the other three voice names — the same "one canonical + a distractor pool,
// no per_item" shape mcq/multi_select/true_false already have, so the
// integrity checks below (no distractor duplicates the canonical, no
// duplicate distractors) apply unmodified.
const CLOSED_INTERACTION_TYPES = new Set(['mcq', 'multi_select', 'true_false', 'voice_options']);

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

// chromaticly-9ig: also accept double-accidental note names — canonical
// "F double sharp" plus the accepted alternatives F##, Fx, F𝄪, Bbb, B𝄫.
const NOTE_NAME_RE = /^[A-G]\s*(double\s+(sharp|flat)|##|bb|𝄪|𝄫|x|flat|sharp|#|b|♭|♯)?$/i;

/** The stave_input variant answers with the SEMANTIC target { pitch, dur }
 *  (AD5), so it gets its own hook rather than the note-name regex above. */
function noteNamingStaveInputHook(inst: ExerciseInstance): string[] {
  const canonical = inst.answer.canonical;
  if (!canonical || typeof canonical !== 'object' || Array.isArray(canonical)) {
    return ['note_naming_stave_input: canonical answer must be a {pitch, dur} object'];
  }
  const scope = scopeForGrade(inst.grade);
  const { pitch, dur } = canonical as { pitch?: unknown; dur?: unknown };
  const errors: string[] = [];
  const clef = (inst.interaction.config as { clef?: unknown } | undefined)?.clef;
  if (typeof clef !== 'string' || !scope.clefs.includes(clef as Clef)) {
    errors.push('note_naming_stave_input: interaction.config.clef is missing or outside the grade');
  }
  if (typeof pitch !== 'string' || !/^[A-G](#|b)?-?\d+$/.test(pitch)) {
    errors.push('note_naming_stave_input: canonical pitch is not a placeable scientific pitch');
  } else if (typeof clef === 'string') {
    const natural = pitch.replace(/[#b]/g, '');
    if (!diatonicPitchesInRange(clef as Clef, inst.grade).includes(natural)) {
      errors.push(`note_naming_stave_input: ${natural} has no slot on the ${clef} stave at grade ${inst.grade}`);
    }
  }
  if (typeof dur !== 'string' || !(scope.noteValues as readonly string[]).includes(dur)) {
    errors.push('note_naming_stave_input: canonical duration is outside the grade scope');
  }
  return errors;
}

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

// The canonical here is the REDUCED label, so this cannot reuse intervalNamingHook
// (which asserts the label of the interval as written). It recomputes the written
// interval from the two rendered pitches and reduces it independently.
function intervalCompoundReduceHook(inst: ExerciseInstance): string[] {
  const canonical = inst.answer.canonical;
  if (typeof canonical !== 'string') {
    return ['interval_compound_reduce: canonical answer must be an interval label string'];
  }
  const music = inst.stimulus.music as Music | null;
  const pitches = music ? music.voices.flatMap((voice) => voice.events).flatMap(eventPitches) : [];
  if (pitches.length !== 2) {
    return ['interval_compound_reduce: the stimulus must render exactly two pitches as a chord'];
  }
  const [lower, upper] = pitches;
  const errors: string[] = [];
  try {
    const number = diatonicIntervalNumber(lower, upper);
    if (!COMPOUND_NUMBERS.includes(number)) {
      errors.push(`interval_compound_reduce: the stimulus spans a ${number}, which is not a compound interval`);
      return errors;
    }
    const recomputed = intervalLabel(intervalQuality(lower, upper, number), simpleEquivalent(number));
    if (canonical !== recomputed) {
      errors.push(
        `interval_compound_reduce: canonical "${canonical}" is not the reduction of ${lower}->${upper} ("${recomputed}")`,
      );
    }
  } catch (err) {
    errors.push(`interval_compound_reduce: ${err instanceof Error ? err.message : String(err)}`);
  }
  for (const d of inst.distractors) {
    if (typeof d !== 'string') {
      errors.push(`interval_compound_reduce: distractor "${String(d)}" is not an interval label`);
      continue;
    }
    if (d === canonical) errors.push(`interval_compound_reduce: distractor "${d}" repeats the canonical answer`);
  }
  return errors;
}

// The match shape asks the reverse question, so its invariant is about the
// OPTIONS: each bar must total exactly the signature that keys it, and no wrong
// bar may total the answer's (a 6-quaver bar answers 3/4 and 6/8 alike).
function timeSignatureMatchHook(inst: ExerciseInstance): string[] {
  const errors = addTimeSignatureHook(inst);
  if (errors.length > 0) return errors;

  const canonical = inst.answer.canonical as string;
  const options = inst.interaction.config?.option_music as Record<string, Music> | undefined;
  if (!options || !options[canonical]) {
    return ['time_signature_match: interaction.config.option_music must carry a bar for the canonical signature'];
  }
  for (const [sig, music] of Object.entries(options)) {
    const units = music.voices[0].events.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
    if (units !== barUnitsFor(sig)) {
      errors.push(`time_signature_match: the ${sig} option totals ${units} units, not the ${barUnitsFor(sig)} that bar needs`);
    }
    if (sig !== canonical && barUnitsFor(sig) === barUnitsFor(canonical)) {
      errors.push(`time_signature_match: option "${sig}" holds the same bar length as "${canonical}", so both are right`);
    }
    if (music.time_sig_hidden !== true) {
      errors.push(`time_signature_match: the ${sig} option prints its time signature, which gives the answer away`);
    }
  }
  return errors;
}

// The closing bar is deliberately absent here, so anacrusisRecognitionHook's
// "first + last = one bar" check cannot apply. What this shape must guarantee
// instead is that the answer IS that missing complement.
function anacrusisFinalBarHook(inst: ExerciseInstance): string[] {
  const music = inst.stimulus.music as Music | null;
  const sig = music?.time_sig;
  if (!music || typeof sig !== 'string') {
    return ['anacrusis_final_bar: stimulus must carry a time signature'];
  }
  if (music.anacrusis !== true || music.time_sig_hidden) {
    return ['anacrusis_final_bar: stimulus must be marked anacrusis: true with a printed time signature'];
  }
  if (isCompoundTimeSignature(sig) || !renderableTimeSignatures(inst.grade).includes(sig)) {
    return [`anacrusis_final_bar: "${sig}" is not a renderable simple time signature`];
  }

  const barUnits = barUnitsFor(sig);
  const totals = splitIntoBarGroups(music.voices[0]?.events ?? []).map(groupUnits);
  if (totals.length < 2) {
    return ['anacrusis_final_bar: stimulus must render a pickup bar and at least one full bar'];
  }
  const errors: string[] = [];
  const pickup = totals[0];
  if (!(pickup > 0 && pickup < barUnits && pickup % 8 === 0)) {
    errors.push('anacrusis_final_bar: the pickup bar is not a positive whole-beat partial bar');
  }
  if (totals.slice(1).some((units) => units !== barUnits)) {
    errors.push('anacrusis_final_bar: a bar after the pickup is not a full bar for the stimulus time signature');
  }

  const expected = `${(barUnits - pickup) / 8} beat${(barUnits - pickup) / 8 === 1 ? '' : 's'}`;
  if (inst.answer.canonical !== expected) {
    errors.push(`anacrusis_final_bar: canonical "${String(inst.answer.canonical)}" is not the pickup's complement ("${expected}")`);
  }
  const seen = new Set<string>([expected]);
  for (const d of inst.distractors) {
    if (typeof d !== 'string' || !/^\d+ beats?$/.test(d)) {
      errors.push(`anacrusis_final_bar: distractor "${String(d)}" is not an "N beat(s)" label`);
      continue;
    }
    if (seen.has(d)) errors.push(`anacrusis_final_bar: distractor "${d}" duplicates another option`);
    seen.add(d);
  }
  return errors;
}

// Recompute, do not trust: every option label is parsed back to note values and
// re-added, so a generator bug that mislabels a sum fails here.
const DURATION_UNITS: Record<string, number> = {
  demisemiquaver: 1,
  semiquaver: 2,
  quaver: 4,
  crotchet: 8,
  minim: 16,
  semibreve: 32,
  breve: 64,
};

function sumLabelUnits(label: string): number {
  let total = 0;
  for (const term of label.split(' + ')) {
    const match = /^(double-dotted |dotted )?([a-z]+)$/.exec(term.trim());
    if (!match) throw new Error(`"${term}" is not a note value`);
    const base = DURATION_UNITS[match[2]];
    if (base === undefined) throw new Error(`"${match[2]}" is not a note value`);
    total += base * (match[1] === 'double-dotted ' ? 1.75 : match[1] === 'dotted ' ? 1.5 : 1);
  }
  return total;
}

function rhythmSumReverseHook(inst: ExerciseInstance): string[] {
  const errors: string[] = [];
  const target = inst.stimulus.text;
  if (typeof target !== 'string') {
    return ['rhythm_sum_reverse: the stimulus text must name the note value being matched'];
  }
  let targetUnits: number;
  try {
    targetUnits = sumLabelUnits(target);
  } catch (err) {
    return [`rhythm_sum_reverse: ${err instanceof Error ? err.message : String(err)}`];
  }
  const canonical = inst.answer.canonical;
  if (typeof canonical !== 'string') {
    return ['rhythm_sum_reverse: canonical answer must be a sum label string'];
  }
  try {
    if (sumLabelUnits(canonical) !== targetUnits) {
      errors.push(`rhythm_sum_reverse: canonical "${canonical}" does not add up to a ${target}`);
    }
  } catch (err) {
    errors.push(`rhythm_sum_reverse: canonical: ${err instanceof Error ? err.message : String(err)}`);
  }
  for (const d of inst.distractors) {
    if (typeof d !== 'string') {
      errors.push(`rhythm_sum_reverse: distractor "${String(d)}" is not a sum label`);
      continue;
    }
    try {
      if (sumLabelUnits(d) === targetUnits) {
        errors.push(`rhythm_sum_reverse: distractor "${d}" also adds up to a ${target}, so both are right`);
      }
    } catch (err) {
      errors.push(`rhythm_sum_reverse: distractor "${d}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return errors;
}

// Recompute the true scale from the first rendered note, then assert exactly one
// interior note is absent and that it is the one the canonical names.
function chromaticScaleMissingHook(inst: ExerciseInstance): string[] {
  const music = inst.stimulus.music as Music | null;
  const shown = (music?.voices[0]?.events ?? []).flatMap(eventPitches);
  if (shown.length < 2) {
    return ['chromatic_scale_missing: the stimulus must render the scale'];
  }
  let trueScale: string[];
  try {
    trueScale = chromaticScaleAscending(shown[0]);
  } catch (err) {
    return [`chromatic_scale_missing: ${err instanceof Error ? err.message : String(err)}`];
  }
  const absent = trueScale.filter((p, i) => i > 0 && i < trueScale.length - 1 && !shown.includes(p));
  const errors: string[] = [];
  if (shown.length !== trueScale.length - 1 || absent.length !== 1) {
    errors.push(`chromatic_scale_missing: the stimulus omits ${absent.length} interior notes, not exactly 1`);
    return errors;
  }
  const name = (pitch: string): string => pitch.replace(/-?\d+$/, '').replace('#', '\u266f');
  if (inst.answer.canonical !== name(absent[0])) {
    errors.push(`chromatic_scale_missing: canonical "${String(inst.answer.canonical)}" is not the missing note ("${name(absent[0])}")`);
  }
  for (const d of inst.distractors) {
    if (typeof d !== 'string' || !shown.some((p) => name(p) === d)) {
      errors.push(`chromatic_scale_missing: distractor "${String(d)}" is not a note the stimulus actually shows`);
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

// metreClassificationHook (D7): canonical must be one of the legal
// {Simple,Compound} x {duple,triple,quadruple} labels — plus the two Irregular
// ones at Grade 5 (chromaticly-e3z.6) — AND must equal the label classifyMetre
// computes for the STIMULUS's own (printed, D8) time signature, the invariant
// that a generated instance can never mislabel the bar it renders. Distractors
// must also be legal labels, and distinct from the canonical and from each
// other.
//
// This label function is deliberately a second implementation of the
// generator's, not a shared import: the hook's job is to recompute rather than
// trust. Both must be widened together, and the "Compound quintuple" a
// half-widened pair produces is what this check exists to catch.
const LEGAL_METRE_LABELS = new Set([
  'Simple duple',
  'Simple triple',
  'Simple quadruple',
  'Compound duple',
  'Compound triple',
  'Compound quadruple',
  'Irregular quintuple',
  'Irregular septuple',
]);

const METRE_DIVISION_WORDS: Record<string, string> = {
  simple: 'Simple',
  compound: 'Compound',
  irregular: 'Irregular',
};

function metreLabel(cls: { division: string; beats: string }): string {
  const division = METRE_DIVISION_WORDS[cls.division];
  if (!division) throw new Error(`validator: unknown metre division "${cls.division}"`);
  return `${division} ${cls.beats}`;
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

// The readable clefs, as an independent list rather than an import from
// music/types — this file recomputes rather than trusts, and a Clef union that
// silently grew would otherwise widen every check here without a decision.
const RECOGNISED_CLEFS: readonly Clef[] = ['treble', 'bass', 'alto', 'tenor'];

function isRecognisedClef(clef: unknown): clef is Clef {
  return typeof clef === 'string' && (RECOGNISED_CLEFS as readonly string[]).includes(clef);
}

// CLEF_RANK orders clefs by pitch height (bass lowest, treble highest; tenor
// between bass and alto) so the
// expected up/down direction is a lookup, not a ternary. Deliberately NOT
// imported from octave-transposition.ts — this is an independent recompute,
// so a generator/validator disagreement fails loud instead of silently
// agreeing with itself (must be kept in sync by hand).
const CLEF_RANK: Record<Clef, number> = { treble: 3, alto: 2, tenor: 1, bass: 0 };

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
  if (!isRecognisedClef(answerClef)) {
    return [`octave_transposition: interaction.config.answerClef must be one of ${RECOGNISED_CLEFS.join(', ')}`];
  }
  if (direction !== 'up' && direction !== 'down') {
    return ['octave_transposition: interaction.config.direction must be "up" or "down"'];
  }
  const givenClef = music.clef;
  if (!isRecognisedClef(givenClef)) {
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

// transposingInstrumentHook (G5-4, chromaticly-wz1) — the interval-transposition
// sibling of octaveTranspositionHook. The written line is notated in the
// TRANSPOSED key (config.answerKeySig), so each recomputed target is the concert
// natural advanced by the instrument's interval letter-span and spelled in the
// WRITTEN key sig. Recomputes the written key from the instrument code
// (srs_tags) + the concert key (recompute-don't-trust config.answerKeySig), so a
// per_item written at concert pitch — the core "forgot to transpose"
// misconception — fails. Both staves are treble; direction is always up.
function transposingInstrumentHook(inst: ExerciseInstance): string[] {
  const music = inst.stimulus.music as Music | null;
  if (!music) return ['transposing_instrument: stimulus.music is required'];
  if (typeof music.key_sig !== 'string') return ['transposing_instrument: stimulus.music.key_sig is required'];

  const tag = inst.srs_tags.find((t) => t.startsWith('transpose_instrument:'));
  if (!tag) return ['transposing_instrument: a transpose_instrument:* srs_tag is required'];
  const code = tag.split(':')[1];
  if (!(code in INSTRUMENT_TRANSPOSITIONS)) {
    return [`transposing_instrument: srs_tag "${tag}" names an unknown instrument`];
  }
  const spec = INSTRUMENT_TRANSPOSITIONS[code as keyof typeof INSTRUMENT_TRANSPOSITIONS];

  const concert = music.key_sig.replace(/_major$/, '');
  const pair = spec.keys.find((k) => k.concert === concert);
  if (!pair) {
    return [`transposing_instrument: concert key "${music.key_sig}" is not a valid concert key for ${code}`];
  }
  const writtenKeySig = `${pair.written}_major`;

  const config = inst.interaction.config as { answerClef?: unknown; direction?: unknown; answerKeySig?: unknown } | undefined;
  const errors: string[] = [];
  if (config?.answerClef !== 'treble') {
    errors.push('transposing_instrument: interaction.config.answerClef must be "treble"');
  }
  if (config?.direction !== 'up') {
    errors.push('transposing_instrument: interaction.config.direction must be "up"');
  }
  if (config?.answerKeySig !== writtenKeySig) {
    errors.push(
      `transposing_instrument: interaction.config.answerKeySig "${String(config?.answerKeySig)}" is not the transposed key "${writtenKeySig}" ` +
        `(the written part is notated in the instrument's key, not accidentals against ${music.key_sig})`,
    );
  }

  const sourceNotes = music.voices.flatMap((v) => v.events).filter((ev): ev is NoteEvent => ev.type === 'note');
  const perItem = inst.answer.per_item;
  if (!Array.isArray(perItem)) {
    errors.push('transposing_instrument: answer.per_item must be an array');
    return errors;
  }
  if (perItem.length !== sourceNotes.length) {
    errors.push(
      `transposing_instrument: per_item length (${perItem.length}) does not match the stimulus note count (${sourceNotes.length})`,
    );
    return errors;
  }

  const givenRange = comfortablePitchRange('treble', inst.grade);
  const answerRange = comfortablePitchRange('treble', inst.grade);

  sourceNotes.forEach((source, i) => {
    const item = perItem[i] as { pitch?: unknown; dur?: unknown; dots?: unknown } | null;
    if (!item || typeof item.pitch !== 'string' || typeof item.dur !== 'string') {
      errors.push(`transposing_instrument: per_item[${i}] must be a {pitch, dur} object`);
      return;
    }
    const natural = naturalLetterOf(source.pitch);
    const expectedTarget = spellInKeySig(naturalPitchStepsAbove(natural, spec.letterSteps), writtenKeySig);
    if (item.pitch !== expectedTarget) {
      errors.push(
        `transposing_instrument: per_item[${i}].pitch "${item.pitch}" does not match the recomputed written target ` +
          `"${expectedTarget}" (up a ${spec.intervalName}, spelled in ${writtenKeySig} — writing concert pitch is the exact misconception this rejects)`,
      );
    }
    if (item.dur !== source.dur) {
      errors.push(
        `transposing_instrument: per_item[${i}].dur "${String(item.dur)}" does not match the source rhythm "${source.dur}"`,
      );
    }
    const sourceDots = source.dots ?? 0;
    const itemDots = typeof item.dots === 'number' ? item.dots : 0;
    if (itemDots !== sourceDots) {
      errors.push(
        `transposing_instrument: per_item[${i}].dots (${itemDots}) does not match the source rhythm's dots (${sourceDots})`,
      );
    }
    checkPitchScope(source.pitch, givenRange, inst.grade, errors);
    checkPitchScope(item.pitch, answerRange, inst.grade, errors);
  });

  if (typeof music.time_sig !== 'string') {
    errors.push('transposing_instrument: stimulus must carry a time signature');
    return errors;
  }
  const barUnits = barUnitsFor(music.time_sig);
  const groups = splitIntoBarGroups(music.voices[0]?.events ?? []).filter((g) => g.length > 0);
  if (groups.length !== 2) {
    errors.push(`transposing_instrument: stimulus must render exactly 2 bars (found ${groups.length})`);
  }
  for (const group of groups) {
    const units = group.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
    if (units !== barUnits) {
      errors.push(
        `transposing_instrument: a bar sums to ${units} units, not a full bar of ${music.time_sig} (${barUnits} units)`,
      );
    }
  }

  return errors;
}

// metreRewriteHook (G5-2, chromaticly-4ak) — recompute-don't-trust for the
// simple<->compound rewrite. The answer bar is the given bar with every note's
// dot toggled (x3/2 scaling), same pitches and order; the given bar must sum to
// its metre and the answer bar to the paired metre. A per_item that changed a
// pitch, dropped/added the wrong dot, or broke the bar total fails.
function metreRewriteHook(inst: ExerciseInstance): string[] {
  const music = inst.stimulus.music as Music | null;
  if (!music) return ['metre_rewrite: stimulus.music is required'];

  const config = inst.interaction.config as
    | { direction?: unknown; givenTimeSig?: unknown; targetTimeSig?: unknown }
    | undefined;
  const direction = config?.direction;
  if (direction !== 'to_compound' && direction !== 'to_simple') {
    return ['metre_rewrite: interaction.config.direction must be "to_compound" or "to_simple"'];
  }
  const dir = direction as RewriteDirection;
  const expectedGiven = dir === 'to_compound' ? METRE_REWRITE_PAIR.simple : METRE_REWRITE_PAIR.compound;
  const expectedTarget = dir === 'to_compound' ? METRE_REWRITE_PAIR.compound : METRE_REWRITE_PAIR.simple;

  const errors: string[] = [];
  if (music.time_sig !== expectedGiven) {
    errors.push(`metre_rewrite: given time signature "${String(music.time_sig)}" must be "${expectedGiven}" for direction ${dir}`);
  }
  if (config?.givenTimeSig !== expectedGiven || config?.targetTimeSig !== expectedTarget) {
    errors.push(`metre_rewrite: config metres must be given=${expectedGiven}, target=${expectedTarget} for direction ${dir}`);
  }

  const givenNotes = music.voices.flatMap((v) => v.events).filter((ev): ev is NoteEvent => ev.type === 'note');
  const perItem = inst.answer.per_item;
  if (!Array.isArray(perItem)) {
    errors.push('metre_rewrite: answer.per_item must be an array');
    return errors;
  }
  if (perItem.length !== givenNotes.length) {
    errors.push(`metre_rewrite: per_item length (${perItem.length}) does not match the given note count (${givenNotes.length})`);
    return errors;
  }

  givenNotes.forEach((given, i) => {
    const item = perItem[i] as { pitch?: unknown; dur?: unknown; dots?: unknown } | null;
    if (!item || typeof item.pitch !== 'string' || typeof item.dur !== 'string') {
      errors.push(`metre_rewrite: per_item[${i}] must be a {pitch, dur} object`);
      return;
    }
    if (item.pitch !== given.pitch) {
      errors.push(`metre_rewrite: per_item[${i}].pitch "${item.pitch}" does not match the given pitch "${given.pitch}" (a rewrite re-values rhythm, never re-pitches)`);
    }
    if (item.dur !== given.dur) {
      errors.push(`metre_rewrite: per_item[${i}].dur "${String(item.dur)}" does not match the given note value "${given.dur}"`);
    }
    let expectedDots: number;
    try {
      expectedDots = rescaleDots((given.dots ?? 0) as 0 | 1 | 2, dir);
    } catch (err) {
      errors.push(`metre_rewrite: given note ${i} is not in the expected form for ${dir}: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    const itemDots = typeof item.dots === 'number' ? item.dots : 0;
    if (itemDots !== expectedDots) {
      errors.push(`metre_rewrite: per_item[${i}].dots (${itemDots}) is not the x3/2-scaled value (expected ${expectedDots}) for direction ${dir}`);
    }
  });

  // Bar totals: the given bar fills its metre, the answer bar fills the paired metre.
  const givenUnits = givenNotes.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
  if (music.time_sig === expectedGiven && givenUnits !== barUnitsFor(expectedGiven)) {
    errors.push(`metre_rewrite: given bar sums to ${givenUnits} units, not a full bar of ${expectedGiven}`);
  }
  const answerUnits = perItem.reduce((sum: number, it) => {
    const item = it as { dur?: string; dots?: number };
    if (!item || typeof item.dur !== 'string') return sum;
    return sum + musicEventUnits({ type: 'note', pitch: 'C4', dur: item.dur as NoteEvent['dur'], dots: item.dots as NoteEvent['dots'] });
  }, 0);
  if (answerUnits !== barUnitsFor(expectedTarget)) {
    errors.push(`metre_rewrite: answer bar sums to ${answerUnits} units, not a full bar of ${expectedTarget}`);
  }

  return errors;
}

// clefEquivalenceHook (chromaticly-ra3) — the same-octave sibling of
// octaveTranspositionHook. The answer stave is a DIFFERENT clef, but the octave
// delta is 0, so each recomputed target is the SOURCE pitch itself, re-spelled
// for the key signature (spellInKeySig(natural, key_sig)); a per_item that has
// shifted the octave — the exact misconception this template must reject — fails
// the recompute. There is no up/down direction (a same-pitch rewrite has none),
// so config carries only answerClef.
function clefEquivalenceHook(inst: ExerciseInstance): string[] {
  const music = inst.stimulus.music as Music | null;
  if (!music) return ['clef_equivalence: stimulus.music is required'];
  if (typeof music.key_sig !== 'string') return ['clef_equivalence: stimulus.music.key_sig is required'];

  const config = inst.interaction.config as { answerClef?: unknown } | undefined;
  const answerClef = config?.answerClef;
  if (!isRecognisedClef(answerClef)) {
    return [`clef_equivalence: interaction.config.answerClef must be one of ${RECOGNISED_CLEFS.join(', ')}`];
  }
  const givenClef = music.clef;
  if (!isRecognisedClef(givenClef)) {
    return [`clef_equivalence: stimulus.music.clef "${String(givenClef)}" is not a recognized clef`];
  }

  const errors: string[] = [];
  if (answerClef === givenClef) {
    errors.push('clef_equivalence: answerClef must be different from the given clef');
  }

  const sourceNotes = music.voices.flatMap((v) => v.events).filter((ev): ev is NoteEvent => ev.type === 'note');
  const perItem = inst.answer.per_item;
  if (!Array.isArray(perItem)) {
    errors.push('clef_equivalence: answer.per_item must be an array');
    return errors;
  }
  if (perItem.length !== sourceNotes.length) {
    errors.push(
      `clef_equivalence: per_item length (${perItem.length}) does not match the stimulus note count (${sourceNotes.length})`,
    );
    return errors;
  }

  const givenRange = comfortablePitchRange(givenClef, inst.grade);
  const answerRange = comfortablePitchRange(answerClef, inst.grade);

  sourceNotes.forEach((source, i) => {
    const item = perItem[i] as { pitch?: unknown; dur?: unknown; dots?: unknown } | null;
    if (!item || typeof item.pitch !== 'string' || typeof item.dur !== 'string') {
      errors.push(`clef_equivalence: per_item[${i}] must be a {pitch, dur} object`);
      return;
    }

    const natural = naturalLetterOf(source.pitch);
    // delta 0: the target is the SAME sounding pitch, re-spelled for the key.
    const expectedTarget = spellInKeySig(naturalPitchStepsAbove(natural, 0), music.key_sig as string);
    if (item.pitch !== expectedTarget) {
      errors.push(
        `clef_equivalence: per_item[${i}].pitch "${item.pitch}" does not match the recomputed same-pitch target ` +
          `"${expectedTarget}" (an octave shift is the exact misconception this rejects)`,
      );
    }
    if (item.dur !== source.dur) {
      errors.push(
        `clef_equivalence: per_item[${i}].dur "${String(item.dur)}" does not match the source rhythm "${source.dur}"`,
      );
    }
    const sourceDots = source.dots ?? 0;
    const itemDots = typeof item.dots === 'number' ? item.dots : 0;
    if (itemDots !== sourceDots) {
      errors.push(
        `clef_equivalence: per_item[${i}].dots (${itemDots}) does not match the source rhythm's dots (${sourceDots})`,
      );
    }

    checkPitchScope(source.pitch, givenRange, inst.grade, errors);
    checkPitchScope(item.pitch, answerRange, inst.grade, errors);
  });

  if (typeof music.time_sig !== 'string') {
    errors.push('clef_equivalence: stimulus must carry a time signature');
    return errors;
  }
  const barUnits = barUnitsFor(music.time_sig);
  const groups = splitIntoBarGroups(music.voices[0]?.events ?? []).filter((g) => g.length > 0);
  if (groups.length !== 2) {
    errors.push(`clef_equivalence: stimulus must render exactly 2 bars (found ${groups.length})`);
  }
  for (const group of groups) {
    const units = group.reduce((sum, ev) => sum + musicEventUnits(ev), 0);
    if (units !== barUnits) {
      errors.push(
        `clef_equivalence: a bar sums to ${units} units, not a full bar of ${music.time_sig} (${barUnits} units)`,
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

// tripletRecognitionHook (chromaticly-e3z.9) — recompute-don't-trust.
// A triplet_rest tag cannot sit on a group that has no rest.
function tripletRecognitionHook(inst: ExerciseInstance): string[] {
  const errors: string[] = [];
  const music = inst.stimulus.music as Music | null;
  if (!music) return ['triplet_recognition: stimulus music is required'];
  if (!music.time_sig || isCompoundTimeSignature(music.time_sig)) {
    return [`triplet_recognition: "${String(music.time_sig)}" is not a simple time signature`];
  }

  const events = music.voices.flatMap((v) => v.events);
  const group = events.filter(
    (ev): ev is NoteEvent | RestEvent => (ev.type === 'note' || ev.type === 'rest') && ev.tuplet !== undefined,
  );
  if (group.length !== 3 || group.some((ev) => ev.tuplet!.size !== 3 || ev.tuplet!.inTimeOf !== 2)) {
    errors.push('triplet_recognition: stimulus must contain exactly one triplet (three 3-in-2 places)');
  } else if (!group[0].tuplet!.start || group.slice(1).some((ev) => ev.tuplet!.start)) {
    errors.push('triplet_recognition: the triplet must mark its first place as the group start');
  }

  const total = events.reduce((sum, ev: MusicEvent) => sum + musicEventUnits(ev), 0);
  if (Math.abs(total - barUnitsFor(music.time_sig)) > 1e-9) {
    errors.push(`triplet_recognition: bar sums to ${total}, not a full ${music.time_sig} bar`);
  }

  const rests = group.filter((ev) => ev.type === 'rest').length;
  const claimsRest = inst.srs_tags.some((t) => t.startsWith('triplet_rest:'));
  if (claimsRest !== rests > 0) {
    errors.push(`triplet_recognition: the tag claims ${claimsRest ? 'a rest' : 'no rest'}, the group has ${rests}`);
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

/** The same recompute as assertMajorTriad, parameterised by the quality the
 *  chord is supposed to have. A minor key's i and iv are minor triads and its V
 *  is major — that asymmetry IS the raised 7th, so checking it here is what
 *  catches a dominant built without one. */
function assertTriadQuality(pitches: unknown, quality: 'major' | 'minor', label: string, errors: string[]): void {
  if (!Array.isArray(pitches) || pitches.length !== 3 || pitches.some((p) => typeof p !== 'string')) {
    errors.push(`chord_recognition: ${label} must be exactly 3 spelled pitches`);
    return;
  }
  const [root, third, fifth] = pitches as string[];
  const lower = quality === 'major' ? 'major' : 'minor';
  const upper = quality === 'major' ? 'minor' : 'major';
  try {
    const thirdNumber = diatonicIntervalNumber(root, third);
    if (thirdNumber !== 3 || intervalQuality(root, third, thirdNumber) !== lower) {
      errors.push(`chord_recognition: ${label} root-third is not a ${lower} 3rd`);
    }
    const fifthNumber = diatonicIntervalNumber(third, fifth);
    if (fifthNumber !== 3 || intervalQuality(third, fifth, fifthNumber) !== upper) {
      errors.push(`chord_recognition: ${label} third-fifth is not a ${upper} 3rd`);
    }
  } catch (err) {
    errors.push(`chord_recognition: ${label}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Recompute a triad's root LETTER and its position (a/b/c) from spelled
 *  pitches, without trusting the generator (chromaticly-ehp). The root is the
 *  letter whose diatonic 3rd (+2) and 5th (+4) are the other two letters; the
 *  position is which member is in the bass (index 0 — pitches are ascending).
 *  Returns null when the three letters do not form a tertian triad. */
function recomputeTriad(pitches: string[]): { rootLetter: string; position: string } | null {
  if (pitches.length !== 3) return null;
  const letters = pitches.map((p) => /^([A-G])/.exec(p)?.[1]).filter((l): l is string => Boolean(l));
  if (letters.length !== 3) return null;
  const idx = (l: string) => LETTER_ORDER.indexOf(l as (typeof LETTER_ORDER)[number]);
  const set = new Set(letters);
  if (set.size !== 3) return null;
  let rootLetter: string | null = null;
  for (const l of set) {
    const third = LETTER_ORDER[(idx(l) + 2) % 7];
    const fifth = LETTER_ORDER[(idx(l) + 4) % 7];
    if (set.has(third) && set.has(fifth)) {
      rootLetter = l;
      break;
    }
  }
  if (!rootLetter) return null;
  const bassLetter = letters[0];
  const third = LETTER_ORDER[(idx(rootLetter) + 2) % 7];
  const fifth = LETTER_ORDER[(idx(rootLetter) + 4) % 7];
  const position = bassLetter === rootLetter ? 'a' : bassLetter === third ? 'b' : bassLetter === fifth ? 'c' : null;
  if (!position) return null;
  return { rootLetter, position };
}

// chordInversionErrors (chromaticly-ehp / plan U2) — the Grade-5 branch of the
// chord hook: recompute-don't-trust for a { numeral, position } answer. The root
// is found by tertian stacking (not positionally), the numeral from the root's
// degree above the tonic (CHORD_DEGREE_STEPS incl. II), and the position from
// which chord member is in the bass. Both axes of the canonical must match.
function chordInversionErrors(inst: ExerciseInstance, tonic: string, stimulusPitches: string[]): string[] {
  const errors: string[] = [];
  const canonical = inst.answer.canonical as { numeral?: unknown; position?: unknown };
  const recomputed = recomputeTriad(stimulusPitches);
  if (!recomputed) {
    return ['chord_recognition: stimulus chord is not a recognizable tertian triad'];
  }
  const idx = (l: string) => LETTER_ORDER.indexOf(l as (typeof LETTER_ORDER)[number]);
  const steps = (idx(recomputed.rootLetter) - idx(tonic[0]) + 7) % 7;
  const recomputedNumeral = Object.entries(CHORD_DEGREE_STEPS).find(([, s]) => s === steps)?.[0];
  if (!recomputedNumeral || !(CHORD_NUMERALS_G5 as readonly string[]).includes(recomputedNumeral)) {
    errors.push(
      `chord_recognition: chord root "${recomputed.rootLetter}" does not sit on a Grade-5 chord degree (I/II/IV/V)`,
    );
  } else if (canonical.numeral !== recomputedNumeral) {
    errors.push(
      `chord_recognition: canonical numeral "${String(canonical.numeral)}" does not match the numeral recomputed from the stimulus ("${recomputedNumeral}")`,
    );
  }
  if (typeof canonical.position !== 'string' || !(CHORD_POSITIONS as readonly string[]).includes(canonical.position)) {
    errors.push(`chord_recognition: canonical position "${String(canonical.position)}" is not a legal position (a/b/c)`);
  } else if (canonical.position !== recomputed.position) {
    errors.push(
      `chord_recognition: canonical position "${String(canonical.position)}" does not match the bass-note position recomputed from the stimulus ("${recomputed.position}")`,
    );
  }
  const numerals = inst.interaction.config?.numerals as unknown;
  const positions = inst.interaction.config?.positions as unknown;
  if (JSON.stringify(numerals) !== JSON.stringify([...CHORD_NUMERALS_G5])) {
    errors.push('chord_recognition: interaction.config.numerals must be the Grade-5 numeral set (I/II/IV/V)');
  }
  if (JSON.stringify(positions) !== JSON.stringify([...CHORD_POSITIONS])) {
    errors.push('chord_recognition: interaction.config.positions must be a/b/c');
  }
  return errors;
}

// chordMinorErrors (chromaticly-7xv) — the minor-key primary triads. Recomputes
// the numeral from the root letter's distance above the tonic, exactly as the
// major path does, and then checks the one thing that distinguishes the mode:
// i and iv must be MINOR triads and V must be MAJOR. A dominant built from the
// key signature alone comes out minor, so this is the check that proves the
// raised 7th is actually on the page.
function chordMinorErrors(inst: ExerciseInstance, tonic: string, stimulusPitches: string[]): string[] {
  const errors: string[] = [];
  const [root] = stimulusPitches;
  const rootLetterMatch = /^([A-G])/.exec(root);
  if (!rootLetterMatch) {
    return [`chord_recognition: chord root "${root}" is not a spelled pitch`];
  }
  const steps =
    (LETTER_ORDER.indexOf(rootLetterMatch[1] as (typeof LETTER_ORDER)[number]) -
      LETTER_ORDER.indexOf(tonic[0] as (typeof LETTER_ORDER)[number]) +
      7) %
    7;
  const recomputed = Object.entries(CHORD_DEGREE_STEPS).find(([, s]) => s === steps)?.[0];
  if (!recomputed || !(CHORD_NUMERALS_MINOR as readonly string[]).includes(recomputed)) {
    errors.push(`chord_recognition: chord root "${root}" does not sit on a primary-triad degree of ${tonic} minor`);
  } else if (inst.answer.canonical !== recomputed) {
    errors.push(
      `chord_recognition: canonical "${String(inst.answer.canonical)}" does not match the numeral recomputed from the stimulus root ("${recomputed}")`,
    );
  }

  assertTriadQuality(stimulusPitches, recomputed === 'V' ? 'major' : 'minor', `the ${recomputed ?? '?'} chord`, errors);

  const expected = CHORD_NUMERALS_MINOR.filter((n) => n !== inst.answer.canonical);
  if (JSON.stringify([...inst.distractors].sort()) !== JSON.stringify([...expected].sort())) {
    errors.push('chord_recognition: distractors must be exactly the other two minor-key primary triads');
  }

  // Every chip's chord is checked, not just the one shown: the UI replays a
  // tapped chip, so a wrong V in the map would sound a minor dominant even when
  // the notated chord is right.
  const triads = inst.interaction.config?.triads as Record<string, unknown> | undefined;
  if (!triads || typeof triads !== 'object') {
    errors.push('chord_recognition: interaction.config.triads is required');
    return errors;
  }
  for (const numeral of CHORD_NUMERALS_MINOR) {
    assertTriadQuality(triads[numeral], numeral === 'V' ? 'major' : 'minor', `config.triads.${numeral}`, errors);
  }
  if (!deepEqual(triads[inst.answer.canonical as string], stimulusPitches)) {
    errors.push("chord_recognition: config.triads[answer.canonical] does not match the stimulus chord's pitches");
  }
  return errors;
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
  if (mode !== 'major' && mode !== 'minor') {
    return [`chord_recognition: key signature "${music.key_sig}" names no mode`];
  }
  if (mode === 'minor' && inst.grade < 4) {
    return [`chord_recognition: minor-key harmony is not in scope at grade ${inst.grade}`];
  }

  const chordEvents = music.voices.flatMap((v) => v.events).filter((ev): ev is ChordEvent => ev.type === 'chord');
  if (chordEvents.length !== 1 || chordEvents[0].pitches.length !== 3) {
    return ['chord_recognition: stimulus must contain exactly one chord event with exactly 3 pitches'];
  }
  const stimulusPitches = chordEvents[0].pitches;

  // Grade-5 inversions path (chromaticly-ehp): canonical is a structured
  // { numeral, position } pair rather than a bare numeral string. Validated by
  // its own recompute — the root is NOT positionally first once inverted.
  if (inst.answer.canonical && typeof inst.answer.canonical === 'object') {
    return chordInversionErrors(inst, tonic, stimulusPitches);
  }

  if (mode === 'minor') {
    return chordMinorErrors(inst, tonic, stimulusPitches);
  }

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

// ornamentWrittenToSignErrors (G5-5, chromaticly-cke) — the reverse-direction
// branch: the stimulus is the ornament written out as plain notes (no ornament
// decoration), and the answer options are the signs (canonical stays the NAME).
// Recompute-don't-trust: the stimulus notes must equal realizeOrnament(kind,
// principal) — the same fixed expansion the generator draws — so a mis-realized
// or transposed pattern fails. The principal is the note the ornament resolves
// on: index 0 for decoration kinds, index 1 (after the grace) for grace kinds.
function ornamentWrittenToSignErrors(inst: ExerciseInstance, music: Music, kind: OrnamentKind): string[] {
  const errors: string[] = [];
  const notes = music.voices.flatMap((v) => v.events).filter((ev): ev is NoteEvent => ev.type === 'note');
  if (notes.some((n) => n.ornament !== undefined)) {
    errors.push('ornament_recognition: written->sign stimulus must render the ornament as plain notes, not a decoration');
  }

  const isGrace = kind === 'acciaccatura' || kind === 'appoggiatura';
  const principal = isGrace ? notes[1]?.pitch : notes[0]?.pitch;
  if (principal === undefined) {
    errors.push(`ornament_recognition: written->sign stimulus has too few notes for a "${kind}" realization`);
  } else {
    const expected = realizeOrnament(kind, principal);
    const mismatch =
      notes.length !== expected.length ||
      notes.some((n, i) => n.pitch !== expected[i].pitch || n.dur !== expected[i].dur || (n.dots ?? 0) !== (expected[i].dots ?? 0));
    if (mismatch) {
      errors.push(
        `ornament_recognition: written->sign stimulus notes do not match the canonical "${kind}" realization`,
      );
    }
  }

  // Shared with sign->name: canonical is the ornament NAME, distractors are
  // other legal names, no duplicates.
  const expectedCanonical = ORNAMENT_NAMES[kind];
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

  // option_sign must map every option name (canonical + distractors) to its kind,
  // so the UI can draw each sign.
  const optionSign = inst.interaction.config?.option_sign as Record<string, unknown> | undefined;
  if (!optionSign || typeof optionSign !== 'object') {
    errors.push('ornament_recognition: written->sign requires interaction.config.option_sign');
  } else {
    for (const name of [expectedCanonical, ...inst.distractors.filter((d): d is string => typeof d === 'string')]) {
      if (!(name in optionSign)) {
        errors.push(`ornament_recognition: option_sign is missing the sign for option "${name}"`);
      }
    }
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
  const config = inst.interaction.config as { ornament?: unknown; direction?: unknown } | undefined;
  const kind = config?.ornament;
  if (typeof kind !== 'string' || !(ORNAMENT_KINDS as readonly string[]).includes(kind)) {
    return [`ornament_recognition: interaction.config.ornament "${String(kind)}" is not a legal ornament kind`];
  }

  const music = inst.stimulus.music as Music | null;
  if (!music) return ['ornament_recognition: stimulus music is required'];

  // G5-5 written->sign: the stimulus is the realization as plain notes and the
  // options are the signs. Separate stimulus shape, so it dispatches to its own
  // check; the Grade-4 sign->name path below stays byte-identical.
  if (config?.direction === ORNAMENT_WRITTEN_TO_SIGN) {
    return ornamentWrittenToSignErrors(inst, music, kind as OrnamentKind);
  }

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

    // Grade 5 (chromaticly-e3z.16): a voice question names no instrument.
    if (kind === 'voice_type') {
      if (!(instrument in VOICE_TABLE)) {
        return [`instrument_knowledge: srs_tag "${tag}" names an unknown voice`];
      }
      if (inst.answer.canonical !== instrument) {
        errors.push(`instrument_knowledge: canonical "${String(inst.answer.canonical)}" is not the tagged voice "${instrument}"`);
      }
      const { group, rank } = VOICE_TABLE[instrument];
      const expected = VOICE_RANK_WORD[rank];
      if (!inst.prompt.includes(`${expected} ${group} voice`)) {
        errors.push(`instrument_knowledge: prompt does not ask for the ${expected} ${group} voice`);
      }
      const sameGroup = (inst.distractors as string[]).filter((d) => VOICE_TABLE[d]?.group === group);
      if (sameGroup.length !== 2) {
        errors.push('instrument_knowledge: voice distractors must include the other two voices of the same group');
      }
      return errors;
    }

    if (!(instrument in INSTRUMENT_TABLE)) {
      return [`instrument_knowledge: srs_tag "${tag}" names an unknown instrument`];
    }

    if (kind === 'instrument_sound') {
      const mechanism = SOUND_TABLE[instrument];
      if (inst.answer.canonical !== mechanism) {
        errors.push(
          `instrument_knowledge: canonical "${String(inst.answer.canonical)}" does not match ${instrument}'s mechanism "${mechanism}"`,
        );
      }
      for (const d of inst.distractors as string[]) {
        if (!(SOUND_MECHANISMS as readonly string[]).includes(d)) {
          errors.push(`instrument_knowledge: distractor "${d}" is not a known sound mechanism`);
        }
        if (d === mechanism) errors.push('instrument_knowledge: a sound distractor repeats the answer');
      }
      return errors;
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

// restCompletionHook (chromaticly-gni) — self-consistency: the answer rest's
// length must exactly fill the gap the sounding notes leave in the stimulus bar.
// Independently RECOMPUTES from the rendered stimulus rather than trusting the
// canonical label (the metreClassification/anacrusis discipline).
function restCompletionHook(inst: ExerciseInstance): string[] {
  const errors: string[] = [];
  const music = inst.stimulus.music as Music | null;
  if (!music || typeof music.time_sig !== 'string') {
    return ['rest_completion: stimulus must carry a time signature'];
  }
  const answerRest = parseRestLabel(String(inst.answer.canonical));
  if (!answerRest) {
    return [`rest_completion: canonical "${String(inst.answer.canonical)}" is not a rest label`];
  }
  const answerUnits = restUnits(answerRest);
  const soundingUnits = (music.voices[0]?.events ?? []).reduce((sum, ev) => sum + musicEventUnits(ev), 0);
  const barUnits = barUnitsFor(music.time_sig);
  if (soundingUnits + answerUnits !== barUnits) {
    errors.push(
      `rest_completion: sounding (${soundingUnits}) + answer rest (${answerUnits}) != bar (${barUnits}) for ${music.time_sig}`,
    );
  }
  const expectedTag = `rest:${restToken(answerRest)}`;
  if (inst.srs_tags[0] !== expectedTag) {
    errors.push(`rest_completion: srs_tag "${inst.srs_tags[0]}" must name the answer rest "${expectedTag}"`);
  }
  return errors;
}

// by_ear_match recomputes the diff rather than trusting the generator: at most
// one event may differ, and the canonical index must name it.
function byEarMatchHook(inst: ExerciseInstance): string[] {
  const errors: string[] = [];
  const written = (inst.stimulus.music as Music | null)?.voices?.[0]?.events ?? [];
  const heard = ((inst.interaction.config as { played_music?: Music }).played_music)?.voices?.[0]?.events ?? [];
  if (written.length === 0 || written.length !== heard.length) {
    return ['by_ear_match: the played music must have the same events as the written music'];
  }
  const differing: number[] = [];
  for (let i = 0; i < written.length; i++) {
    const a = written[i] as { type: string; pitch?: string; dur?: string; dots?: number };
    const b = heard[i] as { type: string; pitch?: string; dur?: string; dots?: number };
    if (a.type !== b.type || a.dur !== b.dur || a.dots !== b.dots) {
      return [`by_ear_match: event ${i} changed its type or duration, which alters the bar, not the pitch`];
    }
    if (a.pitch !== b.pitch) differing.push(i);
  }
  const { verdict, position } = (inst.answer.canonical ?? {}) as { verdict?: string; position?: number | null };
  if (differing.length > 1) {
    errors.push(`by_ear_match: ${differing.length} events differ, not at most 1`);
  } else if (verdict === 'same' && differing.length !== 0) {
    errors.push('by_ear_match: canonical says same, but the played music differs');
  } else if (verdict === 'different' && differing[0] !== position) {
    errors.push(`by_ear_match: canonical position ${String(position)} does not name the altered event (${String(differing[0])})`);
  } else if (verdict !== 'same' && verdict !== 'different') {
    errors.push(`by_ear_match: canonical verdict "${String(verdict)}" is neither same nor different`);
  }
  return errors;
}

// by_ear_verify recomputes the diff: one field of one event may differ, never both.
// It walks EVERY voice — satb_voice_recognition rings a note in any of four, and
// comparing voices[0] alone would miss an alteration made in the ringed one.
function byEarVerifyHook(inst: ExerciseInstance): string[] {
  const writtenVoices = (inst.stimulus.music as Music | null)?.voices ?? [];
  const heardVoices = ((inst.interaction.config as { played_music?: Music }).played_music)?.voices ?? [];
  if (writtenVoices.length === 0 || writtenVoices.length !== heardVoices.length) {
    return ['by_ear_verify: the played music must have the same voices as the written music'];
  }
  let differingEvents = 0;
  for (let v = 0; v < writtenVoices.length; v++) {
    const written = writtenVoices[v].events;
    const heard = heardVoices[v].events;
    if (written.length === 0 || written.length !== heard.length) {
      return ['by_ear_verify: the played music must have the same events as the written music'];
    }
    for (let i = 0; i < written.length; i++) {
    const a = written[i] as { type: string; pitch?: string; pitches?: string[]; dur?: string; dots?: number; ornament?: { kind: string } };
    const b = heard[i] as typeof a;
    if (a.type !== b.type) {
      return [`by_ear_verify: event ${i} changed its type, which this template never alters`];
    }
    const durChanged = a.dur !== b.dur || a.dots !== b.dots;
    const chordDiffs = a.type === 'chord' ? (a.pitches ?? []).filter((p, pi) => p !== b.pitches?.[pi]).length : 0;
    const pitchChanged = a.type === 'note' ? a.pitch !== b.pitch : chordDiffs > 0;
    const ornamentChanged = a.ornament?.kind !== b.ornament?.kind;
    if (a.type === 'chord' && chordDiffs > 1) {
      return [`by_ear_verify: event ${i} changed ${chordDiffs} chord tones, not one (KTD9)`];
    }
    if ([durChanged, pitchChanged, ornamentChanged].filter(Boolean).length > 1) {
      return [`by_ear_verify: event ${i} changed more than one field — this template alters exactly one`];
    }
    if (durChanged || pitchChanged || ornamentChanged) differingEvents++;
    }
  }
  const errors: string[] = [];
  const verdict = inst.answer.canonical as string;
  if (differingEvents > 1) {
    errors.push(`by_ear_verify: ${differingEvents} events differ, not at most 1`);
  } else if (verdict === 'Same' && differingEvents !== 0) {
    errors.push('by_ear_verify: canonical says Same, but the played music differs');
  } else if (verdict === 'Different' && differingEvents === 0) {
    errors.push('by_ear_verify: canonical says Different, but the played music is identical');
  } else if (verdict !== 'Same' && verdict !== 'Different') {
    errors.push(`by_ear_verify: canonical verdict "${verdict}" is neither Same nor Different`);
  }
  return errors;
}


// --- First steps hooks (grade 0, chromaticly-dhe) --------------------------
// House rule: recompute, never re-read. Each of these derives the answer a
// second time, by a different route from the generator's, and compares. A hook
// that merely restated the generator's own table would pass for a generator
// that had gone wrong in exactly the way the table did.

const FIRST_STEPS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** The answer is the number of beats. Recomputed by COUNTING the events in the
 *  bar the learner actually hears — the generator built the bar from the number,
 *  so counting it back is a genuinely independent route. */
function pulseCountHook(inst: ExerciseInstance): string[] {
  const played = (inst.interaction.config as { played_music?: { voices?: { events?: unknown[] }[] } })?.played_music;
  const events = played?.voices?.[0]?.events;
  if (!Array.isArray(events)) return ['pulse_count: interaction.config.played_music carries no bar to count'];
  if (inst.stimulus.music !== null) return ['pulse_count: the card is aural — stimulus.music must be null'];
  const counted = events.length;
  return String(counted) === String(inst.answer.canonical)
    ? []
    : [`pulse_count: the played bar has ${counted} events but the answer says ${inst.answer.canonical}`];
}

/** Recomputed by stepping the alphabet independently of the generator's own
 *  modulo, reading the direction and the starting letter back out of the prompt
 *  the learner is shown. */
function alphabetStepHook(inst: ExerciseInstance): string[] {
  const match = /Which letter comes (after|before) ([A-G])\?/.exec(inst.prompt);
  if (!match) return [`alphabet_step: prompt does not name a direction and a letter: "${inst.prompt}"`];
  const [, direction, from] = match;
  const step = direction === 'after' ? 1 : -1;
  const index = (FIRST_STEPS_LETTERS.indexOf(from) + step + 7) % 7;
  const expected = FIRST_STEPS_LETTERS[index];
  return expected === inst.answer.canonical
    ? []
    : [`alphabet_step: ${direction} ${from} is ${expected}, but the answer says ${inst.answer.canonical}`];
}

/** Recomputed from the atom the item credits, which is set on a different line
 *  from the answer. A drift between the two would mean the SRS credits one
 *  letter while the learner is asked about another. */
function keyboardFindHook(inst: ExerciseInstance): string[] {
  const letter = inst.srs_tags[0]?.split(':')[1];
  if (!letter || !FIRST_STEPS_LETTERS.includes(letter)) return [`keyboard_find: srs_tag names no white-key letter`];
  const canonical = String(inst.answer.canonical);
  if (!/^[A-G]\d$/.test(canonical)) return [`keyboard_find: canonical "${canonical}" is not a keyboard pitch`];
  return canonical[0] === letter ? [] : [`keyboard_find: credits ${letter} but answers ${canonical}`];
}

/** Line-or-space recomputed from stave geometry rather than the generator's
 *  parity helper: count diatonic steps up from the clef's bottom line. */
const STAVE_BOTTOM_LINE: Record<string, string> = { treble: 'E4', bass: 'G2', alto: 'F3', tenor: 'D3' };

function stavePositionHook(inst: ExerciseInstance): string[] {
  const music = inst.stimulus.music as { clef?: string; voices?: { events?: { pitch?: string }[] }[] } | null;
  const events = music?.voices?.[0]?.events;
  if (!music || !Array.isArray(events) || events.length === 0) return ['stave_position: no notated stimulus to read'];

  const canonical = String(inst.answer.canonical);
  if (canonical === 'On a line' || canonical === 'In a space') {
    const bottom = STAVE_BOTTOM_LINE[music.clef ?? ''];
    const pitch = events[0]?.pitch;
    if (!bottom || !pitch) return ['stave_position: cannot locate the note on its stave'];
    const ord = (p: string) => Number(p[1]) * 7 + ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(p[0]);
    const expected = (ord(pitch) - ord(bottom)) % 2 === 0 ? 'On a line' : 'In a space';
    return expected === canonical ? [] : [`stave_position: ${pitch} in ${music.clef} is ${expected}, not ${canonical}`];
  }

  // The higher/lower shape: recompute by comparing the two drawn pitches.
  if (events.length !== 2) return ['stave_position: a higher/lower question must draw exactly two notes'];
  const ord = (p: string) => Number(p[1]) * 7 + ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(p[0]);
  const [first, second] = events.map((e) => e.pitch ?? '');
  if (!first || !second) return ['stave_position: a higher/lower question is missing a pitch'];
  const expected = ord(first) > ord(second) ? 'The first one' : 'The second one';
  return expected === canonical ? [] : [`stave_position: ${first} vs ${second} makes it ${expected}, not ${canonical}`];
}

/** Recomputed by reading the duration off the drawn note, not off the generator's
 *  chosen shape — and every drawn note must share it, or a beamed pair would be
 *  two different values wearing one answer. */
function noteShapeLengthHook(inst: ExerciseInstance): string[] {
  const music = inst.stimulus.music as { voices?: { events?: { dur?: string }[] }[] } | null;
  const events = music?.voices?.[0]?.events;
  if (!Array.isArray(events) || events.length === 0) return ['note_shape_length: no notated stimulus to read'];
  const durations = new Set(events.map((e) => e.dur));
  if (durations.size !== 1) return [`note_shape_length: the stimulus draws ${durations.size} different note values`];
  const drawn = [...durations][0];
  return drawn === inst.answer.canonical
    ? []
    : [`note_shape_length: the stimulus draws a ${drawn} but the answer says ${inst.answer.canonical}`];
}

const TEMPLATE_HOOKS: Record<string, TemplateHook> = {
  pulse_count: pulseCountHook,
  alphabet_step: alphabetStepHook,
  keyboard_find: keyboardFindHook,
  stave_position: stavePositionHook,
  note_shape_length: noteShapeLengthHook,
  note_naming: noteNamingHook,
  note_naming_stave_input: noteNamingStaveInputHook,
  interval_naming: intervalNamingHook,
  interval_compound_reduce: intervalCompoundReduceHook,
  interval_naming_stave_input: intervalNamingHook,
  key_signature_id: keySignatureIdHook,
  mode_swap: modeSwapHook,
  scale_construction: scaleConstructionHook,
  rhythm_sum: rhythmSumHook,
  rhythm_sum_reverse: rhythmSumReverseHook,
  term_meaning: termMeaningHook,
  bar_validity: barValidityHook,
  add_time_signature: addTimeSignatureHook,
  time_signature_match: timeSignatureMatchHook,
  metre_classification: metreClassificationHook,
  anacrusis_recognition: anacrusisRecognitionHook,
  anacrusis_final_bar: anacrusisFinalBarHook,
  duplet_recognition: dupletRecognitionHook,
  triplet_recognition: tripletRecognitionHook,
  octave_transposition: octaveTranspositionHook,
  transposing_instrument: transposingInstrumentHook,
  metre_rewrite: metreRewriteHook,
  clef_equivalence: clefEquivalenceHook,
  chromatic_scale: chromaticScaleHook,
  chromatic_scale_missing: chromaticScaleMissingHook,
  degree_name_id: degreeNameIdHook,
  chord_recognition: chordRecognitionHook,
  ornament_recognition: ornamentRecognitionHook,
  instrument_knowledge: instrumentKnowledgeHook,
  enharmonic_recognition: enharmonicRecognitionHook,
  rest_completion: restCompletionHook,
  by_ear_match: byEarMatchHook,
  by_ear_verify: byEarVerifyHook,
};
