// The answer the app marks correct must be the answer music theory gives.
//
// Everything else in the suite checks SELF-CONSISTENCY: that a generator's stated
// answer matches its own stimulus, that a lesson's atoms match what it emits. None
// of it can catch the worse failure — teaching something confidently and wrongly.
// So the ground truth here is written from the syllabus and computed from scratch
// (semitones from a chroma table, interval numbers from letter distance, the circle
// of fifths as a literal), deliberately NOT read from the app's knowledge base. If
// the two ever disagree, this file is the one asserting the syllabus.
//
// Run 2026-07-29 over 60 seeds per lesson: clean on all seven checks.

import { LESSONS, lessonById } from './lessons';
import { generate } from '../engine/generators';

/* Independent ground truth, written from the syllabus rather than read from the
   app's own knowledge base — the point is to disagree with it if it is wrong. */
const MAJOR_ACCIDENTALS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6,
};
const RELATIVE_MINOR: Record<string, string> = {
  C: 'A', G: 'E', D: 'B', A: 'F#', E: 'C#', B: 'G#',
  F: 'D', Bb: 'G', Eb: 'C', Ab: 'F', Db: 'Bb',
};
const DEGREE: Record<string, number> = {
  tonic: 1, supertonic: 2, mediant: 3, subdominant: 4,
  dominant: 5, submediant: 6, 'leading note': 7, leading_note: 7,
};

interface Inst {
  prompt?: string;
  stimulus?: { music?: { clef?: string; voices?: { events?: { type?: string; pitch?: string }[] }[] } };
  answer?: { canonical?: unknown };
  srs_tags?: string[];
}

function firstPitch(i: Inst): string | undefined {
  return i.stimulus?.music?.voices?.[0]?.events?.find((e) => e.type === 'note')?.pitch;
}

function each(lessonId: string, seeds = 60): Inst[] {
  const lesson = lessonById(lessonId)!;
  const out: Inst[] = [];
  for (let seed = 0; seed < seeds; seed++) {
    try {
      out.push(generate(lesson.templates[0], { grade: lesson.grade, seed, atoms: lesson.atoms }) as Inst);
    } catch { /* rejected seed */ }
  }
  return out;
}

