// Grade 2 scale_construction generator (D7) — spot-the-wrong-note MCQ variant
// CONFIRMED by the human 2026-07-19: one octave ascending, exactly one note
// corrupted, the learner names the ordinal position that's wrong.
//
// FORM-KEYED corruption rules (human requirement): "which notes may be
// corrupted / which corruption is the headline misconception" is looked up
// per scale FORM, resolved from the lesson's `scale:*` atoms — never baked
// into the generator body as a harmonic-only assumption. Grade 2 only ever
// instantiates harmonic because FORM_TABLE has exactly one entry and the
// atoms/scope gate it; an atom naming any other form fails loud below rather
// than silently falling back to harmonic.
//
// Grade-3 melodic minor forward-compat is a documented SEAM, not built here:
// a future `melodic_asc` FORM_TABLE entry (un-raised 6th/7th ascending,
// wrong-direction alterations) plus the KB's melodic_minor_asc scale pattern
// (already form-general in minor-keys.ts's minorScale) is the entire
// addition — zero new interaction/UI/validator-shape work (D7).

import type { Clef, Music } from '../../music/types';
import { KB_VERSION } from '../../content/knowledge-base';
import { parseAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { pitchRange, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { minorScale, shiftAccidental } from './minor-keys';
import type { MinorScaleForm } from './minor-keys';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

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

interface FormEntry {
  builderForm: MinorScaleForm;
  /** Form name as it reads in the prompt copy, e.g. "harmonic minor". */
  promptLabel: string;
  corruptionRules: CorruptionRule[];
}

// FORM_TABLE is the single source of truth the generator resolves the atom's
// form against — an unknown/absent entry fails loud (formEntryFor throws),
// never silently defaulting to harmonic.
const FORM_TABLE: Partial<Record<string, FormEntry>> = {
  harmonic: {
    builderForm: 'harmonic_minor',
    promptLabel: 'harmonic minor',
    corruptionRules: [
      {
        degree: 6,
        semitones: -1,
        headline: true,
        feedback:
          'The 7th note must be raised with a sharp in harmonic minor — a natural 7th belongs to natural minor, not harmonic.',
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
  // melodic_asc: G3 seam (D7) — un-raised 6th/7th ascending + wrong-direction
  // alterations. New KB pattern data + this table entry only; no other file changes.
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

/** The position labels a form's rule table can produce — exported so tests
 *  can assert "the canonical/distractors come from this form's table" by
 *  form lookup, never by inlining the harmonic rule content as a literal. */
export function formPositionLabels(form: string): string[] {
  return formEntryFor(form).corruptionRules.map((r) => positionLabel(r.degree));
}

/** The lesson's `scale:*_minor_*` atoms as {tonic, form} pairs, e.g.
 *  scale:A_minor_harmonic -> {tonic: "A", form: "harmonic"}. Single-atom-safe
 *  (D4/D7): one atom is enough to pin one key+form pair. */
function scaleAtomsFromAtoms(atoms: string[]): { tonic: string; form: string }[] {
  const pairs: { tonic: string; form: string }[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'scale') continue;
    const [tonic, mode, ...formParts] = parts[0].split('_');
    if (mode !== 'minor' || formParts.length === 0) continue;
    const form = formParts.join('_');
    if (!pairs.some((p) => p.tonic === tonic && p.form === form)) pairs.push({ tonic, form });
  }
  if (pairs.length === 0) {
    throw new Error('scale_construction: needs at least one scale:*_minor_* atom');
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
 *  scale — tonic through the octave above — fits pitchRange(clef, grade)
 *  (review finding 3): tonic ordinal >= the clef's low bound AND
 *  tonic-plus-an-octave <= its high bound. An in-range tonic does NOT imply
 *  an in-range top note — e.g. a D5 treble tonic tops at D6, past the C6
 *  ceiling — so both ends of the 8-note span are checked, not just the tonic. */
export function validScaleStartPitches(tonic: string, clef: Clef, grade: number): string[] {
  const { low, high } = pitchRange(clef, grade);
  const lowP = parseNaturalPitch(low);
  const highP = parseNaturalPitch(high);
  const lowOrd = letterOrdinal(lowP.letter, lowP.octave);
  const highOrd = letterOrdinal(highP.letter, highP.octave);

  const starts: string[] = [];
  for (let octave = lowP.octave - 1; octave <= highP.octave; octave++) {
    const tonicOrd = letterOrdinal(tonic, octave);
    const topOrd = letterOrdinal(tonic, octave + 1);
    if (tonicOrd >= lowOrd && topOrd <= highOrd) {
      starts.push(`${tonic}${octave}`);
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

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);

  const { tonic, form } = pick(rng, scaleAtomsFromAtoms(atoms));
  const entry = formEntryFor(form);
  const clef = pick(rng, [...scope.clefs]);

  const starts = validScaleStartPitches(tonic, clef, grade);
  if (starts.length === 0) {
    throw new Error(`scale_construction: no valid start pitch for ${tonic} minor on ${clef} clef at grade ${grade}`);
  }
  const startPitch = pick(rng, starts);

  const trueScale = minorScale(tonic, entry.builderForm, startPitch);
  const rule = pick(rng, entry.corruptionRules);
  const corruptedScale = [...trueScale];
  corruptedScale[rule.degree] = shiftAccidental(trueScale[rule.degree], rule.semitones);

  const canonical = positionLabel(rule.degree);
  const distractors = entry.corruptionRules
    .filter((r) => r !== rule)
    .map((r) => positionLabel(r.degree));

  return {
    id: makeInstanceId('scale_construction', grade, idSeed),
    template_id: 'scale_construction',
    grade,
    strand: 'scales_keys',
    prompt: `One note of this ${tonic} ${entry.promptLabel} scale is wrong — which one?`,
    stimulus: { music: scaleMusic(clef, tonic, corruptedScale), text: null },
    interaction: { type: 'mcq', config: { answer_music: scaleMusic(clef, tonic, trueScale) } },
    answer: { canonical, accepted_alternatives: [] },
    distractors,
    hints: [`Compare each note against the ${tonic} ${entry.promptLabel} scale — only one note is wrong.`],
    feedback: {
      correct: 'Correct!',
      incorrect: rule.feedback,
    },
    srs_tags: [`scale:${tonic}_minor_${form}`],
    kb_version: KB_VERSION,
  };
}

export const scaleConstruction: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
