import type { Music } from '../../music/types';
import { pitchRange } from '../scope';
import { validate } from '../validator';
import { generate } from './index';
import { minorScale } from './minor-keys';
import { formPositionLabels, validScaleStartPitches } from './scale-construction';

const FULL_ATOMS = ['scale:A_minor_harmonic', 'scale:E_minor_harmonic', 'scale:D_minor_harmonic'];

function opts(atoms: string[], seed: number) {
  return { grade: 2, seed, atoms };
}

// D7's six new grade-3 minor keys (harmonic) and the full 9-key grade-3
// melodic scope (the G2 trio + the six new keys) — mirrors GRADE_3_EXTRA_CASES
// in seed-stability.test.ts.
const GRADE_3_HARMONIC_ATOMS = [
  'scale:B_minor_harmonic',
  'scale:G_minor_harmonic',
  'scale:F#_minor_harmonic',
  'scale:C_minor_harmonic',
  'scale:C#_minor_harmonic',
  'scale:F_minor_harmonic',
];
const GRADE_3_MELODIC_ATOMS = [
  'scale:A_minor_melodic',
  'scale:E_minor_melodic',
  'scale:D_minor_melodic',
  'scale:B_minor_melodic',
  'scale:G_minor_melodic',
  'scale:F#_minor_melodic',
  'scale:C_minor_melodic',
  'scale:C#_minor_melodic',
  'scale:F_minor_melodic',
];

function opts3(atoms: string[], seed: number) {
  return { grade: 3, seed, atoms };
}

/** Direction is never a schema field (D3(c)) — it's read off the prompt
 *  copy, which is required to name it ("...scale, descending, is wrong"). */
function directionOf(inst: ReturnType<typeof generate>): 'ascending' | 'descending' | null {
  if ((inst.prompt as string).includes('ascending')) return 'ascending';
  if ((inst.prompt as string).includes('descending')) return 'descending';
  return null;
}

function stimulusMusic(inst: ReturnType<typeof generate>): Music {
  return inst.stimulus.music as Music;
}

function answerMusic(inst: ReturnType<typeof generate>): Music {
  return inst.interaction.config.answer_music as Music;
}

function pitches(music: Music): string[] {
  return music.voices[0].events.map((ev) => (ev as { pitch: string }).pitch);
}

function tonicOf(inst: ReturnType<typeof generate>): string {
  return (stimulusMusic(inst).key_sig as string).split('_')[0];
}

function formOf(inst: ReturnType<typeof generate>): string {
  // srs_tags[0] is "scale:<tonic>_minor_<form>"
  return inst.srs_tags[0].split(':')[1].split('_').slice(2).join('_');
}

const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
function pitchOrdinal(pitch: string): number {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(pitch);
  if (!m) throw new Error(`unexpected pitch "${pitch}"`);
  return Number(m[3]) * 7 + LETTER_ORDER.indexOf(m[1]);
}

function positionIndex(label: string): number {
  return ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].indexOf(label.split(' ')[0]);
}

describe('scale_construction — reachability (mirrors mode_swap/flat-tonic discipline: assert REACHED, not merely not-throw)', () => {
  const instances = Array.from({ length: 120 }, (_, seed) => generate('scale_construction', opts(FULL_ATOMS, seed)));

  test('all three grade-2 keys (A, E, D) are actually asked', () => {
    const keys = new Set(instances.map(tonicOf));
    expect(keys).toEqual(new Set(['A', 'E', 'D']));
  });

  test('both clefs are actually reached', () => {
    const clefs = new Set(instances.map((inst) => stimulusMusic(inst).clef));
    expect(clefs).toEqual(new Set(['treble', 'bass']));
  });

  test('at least two distinct corruption types (canonical positions) are actually reached', () => {
    const positions = new Set(instances.map((inst) => inst.answer.canonical));
    expect(positions.size).toBeGreaterThanOrEqual(2);
  });
});

