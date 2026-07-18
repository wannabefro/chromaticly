// Regression net for chromaticly-elb.2: flat-tonic major keys (Bb, Eb) were
// unreachable in interval_naming and crashed key_signature_id at grade 2,
// because the tonic was located by the full key name ("Bb") against a
// naturals-only pitch enumeration that only ever holds "B". The tonic is now
// located by LETTER and spelled in key. These tests fail if that regresses.

import { validate } from '../validator';
import { generate } from './index';
import { spellInKey, tonicLetter } from './key-spelling';

describe('key-spelling helpers', () => {
  test('tonicLetter strips the accidental to the natural letter', () => {
    expect(tonicLetter('Bb')).toBe('B');
    expect(tonicLetter('Eb')).toBe('E');
    expect(tonicLetter('C')).toBe('C');
  });

  test('spellInKey writes the tonic under its key signature (Bb major tonic is Bb, not B-natural)', () => {
    expect(spellInKey('B4', 'Bb')).toBe('Bb4');
    expect(spellInKey('E4', 'Eb')).toBe('Eb4');
    // A key that does not alter the letter is a no-op (every grade-1 tonic in its own key).
    expect(spellInKey('C4', 'C')).toBe('C4');
    expect(spellInKey('G3', 'G')).toBe('G3');
  });
});

function keyOf(inst: ReturnType<typeof generate>): string {
  return (inst.stimulus.music as { key_sig: string }).key_sig;
}

function lowerPitch(inst: ReturnType<typeof generate>): string {
  const music = inst.stimulus.music as { voices: { events: { pitches?: string[]; pitch?: string }[] }[] };
  const ev = music.voices[0].events[0];
  return ev.pitches ? ev.pitches[0] : ev.pitch!;
}

describe('interval_naming at grade 2 — flat-tonic keys are reachable and spelled', () => {
  const instances = Array.from({ length: 120 }, (_, seed) => generate('interval_naming', { grade: 2, seed, atoms: [] }));

  test('Bb and Eb major keys are actually reached (were silently unreachable before the fix)', () => {
    const keys = new Set(instances.map(keyOf));
    expect(keys).toContain('Bb_major');
    expect(keys).toContain('Eb_major');
  });

  test('every instance validates in scope at grade 2', () => {
    for (const inst of instances) expect(validate(inst).ok).toBe(true);
  });

  test("a flat key's tonic (lower note) is spelled with its accidental, not a stray natural", () => {
    for (const inst of instances) {
      const key = keyOf(inst); // e.g. "Bb_major"
      const tonic = lowerPitch(inst); // e.g. "Bb4"
      const letter = key[0];
      const accid = key[1] === 'b' ? 'b' : '';
      // Invariant: the tonic prints under the key signature — its spelling starts
      // with the key's own tonic letter+accidental (Bb major -> "Bb", C major -> "C").
      expect(tonic.startsWith(`${letter}${accid}`)).toBe(true);
    }
  });
});

describe('key_signature_id at grade 2 — flat keys are reachable, valid, and spelled', () => {
  const atoms = ['key_sig:A_major', 'key_sig:Bb_major', 'key_sig:Eb_major'];
  const instances = Array.from({ length: 60 }, (_, seed) => generate('key_signature_id', { grade: 2, seed, atoms }));

  test('generates valid instances across seeds without throwing (Eb/Bb in the pool poisoned every attempt before)', () => {
    for (const inst of instances) expect(validate(inst).ok).toBe(true);
  });

  test('Bb and Eb major are actually the answer sometimes — not silently skipped for A', () => {
    // The bug this guards: extractKeyTonic dropped the accidental ("Bb major" -> "B"),
    // so the validator rejected every flat-key candidate and generation always
    // converged on A major. A "generates without throwing" test passed anyway
    // because A is in the pool — only asserting the flat keys are REACHED catches it.
    const answers = new Set(instances.map((inst) => inst.answer.canonical));
    expect(answers).toContain('Bb major');
    expect(answers).toContain('Eb major');
  });
});
