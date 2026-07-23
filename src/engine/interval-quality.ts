// Interval quality classifier (D2, widened at fyu.8 for grade-4 aug/dim):
// derives perfect/major/minor/augmented/diminished from the two spelled
// stimulus pitches, not from a per-number/per-form table. The number sets
// (which numbers are perfect vs major/minor-capable) are read from
// KB.intervalQualities; the semitone targets below are fixed music theory,
// not KB-sourced data. The KB's modification_rules ("major -1 = minor; minor
// -1 = diminished; major +1 = augmented; perfect -1 = diminished; perfect +1
// = augmented") is implemented directly below.
//
// RN-free by design (core-boundary.test.ts): only KB + pitch-math + standard
// TS. The validator (U3) imports this to independently recompute a stimulus's
// quality — this module must never import a generator, or validator.ts would
// gain an import cycle into generators/.

import { KB } from '../content/knowledge-base';
import { scientificPitchOrdinal } from './generators/pitch-math';

export type IntervalQuality = 'perfect' | 'major' | 'minor' | 'augmented' | 'diminished';

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
 * Perfect-capable numbers (1/4/5/8) yield perfect/augmented/diminished;
 * major/minor-capable numbers (2/3/6/7) yield major/minor/augmented/
 * diminished. A semitone diff more than one step outside the perfect target,
 * or more than one step outside the major/minor pair (or an out-of-vocabulary
 * number), throws rather than inventing a label — those doubly-altered
 * intervals never occur in the natural-pitch scope this module serves.
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
    if (diff === target + 1) return 'augmented';
    if (diff === target - 1) return 'diminished';
    throw new Error(
      `interval-quality: ${lower}->${upper} (number ${number}) is not perfect/augmented/diminished ` +
        `(semitone diff ${diff}, expected ${target - 1}..${target + 1})`,
    );
  }

  if (majorMinorNumbers.includes(number)) {
    const majorTarget = MAJOR_SEMITONES[number];
    if (majorTarget === undefined) {
      throw new Error(`interval-quality: no major semitone target defined for number ${number}`);
    }
    if (diff === majorTarget) return 'major';
    if (diff === majorTarget - 1) return 'minor';
    if (diff === majorTarget + 1) return 'augmented';
    if (diff === majorTarget - 2) return 'diminished';
    throw new Error(
      `interval-quality: ${lower}->${upper} (number ${number}) is not major/minor/augmented/diminished ` +
        `(semitone diff ${diff}, expected ${majorTarget - 2}..${majorTarget + 1})`,
    );
  }

  throw new Error(
    `interval-quality: number ${number} is not in the interval-quality vocabulary ` +
      `(perfect: ${perfectNumbers.join(',')}; major/minor: ${majorMinorNumbers.join(',')})`,
  );
}

const ORDINAL_WORDS: Record<number, string> = { 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th' };

/**
 * Formats "<quality> <ordinal>" (D5 confirmed copy), e.g. "minor 3rd",
 * "perfect 5th", "augmented 4th", "diminished 5th" — with the confirmed
 * octave special-case "perfect octave" (never "perfect 8th"; an octave is
 * always perfect in the natural-pitch scope this module serves).
 */
export function intervalLabel(quality: IntervalQuality, number: number): string {
  if (number === 8) {
    if (quality !== 'perfect') {
      throw new Error(`interval-quality: an octave (number 8) must be perfect, got "${quality}"`);
    }
    return 'perfect octave';
  }
  const ordinal = ORDINAL_WORDS[number];
  if (!ordinal) throw new Error(`interval-quality: number ${number} has no interval-quality ordinal word`);
  return `${quality} ${ordinal}`;
}

const LABEL_PATTERN = /^(perfect|major|minor|augmented|diminished) (2nd|3rd|4th|5th|6th|7th)$/;
const NUMBER_BY_ORDINAL: Record<string, number> = { '2nd': 2, '3rd': 3, '4th': 4, '5th': 5, '6th': 6, '7th': 7 };

/**
 * Inverse of intervalLabel, for the validator's well-formedness check.
 * Rejects (throws) malformed strings and out-of-vocabulary quality/number
 * combinations ("major 5th", "perfect 3rd" — 5 is perfect-only, 3 is
 * major/minor-only) rather than returning null — mirroring intervalQuality's
 * fail-loud discipline, so a malformed label surfaces at the call site
 * instead of silently becoming a falsy value a caller might not check.
 * augmented/diminished are valid for BOTH perfect-capable and major/minor-
 * capable numbers (the KB's modification_rules apply symmetrically), even
 * though the natural-pitch domain only ever reaches them on 4ths/5ths.
 */
export function parseIntervalLabel(label: string): { quality: IntervalQuality; number: number } {
  if (label === 'perfect octave') return { quality: 'perfect', number: 8 };

  const match = LABEL_PATTERN.exec(label);
  if (!match) throw new Error(`interval-quality: not a well-formed interval label: "${label}"`);
  const quality = match[1] as IntervalQuality;
  const number = NUMBER_BY_ORDINAL[match[2]];

  const { perfect_numbers: perfectNumbers, major_minor_numbers: majorMinorNumbers } = KB.intervalQualities;
  if (quality === 'perfect') {
    if (!perfectNumbers.includes(number)) {
      throw new Error(`interval-quality: "${label}" — number ${number} cannot be perfect`);
    }
  } else if (quality === 'major' || quality === 'minor') {
    if (!majorMinorNumbers.includes(number)) {
      throw new Error(`interval-quality: "${label}" — number ${number} cannot be ${quality}`);
    }
  } else if (!perfectNumbers.includes(number) && !majorMinorNumbers.includes(number)) {
    throw new Error(`interval-quality: "${label}" — number ${number} is not in the interval-quality vocabulary`);
  }

  return { quality, number };
}
