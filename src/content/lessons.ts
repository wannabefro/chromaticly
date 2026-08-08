// Multi-grade lesson loader (U9, grade-2-foundation U1/U2). Each
// curriculum/gradeN-lessons.json is authored data; loadDoc zod-validates one
// doc, cross-checks every referenced atom/template against the live generator
// registries at that doc's grade, and asserts its unlock graph is a single
// acyclic, fully-reachable chain. It fails loud at import time on any
// dangling reference, malformed graph, or lesson id reused across grades.
// grade1-lessons.json and grade2-lessons.json are both registered; Level 2
// stays static-locked (levels.ts) until a later unit wires up dynamic
// unlock, so grade-2 content loads and is pinned but isn't reachable yet.

import { z } from 'zod';
import grade0Raw from '../../curriculum/grade0-lessons.json';
import grade1Raw from '../../curriculum/grade1-lessons.json';
import grade2Raw from '../../curriculum/grade2-lessons.json';
import grade3Raw from '../../curriculum/grade3-lessons.json';
import grade4Raw from '../../curriculum/grade4-lessons.json';
import grade5Raw from '../../curriculum/grade5-lessons.json';
import { ALPHABET_LETTERS, CHORD_NUMERALS, CHORD_NUMERALS_G5, CHORD_NUMERALS_MINOR, CHORD_POSITIONS, CONTEXT_KINDS, DIRECTIONS, ENHARMONIC_NOTES, INSTRUMENTS, INSTRUMENT_TRANSPOSITIONS, isByEarAtom, NOTE_SHAPES, ORNAMENT_KINDS, ORNAMENT_WRITTEN_TO_SIGN, parseAtom, SATB_VOICES, STAVE_ANATOMY_KINDS, VOICE_TYPES, writtenAtomOf } from '../engine/atoms';
import { GENERATORS, generate } from '../engine/generators';
import { byEarCardFor } from '../engine/generators/by-ear-cards';
import { COMPOUND_NUMBERS } from '../engine/interval-quality';
import { TUPLET_SIZES } from '../engine/generators/tuplet-recognition';
import { CADENCE_KINDS } from '../engine/generators/cadence-recognition';
import { CHROMATIC_TONICS } from '../engine/generators/chromatic-scale';
import { parseCancellationAtom } from '../engine/generators/accidental-cancellation';
import { parseTonalCentreAtom, tonalCentrePairs } from '../engine/generators/tonal-centre';
import { UPPER_CLEF_TABLE } from '../engine/generators/instrument-knowledge';
import { dottedRestsInScope, parseRestToken } from '../engine/generators/rest-math';
import { DEGREE_ORDER } from '../engine/generators/degree-name-id';
import { BAR_PROPERTIES } from '../engine/generators/find-the-bar';
import { TERM_ATOM_SLUGS, termAtomSlugsForGrade } from '../engine/generators/term-meaning';
import { isCompoundTimeSignature } from '../engine/metre';
import { diatonicPitchesInRange, metreRenderableTimeSignatures, renderableTimeSignatures, scopeForGrade } from '../engine/scope';
import type { Clef, Duration } from '../music/types';
import { assertRhythmFillsBars } from './teach-rhythm';

const WorkedExampleSchema = z.object({
  template_id: z.string(),
  grade: z.number().int().min(0).max(5),
  seed: z.number().int(),
});

// The teach/read phase ahead of the exercise set (design 4a/4b). Every field but
// `objectives` and `concept` is optional so a lesson can carry only the cards it
// needs. `example` refs reuse the worked-example shape (a seeded generator call)
// so teach notation comes from the same engine as the exercises.
const TeachSchema = z.object({
  objectives: z.array(z.string().min(1)).min(1),
  concept: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    example: WorkedExampleSchema.nullable().optional(),
  }),
  smartTip: z.string().min(1).nullable().optional(),
  didYouKnow: z.string().min(1).nullable().optional(),
  // The by-ear card's rhythm is authored, not generated: it must be a metrically
  // valid excerpt, which the exercise generators deliberately are not (302.3.5).
  theoryInSound: z
    .object({
      prompt: z.string().min(1),
      timeSignature: z.string().min(3),
      notes: z.array(z.string().min(1)).min(2),
    })
    .nullable()
    .optional(),
});

const LessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  strand: z.enum(['rhythm', 'pitch', 'scales_keys', 'intervals', 'chords', 'terms_signs', 'context']),
  atoms: z.array(z.string()).min(1),
  templates: z.array(z.string()).min(1),
  /** theory-by-ear: the written template the by-ear item composes over (KTD3).
   *  Absent on the 22 lessons that emit no notation to compare against. */
  by_ear_source: z.string().min(1).nullable().optional(),
  /** NOT in `atoms`: that array is the generator's sampling pool. */
  by_ear_atoms: z.array(z.string()).optional(),
  worked_example: WorkedExampleSchema.nullable().optional(),
  teach: TeachSchema.nullable().optional(),
  unlocks: z.string().nullable(),
});

