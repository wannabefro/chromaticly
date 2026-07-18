import { musicToAbc } from './abc-emitter';
import { DYNAMIC_GLOSS } from './dynamics';
import type { Dynamic } from './types';

const ALL_MARKS: Dynamic[] = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz'];

describe('DYNAMIC_GLOSS', () => {
  test('every renderable dynamic has a term to ask about', () => {
    for (const mark of ALL_MARKS) {
      expect(DYNAMIC_GLOSS[mark].italian).toBeTruthy();
      expect(DYNAMIC_GLOSS[mark].meaning).toBeTruthy();
    }
  });

  // The gloss and the emitter must agree on the same set of marks, or a rendered
  // dynamic could have no meaning (or a meaning with no way to render it).
  test('every glossed mark renders without error', () => {
    for (const mark of Object.keys(DYNAMIC_GLOSS) as Dynamic[]) {
      const abc = musicToAbc({
        clef: 'treble',
        key_sig: null,
        time_sig: null,
        voices: [{ events: [{ type: 'dynamic', mark }, { type: 'note', pitch: 'C4', dur: 'crotchet' }] }],
      });
      expect(abc).toContain(`!${mark}!`);
    }
  });

  test('forte reads as loud (the 𝆑 the design asks about)', () => {
    expect(DYNAMIC_GLOSS.f).toEqual({ italian: 'forte', meaning: 'loud' });
  });
});
