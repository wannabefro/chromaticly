import { pitchSemitone } from '../interval-quality';
import { validate } from '../validator';
import { ENHARMONIC_PARTNER, displayNote } from './enharmonic-recognition';
import { generate } from './index';

const ALL_NOTES = ['C#', 'Db', 'D#', 'Eb', 'F#', 'Gb', 'G#', 'Ab', 'A#', 'Bb'];
const ALL_ATOMS = ALL_NOTES.map((n) => `enharmonic:${n}`);
const g4 = (atoms: string[], seed: number) => ({ grade: 4, seed, atoms });

// Independent pitch-class helper (mirrors the validator's own recompute, but
// stated here without reading the generator's ENHARMONIC_PARTNER table).
const asciiToPc = (note: string) => (((pitchSemitone(`${note}4`) % 12) + 12) % 12);
const displayToAscii = (s: string) => s.replace('♯', '#').replace('♭', 'b');

describe('enharmonicRecognition — reproducibility', () => {
  test('same (grade, seed, atoms) is deeply equal; different seeds vary', () => {
    expect(generate('enharmonic_recognition', g4(ALL_ATOMS, 5))).toEqual(
      generate('enharmonic_recognition', g4(ALL_ATOMS, 5)),
    );
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seen.add(JSON.stringify(generate('enharmonic_recognition', g4(ALL_ATOMS, seed))));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('enharmonicRecognition — canonical is the same pitch, different letter (computed, not tabled)', () => {
  test('across every atom and seeds 0..40, the answer matches the stimulus pitch class and differs in letter', () => {
    for (const atom of ALL_ATOMS) {
      const note = atom.split(':')[1];
      for (let seed = 0; seed < 40; seed++) {
        const instance = generate('enharmonic_recognition', g4([atom], seed));
        const answer = displayToAscii(instance.answer.canonical as string);
        expect(asciiToPc(answer)).toBe(asciiToPc(note)); // same pitch
        expect(answer[0]).not.toBe(note[0]); // different letter
        expect(instance.prompt).toContain(displayNote(note)); // the stimulus is in the prompt
      }
    }
  });
});

describe('enharmonicRecognition — distractor rule: the two pair-member natural letters', () => {
  test('F# offers exactly {G♭ (answer), F, G}', () => {
    const instance = generate('enharmonic_recognition', g4(['enharmonic:F#'], 3));
    expect(instance.answer.canonical).toBe('G♭');
    expect([...(instance.distractors as string[])].sort()).toEqual(['F', 'G']);
  });

  test('every instance has exactly 3 distinct options, none enharmonic to another', () => {
    for (const atom of ALL_ATOMS) {
      for (let seed = 0; seed < 20; seed++) {
        const instance = generate('enharmonic_recognition', g4([atom], seed));
        const options = [instance.answer.canonical as string, ...(instance.distractors as string[])];
        expect(options).toHaveLength(3);
        expect(new Set(options).size).toBe(3);
      }
    }
  });
});

describe('enharmonicRecognition — text-only mcq shape (no notation stimulus)', () => {
  test('stimulus.music and stimulus.text are null; interaction is mcq; strand is pitch', () => {
    const instance = generate('enharmonic_recognition', g4(ALL_ATOMS, 7));
    expect(instance.stimulus.music).toBeNull();
    expect(instance.stimulus.text).toBeNull();
    expect(instance.interaction.type).toBe('mcq');
    expect(instance.strand).toBe('pitch');
  });
});

describe('enharmonicRecognition — atom scoping + fail-loud', () => {
  test('an unknown note spelling throws', () => {
    expect(() => generate('enharmonic_recognition', g4(['enharmonic:H#'], 0))).toThrow();
  });

  test('no enharmonic atom throws', () => {
    expect(() => generate('enharmonic_recognition', g4(['chord:I'], 0))).toThrow();
  });
});

describe('enharmonicRecognition — validator', () => {
  test('fuzz gate: seeds 0..99 over the full scope all validate clean', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = generate('enharmonic_recognition', g4(ALL_ATOMS, seed));
      expect(validate(instance)).toEqual({ ok: true, errors: [] });
    }
  });

  test('recompute-don\'t-trust: an F# instance mislabelled "F" (same letter, not enharmonic) is rejected', () => {
    const instance = generate('enharmonic_recognition', g4(['enharmonic:F#'], 0));
    const tampered = { ...instance, answer: { ...instance.answer, canonical: 'F' } };
    expect(validate(tampered).ok).toBe(false);
  });

  test('ENHARMONIC_PARTNER table is internally consistent — every pair is same-pitch, different-letter', () => {
    for (const [note, partner] of Object.entries(ENHARMONIC_PARTNER)) {
      expect(asciiToPc(note)).toBe(asciiToPc(partner));
      expect(note[0]).not.toBe(partner[0]);
    }
  });
});