const LessonsDocSchema = z.object({
  grade: z.number().int().min(0).max(5),
  version: z.string().min(1),
  lessons: z.array(LessonSchema).min(1),
});

export type WorkedExample = z.infer<typeof WorkedExampleSchema>;
export type Teach = z.infer<typeof TeachSchema>;
// `grade` is stamped onto every lesson at load time from its doc's grade — it
// is not part of the authored JSON or the zod schema (see loadDoc).
export type Lesson = z.infer<typeof LessonSchema> & { grade: number };

/** The seven strands, derived from the authoring schema above so the enum has one
 *  definition rather than two that can drift. The domain core imports this; the UI
 *  layer keeps its own presentation table (hue/glyph/label) keyed by the same
 *  union. Content is the right owner: a strand exists because lessons are authored
 *  into it, not because it has a colour. */
export type Strand = Lesson['strand'];
export type LessonsDoc = Omit<z.infer<typeof LessonsDocSchema>, 'lessons'> & { lessons: Lesson[] };

/** Throws if an SRS-atom id does not resolve to something a generator can emit at `grade`. */
/** Credit consumers read this; generators read `lesson.atoms`. */
export function creditedAtoms(lesson: { atoms: string[]; by_ear_atoms?: string[] }): string[] {
  return [...lesson.atoms, ...(lesson.by_ear_atoms ?? [])];
}

/** The by-ear item's pool: written twins of the DECLARED by-ear atoms. The full
 *  `atoms` let it credit an entry no review path could reach. */
export function byEarPool(lesson: { atoms: string[]; by_ear_atoms?: string[] }): string[] {
  const declared = lesson.by_ear_atoms;
  return declared?.length ? declared.map(writtenAtomOf) : lesson.atoms;
}

