// Shared key-spelling helpers for the pitch generators (interval_naming,
// key_signature_id). A pitch is stored spelled with its SOUNDING accidental so
// the abc emitter renders it under the key signature without a stray natural:
// pitchToAbc prints an explicit natural for a plain 'B4' in Bb major (B natural,
// wrong for the tonic), and suppresses the flat on 'Bb4' because the key already
// imposes it (plain B on the stave, correct). So a key whose tonic carries an
// accidental (Bb, Eb) must spell that tonic — matching on the natural LETTER,
// then spelling in key — not on the full key name.

import { keyAccidentals } from '../../music/abc-emitter';

/** The natural letter of a major-key tonic: 'Bb' -> 'B', 'Eb' -> 'E', 'C' -> 'C'.
 *  Used to locate the tonic's natural-letter position in a naturals-only pitch
 *  enumeration (diatonicPitchesInRange), which never contains an accidental. */
export function tonicLetter(key: string): string {
  return key[0];
}

/** Spell a natural-letter pitch (e.g. "C5") in a major key so the key signature
 *  carries the accidental: the tonic of Bb major is written "Bb4", and the 7th
 *  above D's tonic is C#, not C-natural. Non-natural input is returned unchanged.
 *  For a key whose signature does not alter the letter (every Grade 1 tonic in
 *  its own key), the pitch is returned as-is — so this is a no-op there. */
export function spellInKey(naturalPitch: string, key: string): string {
  const m = /^([A-G])(-?\d+)$/.exec(naturalPitch);
  if (!m) return naturalPitch;
  const [, letter, octave] = m;
  const acc = keyAccidentals(`${key}_major`)[letter];
  const symbol = acc === 'sharp' ? '#' : acc === 'flat' ? 'b' : '';
  return `${letter}${symbol}${octave}`;
}

/** Spell a natural-letter pitch under a full key SIGNATURE id ("E_minor",
 *  "Bb_major"), not just a major tonic: a minor key signature spells like its
 *  relative major's (the signature, not the mode, owns the accidental), so
 *  spellInKeySig('F4', 'E_minor') === 'F#4'. Superset of spellInKey, not a
 *  fork: spellInKeySig(p, `${key}_major`) === spellInKey(p, key) for any
 *  major key. Non-natural input is returned unchanged. */
export function spellInKeySig(naturalPitch: string, keySig: string): string {
  const m = /^([A-G])(-?\d+)$/.exec(naturalPitch);
  if (!m) return naturalPitch;
  const [, letter, octave] = m;
  const acc = keyAccidentals(keySig)[letter];
  const symbol = acc === 'sharp' ? '#' : acc === 'flat' ? 'b' : '';
  return `${letter}${symbol}${octave}`;
}