describe('scale_construction — validator-clean across the retry budget (scope is law at grade 2)', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('scale_construction', opts(FULL_ATOMS, seed));
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('scale_construction — full-octave register selection (review finding 3: an in-range tonic does not imply an in-range scale)', () => {
  const instances = Array.from({ length: 100 }, (_, seed) => generate('scale_construction', opts(FULL_ATOMS, seed)));

  test("every instance's highest pitch (the top tonic, from the TRUE scale) is within pitchRange(clef, 2)", () => {
    for (const inst of instances) {
      const music = stimulusMusic(inst);
      const range = pitchRange(music.clef, 2);
      const top = pitches(answerMusic(inst))[7];
      expect(pitchOrdinal(top)).toBeGreaterThanOrEqual(pitchOrdinal(range.low));
      expect(pitchOrdinal(top)).toBeLessThanOrEqual(pitchOrdinal(range.high));
    }
  });

  test('the start-pitch enumerator never offers a start whose top would exceed the clef ceiling (D5 in treble tops at D6 > the C6 ceiling)', () => {
    const starts = validScaleStartPitches('D', 'treble', 2);
    expect(starts).not.toContain('D5');
    expect(starts).toContain('D4');
  });
});

describe('scale_construction — exactly one corrupted note, at the canonical position (one-corruption rule)', () => {
  test('the corrupted stimulus differs from answer_music in exactly one event, at the position the canonical names', () => {
    for (let seed = 0; seed < 60; seed++) {
      const inst = generate('scale_construction', opts(FULL_ATOMS, seed));
      const truth = pitches(answerMusic(inst));
      const corrupted = pitches(stimulusMusic(inst));
      const diffIndices = truth.flatMap((p, i) => (p === corrupted[i] ? [] : [i]));
      expect(diffIndices).toHaveLength(1);
      expect(diffIndices[0]).toBe(positionIndex(inst.answer.canonical as string));
    }
  });
});

describe('scale_construction — answer_music is a TRUE harmonic minor scale (never-violate rule 5: the feedback sheet shows the CORRECT scale)', () => {
  test("answer_music's pitch sequence equals the U1 builder's output for the instance's key/register — fails if corrupted and correct payloads are swapped", () => {
    for (let seed = 0; seed < 60; seed++) {
      const inst = generate('scale_construction', opts(FULL_ATOMS, seed));
      const music = answerMusic(inst);
      const tonic = (music.key_sig as string).split('_')[0];
      const startPitch = pitches(music)[0];
      const expected = minorScale(tonic, 'harmonic_minor', startPitch);
      expect(pitches(music)).toEqual(expected);
    }
  });
});

describe('scale_construction — form-keyed corruption rules (human requirement: no harmonic assumption outside the rule table)', () => {
  test('every canonical + distractor position is drawn from the resolved form\'s rule table, looked up by form (not a hardcoded harmonic literal)', () => {
    for (let seed = 0; seed < 60; seed++) {
      const inst = generate('scale_construction', opts(FULL_ATOMS, seed));
      const allowed = new Set(formPositionLabels(formOf(inst)));
      expect(allowed.has(inst.answer.canonical as string)).toBe(true);
      for (const d of inst.distractors as string[]) expect(allowed.has(d)).toBe(true);
    }
  });

  test('an unknown/absent form entry fails loud rather than silently defaulting to harmonic', () => {
    expect(() => formPositionLabels('melodic_asc')).toThrow(/no corruption rule table entry/);
    expect(() => generate('scale_construction', opts(['scale:A_minor_melodic_asc'], 0))).toThrow();
  });
});

describe('scale_construction — grade-2 melodic unreachability (structural forward-compat, D7)', () => {
  test('a scale:A_minor_melodic_asc-style atom at grade 2 fails to generate', () => {
    expect(() => generate('scale_construction', opts(['scale:A_minor_melodic_asc'], 0))).toThrow();
  });

  test('no grade-2 instance generated from the real harmonic atoms ever carries a non-harmonic form', () => {
    for (let seed = 0; seed < 60; seed++) {
      const inst = generate('scale_construction', opts(FULL_ATOMS, seed));
      expect(formOf(inst)).toBe('harmonic');
    }
  });
});

describe('scale_construction — un-raised 7th is the headline misconception (commandment 6)', () => {
  test('the un-raised-7th corruption ("7th note") appears across seeds, and its feedback.incorrect names the raised-7th rule', () => {
    const instances = Array.from({ length: 80 }, (_, seed) => generate('scale_construction', opts(FULL_ATOMS, seed)));
    const headline = instances.filter((inst) => inst.answer.canonical === '7th note');
    expect(headline.length).toBeGreaterThan(0);
    for (const inst of headline) {
      expect(inst.feedback.incorrect).toMatch(/raised/i);
      expect(inst.feedback.incorrect).toMatch(/7th/);
    }
  });
});

describe('scale_construction — single-atom scope is safe (Practice due-path safety, same invariant as U3)', () => {
  const atoms = ['scale:D_minor_harmonic'];
  const instances = Array.from({ length: 20 }, (_, seed) => generate('scale_construction', opts(atoms, seed)));

  test('generation succeeds across seeds 0..19 without throwing', () => {
    expect(instances).toHaveLength(20);
  });

  test('every instance is pinned to D minor', () => {
    for (const inst of instances) expect(tonicOf(inst)).toBe('D');
  });

  test('every instance still validates', () => {
    for (const inst of instances) expect(validate(inst).ok).toBe(true);
  });
});

describe('scale_construction — one unambiguous answer (commandment 4: every other position is provably correct)', () => {
  test("every distractor position's note in the stimulus matches the TRUE scale — only the canonical position is wrong", () => {
    for (let seed = 0; seed < 60; seed++) {
      const inst = generate('scale_construction', opts(FULL_ATOMS, seed));
      const truth = pitches(answerMusic(inst));
      const corrupted = pitches(stimulusMusic(inst));
      for (const d of inst.distractors as string[]) {
        const idx = positionIndex(d);
        expect(corrupted[idx]).toBe(truth[idx]);
      }
    }
  });
});

describe('scale_construction — cannot leak below grade 2 (keysMinor is empty at grade 1)', () => {
  test('grade 1 fails to generate a valid instance', () => {
    expect(() => generate('scale_construction', opts(FULL_ATOMS, 0))).not.toThrow(); // sanity: grade 2 itself is fine
    expect(() => generate('scale_construction', { grade: 1, seed: 0, atoms: FULL_ATOMS })).toThrow();
  });
});

describe('scale_construction — reproducibility (KTD4: pure function of seed + atoms)', () => {
  test('the same (seed, atoms) produces a deeply-equal instance', () => {
    expect(generate('scale_construction', opts(FULL_ATOMS, 12))).toEqual(
      generate('scale_construction', opts(FULL_ATOMS, 12)),
    );
  });

  test('different seeds produce different instances', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seen.add(JSON.stringify(generate('scale_construction', opts(FULL_ATOMS, seed))));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('scale_construction — grade-2 byte-identity (D5: tonicLetter reduction is a no-op for natural tonics)', () => {
  test("validScaleStartPitches for every grade-2 (key, clef) equals its pre-fix value — the sharp-tonic fix must not move a single grade-2 key's enumeration", () => {
    expect(validScaleStartPitches('A', 'treble', 2)).toEqual(['A3', 'A4']);
    expect(validScaleStartPitches('A', 'bass', 2)).toEqual(['A2']);
    expect(validScaleStartPitches('E', 'treble', 2)).toEqual(['E4']);
    expect(validScaleStartPitches('E', 'bass', 2)).toEqual(['E2', 'E3']);
    expect(validScaleStartPitches('D', 'treble', 2)).toEqual(['D4']);
    expect(validScaleStartPitches('D', 'bass', 2)).toEqual(['D2', 'D3']);
  });
});

describe('scale_construction — sharp-tonic generation (D5: the two verified breaks are fixed)', () => {
  test('scale:F#_minor_harmonic and scale:C#_minor_harmonic generate and validate across seeds', () => {
    for (const atom of ['scale:F#_minor_harmonic', 'scale:C#_minor_harmonic']) {
      for (let seed = 0; seed < 40; seed++) {
        const inst = generate('scale_construction', opts3([atom], seed));
        expect(validate(inst)).toEqual({ ok: true, errors: [] });
      }
    }
  });

  test("F# minor's raised 7th spells E# and C# minor's raised 7th spells B# (never a natural spelling, D5/D6)", () => {
    const eSharpSpellings = new Set<string>();
    const bSharpSpellings = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const fSharp7th = pitches(answerMusic(generate('scale_construction', opts3(['scale:F#_minor_harmonic'], seed))))[6];
      const cSharp7th = pitches(answerMusic(generate('scale_construction', opts3(['scale:C#_minor_harmonic'], seed))))[6];
      eSharpSpellings.add(fSharp7th.replace(/-?\d+$/, ''));
      bSharpSpellings.add(cSharp7th.replace(/-?\d+$/, ''));
    }
    expect(eSharpSpellings).toEqual(new Set(['E#']));
    expect(bSharpSpellings).toEqual(new Set(['B#']));
  });
});

describe('scale_construction — grade-3 reachability over seeds 0..119 (flat-tonic discipline extended to sharp tonics)', () => {
  const harmonicInstances = Array.from({ length: 120 }, (_, seed) =>
    generate('scale_construction', opts3(GRADE_3_HARMONIC_ATOMS, seed)),
  );
  const melodicInstances = Array.from({ length: 120 }, (_, seed) =>
    generate('scale_construction', opts3(GRADE_3_MELODIC_ATOMS, seed)),
  );

  test('all 6 new grade-3 harmonic keys are actually asked', () => {
    const keys = new Set(harmonicInstances.map(tonicOf));
    expect(keys).toEqual(new Set(['B', 'G', 'F#', 'C', 'C#', 'F']));
  });

  test('all 9 grade-3 melodic atoms (the G2 trio + the 6 new keys) are actually asked', () => {
    const keys = new Set(melodicInstances.map(tonicOf));
    expect(keys).toEqual(new Set(['A', 'E', 'D', 'B', 'G', 'F#', 'C', 'C#', 'F']));
  });

  test('both clefs are reached for both forms', () => {
    expect(new Set(harmonicInstances.map((inst) => stimulusMusic(inst).clef))).toEqual(new Set(['treble', 'bass']));
    expect(new Set(melodicInstances.map((inst) => stimulusMusic(inst).clef))).toEqual(new Set(['treble', 'bass']));
  });

  test('both melodic directions are reached', () => {
    expect(new Set(melodicInstances.map(directionOf))).toEqual(new Set(['ascending', 'descending']));
  });

  test('at least two distinct corruption types are reached for the new-key harmonic keys', () => {
    expect(new Set(harmonicInstances.map((inst) => inst.answer.canonical)).size).toBeGreaterThanOrEqual(2);
  });

  test('at least two distinct corruption types are reached for melodic (across both directions)', () => {
    expect(new Set(melodicInstances.map((inst) => inst.answer.canonical)).size).toBeGreaterThanOrEqual(2);
  });
});

describe('scale_construction — grade-3 validation sweep (scope is law incl. E#/B# spellings and letter-ordinal ranges)', () => {
  test('seeds 0..99 all produce a passing instance for the 6 new harmonic keys', () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('scale_construction', opts3(GRADE_3_HARMONIC_ATOMS, seed));
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
    }
  });

  test('seeds 0..99 all produce a passing instance for all 9 melodic keys, both directions', () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('scale_construction', opts3(GRADE_3_MELODIC_ATOMS, seed));
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('scale_construction — exactly one corrupted note in BOTH directions (one-corruption rule survives the direction parameter)', () => {
  test('the corrupted stimulus differs from answer_music in exactly one event, at the position the canonical names', () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('scale_construction', opts3(GRADE_3_MELODIC_ATOMS, seed));
      const truth = pitches(answerMusic(inst));
      const corrupted = pitches(stimulusMusic(inst));
      const diffIndices = truth.flatMap((p, i) => (p === corrupted[i] ? [] : [i]));
      expect(diffIndices).toHaveLength(1);
      expect(diffIndices[0]).toBe(positionIndex(inst.answer.canonical as string));
    }
  });

  test('both directions appear across this sweep (so the assertion above is not vacuously ascending-only)', () => {
    const directions = new Set(
      Array.from({ length: 100 }, (_, seed) =>
        directionOf(generate('scale_construction', opts3(GRADE_3_MELODIC_ATOMS, seed))),
      ),
    );
    expect(directions).toEqual(new Set(['ascending', 'descending']));
  });
});

describe('scale_construction — answer_music is the U2 builder output for the direction (never-violate rule 5: like-for-like)', () => {
  test('ascending: answer_music equals minorScale(tonic, melodic_minor_asc, startPitch) walked low->high', () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('scale_construction', opts3(GRADE_3_MELODIC_ATOMS, seed));
      if (directionOf(inst) !== 'ascending') continue;
      const music = answerMusic(inst);
      const tonic = (music.key_sig as string).split('_')[0];
      const played = pitches(music);
      // minorScale's startPitch contract is NATURAL-LETTER only (D5) — reduce
      // the played bottom note's octave onto the tonic's natural letter.
      const startPitch = tonic[0] + /-?\d+$/.exec(played[0])![0];
      const expected = minorScale(tonic, 'melodic_minor_asc', startPitch);
      expect(played).toEqual(expected);
    }
  });

  test('descending: answer_music equals the REVERSED ascending walk of minorScale(tonic, melodic_minor_desc, startPitch)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('scale_construction', opts3(GRADE_3_MELODIC_ATOMS, seed));
      if (directionOf(inst) !== 'descending') continue;
      const music = answerMusic(inst);
      const tonic = (music.key_sig as string).split('_')[0];
      const played = pitches(music);
      // last note played is the tonic (low end); reduce to natural-letter (D5).
      const startPitch = tonic[0] + /-?\d+$/.exec(played[played.length - 1])![0];
      const expected = [...minorScale(tonic, 'melodic_minor_desc', startPitch)].reverse();
      expect(played).toEqual(expected);
    }
  });
});