export function assertAtomResolves(atom: string, grade: number): void {
  if (isByEarAtom(atom)) {
    const written = writtenAtomOf(atom);
    // A doubled suffix is malformed, not a base that happens to end in by_ear.
    if (isByEarAtom(written)) throw new Error(`lessons: malformed by-ear atom "${atom}"`);
    assertAtomResolves(written, grade);
    return;
  }
  const { kind, parts } = parseAtom(atom);
  switch (kind) {
    case 'rhythm_sum':
      // Bare `rhythm_sum` resolves at any grade; the `double_dot` scope
      // (chromaticly-2fc) is a Grade-4 device (GRADE_4_SCOPE.rhythmDevices).
      if (parts.length === 0) return;
      if (parts.length === 1 && parts[0] === 'double_dot') {
        if (grade !== 4) throw new Error(`lessons: atom "${atom}" only resolves at grade 4`);
        return;
      }
      throw new Error(`lessons: malformed rhythm_sum atom "${atom}"`);
    case 'note_value_compare':
      if (parts.length !== 0) throw new Error(`lessons: malformed note_value_compare atom "${atom}"`);
      return;
    // First steps (grade 0, chromaticly-dhe). None of the five is grade-scoped —
    // the level teaches what notation IS, so no key, metre or clef bounds them.
    case 'pulse':
      if (parts.length !== 0) throw new Error(`lessons: malformed pulse atom "${atom}"`);
      return;
    case 'alphabet': {
      if (parts.length !== 1 || !ALPHABET_LETTERS.includes(parts[0])) {
        throw new Error(`lessons: atom "${atom}" is not one of the seven letter names`);
      }
      return;
    }
    case 'keyboard': {
      if (parts.length !== 1 || !ALPHABET_LETTERS.includes(parts[0])) {
        throw new Error(`lessons: atom "${atom}" is not a white-key letter`);
      }
      return;
    }
    case 'stave_anatomy': {
      if (parts.length !== 1 || !STAVE_ANATOMY_KINDS.includes(parts[0])) {
        throw new Error(`lessons: atom "${atom}" is not a stave-anatomy question kind`);
      }
      return;
    }
    case 'note_shape': {
      if (parts.length !== 1 || !NOTE_SHAPES.includes(parts[0])) {
        throw new Error(`lessons: atom "${atom}" is not a First steps note shape`);
      }
      return;
    }
    case 'bar_validity':
      if (parts.length !== 0) throw new Error(`lessons: malformed bar_validity atom "${atom}"`);
      return;
    case 'rest': {
      // chromaticly-gni: rest:<duration> resolves iff the duration is a rest
      // value in scope at this grade (scope.rests mirrors noteValues per the KB).
      // chromaticly-7xv.3: `dotted_rests` opens one dot, `double_dot` opens two.
      if (parts.length !== 1) throw new Error(`lessons: malformed rest atom "${atom}"`);
      const value = parseRestToken(parts[0]);
      const scope = scopeForGrade(grade);
      if (!value || !scope.rests.includes(value.dur)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} rest value`);
      }
      if (value.dots > 0 && !dottedRestsInScope(scope.rests, scope.rhythmDevices).some((r) => r.dur === value.dur && r.dots === value.dots)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} dotted rest value`);
      }
      return;
    }
    case 'accidental_cancel': {
      // chromaticly-7xv.2. G4 item 2 names the cancellation; nothing scored it.
      if (grade < 4) throw new Error(`lessons: atom "${atom}" only resolves from grade 4`);
      if (!parseCancellationAtom(atom)) throw new Error(`lessons: atom "${atom}" is not a cancellation`);
      return;
    }
    case 'add_time_signature': {
      if (parts.length === 0) return; // legacy bare atom (grade 1)
      if (parts.length !== 1) throw new Error(`lessons: malformed add_time_signature atom "${atom}"`);
      const [sig] = parts;
      if (!scopeForGrade(grade).timeSignatures.includes(sig) || !renderableTimeSignatures(grade).includes(sig)) {
        throw new Error(`lessons: atom "${atom}" is not a renderable G${grade} time signature`);
      }
      return;
    }
    case 'metre': {
      if (parts.length !== 1) throw new Error(`lessons: malformed metre atom "${atom}"`);
      const [sig] = parts;
      // Metre-scoped renderable set (chromaticly-570): metre_classification is
      // the only template made denominator-aware, so it uses the wider grade-4
      // set here rather than the global renderableTimeSignatures the other
      // templates (duplet/anacrusis/add_time_signature) still gate on.
      if (!scopeForGrade(grade).timeSignatures.includes(sig) || !metreRenderableTimeSignatures(grade).includes(sig)) {
        throw new Error(`lessons: atom "${atom}" is not a renderable G${grade} time signature`);
      }
      return;
    }
    case 'grouping': {
      if (parts.length !== 1) throw new Error(`lessons: malformed grouping atom "${atom}"`);
      const [sig] = parts;
      // Same wider set as `metre`: the emitter beams every metre-renderable signature.
      if (!scopeForGrade(grade).timeSignatures.includes(sig) || !metreRenderableTimeSignatures(grade).includes(sig)) {
        throw new Error(`lessons: atom "${atom}" is not a renderable G${grade} time signature`);
      }
      return;
    }
    case 'anacrusis': {
      if (parts.length !== 1) throw new Error(`lessons: malformed anacrusis atom "${atom}"`);
      const [sig] = parts;
      if (
        isCompoundTimeSignature(sig) ||
        !renderableTimeSignatures(grade).includes(sig) ||
        !scopeForGrade(grade).rhythmDevices.includes('anacrusis')
      ) {
        throw new Error(`lessons: atom "${atom}" is not a renderable G${grade} simple anacrusis signature`);
      }
      return;
    }
    case 'duplet': {
      if (parts.length !== 1) throw new Error(`lessons: malformed duplet atom "${atom}"`);
      const [sig] = parts;
      // Duplets live in COMPOUND time (opposite of anacrusis), and only where
      // the grade's rhythmDevices actually carries 'duplet' (Grade 4+).
      if (
        !isCompoundTimeSignature(sig) ||
        !renderableTimeSignatures(grade).includes(sig) ||
        !scopeForGrade(grade).rhythmDevices.includes('duplet')
      ) {
        throw new Error(`lessons: atom "${atom}" is not a renderable G${grade} compound duplet signature`);
      }
      return;
    }
    case 'note_read': {
      const [clef, pitch] = parts;
      if (!scopeForGrade(grade).clefs.includes(clef as Clef)) throw new Error(`lessons: atom "${atom}" has clef outside G${grade} scope`);
      const natural = (pitch ?? '').replace(/[#b]/g, '');
      if (!diatonicPitchesInRange(clef as Clef, grade).includes(natural)) {
        throw new Error(`lessons: atom "${atom}" pitch is outside the ${clef} G${grade} range`);
      }
      return;
    }
    // The pitch names a position; an accidental would contradict the signature.
    case 'note_read_keyed': {
      const [clef, pitch] = parts;
      if (!scopeForGrade(grade).clefs.includes(clef as Clef)) throw new Error(`lessons: atom "${atom}" has clef outside G${grade} scope`);
      if (/[#b]/.test(pitch ?? '')) throw new Error(`lessons: atom "${atom}" must name a natural pitch`);
      if (!diatonicPitchesInRange(clef as Clef, grade).includes(pitch ?? '')) {
        throw new Error(`lessons: atom "${atom}" pitch is outside the ${clef} G${grade} range`);
      }
      return;
    }
    case 'add_barlines': {
      const [sig] = parts;
      if (!renderableTimeSignatures(grade).includes(sig)) {
        throw new Error(`lessons: atom "${atom}" is not a renderable G${grade} time signature`);
      }
      return;
    }
    case 'rest_grouping': {
      const [sig] = parts;
      if (!isCompoundTimeSignature(sig) || !metreRenderableTimeSignatures(grade).includes(sig)) {
        throw new Error(`lessons: atom "${atom}" is not a renderable G${grade} compound signature`);
      }
      return;
    }
    case 'tonal_centre': {
      const centre = parseTonalCentreAtom(atom);
      const pairs = tonalCentrePairs(grade);
      const known = centre && pairs.some((p) => (centre.mode === 'minor' ? p.minor : p.major) === centre.tonic);
      if (!known) throw new Error(`lessons: atom "${atom}" is not a G${grade} relative-pair key`);
      return;
    }
    case 'key_sig': {
      const [key] = parts;
      const [tonic, mode] = (key ?? '').split('_');
      if (mode === 'major') {
        if (!scopeForGrade(grade).keysMajor.includes(tonic)) {
          throw new Error(`lessons: atom "${atom}" is not a G${grade} major key`);
        }
        return;
      }
      if (mode === 'minor') {
        if (!scopeForGrade(grade).keysMinor.includes(tonic)) {
          throw new Error(`lessons: atom "${atom}" is not a G${grade} minor key`);
        }
        return;
      }
      throw new Error(`lessons: atom "${atom}" is not a G${grade} key signature`);
    }
    case 'scale': {
      const [spec] = parts;
      const [tonic, mode, ...formParts] = (spec ?? '').split('_');
      const scope = scopeForGrade(grade);
      if (mode === 'chromatic') {
        if (grade < 4 || !CHROMATIC_TONICS.includes(tonic)) {
          throw new Error(`lessons: atom "${atom}" is not a G${grade} chromatic scale`);
        }
        return;
      }
      const form = formParts.join('_');
      if (mode !== 'minor' || !scope.keysMinor.includes(tonic) || !scope.minorForms.includes(form)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} scale`);
      }
      return;
    }
    case 'degree_name': {
      const [name] = parts;
      if (grade < 4 || !(DEGREE_ORDER as readonly string[]).includes(name)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} degree name`);
      }
      return;
    }
    case 'chord': {
      const [numeral, position] = parts;
      // Grade-5 inversion atom: chord:<numeral>:<pos> (chromaticly-ehp). The
      // 3-part shape adds II and the a/b/c position axis; the bare 2-part atom
      // stays the Grade-4 primary-triad path.
      if (position !== undefined) {
        if (
          grade < 5 ||
          !(CHORD_NUMERALS_G5 as readonly string[]).includes(numeral) ||
          !(CHORD_POSITIONS as readonly string[]).includes(position)
        ) {
          throw new Error(`lessons: atom "${atom}" is not a G${grade} chord inversion`);
        }
        return;
      }
      if (grade < 4 || !(CHORD_NUMERALS as readonly string[]).includes(numeral)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} primary-triad chord numeral`);
      }
      return;
    }
    // The minor-key primary triads (chromaticly-7xv). G4 item 4 asks for tonic,
    // subdominant and dominant chords in ANY key set for the grade, and the
    // course had only the major ones.
    case 'chord_minor': {
      const [numeral, position] = parts;
      // 3-part chord_minor:<numeral>:<pos> is the Grade-5 minor inversion
      // (chromaticly-ic5.5); the bare 2-part atom stays the Grade-4 path.
      if (position !== undefined) {
        if (
          grade < 5 ||
          !(CHORD_NUMERALS_G5 as readonly string[]).includes(numeral) ||
          !(CHORD_POSITIONS as readonly string[]).includes(position)
        ) {
          throw new Error(`lessons: atom "${atom}" is not a G${grade} minor chord inversion`);
        }
        return;
      }
      if (grade < 4 || !(CHORD_NUMERALS_MINOR as readonly string[]).includes(numeral)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} minor-key primary triad`);
      }
      return;
    }
    case 'ornament': {
      const [kind, direction] = parts;
      if (!(ORNAMENT_KINDS as readonly string[]).includes(kind)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} ornament kind`);
      }
      // 3-part ornament:<kind>:written_to_sign is the Grade-5 reverse direction
      // (G5-5, chromaticly-cke); bare 2-part ornament:<kind> stays Grade-4 up.
      if (direction !== undefined) {
        if (direction !== ORNAMENT_WRITTEN_TO_SIGN || grade < 5) {
          throw new Error(`lessons: atom "${atom}" is not a G${grade} ornament direction`);
        }
        return;
      }
      if (grade < 4) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} ornament kind`);
      }
      return;
    }
    case 'instrument_family': {
      const [instrument] = parts;
      if (grade < 4 || !(INSTRUMENTS as readonly string[]).includes(instrument)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} instrument`);
      }
      return;
    }
    case 'instrument_clef': {
      const [instrument] = parts;
      if (grade < 4 || !(INSTRUMENTS as readonly string[]).includes(instrument)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} instrument`);
      }
      return;
    }
    case 'instrument_clef_upper': {
      const [instrument] = parts;
      if (grade < 5 || !(instrument in UPPER_CLEF_TABLE)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} upper-clef instrument`);
      }
      return;
    }
    case 'direction': {
      const [term] = parts;
      if (grade < 4 || !(DIRECTIONS as readonly string[]).includes(term)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} direction term`);
      }
      return;
    }
    case 'enharmonic': {
      const [note] = parts;
      if (grade < 4 || !(ENHARMONIC_NOTES as readonly string[]).includes(note)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} enharmonic note spelling`);
      }
      return;
    }
    case 'interval': {
      // Grade-agnostic: the above-tonic 2nd..octave range holds at every grade
      // this curriculum currently covers, so there is no scope call here.
      const n = Number(parts[0]);
      if (!Number.isInteger(n) || n < 2 || n > 8) throw new Error(`lessons: atom "${atom}" is not a G1 interval (2..8)`);
      return;
    }
    case 'instrument_sound': {
      if (parts.length !== 1 || !(INSTRUMENTS as readonly string[]).includes(parts[0])) {
        throw new Error(`lessons: atom "${atom}" names an unknown instrument`);
      }
      if (grade < 5) throw new Error(`lessons: atom "${atom}" is a grade-5 question`);
      return;
    }
    case 'voice_type': {
      if (parts.length !== 1 || !(VOICE_TYPES as readonly string[]).includes(parts[0])) {
        throw new Error(`lessons: atom "${atom}" names an unknown voice`);
      }
      if (grade < 5) throw new Error(`lessons: atom "${atom}" is a grade-5 question`);
      return;
    }
    case 'interval_key': {
      // chromaticly-0i9: the grade-2 widening is the KEY, so the atom names one
      // in scope, and only where naming is still number-only (grades 1-2).
      if (parts.length !== 1) throw new Error(`lessons: malformed interval_key atom "${atom}"`);
      const scope = scopeForGrade(grade);
      const inScope = [
        ...scope.keysMajor.map((k) => `${k}_major`),
        ...scope.keysMinor.map((k) => `${k}_minor`),
      ];
      if (!inScope.includes(parts[0])) throw new Error(`lessons: atom "${atom}" is not a G${grade} key`);
      if (scope.intervalRule.namingStyle === 'number_and_type') {
        throw new Error(`lessons: atom "${atom}" is number-only, not a grade-${grade} interval`);
      }
      return;
    }
    case 'interval_type': {
      // D4: only resolves where the grade's namingStyle is the number+type
      // widening (grade 3+) — a grade-1/2 lesson can never own this atom kind.
      const n = Number(parts[0]);
      if (!Number.isInteger(n) || n < 2 || n > 8) {
        throw new Error(`lessons: atom "${atom}" is not a G3 interval (2..8)`);
      }
      if (scopeForGrade(grade).intervalRule.namingStyle !== 'number_and_type') {
        throw new Error(`lessons: atom "${atom}" is not a number+type interval at grade ${grade}`);
      }
      return;
    }
    case 'interval_any': {
      // chromaticly-6ga: the grade-4 widening. Only resolves where the scope drops
      // `aboveTonicOnly`, which is precisely the rule that makes augmented and
      // diminished reachable — so a grade-3 lesson can never own this atom kind.
      const n = Number(parts[0]);
      if (!Number.isInteger(n) || n < 2 || n > 8) {
        throw new Error(`lessons: atom "${atom}" is not a G4 interval (2..8)`);
      }
      if (scopeForGrade(grade).intervalRule.aboveTonicOnly) {
        throw new Error(`lessons: atom "${atom}" needs between-any-notes intervals, which grade ${grade} does not have`);
      }
      return;
    }
    case 'degree': {
      const n = Number(parts[0]);
      if (!Number.isInteger(n) || n < 1 || n > 7) {
        throw new Error(`lessons: atom "${atom}" is not a scale degree (1-7)`);
      }
      // Degrees by number run grades 1-3; grade 4 replaces the requirement with
      // the technical names (degree_name:*), which is a different fact.
      if (grade > 3) throw new Error(`lessons: atom "${atom}" is superseded by degree_name at G${grade}`);
      return;
    }
    case 'tonic_triad':
    case 'tonic_triad_minor': {
      if (parts.length !== 0) throw new Error(`lessons: malformed ${kind} atom "${atom}"`);
      if (grade > 3) throw new Error(`lessons: atom "${atom}" is superseded by chord_recognition at G${grade}`);
      // chromaticly-6xs.2: a minor tonic triad needs a minor key to build in.
      if (kind === 'tonic_triad_minor' && scopeForGrade(grade).keysMinor.length === 0) {
        throw new Error(`lessons: atom "${atom}" has no minor key at G${grade}`);
      }
      return;
    }
    case 'cadence':
    // cadence_choose:<kind> asks for the missing chord rather than the name
    // (chromaticly-ic5.6). Same scope, different question.
    case 'cadence_choose': {
      const [name] = parts;
      if (!(CADENCE_KINDS as readonly string[]).includes(name)) {
        throw new Error(`lessons: atom "${atom}" is not a cadence in scope (perfect, plagal, imperfect)`);
      }
      if (grade < 5) throw new Error(`lessons: atom "${atom}" is not a G${grade} cadence`);
      return;
    }
    case 'tie':
    case 'single_dot': {
      if (parts.length !== 0) throw new Error(`lessons: malformed ${kind} atom "${atom}"`);
      if (!scopeForGrade(grade).rhythmDevices.includes(kind)) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} rhythm device`);
      }
      return;
    }
    case 'major_steps': {
      if (parts.length !== 1) throw new Error(`lessons: malformed major_steps atom "${atom}"`);
      if (!scopeForGrade(grade).keysMajor.includes(parts[0])) {
        throw new Error(`lessons: atom "${atom}" is not a G${grade} major key`);
      }
      return;
    }
    case 'triplet':
    case 'triplet_rest': {
      if (parts.length !== 1) throw new Error(`lessons: malformed ${kind} atom "${atom}"`);
      const [sig] = parts;
      const device = kind === 'triplet' ? 'triplet' : 'triplet_with_rests';
      if (
        isCompoundTimeSignature(sig) ||
        !renderableTimeSignatures(grade).includes(sig) ||
        !scopeForGrade(grade).rhythmDevices.includes(device)
      ) {
        throw new Error(`lessons: atom "${atom}" is not a renderable G${grade} simple-time triplet signature`);
      }
      return;
    }
    case 'tuplet': {
      const size = Number(parts[0]);
      if (!TUPLET_SIZES.includes(size)) {
        throw new Error(`lessons: atom "${atom}" is not an irregular division size (5, 6 or 7)`);
      }
      if (grade < 5) throw new Error(`lessons: atom "${atom}" is not a G${grade} rhythm device`);
      return;
    }
    case 'interval_compound': {
      const n = Number(parts[0]);
      if (!COMPOUND_NUMBERS.includes(n)) {
        throw new Error(`lessons: atom "${atom}" is not a compound interval number (9-14)`);
      }
      // A compound interval needs the domain open beyond the tonic AND two
      // octaves of headroom; both arrive together at grade 5.
      const rule = scopeForGrade(grade).intervalRule;
      if (rule.aboveTonicOnly || rule.maxOctaves < 2) {
        throw new Error(`lessons: atom "${atom}" needs a grade whose intervals reach beyond one octave`);
      }
      return;
    }
    case 'term': {
      const [slug] = parts;
      if (!TERM_ATOM_SLUGS.has(slug)) throw new Error(`lessons: atom "${atom}" references an unknown term`);
      // The deck is cumulative, so a Grade 1 lesson must not declare a Grade 3 term.
      if (!termAtomSlugsForGrade(grade).has(slug)) {
        throw new Error(`lessons: atom "${atom}" is not in the G${grade} terms deck`);
      }
      return;
    }
    case 'context':
    case 'find_bar': {
      const [name, gradePart] = parts;
      const known = kind === 'context' ? CONTEXT_KINDS : (BAR_PROPERTIES as readonly string[]);
      if (!known.includes(name)) {
        throw new Error(`lessons: atom "${atom}" is not a Music-in-Context sub-question`);
      }
      // Grade 1 owns the bare atom; every later grade suffixes its own.
      const owner = gradePart === undefined ? 1 : Number(gradePart);
      if (owner !== grade) {
        throw new Error(`lessons: atom "${atom}" belongs to grade ${owner}, not G${grade}`);
      }
      return;
    }
    case 'transpose': {
      // octave_transposition (D1/D10, widened to alto by fyu.5) supports
      // grades 3, 4 and 5 (octave-transposition.ts's build() gate) — it has no
      // scope flag of its own, so this atom's grade gate mirrors that
      // generator's own lock directly. Grade 3 is treble<->bass; grade 4
      // always involves alto and grade 5 always tenor (the new skill at each)
      // — same bare atom throughout, since transposing at the octave is one
      // skill whatever pair of clefs it runs between.
      if (parts.length !== 1 || parts[0] !== 'octave') {
        throw new Error(`lessons: malformed transpose atom "${atom}"`);
      }
      if (grade !== 3 && grade !== 4 && grade !== 5) {
        throw new Error(`lessons: atom "${atom}" only resolves at grade 3, 4 or 5`);
      }
      return;
    }
    case 'rewrite': {
      // metre_rewrite (G5-2, chromaticly-4ak) is a Grade-5-only skill. One bare
      // atom for the whole simple<->compound skill, like transpose:octave.
      if (parts.length !== 1 || parts[0] !== 'simple_compound') {
        throw new Error(`lessons: malformed rewrite atom "${atom}"`);
      }
      if (grade !== 5) {
        throw new Error(`lessons: atom "${atom}" only resolves at grade 5`);
      }
      return;
    }
    case 'transpose_instrument': {
      // transposing_instrument (G5-4, chromaticly-wz1) is a Grade-5-only skill
      // (the KB scopes transposing instruments at grade 5). One atom per
      // instrument code (bb/a/f), each pinning the interval to write.
      if (parts.length !== 1 || !(parts[0] in INSTRUMENT_TRANSPOSITIONS)) {
        throw new Error(`lessons: atom "${atom}" names an unknown transposing instrument`);
      }
      if (grade !== 5) {
        throw new Error(`lessons: atom "${atom}" only resolves at grade 5`);
      }
      return;
    }
    case 'clef_equiv': {
      // clef_equivalence (chromaticly-ra3) is a Grade-4-only skill (the KB
      // scopes "same pitch across treble/alto/bass" at grade 4). One bare atom
      // for the whole skill, like transpose:octave.
      if (parts.length !== 1 || parts[0] !== 'cross') {
        throw new Error(`lessons: malformed clef_equiv atom "${atom}"`);
      }
      if (grade !== 4) {
        throw new Error(`lessons: atom "${atom}" only resolves at grade 4`);
      }
      return;
    }
    case 'satb_voice': {
      // satb_voice_recognition (G5-1, chromaticly-0iy) is a Grade-5-only skill
      // (the KB adds "voices": [soprano, alto, tenor, bass] at grade 5). One
      // atom per voice name, mirroring transpose_instrument's one-atom-per-code shape.
      if (parts.length !== 1 || !(SATB_VOICES as readonly string[]).includes(parts[0])) {
        throw new Error(`lessons: atom "${atom}" names an unknown SATB voice`);
      }
      if (grade !== 5) {
        throw new Error(`lessons: atom "${atom}" only resolves at grade 5`);
      }
      return;
    }
    default:
      throw new Error(`lessons: atom "${atom}" has unknown kind "${kind}"`);
  }
}

