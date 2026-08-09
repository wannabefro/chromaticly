import type { Clef } from '../../music/types';
import { diatonicPitchesInRange } from '../scope';
import { validate } from '../validator';
import { spellInKeySig } from './key-spelling';
import { noteNaming, noteNamingStaveInput } from './note-naming';
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

// chromaticly-7tb — the two distractors ARE the two named misconceptions, so
// each says which one it is. The hedged "the other clef, or miscounting by one"
// string stays as the fallback for a wrong answer that was typed rather than
// picked; it is no longer what a picked distractor shows.
describe('noteNaming — each distractor names its own misconception (never-violate rule 5)', () => {
  const CLEFS = [
    ['treble', ['note_read:treble:C4', 'note_read:treble:E4', 'note_read:treble:G4']],
    ['bass', ['note_read:bass:G2', 'note_read:bass:B2', 'note_read:bass:D3']],
  ] as const;

  test.each(CLEFS)('every %s distractor is diagnosed, and no key is unreachable', (_clef, atoms) => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = noteNaming({ grade: 1, seed, atoms: [...atoms] });
      const keys = Object.keys(instance.feedback.by_distractor ?? {}).sort();
      // Equality both ways: no distractor without copy (a hedged sheet), and no
      // copy without a distractor (dead text nothing can ever show).
      expect(keys).toEqual([...new Set(instance.distractors as string[])].sort());
    }
  });

  test('the clef-confusion copy names the OTHER clef, and the off-by-one copy does not mention a clef at all', () => {
    const instance = noteNaming({ grade: 1, seed: 4, atoms: ['note_read:treble:C4', 'note_read:treble:E4', 'note_read:treble:G4'] });
    const copies = Object.values(instance.feedback.by_distractor!);
    expect(copies.some((c) => c.includes('bass clef'))).toBe(true);
    expect(copies.some((c) => c.includes('one line or space out'))).toBe(true);
  });

  // Copy is read aloud in the head; "a alto clef" reads as broken English on
  // device the same way "a 8th" did in the interval prompt.
  test('the article agrees with the clef name at every clef, including alto', () => {
    for (const atoms of [['note_read:treble:C4'], ['note_read:bass:G2'], ['note_read:alto:C4']]) {
      for (let seed = 0; seed < 10; seed++) {
        const instance = noteNaming({ grade: 4, seed, atoms });
        for (const copy of Object.values(instance.feedback.by_distractor ?? {})) {
          expect(copy).not.toMatch(/\ba (alto|8)\b/);
        }
      }
    }
  });
});