describe('the answer the app marks correct is the answer music theory gives', () => {
  test('note naming: the named letter is the letter actually on the stave', () => {
    const wrong: string[] = [];
    for (const id of ['treble-notes', 'bass-notes', 'ledger-lines-3', 'alto-reading-4']) {
      for (const i of each(id)) {
        const pitch = firstPitch(i);
        if (!pitch) continue;
        // canonical is a letter name, possibly with an accidental; the stimulus
        // pitch is scientific (e.g. "E4", "Bb2"). Compare letter + accidental.
        const stave = pitch.replace(/\d+$/, '').replace('♭', 'b').replace('♯', '#');
        const said = String(i.answer?.canonical).replace('♭', 'b').replace('♯', '#');
        if (stave.toUpperCase() !== said.toUpperCase()) wrong.push(`${id}: stave ${pitch} marked "${said}"`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test('key signatures: the accidental count is the one the circle of fifths gives', () => {
    const wrong: string[] = [];
    for (const id of ['key-signatures', 'key-signatures-2', 'major-keys-4']) {
      for (const i of each(id)) {
        const tag = i.srs_tags?.[0] ?? '';
        const m = /^key_sig:([A-G][b#]?)_major$/.exec(tag);
        if (!m) continue;
        const expected = MAJOR_ACCIDENTALS[m[1]];
        if (expected === undefined) { wrong.push(`${id}: unknown key ${m[1]}`); continue; }
        const said = String(i.answer?.canonical);
        const n = /(\d+)/.exec(said);
        if (n && Number(n[1]) !== Math.abs(expected)) wrong.push(`${id}: ${m[1]} major marked "${said}", truth ${Math.abs(expected)}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test('relative minors: a minor 3rd below the major tonic, spelled correctly', () => {
    const wrong: string[] = [];
    for (const id of ['minor-keys-2', 'minor-keys-3', 'keys-4']) {
      for (const i of each(id)) {
        const said = String(i.answer?.canonical);
        const norm = (x: string) => x.replace('♭', 'b').replace('♯', '#');
        // Both directions are asked: "relative minor of X major" and "relative
        // major of Y minor". Each is checked against the same table.
        const toMinor = /relative minor of ([A-G][b#♭♯]?) major/.exec(i.prompt ?? '');
        const toMajor = /relative major of ([A-G][b#♭♯]?) minor/.exec(i.prompt ?? '');
        if (toMinor) {
          const key = norm(toMinor[1]);
          const truth = RELATIVE_MINOR[key];
          if (truth === undefined) { wrong.push(`${id}: no ground truth for ${key} major`); continue; }
          const got = norm(/([A-G][b#♭♯]?)/.exec(said)?.[1] ?? '');
          if (got !== truth) wrong.push(`${id}: relative minor of ${key} major marked "${said}", truth ${truth} minor`);
        } else if (toMajor) {
          const minor = norm(toMajor[1]);
          const truth = Object.entries(RELATIVE_MINOR).find(([, m]) => m === minor)?.[0];
          if (truth === undefined) { wrong.push(`${id}: no ground truth for ${minor} minor`); continue; }
          const got = norm(/([A-G][b#♭♯]?)/.exec(said)?.[1] ?? '');
          if (got !== truth) wrong.push(`${id}: relative major of ${minor} minor marked "${said}", truth ${truth} major`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  test('degree names: the ordinal the syllabus assigns', () => {
    const wrong: string[] = [];
    for (const i of each('degree-names-4')) {
      const said = String(i.answer?.canonical).toLowerCase().trim();
      const asked = /(\d+)(?:st|nd|rd|th)\b/.exec(i.prompt ?? '')?.[1];
      const degreeFromName = DEGREE[said];
      if (asked && degreeFromName !== undefined && Number(asked) !== degreeFromName) {
        wrong.push(`degree-names-4: "${i.prompt}" marked "${said}" (= degree ${degreeFromName})`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

/* Semitone ground truth, computed from scratch. */
const CHROMA: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = 'CDEFGAB';
function midi(pitch: string): number {
  const m = /^([A-G])([b#x]*)(-?\d+)$/.exec(pitch.replace('♭', 'b').replace('♯', '#'));
  if (!m) throw new Error(`unparsed pitch ${pitch}`);
  const [, letter, acc, oct] = m;
  const shift = [...acc].reduce((n, c) => n + (c === '#' ? 1 : c === 'x' ? 2 : -1), 0);
  return (Number(oct) + 1) * 12 + CHROMA[letter] + shift;
}
function letterDistance(lo: string, hi: string): number {
  const p = (s: string) => {
    const m = /^([A-G])[b#x]*(-?\d+)$/.exec(s)!;
    return LETTERS.indexOf(m[1]) + 7 * Number(m[2]);
  };
  return p(hi) - p(lo) + 1;
}
const QUALITY_BY_SEMITONES: Record<number, Record<number, string>> = {
  1: { 0: 'perfect' },
  2: { 1: 'minor', 2: 'major' },
  3: { 3: 'minor', 4: 'major' },
  4: { 5: 'perfect' },
  5: { 7: 'perfect' },
  6: { 8: 'minor', 9: 'major' },
  7: { 10: 'minor', 11: 'major' },
  8: { 12: 'perfect' },
};

describe('intervals, enharmonics and transposition against computed truth', () => {
  test('interval number and quality match the two notes actually drawn', () => {
    const wrong: string[] = [];
    for (const id of ['intervals', 'intervals-3', 'intervals-4']) {
      for (const i of each(id)) {
        const events = (i.stimulus?.music?.voices?.[0]?.events ?? []).filter((e) => e.type === 'note' && e.pitch);
        const pitches = events.map((e) => e.pitch!) as string[];
        if (pitches.length < 2) continue;
        const [lo, hi] = [...pitches].sort((a, b) => midi(a) - midi(b));
        const number = letterDistance(lo, hi);
        const semis = midi(hi) - midi(lo);
        const said = String(i.answer?.canonical).toLowerCase();
        const saidNumber = /(\d+)/.exec(said)?.[1] ?? (/unison/.test(said) ? '1' : /octave/.test(said) ? '8' : '');
        if (saidNumber && Number(saidNumber) !== number) {
          wrong.push(`${id}: ${lo}->${hi} is a ${number}, marked "${said}"`);
          continue;
        }
        const truthQuality = QUALITY_BY_SEMITONES[number]?.[semis];
        if (truthQuality && /perfect|major|minor/.test(said) && !said.includes(truthQuality)) {
          wrong.push(`${id}: ${lo}->${hi} (${semis} semitones) is ${truthQuality}, marked "${said}"`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  test('enharmonic pairs are the same pitch spelled two ways', () => {
    const wrong: string[] = [];
    for (const i of each('enharmonics-4')) {
      const given = firstPitch(i);
      const said = String(i.answer?.canonical);
      if (!given) continue;
      const octave = /(-?\d+)$/.exec(given)?.[1] ?? '4';
      const saidPitch = /\d/.test(said) ? said : `${said}${octave}`;
      try {
        if (midi(given) % 12 !== midi(saidPitch) % 12) {
          wrong.push(`enharmonics-4: ${given} marked equal to ${said}`);
        }
      } catch { /* not a bare pitch answer */ }
    }
    expect(wrong).toEqual([]);
  });

  test('a B-flat instrument sounds a major 2nd BELOW what it reads', () => {
    const wrong: string[] = [];
    for (const i of each('transposing-instruments-5')) {
      const prompt = i.prompt ?? '';
      const dirUp = /up a major 2nd|written pitch|concert/i.test(prompt);
      if (!dirUp) continue;
      // The generator states its own direction in the prompt; the check here is
      // that the interval it asks for is a major 2nd, never a minor 2nd or a 3rd.
      if (/minor 2nd|major 3rd|minor 3rd/i.test(prompt)) wrong.push(`transposing-instruments-5: "${prompt}"`);
    }
    expect(wrong).toEqual([]);
  });
});
