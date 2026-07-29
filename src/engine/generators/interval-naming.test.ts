import { musicToAbc } from '../../music/abc-emitter';
import type { Music } from '../../music/types';
import { diatonicIntervalNumber, intervalLabel, intervalQuality, parseIntervalLabel } from '../interval-quality';
import { pitchRange, scopeForGrade } from '../scope';
import { validate } from '../validator';

const g1Clefs = scopeForGrade(1).clefs;
const g1KeysMajor = scopeForGrade(1).keysMajor;
const g1NoteValues = scopeForGrade(1).noteValues;
import preChangeGrade1Fixture from './__fixtures__/interval-naming-grade1-pre-u3.json';
import { intervalNaming, intervalNamingStaveInput } from './interval-naming';
import { spellInKeySig } from './key-spelling';
import { scientificPitchOrdinal } from './pitch-math';

describe('intervalNaming — reproducibility (KTD4: pure function of seed)', () => {
  test('the same (grade, seed) produces a deeply-equal instance', () => {
    const a = intervalNaming({ grade: 1, seed: 11, atoms: [] });
    const b = intervalNaming({ grade: 1, seed: 11, atoms: [] });
    expect(a).toEqual(b);
  });

  test('different seeds produce different instances', () => {
    const seeds = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seeds.add(JSON.stringify(intervalNaming({ grade: 1, seed, atoms: [] })));
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('intervalNaming — G1 rule: lower note pinned to the tonic, above-tonic only, <= an octave', () => {
  test('the chord\'s lower note is always the sampled key\'s tonic letter, and both pitches stay in clef range', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = intervalNaming({ grade: 1, seed, atoms: [] });
      const music = instance.stimulus.music as {
        clef: 'treble' | 'bass';
        key_sig: string;
        voices: { events: { pitches: string[] }[] }[];
      };
      const [tonic] = music.key_sig.split('_');
      const [lower, upper] = music.voices[0].events[0].pitches;

      // Interval number counts letter positions, so compare on the natural
      // letter+octave — the upper note may carry a diatonic accidental (e.g.
      // Bb in F major) that does not change the step count.
      const naturalize = (p: string) => p.replace(/[#b]/, '');

      expect(g1KeysMajor).toContain(tonic);
      expect(g1Clefs).toContain(music.clef);
      expect(lower[0]).toBe(tonic);

      const range = pitchRange(music.clef, 1);
      expect(scientificPitchOrdinal(naturalize(lower))).toBeGreaterThanOrEqual(scientificPitchOrdinal(range.low));
      expect(scientificPitchOrdinal(naturalize(upper))).toBeLessThanOrEqual(scientificPitchOrdinal(range.high));

      // above tonic only, at most an octave (7 diatonic steps)
      const steps = scientificPitchOrdinal(naturalize(upper)) - scientificPitchOrdinal(naturalize(lower));
      expect(steps).toBeGreaterThanOrEqual(1);
      expect(steps).toBeLessThanOrEqual(7);
    }
  });
});

describe('intervalNaming — answer is number-only', () => {
  test('canonical answer is an integer 2..8 (steps + 1, above tonic)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = intervalNaming({ grade: 1, seed, atoms: [] });
      expect(typeof instance.answer.canonical).toBe('number');
      expect(instance.answer.canonical).toBeGreaterThanOrEqual(2);
      expect(instance.answer.canonical).toBeLessThanOrEqual(8);
    }
  });
});

describe('intervalNaming — distractor rule: +/-1 number', () => {
  test('every distractor is exactly one away from the canonical interval number', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = intervalNaming({ grade: 1, seed, atoms: [] });
      const canonical = instance.answer.canonical as number;
      for (const d of instance.distractors as number[]) {
        expect(Math.abs(d - canonical)).toBe(1);
      }
    }
  });
});

describe('intervalNaming — notes are spelled diatonically within the key', () => {
  // A G1 interval above the tonic is diatonic, so the key signature carries any
  // accidental and the emitter never prints an explicit natural (=) — e.g. the
  // 7th above D in D major must render as C#, not a chromatic C-natural.
  test('no generated interval renders an explicit accidental in the ABC body', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = intervalNaming({ grade: 1, seed, atoms: [] });
      const abc = musicToAbc(instance.stimulus.music as Music);
      const body = abc.split('\n').filter((line) => !/^[A-Za-z]:/.test(line)).join('\n');
      expect(body).not.toMatch(/[=^_]/);
    }
  });
});

