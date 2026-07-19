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
