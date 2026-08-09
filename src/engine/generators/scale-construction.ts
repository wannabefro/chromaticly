// scale_construction generator (D7/G3 D3(c)) — spot-the-wrong-note MCQ.
// Grade 2: one octave ascending harmonic minor, exactly one note corrupted,
// the learner names the ordinal position that's wrong.
//
// FORM-KEYED corruption rules (human requirement): "which notes may be
// corrupted / which corruption is the headline misconception" is looked up
// per scale FORM, resolved from the lesson's `scale:*` atoms — never baked
// into the generator body as a harmonic-only assumption. An atom naming any
// other form fails loud below rather than silently falling back to harmonic.
//
// Grade 3 (D3(c), settled): melodic minor is DIRECTIONAL — ascending raises
// the 6th/7th, descending reverts to natural minor — so its FORM_TABLE entry
// carries per-direction builderForm + corruption rules, and the generator
// rng-picks a direction INSIDE the melodic-only branch (gated on
// `entry.kind === 'directional'`, which harmonic's 'single' entry never is)
// so the harmonic path's RNG draw sequence — and grade-1/2 byte-identity —
// is untouched. A descending item's stimulus/answer_music events are emitted
// high->low (the reversed ascending walk of the melodic-descending form) and
// its prompt names the direction, matching the harmonic prompt's form-naming
// pattern.

import type { Clef, Music } from '../../music/types';
import { KB_VERSION } from '../../content/knowledge-base';
import { parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { comfortablePitchRange, scopeForGrade } from '../scope';
import type { GradeScope } from '../scope';
import type { ExerciseInstance } from '../schema';
import { tonicLetter } from './key-spelling';
import { minorScale, shiftAccidental } from './minor-keys';
import type { MinorScaleForm } from './minor-keys';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type Direction = 'ascending' | 'descending';
const DIRECTIONS: Direction[] = ['ascending', 'descending'];

interface CorruptionRule {
  /** 0-indexed scale degree (0 = tonic .. 7 = the octave above) this rule corrupts. */
  degree: number;
  /** Semitone shift applied to the TRUE scale's note at `degree` to produce the wrong note. */
  semitones: number;
  /** feedback.incorrect text naming the misconception this rule encodes. */
  feedback: string;
  /** Highest-frequency / must-appear corruption for this form (commandment 6). */
  headline?: boolean;
}

interface FormVariant {
  builderForm: MinorScaleForm;
  corruptionRules: CorruptionRule[];
}

interface SingleDirectionFormEntry {
  kind: 'single';
  builderForm: MinorScaleForm;
  /** Form name as it reads in the prompt copy, e.g. "harmonic minor". */
  promptLabel: string;
  corruptionRules: CorruptionRule[];
}

/** Melodic minor's directional form (D3(c)): one FORM_TABLE entry carrying
 *  BOTH directions' builder form + corruption rules, so `formEntryFor` still
 *  resolves a single `scale:*_minor_melodic` atom to one entry — the
 *  generator picks the direction (and therefore the variant) at build time. */
interface DirectionalFormEntry {
  kind: 'directional';
  promptLabel: string;
  ascending: FormVariant;
  descending: FormVariant;
}

type FormEntry = SingleDirectionFormEntry | DirectionalFormEntry;

// FORM_TABLE is the single source of truth the generator resolves the atom's
// form against — an unknown/absent entry fails loud (formEntryFor throws),
// never silently defaulting to harmonic.
const FORM_TABLE: Partial<Record<string, FormEntry>> = {
  harmonic: {
    kind: 'single',
    builderForm: 'harmonic_minor',
    promptLabel: 'harmonic minor',
    corruptionRules: [
      {
        degree: 6,
        semitones: -1,
        headline: true,
        feedback:
          'Harmonic minor raises the 7th note a semitone above the key signature — left as the signature writes it, the scale is natural minor.',
      },
      {
        degree: 5,
        semitones: 1,
        feedback: 'Only the 7th note is raised in harmonic minor — the 6th stays as the key signature has it.',
      },
      {
        degree: 2,
        semitones: 1,
        feedback: 'The 3rd note keeps the minor 3rd — raising it borrows from the major scale, not harmonic minor.',
      },
    ],
  },
  melodic: {
    kind: 'directional',
    promptLabel: 'melodic minor',
    ascending: {
      builderForm: 'melodic_minor_asc',
      corruptionRules: [
        {
          degree: 5,
          semitones: -1,
          headline: true,
          feedback:
            'Going up, melodic minor raises the 6th note a semitone above the key signature — left as the signature writes it, it belongs to the descent.',
        },
        {
          degree: 6,
          semitones: -1,
          feedback:
            'Going up, melodic minor raises the 7th note too — left as the key signature writes it, it belongs to the descent.',
        },
        {
          degree: 2,
          semitones: 1,
          feedback: 'The 3rd note keeps the minor 3rd — raising it borrows from the major scale, not melodic minor.',
        },
      ],
    },
    descending: {
      builderForm: 'melodic_minor_desc',
      corruptionRules: [
        {
          degree: 6,
          semitones: 1,
          headline: true,
          feedback:
            'Melodic minor lowers the 7th and 6th on the way down — keeping the raised 7th here borrows from the ascending form.',
        },
        {
          degree: 5,
          semitones: 1,
          feedback:
            'Melodic minor lowers the 6th too on the way down — keeping the raised 6th here borrows from the ascending form.',
        },
      ],
    },
  },
};

function formEntryFor(form: string): FormEntry {
  const entry = FORM_TABLE[form];
  if (!entry) {
    throw new Error(`scale_construction: no corruption rule table entry for form "${form}"`);
  }
  return entry;
}

const ORDINAL_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

function positionLabel(degree: number): string {
  return `${ORDINAL_LABELS[degree]} note`;
}

/** A degree (0=tonic..7=octave, always indexed against the ASCENDING walk)
 *  translated to its position in PLAYED order: unchanged ascending, mirrored
 *  (7 - degree) descending — a descending item's 2nd note played is the 7th
 *  scale degree (D3(c)). */
function playedIndex(degree: number, direction: Direction | null): number {
  return direction === 'descending' ? 7 - degree : degree;
}

/** The position labels a form's rule table can produce — exported so tests
 *  can assert "the canonical/distractors come from this form's table" by
 *  form lookup, never by inlining the harmonic rule content as a literal.
 *  For a directional form, an explicit `direction` narrows to that
 *  direction's played-order labels; omitted, it returns the union over both. */
export function formPositionLabels(form: string, direction?: Direction): string[] {
  const entry = formEntryFor(form);
  if (entry.kind === 'single') {
    return entry.corruptionRules.map((r) => positionLabel(r.degree));
  }
  if (direction) {
    return entry[direction].corruptionRules.map((r) => positionLabel(playedIndex(r.degree, direction)));
  }
  const labels = DIRECTIONS.flatMap((d) => entry[d].corruptionRules.map((r) => positionLabel(playedIndex(r.degree, d))));
  return [...new Set(labels)];
}

/** The lesson's `scale:*_minor_*` atoms as {tonic, form} pairs, e.g.
 *  scale:A_minor_harmonic -> {tonic: "A", form: "harmonic"}. Single-atom-safe
 *  (D4/D7): one atom is enough to pin one key+form pair.
 *
 *  Scope-filtered by `scope.minorForms` (commandment 1: scope is law, per
 *  grade): `Music` carries no form field, so the validator's checkScope
 *  cannot reject an out-of-grade FORM downstream (validator.ts's own
 *  scaleConstructionHook comment names this gap) — this filter is what keeps
 *  a stray `scale:*_minor_melodic` atom unreachable at grade 2 now that the
 *  melodic FORM_TABLE entry exists. A no-op for every real caller today (its
 *  atoms already only name in-scope forms), so grade-1/2 output is untouched. */
function scaleAtomsFromAtoms(atoms: string[], scope: GradeScope): { tonic: string; form: string }[] {
  const allPairs: { tonic: string; form: string }[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'scale') continue;
    const [tonic, mode, ...formParts] = parts[0].split('_');
    if (mode !== 'minor' || formParts.length === 0) continue;
    const form = formParts.join('_');
    if (!allPairs.some((p) => p.tonic === tonic && p.form === form)) allPairs.push({ tonic, form });
  }
  if (allPairs.length === 0) {
    throw new Error('scale_construction: needs at least one scale:*_minor_* atom');
  }
  const pairs = allPairs.filter((p) => scope.minorForms.includes(p.form));
  if (pairs.length === 0) {
    throw new Error("scale_construction: no scale:*_minor_* atom's form is in scope at this grade");
  }
  return pairs;
}