describe('intervalNaming — srs_tags', () => {
  test('emits an interval atom for the answer number', () => {
    const instance = intervalNaming({ grade: 1, seed: 3, atoms: [] });
    expect(instance.srs_tags).toEqual([`interval:${instance.answer.canonical}`]);
  });
});

describe('intervalNaming — fuzz gate: 100 generated items are all validator-clean', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = intervalNaming({ grade: 1, seed, atoms: [] });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });
});

// U8/RD2: "write the note a [interval] higher than the given note" — the sole
// Grade 1 stave-input item. answer.canonical is the SEMANTIC target
// {pitch, dur}, not a rendered Music object (AD5) — grading (grading.test.ts)
// never deep-equals a Music object either.
describe('intervalNamingStaveInput — reproducibility (KTD4: pure function of seed)', () => {
  test('the same (grade, seed) produces a deeply-equal instance', () => {
    const a = intervalNamingStaveInput({ grade: 1, seed: 11, atoms: [] });
    const b = intervalNamingStaveInput({ grade: 1, seed: 11, atoms: [] });
    expect(a).toEqual(b);
  });

  test('different seeds produce different instances', () => {
    const seeds = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seeds.add(JSON.stringify(intervalNamingStaveInput({ grade: 1, seed, atoms: [] })));
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('intervalNamingStaveInput — interaction shape', () => {
  test('interaction.type is stave_input', () => {
    const instance = intervalNamingStaveInput({ grade: 1, seed: 2, atoms: [] });
    expect(instance.interaction.type).toBe('stave_input');
  });

  test('stimulus renders exactly the given (lower) note — the learner writes the target, not the reverse', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = intervalNamingStaveInput({ grade: 1, seed, atoms: [] });
      const music = instance.stimulus.music as Music;
      expect(music.voices[0].events).toHaveLength(1);
      expect(music.voices[0].events[0].type).toBe('note');
    }
  });
});

describe('intervalNamingStaveInput — canonical target is semantic {pitch, dur}, in G1 scope (ledger = middle C only)', () => {
  test('canonical is a scientific pitch + a G1 duration, within the sampled clef range, above the given note', () => {
    for (let seed = 0; seed < 50; seed++) {
      const instance = intervalNamingStaveInput({ grade: 1, seed, atoms: [] });
      const music = instance.stimulus.music as {
        clef: 'treble' | 'bass';
        key_sig: string;
        voices: { events: { pitch: string }[] }[];
      };
      const canonical = instance.answer.canonical as { pitch: string; dur: string };
      const givenPitch = music.voices[0].events[0].pitch;

      expect(g1Clefs).toContain(music.clef);
      expect(g1NoteValues).toContain(canonical.dur);

      const range = pitchRange(music.clef, 1);
      const naturalize = (p: string) => p.replace(/[#b]/, '');
      expect(scientificPitchOrdinal(naturalize(canonical.pitch))).toBeGreaterThanOrEqual(scientificPitchOrdinal(range.low));
      expect(scientificPitchOrdinal(naturalize(canonical.pitch))).toBeLessThanOrEqual(scientificPitchOrdinal(range.high));

      // above the given note (RD2/scopeForGrade(1).intervalRule: above tonic only)
      expect(scientificPitchOrdinal(naturalize(canonical.pitch))).toBeGreaterThan(scientificPitchOrdinal(naturalize(givenPitch)));
    }
  });

  test('canonical answer is never a Music object — grading stays semantic (AD5)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = intervalNamingStaveInput({ grade: 1, seed, atoms: [] });
      const canonical = instance.answer.canonical as Record<string, unknown>;
      expect(canonical).not.toHaveProperty('voices');
      expect(canonical).not.toHaveProperty('clef');
      expect(Object.keys(canonical).sort()).toEqual(['dur', 'pitch']);
    }
  });
});

describe('intervalNamingStaveInput — srs_tags', () => {
  test('emits the same interval-atom scheme as the mcq variant (shared mastery skill)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const instance = intervalNamingStaveInput({ grade: 1, seed, atoms: [] });
      expect(instance.srs_tags[0]).toMatch(/^interval:\d+$/);
    }
  });
});

