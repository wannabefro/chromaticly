import { highlightLocator } from '../../music/abc-emitter';
import type { Music, NoteEvent, VoiceName } from '../../music/types';
import { validate } from '../validator';
import { generate } from './index';

const SEEDS = Array.from({ length: 40 }, (_, i) => i);
const ALL_VOICES: VoiceName[] = ['soprano', 'alto', 'tenor', 'bass'];

function opts(seed: number) {
  return { grade: 5, seed, atoms: ['satb_voice:soprano', 'satb_voice:alto', 'satb_voice:tenor', 'satb_voice:bass'] };
}

function musicOf(seed: number): Music {
  return generate('satb_voice_recognition', opts(seed)).stimulus.music as Music;
}

describe('satb_voice_recognition — voice -> stave/stem invariant (design G5-1)', () => {
  test.each(SEEDS)('seed %i: exactly four voices, each matching S=treble/up, A=treble/down, T=bass/up, B=bass/down', (seed) => {
    const music = musicOf(seed);
    expect(music.staves).toEqual(['treble', 'bass']);
    expect(music.voices).toHaveLength(4);

    const byName = new Map(music.voices.map((v) => [v.name, v]));
    expect(byName.get('soprano')).toMatchObject({ staff: 0, stem: 'up' });
    expect(byName.get('alto')).toMatchObject({ staff: 0, stem: 'down' });
    expect(byName.get('tenor')).toMatchObject({ staff: 1, stem: 'up' });
    expect(byName.get('bass')).toMatchObject({ staff: 1, stem: 'down' });
  });
});

describe('satb_voice_recognition — exactly one highlighted note, naming the answer', () => {
  test.each(SEEDS)('seed %i: exactly one voice is highlighted and it is the canonical answer', (seed) => {
    const inst = generate('satb_voice_recognition', opts(seed));
    const music = inst.stimulus.music as Music;

    const highlighted = music.voices.filter((v) => (v.events[0] as NoteEvent).highlight === true);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].name).toBe(inst.answer.canonical);
  });
});

describe('satb_voice_recognition — distractors are the other three voice names (commandments 3/4)', () => {
  test.each(SEEDS)('seed %i: distractors are exactly the three non-answer voices, no duplicate of the answer', (seed) => {
    const inst = generate('satb_voice_recognition', opts(seed));
    const answer = inst.answer.canonical as VoiceName;

    expect(new Set(inst.distractors)).toEqual(new Set(ALL_VOICES.filter((v) => v !== answer)));
    expect(inst.distractors).not.toContain(answer);
  });
});

describe('satb_voice_recognition — validity and the highlight locator (U8 multi-staff scope)', () => {
  test.each(SEEDS)('seed %i: validates clean and the highlight locator resolves', (seed) => {
    const inst = generate('satb_voice_recognition', opts(seed));
    expect(validate(inst).errors).toEqual([]);

    const music = inst.stimulus.music as Music;
    const locator = highlightLocator(music);
    expect(locator).not.toBeNull();
    expect(music.voices[locator!.voice].name).toBe(inst.answer.canonical);
  });
});

describe('satb_voice_recognition — every option carries a stave+stem cue, not colour alone (R3)', () => {
  test.each(SEEDS)('seed %i: all four options name their voice, stave, and stem', (seed) => {
    const inst = generate('satb_voice_recognition', opts(seed));
    const options = inst.interaction.config!.options as { voice: VoiceName; label: string; cue: string }[];

    expect(options.map((o) => o.voice)).toEqual(ALL_VOICES);
    const expectedCues: Record<VoiceName, string> = {
      soprano: 'treble, stem up',
      alto: 'treble, stem down',
      tenor: 'bass, stem up',
      bass: 'bass, stem down',
    };
    for (const opt of options) {
      expect(opt.cue).toBe(expectedCues[opt.voice]);
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});

describe('satb_voice_recognition — reproducibility + grade gating', () => {
  test('the same seed produces a deeply-equal instance', () => {
    expect(generate('satb_voice_recognition', opts(11))).toEqual(generate('satb_voice_recognition', opts(11)));
  });

  test('grade other than 5 is unsupported', () => {
    expect(() =>
      generate('satb_voice_recognition', {
        grade: 4,
        seed: 0,
        atoms: ['satb_voice:soprano', 'satb_voice:alto', 'satb_voice:tenor', 'satb_voice:bass'],
      }),
    ).toThrow();
  });

  test('an unknown satb_voice atom fails loud', () => {
    expect(() => generate('satb_voice_recognition', { grade: 5, seed: 0, atoms: ['satb_voice:nonexistent'] })).toThrow();
  });

  test('no satb_voice atom at all fails loud', () => {
    expect(() => generate('satb_voice_recognition', { grade: 5, seed: 0, atoms: [] })).toThrow();
  });
});