describe('scale_construction — descending headline: raised-7th-left-in names the wrong-direction misconception', () => {
  test('the raised-7th-left-in corruption appears, and its feedback names melodic minor lowering the 7th (and 6th) on the way down', () => {
    const instances = Array.from({ length: 150 }, (_, seed) =>
      generate('scale_construction', opts3(GRADE_3_MELODIC_ATOMS, seed)),
    );
    const descendingHeadline = instances.filter(
      (inst) => directionOf(inst) === 'descending' && formPositionLabels('melodic', 'descending')[0] === inst.answer.canonical,
    );
    expect(descendingHeadline.length).toBeGreaterThan(0);
    for (const inst of descendingHeadline) {
      expect(inst.feedback.incorrect).toMatch(/lowers/i);
      expect(inst.feedback.incorrect).toMatch(/7th/);
      expect(inst.feedback.incorrect).toMatch(/6th/);
      expect(inst.feedback.incorrect).toMatch(/down/i);
    }
  });
});

describe('scale_construction — grade-3 form-keyed discipline (no silent harmonic fallback)', () => {
  test('every canonical + distractor position is drawn from the resolved form+direction rule table', () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('scale_construction', opts3([...GRADE_3_HARMONIC_ATOMS, ...GRADE_3_MELODIC_ATOMS], seed));
      const form = formOf(inst);
      const allowed = new Set(formPositionLabels(form, directionOf(inst) ?? undefined));
      expect(allowed.has(inst.answer.canonical as string)).toBe(true);
      for (const d of inst.distractors as string[]) expect(allowed.has(d)).toBe(true);
    }
  });

  test('an unknown form at grade 3 fails loud rather than silently defaulting to harmonic', () => {
    expect(() => generate('scale_construction', opts3(['scale:A_minor_natural'], 0))).toThrow();
  });
});