describe('intervalNamingStaveInput — fuzz gate: 100 generated items are all validator-clean', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = intervalNamingStaveInput({ grade: 1, seed, atoms: [] });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });

  // "a 8th" read as broken English on device; the article follows the spoken ordinal.
  test('the prompt takes the right article for every Grade 1 interval', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = intervalNamingStaveInput({ grade: 1, seed, atoms: [] });
      expect(inst.prompt).not.toMatch(/\ba 8th\b/);
      expect(inst.prompt).toMatch(/Write the note (a|an) \d+(st|nd|rd|th) higher/);
    }
  });
});

// U3 (plan 2026-07-20-002) — grade-3 number+type naming. The `namingStyle`
// branch in build() is the slice's central regression risk, so this suite
// leads with the grade-1/2 byte-identity hard core before covering the new
// grade-3 behavior.

describe('intervalNaming — grade-1 byte-identity (U3 hard core): the else-branch and untouched sampleInterval move nothing', () => {
  /** `feedback.by_distractor` (chromaticly-7tb) is an ADDITIVE field: it names
   *  which of the two off-by-one distractors the learner picked, and is derived
   *  from `intervalNumber`, which the fixture already pins. Stripping it before
   *  the comparison keeps the fixture genuinely pre-U3 — regenerating it would
   *  make the file post-change and quietly retire the guarantee it exists for,
   *  which is that the grade-1 SAMPLING sequence never moved. */
  function withoutMisconceptions(instances: ReturnType<typeof intervalNaming>[]) {
    return instances.map(({ feedback: { by_distractor: _dropped, ...feedback }, ...rest }) => ({ ...rest, feedback }));
  }

  test('seeds 0..19 deep-equal the pre-U3 fixture, both templates — independent of the seed-stability .snap net', () => {
    const mcqNow = Array.from({ length: 20 }, (_, seed) => intervalNaming({ grade: 1, seed, atoms: [] }));
    const staveNow = Array.from({ length: 20 }, (_, seed) => intervalNamingStaveInput({ grade: 1, seed, atoms: [] }));
    expect(withoutMisconceptions(mcqNow)).toEqual(preChangeGrade1Fixture.mcq);
    expect(withoutMisconceptions(staveNow)).toEqual(preChangeGrade1Fixture.stave);
  });

  test('the stripped field is the only difference — the fixture still pins everything else about grade 1', () => {
    const mcqNow = Array.from({ length: 20 }, (_, seed) => intervalNaming({ grade: 1, seed, atoms: [] }));
    for (const instance of mcqNow) {
      expect(Object.keys(instance.feedback.by_distractor ?? {}).sort()).toEqual(
        (instance.distractors as number[]).map(String).sort(),
      );
    }
  });
});

describe('intervalNamingStaveInput — D7: number-only and unaffected by namingStyle at every grade, including grade 3', () => {
  test('grade-3 output never carries quality vocabulary and keeps the bare interval:<n> atom scheme', () => {
    for (let seed = 0; seed < 40; seed++) {
      const instance = intervalNamingStaveInput({ grade: 3, seed, atoms: [] });
      expect(instance.prompt).toMatch(/^Write the note (a|an) \d+(st|nd|rd|th) higher than the given note, as a \S+\.$/);
      expect(instance.prompt).not.toMatch(/major|minor|perfect/i);
      expect(instance.srs_tags[0]).toMatch(/^interval:\d+$/);
      expect(Object.keys(instance.answer.canonical as object).sort()).toEqual(['dur', 'pitch']);
    }
  });
});

function chordPitches(instance: ReturnType<typeof intervalNaming>): [string, string] {
  const music = instance.stimulus.music as Music;
  const event = music.voices[0].events[0] as { pitches: string[] };
  return [event.pitches[0], event.pitches[1]];
}

