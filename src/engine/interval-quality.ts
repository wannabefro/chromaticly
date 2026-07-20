// Grade-3 interval quality classifier (D2): derives perfect/major/minor from
// the two spelled stimulus pitches, not from a per-number/per-form table. The
// number sets (which numbers are perfect vs major/minor-capable) are read
// from KB.intervalQualities; the semitone targets below are fixed music
// theory, not KB-sourced data.
//
// RN-free by design (core-boundary.test.ts): only KB + pitch-math + standard
// TS. The validator (U3) imports this to independently recompute a stimulus's
// quality — this module must never import a generator, or validator.ts would
// gain an import cycle into generators/.

import { KB } from '../content/knowledge-base';
import { scientificPitchOrdinal } from './generators/pitch-math';

export type IntervalQuality = 'perfect' | 'major' | 'minor';

const PITCH_PATTERN = /^([A-G])(#|b)?(-?\d+)$/;

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Absolute semitone value of a spelled scientific pitch, e.g. "C4" -> 48, "F#4" -> 54. */
export function pitchSemitone(pitch: string): number {
  const match = PITCH_PATTERN.exec(pitch);
  if (!match) throw new Error(`interval-quality: not a spelled scientific pitch: ${pitch}`);
  const [, letter, accidental, octaveStr] = match;
  const accidentalOffset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return PITCH_CLASS[letter] + accidentalOffset + Number(octaveStr) * 12;
}

/** Strip a pitch's accidental so pitch-math's natural-letter ordinal helpers apply. */
function naturalizedLetterOrdinal(pitch: string): number {
  const match = PITCH_PATTERN.exec(pitch);
  if (!match) throw new Error(`interval-quality: not a spelled scientific pitch: ${pitch}`);
  const [, letter, , octaveStr] = match;
  return scientificPitchOrdinal(`${letter}${octaveStr}`);
}

/** The above-tonic interval NUMBER by letter-counting (a 3rd = 3), ignoring accidentals. */
export function diatonicIntervalNumber(lower: string, upper: string): number {
  return naturalizedLetterOrdinal(upper) - naturalizedLetterOrdinal(lower) + 1;
}

// Fixed music theory: semitone size of a PERFECT interval of the given number
// above the tonic (1/4/5/8 are the only perfect-capable numbers in scope).
const PERFECT_SEMITONES: Record<number, number> = { 1: 0, 4: 5, 5: 7, 8: 12 };
// Fixed music theory: semitone size of a MAJOR interval of the given number
// above the tonic; minor is exactly one semitone smaller (2/3/6/7 in scope).
const MAJOR_SEMITONES: Record<number, number> = { 2: 2, 3: 4, 6: 9, 7: 11 };

/**
 * Classifies the interval `lower`->`upper` of the given diatonic NUMBER.
 * Grade-3 scope is perfect/major/minor only — no augmented/diminished — so an
 * out-of-vocabulary semitone diff (or an out-of-vocabulary number) throws
 * rather than inventing a label.
 */
export function intervalQuality(lower: string, upper: string, number: number): IntervalQuality {
  const diff = pitchSemitone(upper) - pitchSemitone(lower);
  const { perfect_numbers: perfectNumbers, major_minor_numbers: majorMinorNumbers } = KB.intervalQualities;

  if (perfectNumbers.includes(number)) {
    const target = PERFECT_SEMITONES[number];
    if (target === undefined) {
      throw new Error(`interval-quality: no perfect semitone target defined for number ${number}`);
    }
    if (diff === target) return 'perfect';
    throw new Error(
      `interval-quality: ${lower}->${upper} (number ${number}) is not a perfect interval in grade-3 scope ` +
        `(semitone diff ${diff}, expected ${target})`,
    );
  }

  if (majorMinorNumbers.includes(number)) {
    const majorTarget = MAJOR_SEMITONES[number];
    if (majorTarget === undefined) {
      throw new Error(`interval-quality: no major semitone target defined for number ${number}`);
    }
    if (diff === majorTarget) return 'major';
    if (diff === majorTarget - 1) return 'minor';
    throw new Error(
      `interval-quality: ${lower}->${upper} (number ${number}) is neither major nor minor in grade-3 scope ` +
        `(semitone diff ${diff}, expected ${majorTarget} or ${majorTarget - 1})`,
    );
  }

  throw new Error(
    `interval-quality: number ${number} is not in grade-3 vocabulary ` +
      `(perfect: ${perfectNumbers.join(',')}; major/minor: ${majorMinorNumbers.join(',')})`,
  );
}

const ORDINAL_WORDS: Record<number, string> = { 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th' };

/**
 * Formats "<quality> <ordinal>" (D5 confirmed copy), e.g. "minor 3rd",
 * "perfect 5th" — with the confirmed octave special-case "perfect octave"
 * (never "perfect 8th").
 */
export function intervalLabel(quality: IntervalQuality, number: number): string {
  if (number === 8) {
    if (quality !== 'perfect') {
      throw new Error(`interval-quality: an octave (number 8) must be perfect, got "${quality}"`);
    }
    return 'perfect octave';
  }
  const ordinal = ORDINAL_WORDS[number];
  if (!ordinal) throw new Error(`interval-quality: number ${number} has no grade-3 ordinal word`);
  return `${quality} ${ordinal}`;
}

const LABEL_PATTERN = /^(perfect|major|minor) (2nd|3rd|4th|5th|6th|7th)$/;
const NUMBER_BY_ORDINAL: Record<string, number> = { '2nd': 2, '3rd': 3, '4th': 4, '5th': 5, '6th': 6, '7th': 7 };

/**
 * Inverse of intervalLabel, for the validator's well-formedness check.
 * Rejects (throws) malformed strings and out-of-vocabulary quality/number
 * combinations ("major 5th", "diminished 4th", "perfect 3rd") rather than
 * returning null — mirroring intervalQuality's fail-loud discipline, so a
 * malformed label surfaces at the call site instead of silently becoming a
 * falsy value a caller might not check.
 */
export function parseIntervalLabel(label: string): { quality: IntervalQuality; number: number } {
  if (label === 'perfect octave') return { quality: 'perfect', number: 8 };

  const match = LABEL_PATTERN.exec(label);
  if (!match) throw new Error(`interval-quality: not a well-formed grade-3 interval label: "${label}"`);
  const quality = match[1] as IntervalQuality;
  const number = NUMBER_BY_ORDINAL[match[2]];

  const { perfect_numbers: perfectNumbers, major_minor_numbers: majorMinorNumbers } = KB.intervalQualities;
  if (quality === 'perfect') {
    if (!perfectNumbers.includes(number)) {
      throw new Error(`interval-quality: "${label}" — number ${number} cannot be perfect in grade-3 vocabulary`);
    }
  } else {
    if (!majorMinorNumbers.includes(number)) {
      throw new Error(`interval-quality: "${label}" — number ${number} cannot be ${quality} in grade-3 vocabulary`);
    }
  }

  return { quality, number };
}