const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

function letterOrdinal(letter: string, octave: number): number {
  return octave * 7 + LETTER_ORDER.indexOf(letter as (typeof LETTER_ORDER)[number]);
}

function parseNaturalPitch(pitch: string): { letter: string; octave: number } {
  const m = /^([A-G])(-?\d+)$/.exec(pitch);
  if (!m) throw new Error(`scale_construction: not a natural scientific pitch "${pitch}"`);
  return { letter: m[1], octave: Number(m[2]) };
}

/** Start pitches ("<Letter><Octave>") for which the COMPLETE 8-note ascending
 *  scale — tonic through the octave above — fits comfortablePitchRange(clef, grade)
 *  (review finding 3): tonic ordinal >= the clef's low bound AND
 *  tonic-plus-an-octave <= its high bound. An in-range tonic does NOT imply
 *  an in-range top note — e.g. a D5 treble tonic tops at D6, past the C6
 *  ceiling — so both ends of the 8-note span are checked, not just the tonic.
 *
 *  Sharp-tonic fix (D5): the ordinal math and the returned starts are keyed
 *  on the tonic's NATURAL LETTER (`tonicLetter`), never the raw tonic — the
 *  key signature (via `minorScale`'s `spellInKeySig`) is what puts the sharp
 *  back on, matching `minorScale`'s natural-letter-only startPitch contract.
 *  For a natural tonic (every grade-1/2 minor) `tonicLetter` is a no-op, so
 *  this is byte-identical to the pre-fix output there. */