describe('intervalNaming — grade 3: prompt and canonical shape (D5)', () => {
  test('prompt names both number and type', () => {
    const instance = intervalNaming({ grade: 3, seed: 0, atoms: [] });
    expect(instance.prompt).toBe('Name this interval (number and type).');
  });

  test("every instance's canonical is exactly the label recomputed from its own stimulus (seeds 0..99)", () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = intervalNaming({ grade: 3, seed, atoms: [] });
      const [lower, upper] = chordPitches(instance);
      const number = diatonicIntervalNumber(lower, upper);
      const quality = intervalQuality(lower, upper, number);
      expect(instance.answer.canonical).toBe(intervalLabel(quality, number));
    }
  });
});

describe('intervalNaming — grade 3, D3: minor is a reachable CORRECT answer, not just a distractor', () => {
  test('seeds 0..119 reach at least one minor, one major, and one perfect canonical', () => {
    const qualitiesSeen = new Set<string>();
    for (let seed = 0; seed < 120; seed++) {
      const instance = intervalNaming({ grade: 3, seed, atoms: [] });
      qualitiesSeen.add(parseIntervalLabel(instance.answer.canonical as string).quality);
    }
    expect(qualitiesSeen).toEqual(new Set(['perfect', 'major', 'minor']));
  });

  test('every minor-canonical instance samples a minor key signature', () => {
    for (let seed = 0; seed < 120; seed++) {
      const instance = intervalNaming({ grade: 3, seed, atoms: [] });
      if (parseIntervalLabel(instance.answer.canonical as string).quality !== 'minor') continue;
      const music = instance.stimulus.music as Music;
      expect(music.key_sig).toMatch(/_minor$/);
    }
  });
});

describe('intervalNaming — grade 3, ORC1/R1: minor items are natural-minor diatonic — no raised 6th/7th ever', () => {
  test('every _minor instance renders both pitches exactly as the key signature spells them (seeds 0..119)', () => {
    let minorInstancesSeen = 0;
    for (let seed = 0; seed < 120; seed++) {
      const instance = intervalNaming({ grade: 3, seed, atoms: [] });
      const music = instance.stimulus.music as Music;
      if (!music.key_sig?.endsWith('_minor')) continue;
      minorInstancesSeen++;
      for (const pitch of chordPitches(instance)) {
        const naturalLetter = pitch[0];
        const octave = pitch.slice(-1);
        expect(pitch).toBe(spellInKeySig(`${naturalLetter}${octave}`, music.key_sig as string));
      }
    }
    expect(minorInstancesSeen).toBeGreaterThan(0);
  });
});

describe('intervalNaming — grade 3, ORC1/R5: opts.atoms scopes the sampled interval NUMBER (the due-path fix)', () => {
  test('atoms=["interval_type:5"] samples number 5 across every seed', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = intervalNaming({ grade: 3, seed, atoms: ['interval_type:5'] });
      expect(parseIntervalLabel(instance.answer.canonical as string).number).toBe(5);
    }
  });

  test('the full interval_type:2..8 atom set ranges over every number 2..8', () => {
    const atoms = [2, 3, 4, 5, 6, 7, 8].map((n) => `interval_type:${n}`);
    const numbers = new Set<number>();
    for (let seed = 0; seed < 60; seed++) {
      const instance = intervalNaming({ grade: 3, seed, atoms });
      numbers.add(parseIntervalLabel(instance.answer.canonical as string).number);
    }
    expect(numbers).toEqual(new Set([2, 3, 4, 5, 6, 7, 8]));
  });

  test('empty atoms still range over every number 2..8 — the bare-draw case unchanged', () => {
    const numbers = new Set<number>();
    for (let seed = 0; seed < 60; seed++) {
      const instance = intervalNaming({ grade: 3, seed, atoms: [] });
      numbers.add(parseIntervalLabel(instance.answer.canonical as string).number);
    }
    expect(numbers).toEqual(new Set([2, 3, 4, 5, 6, 7, 8]));
  });
});