/** Assert the `unlocks` links form one acyclic chain reaching every lesson but the first. */
export function assertUnlockGraph(lessons: Lesson[]): void {
  const byId = new Map(lessons.map((l) => [l.id, l]));

  for (const lesson of lessons) {
    if (lesson.unlocks !== null && !byId.has(lesson.unlocks)) {
      throw new Error(`lessons: "${lesson.id}" unlocks unknown lesson "${lesson.unlocks}"`);
    }
  }

  // Reachable set: every lesson named as some lesson's `unlocks` target.
  const unlocked = new Set(lessons.map((l) => l.unlocks).filter((id): id is string => id !== null));
  const roots = lessons.filter((l) => !unlocked.has(l.id));
  if (roots.length !== 1) {
    throw new Error(`lessons: expected exactly one starting lesson, found ${roots.length}`);
  }

  // Walk from the single root; a cycle or fork shows up as a revisit or a miss.
  const seen = new Set<string>();
  let cursor: string | null = roots[0].id;
  while (cursor !== null) {
    if (seen.has(cursor)) throw new Error(`lessons: unlock graph has a cycle at "${cursor}"`);
    seen.add(cursor);
    cursor = byId.get(cursor)!.unlocks;
  }
  if (seen.size !== lessons.length) {
    const stranded = lessons.filter((l) => !seen.has(l.id)).map((l) => l.id);
    throw new Error(`lessons: unreachable from the start: ${stranded.join(', ')}`);
  }
}