describe('scale_construction — melodic minor is unreachable at grade 2 even though the form now exists (D3(c) scope gate)', () => {
  test('a scale:F_minor_melodic atom fails to generate at grade 2', () => {
    expect(() => generate('scale_construction', { grade: 2, seed: 0, atoms: ['scale:F_minor_melodic'] })).toThrow();
  });

  test('harmonic minor still generates fine at grade 2 (the gate is form-specific, not a blanket regression)', () => {
    expect(() => generate('scale_construction', opts(FULL_ATOMS, 0))).not.toThrow();
  });
});

describe('scale_construction — single-atom melodic scope is safe (Practice due-path safety)', () => {
  const atoms = ['scale:F_minor_melodic'];
  const instances = Array.from({ length: 20 }, (_, seed) => generate('scale_construction', opts3(atoms, seed)));

  test('generation succeeds across seeds 0..19 without throwing', () => {
    expect(instances).toHaveLength(20);
  });

  test('every instance is pinned to F minor melodic', () => {
    for (const inst of instances) {
      expect(tonicOf(inst)).toBe('F');
      expect(formOf(inst)).toBe('melodic');
    }
  });

  test('every instance still validates', () => {
    for (const inst of instances) expect(validate(inst).ok).toBe(true);
  });
});

describe('scale_construction — grade-3 one unambiguous answer (every other position is provably correct)', () => {
  test("every distractor position's note in the stimulus matches the TRUE scale — only the canonical position is wrong", () => {
    for (let seed = 0; seed < 100; seed++) {
      const inst = generate('scale_construction', opts3(GRADE_3_MELODIC_ATOMS, seed));
      const truth = pitches(answerMusic(inst));
      const corrupted = pitches(stimulusMusic(inst));
      for (const d of inst.distractors as string[]) {
        const idx = positionIndex(d);
        expect(corrupted[idx]).toBe(truth[idx]);
      }
    }
  });
});

describe('scale_construction — register policy pin (D5: letter-ordinal range semantics are a deliberate policy, not a bug)', () => {
  test('a C#-minor treble instance whose top note spells C#6 generates and validates', () => {
    let found = false;
    for (let seed = 0; seed < 60; seed++) {
      const inst = generate('scale_construction', opts3(['scale:C#_minor_harmonic'], seed));
      if (stimulusMusic(inst).clef !== 'treble') continue;
      const top = pitches(answerMusic(inst))[7];
      if (top === 'C#6') {
        found = true;
        expect(validate(inst)).toEqual({ ok: true, errors: [] });
      }
    }
    expect(found).toBe(true);
  });
});