describe('intervalNaming — grade 3, D6/ORC2: distractor shape', () => {
  test('every instance has exactly 2 well-formed, distinct distractors, neither equal to the canonical (seeds 0..99)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = intervalNaming({ grade: 3, seed, atoms: [] });
      expect(instance.distractors).toHaveLength(2);
      const [d1, d2] = instance.distractors as string[];
      expect(() => parseIntervalLabel(d1)).not.toThrow();
      expect(() => parseIntervalLabel(d2)).not.toThrow();
      expect(d1).not.toBe(d2);
      expect(d1).not.toBe(instance.answer.canonical);
      expect(d2).not.toBe(instance.answer.canonical);
    }
  });

  test('a major/minor-number canonical carries a same-number flipped-quality distractor (the type misconception)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = intervalNaming({ grade: 3, seed, atoms: [] });
      const { quality, number } = parseIntervalLabel(instance.answer.canonical as string);
      if (quality === 'perfect') continue;
      const flipped = quality === 'major' ? 'minor' : 'major';
      expect(instance.distractors).toContain(intervalLabel(flipped, number));
    }
  });

  test('a perfect-number canonical carries two distinct nearest-number distractors, neither the canonical number', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = intervalNaming({ grade: 3, seed, atoms: [] });
      const { quality, number } = parseIntervalLabel(instance.answer.canonical as string);
      if (quality !== 'perfect') continue;
      const distractorNumbers = (instance.distractors as string[]).map((d) => parseIntervalLabel(d).number);
      expect(distractorNumbers).toHaveLength(2);
      expect(new Set(distractorNumbers).size).toBe(2);
      expect(distractorNumbers).not.toContain(number);
    }
  });

  // ORC2: the octave (n=8) is the case a naive "±1 clamped" rule breaks —
  // n+1=9 is out of range, so a clamp would yield only ONE distractor {7}.
  // The nearest-two rule must reach past 7 to 6.
  test('a "perfect octave" canonical yields distractors for exactly the 7th and 6th, in that order', () => {
    let found = false;
    for (let seed = 0; seed < 200; seed++) {
      const instance = intervalNaming({ grade: 3, seed, atoms: ['interval_type:8'] });
      if (instance.answer.canonical !== 'perfect octave') continue;
      found = true;
      const distractorNumbers = (instance.distractors as string[]).map((d) => parseIntervalLabel(d).number);
      expect(distractorNumbers).toEqual([7, 6]);
    }
    expect(found).toBe(true);
  });
});

describe('intervalNaming — grade 3, D4: srs_tags emit the number+type atom, not the bare grade-1 atom', () => {
  test('a grade-3 instance emits interval_type:<n> matching its canonical number', () => {
    for (let seed = 0; seed < 30; seed++) {
      const instance = intervalNaming({ grade: 3, seed, atoms: [] });
      const { number } = parseIntervalLabel(instance.answer.canonical as string);
      expect(instance.srs_tags).toEqual([`interval_type:${number}`]);
    }
  });

  test('a grade-1 instance still emits the bare interval:<n> atom (unchanged)', () => {
    const instance = intervalNaming({ grade: 1, seed: 3, atoms: [] });
    expect(instance.srs_tags).toEqual([`interval:${instance.answer.canonical}`]);
  });
});

describe('intervalNaming — grade 3, fuzz gate: 100 generated items are all validator-clean', () => {
  test('seeds 0..99 all produce a passing instance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = intervalNaming({ grade: 3, seed, atoms: [] });
      const result = validate(instance);
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });
});

// fyu.8 — grade-4 aug/dim + between-any-notes. Domain LOCKED to natural
// pitches only (key_sig: null): grades 1-3 stay untouched (byte-identity
// fixture above), so this suite covers only the new aboveTonicOnly:false
// branch.