/** Parses, cross-checks, and returns one grade's lesson doc, with `grade` stamped onto every lesson. */
export function loadDoc(raw: unknown): LessonsDoc {
  const parsed = LessonsDocSchema.parse(raw);
  const lessons: Lesson[] = parsed.lessons.map((lesson) => ({ ...lesson, grade: parsed.grade }));

  for (const lesson of lessons) {
    for (const template of lesson.templates) {
      if (!(template in GENERATORS)) throw new Error(`lessons: "${lesson.id}" uses unknown template "${template}"`);
    }
    if (lesson.by_ear_source && !(lesson.by_ear_source in GENERATORS)) {
      throw new Error(`lessons: "${lesson.id}" by-ear source is unknown template "${lesson.by_ear_source}"`);
    }
    if (lesson.by_ear_source) {
      const card = byEarCardFor(lesson);
      // Each atom ALONE: Practice serves one due atom, and a throw there lands in
      // a render with no ErrorBoundary above it.
      for (const atom of byEarPool(lesson)) {
        try {
          generate(card, { grade: lesson.grade, seed: 0, atoms: [atom], source: lesson.by_ear_source });
        } catch (err) {
          throw new Error(`lessons: "${lesson.id}" by-ear card "${card}" cannot generate "${atom}": ${(err as Error).message}`);
        }
      }
    }
    for (const atom of creditedAtoms(lesson)) assertAtomResolves(atom, lesson.grade);
    if (lesson.worked_example && !(lesson.worked_example.template_id in GENERATORS)) {
      throw new Error(`lessons: "${lesson.id}" worked example uses unknown template "${lesson.worked_example.template_id}"`);
    }
    const conceptExample = lesson.teach?.concept.example;
    if (conceptExample && !(conceptExample.template_id in GENERATORS)) {
      throw new Error(`lessons: "${lesson.id}" teach example uses unknown template "${conceptExample.template_id}"`);
    }
    // A by-ear rhythm that doesn't fill whole bars would play as nonsense and its
    // beat grid would be a lie — fail at import, not on device.
    if (lesson.teach?.theoryInSound) assertRhythmFillsBars(lesson.teach.theoryInSound);
  }
  assertUnlockGraph(lessons);

  return { ...parsed, lessons };
}

