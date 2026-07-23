import { keyAccidentals, musicToAbc, pitchToAbc } from '../../music/abc-emitter';
import type { Music, NoteEvent } from '../../music/types';
import { ORNAMENT_KINDS } from '../atoms';
import { validate } from '../validator';
import { generate } from './index';
import { ORNAMENT_NAMES } from './ornament-recognition';
import { naturalPitchStepsAbove } from './pitch-math';

const ALL_ATOMS = ORNAMENT_KINDS.map((k) => `ornament:${k}`);

// Mirrors abc-emitter.ts's own (unexported) ORNAMENT_DECORATION table — an
// independent expectation, not a re-import, so a regression in the emitter's
// mapping would show up here too.
const DECORATION_TOKEN: Partial<Record<string, string>> = {
  trill: '!trill!',
  turn: '!turn!',
  upper_mordent: '!uppermordent!',
  lower_mordent: '!lowermordent!',
};

const GRACE_KINDS = new Set(['acciaccatura', 'appoggiatura']);

function opts(seed: number, atoms: string[] = ALL_ATOMS) {
  return { grade: 4, seed, atoms };
}

function ornamentedNote(music: Music): NoteEvent {
  const notes = music.voices
    .flatMap((v) => v.events)
    .filter((ev): ev is NoteEvent => ev.type === 'note' && ev.ornament !== undefined);
  expect(notes).toHaveLength(1);
  return notes[0];
}

describe('ornament_recognition — every instance validates clean across seeds 0-40', () => {
  test('seeds 0..40 all produce a passing instance', () => {
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('ornament_recognition', opts(seed));
      expect(validate(inst)).toEqual({ ok: true, errors: [] });
    }
  });
});

describe('ornament_recognition — stimulus shape', () => {
  test('exactly one ornamented note, no key/time signature, treble or bass clef', () => {
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('ornament_recognition', opts(seed));
      const music = inst.stimulus.music as Music;
      expect(['treble', 'bass']).toContain(music.clef);
      expect(music.key_sig).toBeNull();
      expect(music.time_sig).toBeNull();
      ornamentedNote(music);
    }
  });
});

describe('ornament_recognition — the invariant: canonical always names config.ornament\'s display name', () => {
  test('across seeds, answer.canonical matches ORNAMENT_NAMES[config.ornament]', () => {
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('ornament_recognition', opts(seed));
      const config = inst.interaction.config as { ornament: string };
      expect(inst.answer.canonical).toBe(ORNAMENT_NAMES[config.ornament as keyof typeof ORNAMENT_NAMES]);
      const music = inst.stimulus.music as Music;
      expect(ornamentedNote(music).ornament?.kind).toBe(config.ornament);
    }
  });
});

describe('ornament_recognition — each of the six ornament kinds is reachable across seeds', () => {
  test('all six kinds appear as config.ornament across seeds 0-40', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('ornament_recognition', opts(seed));
      const config = inst.interaction.config as { ornament: string };
      seen.add(config.ornament);
    }
    expect(seen).toEqual(new Set(ORNAMENT_KINDS));
  });
});

describe('ornament_recognition — distractors are valid, distinct other ornament names', () => {
  test('every distractor is some other kind\'s display name, never the canonical, never duplicated', () => {
    for (let seed = 0; seed <= 40; seed++) {
      const inst = generate('ornament_recognition', opts(seed));
      const distractors = inst.distractors as string[];
      expect(distractors).toHaveLength(2);
      const nameSet = new Set(Object.values(ORNAMENT_NAMES));
      for (const d of distractors) {
        expect(nameSet.has(d)).toBe(true);
        expect(d).not.toBe(inst.answer.canonical);
      }
      expect(new Set(distractors).size).toBe(distractors.length);
    }
  });
});

describe('ornament_recognition — grace kinds (acciaccatura/appoggiatura)', () => {
  test('carry a grace pitch a diatonic step above the principal, and the emitted ABC has a `{...}` grace', () => {
    let foundAcciaccatura = false;
    let foundAppoggiatura = false;
    for (let seed = 0; seed <= 60; seed++) {
      const inst = generate('ornament_recognition', opts(seed));
      const music = inst.stimulus.music as Music;
      const note = ornamentedNote(music);
      const kind = note.ornament!.kind;
      if (!GRACE_KINDS.has(kind)) continue;
      if (kind === 'acciaccatura') foundAcciaccatura = true;
      if (kind === 'appoggiatura') foundAppoggiatura = true;

      expect(note.ornament!.pitch).toBe(naturalPitchStepsAbove(note.pitch, 1));

      const abc = musicToAbc(music);
      const grace = pitchToAbc(note.ornament!.pitch!, keyAccidentals(music.key_sig));
      const expectedToken = kind === 'acciaccatura' ? `{/${grace}}` : `{${grace}}`;
      expect(abc).toContain(expectedToken);
    }
    expect(foundAcciaccatura).toBe(true);
    expect(foundAppoggiatura).toBe(true);
  });
});

describe('ornament_recognition — decoration kinds (trill/turn/mordents)', () => {
  test('carry no grace pitch, and the emitted ABC has the `!name!` decoration', () => {
    const found = new Set<string>();
    for (let seed = 0; seed <= 60; seed++) {
      const inst = generate('ornament_recognition', opts(seed));
      const music = inst.stimulus.music as Music;
      const note = ornamentedNote(music);
      const kind = note.ornament!.kind;
      if (GRACE_KINDS.has(kind)) continue;
      found.add(kind);

      expect(note.ornament!.pitch).toBeUndefined();
      const abc = musicToAbc(music);
      expect(abc).toContain(DECORATION_TOKEN[kind]);
    }
    expect(found).toEqual(new Set(['trill', 'turn', 'upper_mordent', 'lower_mordent']));
  });
});

describe('ornament_recognition — single-atom scope pins the kind (SRS due-path discipline)', () => {
  test('every instance names trill when only ornament:trill is in scope', () => {
    for (let seed = 0; seed < 20; seed++) {
      const inst = generate('ornament_recognition', opts(seed, ['ornament:trill']));
      expect(inst.srs_tags).toEqual(['ornament:trill']);
      expect(inst.answer.canonical).toBe(ORNAMENT_NAMES.trill);
    }
  });
});

describe('ornament_recognition — rejects an unknown ornament kind atom', () => {
  test('an atom naming an unregistered kind throws', () => {
    expect(() => generate('ornament_recognition', opts(0, ['ornament:staccato']))).toThrow();
  });
});

describe('ornament_recognition — rejects an empty atom scope', () => {
  test('no ornament:* atom present throws', () => {
    expect(() => generate('ornament_recognition', opts(0, []))).toThrow();
  });
});

describe('ornament_recognition — reproducibility (KTD4: pure function of seed + atoms)', () => {
  test('the same (seed, atoms) produces a deeply-equal instance', () => {
    expect(generate('ornament_recognition', opts(9))).toEqual(generate('ornament_recognition', opts(9)));
  });
});