describe('intervalNaming — grade 4, fyu.8: between-any-notes, natural pitches only, key_sig: null', () => {
  test('seeds 0..40: every instance validates clean, both stimulus pitches are natural, and the interval is <= an octave', () => {
    for (let seed = 0; seed <= 40; seed++) {
      const instance = intervalNaming({ grade: 4, seed, atoms: [] });
      expect(validate(instance)).toEqual({ ok: true, errors: [] });

      const music = instance.stimulus.music as Music;
      expect(music.key_sig).toBeNull();

      const [lower, upper] = chordPitches(instance);
      expect(lower).toMatch(/^[A-G]-?\d+$/);
      expect(upper).toMatch(/^[A-G]-?\d+$/);

      const number = diatonicIntervalNumber(lower, upper);
      expect(number).toBeGreaterThanOrEqual(2);
      expect(number).toBeLessThanOrEqual(8);
    }
  });

  test('every canonical is exactly the label recomputed from its own stimulus (seeds 0..99)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = intervalNaming({ grade: 4, seed, atoms: [] });
      const [lower, upper] = chordPitches(instance);
      const number = diatonicIntervalNumber(lower, upper);
      const quality = intervalQuality(lower, upper, number);
      expect(instance.answer.canonical).toBe(intervalLabel(quality, number));
    }
  });

  // The domain-lock invariant (fyu.8 spec): aug/dim must be REACHABLE, not
  // merely theoretically supported — a sampler that only ever lands on the
  // majority perfect 4ths/5ths would pass every other check here while
  // silently never exercising the tritone pairs.
  test('the augmented 4th (F-B) and diminished 5th (B-F) are reachable, not just theoretically supported (seeds 0..150, bare draw)', () => {
    const qualitiesSeen = new Set<string>();
    for (let seed = 0; seed < 150; seed++) {
      const instance = intervalNaming({ grade: 4, seed, atoms: [] });
      qualitiesSeen.add(parseIntervalLabel(instance.answer.canonical as string).quality);
    }
    expect(qualitiesSeen).toContain('augmented');
    expect(qualitiesSeen).toContain('diminished');
  });

  test('atom-scoped interval_type:4 reaches both perfect and augmented 4ths (seeds 0..40)', () => {
    const qualitiesSeen = new Set<string>();
    for (let seed = 0; seed <= 40; seed++) {
      const instance = intervalNaming({ grade: 4, seed, atoms: ['interval_type:4'] });
      qualitiesSeen.add(parseIntervalLabel(instance.answer.canonical as string).quality);
    }
    expect(qualitiesSeen).toEqual(new Set(['perfect', 'augmented']));
  });

  test('atom-scoped interval_type:5 reaches both perfect and diminished 5ths (seeds 0..40)', () => {
    const qualitiesSeen = new Set<string>();
    for (let seed = 0; seed <= 40; seed++) {
      const instance = intervalNaming({ grade: 4, seed, atoms: ['interval_type:5'] });
      qualitiesSeen.add(parseIntervalLabel(instance.answer.canonical as string).quality);
    }
    expect(qualitiesSeen).toEqual(new Set(['perfect', 'diminished']));
  });

  test('the minor 2nds (E-F, B-C) are reachable, not just the majority major 2nds (seeds 0..40, atom-scoped)', () => {
    const qualitiesSeen = new Set<string>();
    for (let seed = 0; seed <= 40; seed++) {
      const instance = intervalNaming({ grade: 4, seed, atoms: ['interval_type:2'] });
      qualitiesSeen.add(parseIntervalLabel(instance.answer.canonical as string).quality);
    }
    expect(qualitiesSeen).toEqual(new Set(['major', 'minor']));
  });

  test('every instance has exactly 2 well-formed, distinct distractors, neither equal to the canonical (seeds 0..99)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const instance = intervalNaming({ grade: 4, seed, atoms: [] });
      expect(instance.distractors).toHaveLength(2);
      const [d1, d2] = instance.distractors as string[];
      expect(() => parseIntervalLabel(d1)).not.toThrow();
      expect(() => parseIntervalLabel(d2)).not.toThrow();
      expect(d1).not.toBe(d2);
      expect(d1).not.toBe(instance.answer.canonical);
      expect(d2).not.toBe(instance.answer.canonical);
    }
  });

  test('an augmented/diminished canonical carries a "perfect" same-number distractor (the un-altered misconception)', () => {
    let seen = 0;
    for (let seed = 0; seed < 150; seed++) {
      const instance = intervalNaming({ grade: 4, seed, atoms: [] });
      const { quality, number } = parseIntervalLabel(instance.answer.canonical as string);
      if (quality !== 'augmented' && quality !== 'diminished') continue;
      seen++;
      expect(instance.distractors).toContain(intervalLabel('perfect', number));
    }
    expect(seen).toBeGreaterThan(0);
  });
});