// chromaticly-7xv.6 / chromaticly-ic5.4. Both grades ask for notes in any clef,
// in any key set for the grade.
describe('noteNaming — a keyed atom is read under a drawn key signature', () => {
  const ALTO_KEYED = atomsForLesson('alto-keyed-4');
  const TENOR_KEYED = atomsForLesson('tenor-keyed-5');
  const CASES = [
    ['alto-keyed-4', 4, ALTO_KEYED],
    ['tenor-keyed-5', 5, TENOR_KEYED],
  ] as const;

  test.each(CASES)('%s draws a signature on every item and stays validator-clean', (_id, grade, atoms) => {
    for (let seed = 0; seed < 40; seed++) {
      const instance = noteNaming({ grade, seed, atoms: [...atoms] });
      expect((instance.stimulus.music as any).key_sig).not.toBeNull();
      expect(validate(instance)).toEqual({ ok: true, errors: [] });
    }
  });

  // THE invariant: naming the note as written would teach the opposite.
  test.each(CASES)('%s names the note the signature produces, not the natural', (_id, grade, atoms) => {
    const altered: string[] = [];
    for (let seed = 0; seed < 40; seed++) {
      const instance = noteNaming({ grade, seed, atoms: [...atoms] });
      const { pitch } = stimulus(instance);
      const written = pitch.replace(/-?\d+$/, '').replace('#', ' sharp').replace('b', ' flat');
      expect(instance.answer.canonical).toBe(written);
      if (written.length > 1) altered.push(written);
    }
    expect(altered.some((a) => a.endsWith('sharp'))).toBe(true);
    expect(altered.some((a) => a.endsWith('flat'))).toBe(true);
  });

  // Crediting the sounding pitch would split one position into 22 atoms.
  test.each(CASES)('%s credits the natural position whatever the signature does', (_id, grade, atoms) => {
    for (let seed = 0; seed < 40; seed++) {
      const tag = noteNaming({ grade, seed, atoms: [...atoms] }).srs_tags[0];
      expect(atoms).toContain(tag);
    }
  });

  test('a single due keyed atom is a whole item', () => {
    const instance = noteNaming({ grade: 4, seed: 0, atoms: ['note_read_keyed:alto:C4'] });
    expect(instance.srs_tags).toEqual(['note_read_keyed:alto:C4']);
    expect(instance.distractors).not.toContain(instance.answer.canonical);
    expect(validate(instance)).toEqual({ ok: true, errors: [] });
  });

  // A natural distractor under a signature that alters it is unprintable.
  test('a distractor altered by the signature carries its accidental', () => {
    let checked = 0;
    for (let seed = 0; seed < 60; seed++) {
      const instance = noteNaming({ grade: 5, seed, atoms: [...TENOR_KEYED] });
      const keySig = (instance.stimulus.music as any).key_sig as string;
      for (const d of instance.distractors as string[]) {
        const letter = d[0];
        const spelled = spellInKeySig(`${letter}4`, keySig);
        if (spelled === `${letter}4`) continue;
        expect(d).toBe(`${letter} ${spelled[1] === '#' ? 'sharp' : 'flat'}`);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('a plain note_read atom still draws no signature and credits the plain atom', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = noteNaming({ grade: 4, seed, atoms: ['note_read:alto:F3'] });
      expect((instance.stimulus.music as any).key_sig).toBeNull();
      expect(instance.srs_tags).toEqual(['note_read:alto:F3']);
    }
  });
});

// Shape alone passed an answer that ignored the signature.
describe('noteNamingHook rejects an answer the stave does not print', () => {
  const keyed = () => noteNaming({ grade: 4, seed: 0, atoms: [...atomsForLesson('alto-keyed-4')] });

  test('a canonical that names the natural under an altering signature', () => {
    // Only an altering signature makes the natural wrong, so search for one.
    const altered = Array.from({ length: 40 }, (_, seed) =>
      noteNaming({ grade: 4, seed, atoms: [...atomsForLesson('alto-keyed-4')] }),
    ).find((i) => /[#b]/.test(stimulus(i).pitch));
    expect(altered).toBeDefined();
    altered!.answer.canonical = stimulus(altered!).pitch.replace(/[#b]-?\d+$/, '');
    expect(validate(altered!).errors.some((e) => e.includes('the stave prints'))).toBe(true);
  });

  test('a canonical naming a different letter entirely', () => {
    const instance = keyed();
    instance.answer.canonical = 'B';
    expect(validate(instance).errors.some((e) => e.includes('the stave prints'))).toBe(true);
  });

  test('an answer that also appears among the distractors', () => {
    const instance = keyed();
    instance.distractors = [...instance.distractors, instance.answer.canonical as string];
    expect(validate(instance).errors.some((e) => e.includes('both the answer and a distractor'))).toBe(true);
  });
});

describe('noteNamingStaveInput refuses a keyed-only pool', () => {
  test('it throws rather than crediting the plain atom for a question never asked', () => {
    expect(() => noteNamingStaveInput({ grade: 4, seed: 0, atoms: ['note_read_keyed:alto:C4'] })).toThrow();
  });
});

// "Write D on the stave" names a pitch class. Both a treble D4 and a treble D5
// answer it, and only one used to be accepted — the seed decided which.
describe('noteNamingStaveInput accepts every octave the prompt allows', () => {
  const instances = [TREBLE, BASS, ACCIDENTALS].flatMap((atoms) =>
    [1, 2, 3, 4].map((seed) => noteNamingStaveInput(optsFor(atoms, seed))),
  );

  test('an alternative differs from the answer only in its octave', () => {
    for (const inst of instances) {
      const { pitch, dur } = inst.answer.canonical as { pitch: string; dur: string };
      for (const alt of inst.answer.accepted_alternatives as { pitch: string; dur: string }[]) {
        expect(alt.dur).toBe(dur);
        expect(alt.pitch.replace(/\d+$/, '')).toBe(pitch.replace(/\d+$/, ''));
        expect(alt.pitch).not.toBe(pitch);
      }
    }
  });

  test('every other octave in the clef range is offered, so no seed marks one wrong', () => {
    for (const inst of instances) {
      const { pitch } = inst.answer.canonical as { pitch: string; dur: string };
      const clef = (inst.interaction.config as { clef: Clef }).clef;
      const letter = pitch[0];
      const inRange = diatonicPitchesInRange(clef, inst.grade).filter((p) => p.startsWith(letter));
      expect(inst.answer.accepted_alternatives).toHaveLength(inRange.length - 1);
    }
  });

  // The old copy told a learner writing a plain D to "add the accidental".
  test('the accidental is mentioned only when the answer has one', () => {
    for (const inst of instances) {
      const { pitch } = inst.answer.canonical as { pitch: string };
      const altered = /[#b]/.test(pitch);
      expect(inst.feedback.incorrect.includes('add the accidental')).toBe(altered);
    }
  });
});

const ACCIDENTAL_ATOMS = ['note_read:treble:F#5', 'note_read:treble:C#5', 'note_read:treble:Bb4', 'note_read:bass:F#3', 'note_read:bass:Bb2'];

describe('note_naming — the wrong-clef feedback accounts for a printed accidental', () => {
  // It said "That is E, but only in the bass clef". The sharp applies there
  // too: E sharp.
  test('an accidental stimulus never claims the other clef reads it as a natural', () => {
    const wrong: string[] = [];
    for (let seed = 0; seed < 200; seed++) {
      const inst = noteNaming({ grade: 1, seed, atoms: ACCIDENTAL_ATOMS });
      const canonical = inst.answer.canonical as string;
      if (!/sharp|flat/.test(canonical)) continue;
      for (const [option, why] of Object.entries(inst.feedback.by_distractor ?? {})) {
        if (!/only in the/.test(why as string)) continue;
        wrong.push(`seed ${seed}: answer ${canonical}, "${option}" -> ${why}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
