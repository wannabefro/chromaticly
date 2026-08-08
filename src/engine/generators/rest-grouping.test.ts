// chromaticly-6xs.3. G3 item 1 asks for the grouping of notes AND rests in
// compound time. Nothing scored the rests.

import { generate } from './index';
import { validate } from '../validator';
import { WRITTEN_ITEMS } from '../../learn/exercise-set';
import { compoundBeats, correctRests, restLabel, silencesFor } from './rest-grouping';
import type { ExerciseInstance } from '../schema';
import type { Music } from '../../music/types';

const SIGS = ['6/8', '9/8', '12/8'];
const ATOMS = SIGS.map((s) => `rest_grouping:${s}`);

function gen(seed: number, atoms: string[] = ATOMS): ExerciseInstance {
  return generate('rest_grouping', { grade: 3, seed, atoms });
}

function options(inst: ExerciseInstance): Record<string, Music> {
  return (inst.interaction.config as { option_music: Record<string, Music> }).option_music;
}

const QUAVERS: Record<string, number> = { quaver: 1, crotchet: 2, minim: 4 };

/** Rest onsets and lengths in quavers, read back off a rendered bar. */
function rests(music: Music): { onset: number; quavers: number }[] {
  const out: { onset: number; quavers: number }[] = [];
  let at = 0;
  for (const ev of music.voices[0].events) {
    if (ev.type === 'barline') continue;
    const q = QUAVERS[(ev as { dur: string }).dur] * ((ev as { dots?: number }).dots === 1 ? 1.5 : 1);
    if (ev.type === 'rest') out.push({ onset: at, quavers: q });
    at += q;
  }
  return out;
}

describe('rest_grouping generator (chromaticly-6xs.3)', () => {
  test('every item in the deterministic set is validator-clean', () => {
    for (let seed = 0; seed < WRITTEN_ITEMS; seed++) {
      expect(validate(gen(seed))).toEqual({ ok: true, errors: [] });
    }
  });

  // THE invariant, read off the rendered bar rather than the label.
  test('no rest in the answer bar runs past the end of its dotted beat', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = gen(seed);
      for (const r of rests(options(inst)[inst.answer.canonical as string])) {
        expect((r.onset % 3) + r.quavers).toBeLessThanOrEqual(3);
      }
    }
  });

  test('a beat that is silent throughout is written as one rest in the answer', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = gen(seed);
      const spans = rests(options(inst)[inst.answer.canonical as string]);
      for (let i = 1; i < spans.length; i++) {
        const previous = spans[i - 1];
        const adjacent = previous.onset + previous.quavers === spans[i].onset;
        const sameBeat = Math.floor(previous.onset / 3) === Math.floor(spans[i].onset / 3);
        expect(adjacent && sameBeat).toBe(false);
      }
    }
  });

  // Two right answers would make the item unanswerable, and the validator is
  // the only thing that could tell.
  test('every distractor bar breaks the rule the answer obeys', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = gen(seed);
      for (const label of inst.distractors as string[]) {
        const spans = rests(options(inst)[label]);
        const crosses = spans.some((r) => (r.onset % 3) + r.quavers > 3);
        const split = spans.some((r, i) => i > 0 && spans[i - 1].onset + spans[i - 1].quavers === r.onset
          && Math.floor(spans[i - 1].onset / 3) === Math.floor(r.onset / 3));
        expect(crosses || split).toBe(true);
      }
    }
  });

  // Otherwise the question is arithmetic, not grouping.
  test('every option holds the same silence and fills the same bar', () => {
    for (let seed = 0; seed < 40; seed++) {
      const inst = gen(seed);
      const bars = Object.values(options(inst));
      const totals = bars.map((m) => rests(m).reduce((a, r) => a + r.quavers, 0));
      expect(new Set(totals).size).toBe(1);
      const beats = compoundBeats(inst.stimulus.text as string);
      for (const m of bars) {
        const filled = m.voices[0].events
          .filter((ev) => ev.type !== 'barline')
          .reduce((a, ev) => a + QUAVERS[(ev as { dur: string }).dur] * ((ev as { dots?: number }).dots === 1 ? 1.5 : 1), 0);
        expect(filled).toBe(beats * 3);
      }
    }
  });

  test('all three signatures are asked within one set', () => {
    const asked = new Set<string>();
    for (let seed = 0; seed < WRITTEN_ITEMS * 3; seed++) asked.add(gen(seed).srs_tags[0]);
    expect([...asked].sort()).toEqual([...ATOMS].sort());
  });

  // One memorised label would answer every item without reading a bar.
  test('more than one answer label is reachable', () => {
    const labels = new Set<string>();
    for (let seed = 0; seed < 40; seed++) labels.add(gen(seed).answer.canonical as string);
    expect(labels.size).toBeGreaterThan(2);
  });

  test.each(ATOMS)('a single due atom %s is a whole item', (atom) => {
    const inst = gen(0, [atom]);
    expect(inst.srs_tags).toEqual([atom]);
    expect(inst.distractors).not.toContain(inst.answer.canonical);
    expect(validate(inst)).toEqual({ ok: true, errors: [] });
  });

  test('is a pure function of (grade, seed, atoms) — determinism', () => {
    expect(gen(3)).toEqual(gen(3));
  });

  test('an atom pool with no rest_grouping atom throws rather than inventing one', () => {
    expect(() => gen(0, ['grouping:6/8'])).toThrow();
  });

  test('a simple time signature is not a compound beat and is rejected', () => {
    expect(() => compoundBeats('3/4')).toThrow();
    expect(() => compoundBeats('3/8')).toThrow();
  });

  // 6/8 has two beats, so the two-beat silence has nowhere to sit.
  test('6/8 offers two silence shapes and 9/8 offers three', () => {
    expect(silencesFor('6/8')).toHaveLength(2);
    expect(silencesFor('9/8')).toHaveLength(3);
  });

  test('the rule is applied at the boundary itself, not near it', () => {
    expect(restLabel(correctRests({ from: 2, to: 6 }))).toBe('A quaver rest, then a dotted crotchet rest');
    expect(restLabel(correctRests({ from: 0, to: 3 }))).toBe('One dotted crotchet rest');
    expect(restLabel(correctRests({ from: 3, to: 9 }))).toBe('2 dotted crotchet rests');
  });
});