export function validScaleStartPitches(tonic: string, clef: Clef, grade: number): string[] {
  const naturalTonic = tonicLetter(tonic);
  // Comfortable (grade-2) range, not the widened grade-3 reading range: a scale
  // spans a full octave, so a high grade-3 tonic would push the top note onto
  // extreme ledger lines. Ledger reading is note_naming's job, not this one.
  const { low, high } = comfortablePitchRange(clef, grade);
  const lowP = parseNaturalPitch(low);
  const highP = parseNaturalPitch(high);
  const lowOrd = letterOrdinal(lowP.letter, lowP.octave);
  const highOrd = letterOrdinal(highP.letter, highP.octave);

  const starts: string[] = [];
  for (let octave = lowP.octave - 1; octave <= highP.octave; octave++) {
    const tonicOrd = letterOrdinal(naturalTonic, octave);
    const topOrd = letterOrdinal(naturalTonic, octave + 1);
    if (tonicOrd >= lowOrd && topOrd <= highOrd) {
      starts.push(`${naturalTonic}${octave}`);
    }
  }
  return starts;
}

function scaleMusic(clef: Clef, tonic: string, pitches: string[]): Music {
  return {
    clef,
    key_sig: `${tonic}_minor`,
    time_sig: null,
    voices: [{ events: pitches.map((pitch) => ({ type: 'note', pitch, dur: 'crotchet' })) }],
  };
}

function promptFor(tonic: string, promptLabel: string, direction: Direction | null): string {
  const directionSuffix = direction ? `, ${direction},` : '';
  return `One note of this ${tonic} ${promptLabel} scale${directionSuffix} is wrong — which one?`;
}

function hintFor(tonic: string, promptLabel: string, direction: Direction | null): string {
  const directionSuffix = direction ? `, ${direction},` : '';
  return `Compare each note against the ${tonic} ${promptLabel} scale${directionSuffix} — only one note is wrong.`;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);

  const { tonic, form } = pick(rng, scaleAtomsFromAtoms(atoms, scope));
  const entry = formEntryFor(form);
  const clef = pick(rng, [...scope.clefs]);

  const starts = validScaleStartPitches(tonic, clef, grade);
  if (starts.length === 0) {
    throw new Error(`scale_construction: no valid start pitch for ${tonic} minor on ${clef} clef at grade ${grade}`);
  }
  const startPitch = pick(rng, starts);

  // Direction is picked ONLY inside the melodic (directional) branch — the
  // harmonic ('single') path below never calls `pick` here, so its RNG draw
  // sequence (and grade-1/2 byte-identity) is untouched (D3(c)).
  let builderForm: MinorScaleForm;
  let corruptionRules: CorruptionRule[];
  let direction: Direction | null = null;
  if (entry.kind === 'directional') {
    direction = pick(rng, DIRECTIONS);
    const variant = entry[direction];
    builderForm = variant.builderForm;
    corruptionRules = variant.corruptionRules;
  } else {
    builderForm = entry.builderForm;
    corruptionRules = entry.corruptionRules;
  }

  // Always built as the ASCENDING walk (tonic..octave) — a descending item
  // reverses it into played order below, so answer_music is always the U2
  // builder's own output for this key/form/register, just walked backwards.
  const trueScale = minorScale(tonic, builderForm, startPitch);
  const rule = pick(rng, corruptionRules);
  const corruptedScale = [...trueScale];
  corruptedScale[rule.degree] = shiftAccidental(trueScale[rule.degree], rule.semitones);

  const canonical = positionLabel(playedIndex(rule.degree, direction));
  const wrongRules = corruptionRules.filter((r) => r !== rule);
  const distractors = wrongRules.map((r) => positionLabel(playedIndex(r.degree, direction)));

  const playedTrue = direction === 'descending' ? [...trueScale].reverse() : trueScale;
  const playedCorrupted = direction === 'descending' ? [...corruptedScale].reverse() : corruptedScale;

  return {
    id: makeInstanceId('scale_construction', grade, idSeed),
    template_id: 'scale_construction',
    grade,
    strand: 'scales_keys',
    prompt: promptFor(tonic, entry.promptLabel, direction),
    stimulus: { music: scaleMusic(clef, tonic, playedCorrupted), text: null },
    interaction: { type: 'mcq', config: { answer_music: scaleMusic(clef, tonic, playedTrue) } },
    answer: { canonical, accepted_alternatives: [] },
    distractors,
    hints: [hintFor(tonic, entry.promptLabel, direction)],
    feedback: {
      correct: 'Correct!',
      incorrect: rule.feedback,
      // Every distractor names a position the printed scale already spells right.
      by_distractor: Object.fromEntries(
        wrongRules.map((r) => {
          const i = playedIndex(r.degree, direction);
          return [positionLabel(i), `The ${positionLabel(i)} is ${playedTrue[i]}, which this scale spells correctly.`];
        }),
      ),
    },
    srs_tags: [`scale:${tonic}_minor_${form}`],
    kb_version: KB_VERSION,
  };
}

export const scaleConstruction: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