/** Throws if any lesson id is reused across two different grade docs (within-doc dupes are a separate concern). */
export function assertNoCrossDocDuplicateIds(docs: readonly LessonsDoc[]): void {
  const docIndexesById = new Map<string, Set<number>>();
  docs.forEach((doc, docIndex) => {
    for (const lesson of doc.lessons) {
      const docIndexes = docIndexesById.get(lesson.id) ?? new Set<number>();
      docIndexes.add(docIndex);
      docIndexesById.set(lesson.id, docIndexes);
    }
  });
  for (const [id, docIndexes] of docIndexesById) {
    if (docIndexes.size > 1) {
      const grades = [...docIndexes].map((i) => docs[i].grade);
      throw new Error(`lessons: id "${id}" is used by more than one grade doc (grades ${grades.join(', ')})`);
    }
  }
}

// Grade-1 first — order matters for the interim single-root-per-grade unlock
// behavior (see U2 of the grade2-new-major-keys plan).
const GRADE_DOCS: readonly LessonsDoc[] = [
  // First steps (grade 0, chromaticly-dhe) leads, so LESSONS stays in grade order.
  loadDoc(grade0Raw),
  loadDoc(grade1Raw),
  loadDoc(grade2Raw),
  loadDoc(grade3Raw),
  loadDoc(grade4Raw),
  loadDoc(grade5Raw),
];

assertNoCrossDocDuplicateIds(GRADE_DOCS);

export const LESSONS_BY_GRADE: Record<number, Lesson[]> = Object.fromEntries(GRADE_DOCS.map((doc) => [doc.grade, doc.lessons]));

// Concatenated in grade order so a second registered doc extends this, not rewrites it.
export const LESSONS: Lesson[] = Object.keys(LESSONS_BY_GRADE)
  .map(Number)
  .sort((a, b) => a - b)
  .flatMap((grade) => LESSONS_BY_GRADE[grade]);

export function lessonsForGrade(grade: number): Lesson[] {
  return LESSONS_BY_GRADE[grade] ?? [];
}

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
