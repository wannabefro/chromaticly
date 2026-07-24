import { validate } from '../validator';
import { noteNaming } from './note-naming';
import { atomsForLesson, optsFor } from './test-helpers';

const TREBLE = atomsForLesson('treble-notes'); // 13 treble naturals C4..A5
const BASS = atomsForLesson('bass-notes'); // 14 bass naturals E2..D4
const ACCIDENTALS = atomsForLesson('accidentals'); // F#5, C#5, Bb4, F#3, Bb2
const ALL = [TREBLE, BASS, ACCIDENTALS];

const NEVER_G1_LABELS = ['C flat', 'F flat', 'B sharp', 'E sharp'];

function stimulus(instance: ReturnType<typeof noteNaming>): { clef: string; pitch: string } {
  const m = instance.stimulus.music as { clef: string; voices: { events: { pitch: string }[] }[] };
  return { clef: m.clef, pitch: m.voices[0].events[0].pitch };
}

describe('noteNaming — reproducibility (KTD4: pure function of seed + atoms)', () => {
  test('the same (seed, atoms) produces a deeply-equal instance', () => {
    expect(noteNaming(optsFor(TREBLE, 42))).toEqual(noteNaming(optsFor(TREBLE, 42)));
  });

  test('different seeds produce different instances', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) seen.add(JSON.stringify(noteNaming(optsFor(TREBLE, seed))));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('noteNaming — draws only from the lesson atoms (R1, 1uj)', () => {
  test('treble-notes: only treble naturals in-scope, never an accidental, always treble clef', () => {
    const allowed = new Set(TREBLE);
    for (let seed = 0; seed < 200; seed++) {
      const { clef, pitch } = stimulus(noteNaming(optsFor(TREBLE, seed)));
      expect(clef).toBe('treble');
      expect(pitch).not.toMatch(/[#b]/); // no accidental on a naturals lesson
      expect(allowed.has(`note_read:${clef}:${pitch}`)).toBe(true);
    }
  });

  test('bass-notes: only the 14 bass naturals, always bass clef', () => {
    const allowed = new Set(BASS);
    for (let seed = 0; seed < 200; seed++) {
      const { clef, pitch } = stimulus(noteNaming(optsFor(BASS, seed)));
      expect(clef).toBe('bass');
      expect(allowed.has(`note_read:${clef}:${pitch}`)).toBe(true);
    }
  });

  test('accidentals: only the five declared accidental notes, on the clefs the atoms name', () => {
    const allowed = new Set(ACCIDENTALS);
    for (let seed = 0; seed < 200; seed++) {
      const { clef, pitch } = stimulus(noteNaming(optsFor(ACCIDENTALS, seed)));
      expect(allowed.has(`note_read:${clef}:${pitch}`)).toBe(true);
    }
  });

  test('srs_tags[0] is exactly the chosen lesson atom (mastery records what was shown)', () => {
    for (const atoms of ALL) {
      const allowed = new Set(atoms);
      for (let seed = 0; seed < 100; seed++) {
        const instance = noteNaming(optsFor(atoms, seed));
        expect(instance.srs_tags).toHaveLength(1);
        expect(allowed.has(instance.srs_tags[0])).toBe(true);
        // and it is the atom for the pitch actually rendered
        const { clef, pitch } = stimulus(instance);
        expect(instance.srs_tags[0]).toBe(`note_read:${clef}:${pitch}`);
      }
    }
  });

  test('a lesson with no note_read:* atoms throws (fail loud, not grade-wide fallback)', () => {
    expect(() => noteNaming(optsFor(['key_sig:C_major'], 0))).toThrow(/no note_read/);
  });
});

describe('noteNaming — no never-Grade-1 spellings (R2, R6)', () => {
  test('no stimulus pitch is Cb / Fb / B# / E# across all lessons', () => {
    for (const atoms of ALL) {
      for (let seed = 0; seed < 400; seed++) {
        const { pitch } = stimulus(noteNaming(optsFor(atoms, seed)));
        expect(pitch).not.toMatch(/^(Cb|Fb|B#|E#)/);
      }
    }
  });

  test('no distractor label reads C flat / F flat / B sharp / E sharp across all lessons', () => {
    for (const atoms of ALL) {
      for (let seed = 0; seed < 400; seed++) {
        for (const d of noteNaming(optsFor(atoms, seed)).distractors as string[]) {
          expect(NEVER_G1_LABELS).not.toContain(d);
        }
      }
    }
  });
});

describe('noteNaming — grading (spec: "F sharp" accepts "F#"/"F♯")', () => {
  test('an accidental atom yields the accidental word plus symbol alternatives', () => {
    // ACCIDENTALS carries both a sharp (F#5) and a flat (Bb4); assert both spellings appear.
    const kinds = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const instance = noteNaming(optsFor(ACCIDENTALS, seed));
      const canonical = instance.answer.canonical as string;
      if (canonical.endsWith('sharp')) {
        kinds.add('sharp');
        expect(instance.answer.accepted_alternatives).toEqual([`${canonical[0]}#`, `${canonical[0]}♯`]);
      } else if (canonical.endsWith('flat')) {
        kinds.add('flat');
        expect(instance.answer.accepted_alternatives).toEqual([`${canonical[0]}b`, `${canonical[0]}♭`]);
      }
    }
    expect(kinds).toEqual(new Set(['sharp', 'flat']));
  });

  test('a natural (treble-notes) answer has no accepted_alternatives', () => {
    const instance = noteNaming(optsFor(TREBLE, 0));
    expect(instance.answer.canonical).not.toContain(' ');
    expect(instance.answer.accepted_alternatives).toEqual([]);
  });
});

describe('noteNaming — distractors distinct from the answer and each other', () => {
  test('across seeds and lessons, both distractors are well-formed and distinct', () => {
    for (const atoms of ALL) {
      for (let seed = 0; seed < 60; seed++) {
        const instance = noteNaming(optsFor(atoms, seed));
        const [adjacent, clefConfusion] = instance.distractors as string[];
        expect(instance.distractors).toHaveLength(2);
        expect(adjacent).not.toBe(instance.answer.canonical);
        expect(clefConfusion).not.toBe(instance.answer.canonical);
        expect(adjacent).not.toBe(clefConfusion);
      }
    }
  });
});

describe('noteNaming — fuzz gate: every generated item is validator-clean', () => {
  test('seeds 0..99 across all lessons produce passing instances', () => {
    for (const atoms of ALL) {
      for (let seed = 0; seed < 100; seed++) {
        expect(validate(noteNaming(optsFor(atoms, seed)))).toEqual({ ok: true, errors: [] });
      }
    }
  });
});

// fyu.5 — alto clef reading opens at grade 4. optsFor hardcodes grade 1, so
// this builds GenerateOptions inline; the atom scope mirrors the
// seed-stability pre-lesson pin (curriculum/grade4-lessons.json's own alto
// lesson atoms are the orchestrator's, not authored here).
const ALTO_G4_ATOMS = ['note_read:alto:C4', 'note_read:alto:F3', 'note_read:alto:A3', 'note_read:alto:E4', 'note_read:alto:G4'];

describe('noteNaming — alto clef at grade 4 (fyu.5)', () => {
  test('seeds 0..20 produce a passing, alto-clef instance', () => {
    for (let seed = 0; seed <= 20; seed++) {
      const instance = noteNaming({ grade: 4, seed, atoms: ALTO_G4_ATOMS });
      expect(stimulus(instance).clef).toBe('alto');
      expect(validate(instance)).toEqual({ ok: true, errors: [] });
    }
  });
});

// chromaticly-9ig — double accidentals (double-sharp / double-flat) become
// nameable at grade 4. The canonical is spelled "F double sharp"; the accepted
// alternatives carry the shorthand (F##, Fx, F𝄪). Grade-gated in the validator.
const DOUBLE_ACC_G4_ATOMS = ['note_read:treble:F##4', 'note_read:bass:Bbb3'];

describe('noteNaming — double accidentals at grade 4 (chromaticly-9ig)', () => {
  test('seeds 0..20 produce a passing double-accidental instance', () => {
    for (let seed = 0; seed <= 20; seed++) {
      const instance = noteNaming({ grade: 4, seed, atoms: DOUBLE_ACC_G4_ATOMS });
      expect(validate(instance)).toEqual({ ok: true, errors: [] });
      expect(instance.answer.canonical).toMatch(/^[A-G] double (sharp|flat)$/);
    }
  });

  test('the canonical spells out the accidental; alternatives carry ## / x / 𝄪', () => {
    const fSharp = noteNaming({ grade: 4, seed: 3, atoms: ['note_read:treble:F##4'] });
    expect(fSharp.answer.canonical).toBe('F double sharp');
    expect(fSharp.answer.accepted_alternatives).toEqual(expect.arrayContaining(['F##', 'Fx', 'F𝄪']));
  });

  test('double accidentals are grade-gated in the validator — generation throws below grade 4', () => {
    expect(() => noteNaming({ grade: 3, seed: 3, atoms: ['note_read:treble:F##4'] })).toThrow();
  });
});