describe('restGroupingHook rejects a tampered instance', () => {
  const setOption = (inst: ExerciseInstance, label: string, events: Music['voices'][0]['events']): void => {
    options(inst)[label].voices[0].events = events;
  };

  test('an answer bar whose rest crosses a beat', () => {
    const inst = gen(0);
    const label = inst.answer.canonical as string;
    const beats = compoundBeats(inst.stimulus.text as string);
    setOption(inst, label, [
      { type: 'note', pitch: 'C4', dur: 'quaver' },
      { type: 'note', pitch: 'C4', dur: 'quaver' },
      { type: 'rest', dur: 'minim' },
      ...Array.from({ length: beats * 3 - 6 }, () => ({ type: 'note' as const, pitch: 'C4', dur: 'quaver' as const })),
    ]);
    expect(validate(inst).errors.some((e) => e.includes('runs past the end of its dotted beat'))).toBe(true);
  });

  test('a distractor bar that obeys the rule too', () => {
    const inst = gen(0);
    const label = (inst.distractors as string[])[0];
    options(inst)[label] = JSON.parse(JSON.stringify(options(inst)[inst.answer.canonical as string]));
    expect(validate(inst).errors.some((e) => e.includes('two answers'))).toBe(true);
  });

  test('an answer that names no rendered bar', () => {
    const inst = gen(0);
    inst.answer.canonical = 'One breve rest';
    expect(validate(inst).errors.some((e) => e.includes('names no rendered bar'))).toBe(true);
  });

  test('an option holding a different amount of silence', () => {
    const inst = gen(0);
    const label = (inst.distractors as string[])[0];
    const beats = compoundBeats(inst.stimulus.text as string);
    setOption(inst, label, [
      { type: 'rest', dur: 'crotchet' },
      ...Array.from({ length: beats * 3 - 2 }, () => ({ type: 'note' as const, pitch: 'C4', dur: 'quaver' as const })),
    ]);
    expect(validate(inst).errors.some((e) => e.includes('different amount of silence'))).toBe(true);
  });

  test('two rests sharing one silent beat in the answer', () => {
    const inst = gen(0);
    const label = inst.answer.canonical as string;
    const beats = compoundBeats(inst.stimulus.text as string);
    setOption(inst, label, [
      { type: 'rest', dur: 'crotchet' },
      { type: 'rest', dur: 'quaver' },
      ...Array.from({ length: beats * 3 - 3 }, () => ({ type: 'note' as const, pitch: 'C4', dur: 'quaver' as const })),
    ]);
    expect(validate(inst).errors.some((e) => e.includes('share the dotted beat'))).toBe(true);
  });
});
