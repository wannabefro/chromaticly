// by_ear_match's interaction (theory-by-ear U3). The two invariants worth
// guarding: the item is not gradeable until both steps are answered (AE3), and
// every wrong answer collapses to a key that resolves a by_distractor line.

import { fireEvent, render } from '@testing-library/react-native';

// registry.tsx reaches NotationCard -> MusicSurface -> the native WebView module.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef(() => null) };
});

import { generate } from '../../engine/generators';
import { INTERACTIONS } from './registry';
import { ByEarMatch, emptyByEarMatchResponse, type ByEarMatchResponse } from './ByEarMatch';

const ATOMS = ['rest:crotchet', 'rest:minim', 'rest:semibreve'];

function instance(seed = 0) {
  return generate('by_ear_match', { grade: 1, seed, atoms: ATOMS, source: 'rest_completion' });
}

const spec = INTERACTIONS.by_ear_match!;

function canonicalOf(inst: ReturnType<typeof instance>) {
  return inst.answer.canonical as { verdict: 'same' | 'different'; position: number | null };
}

function renderCard(inst: ReturnType<typeof instance>, response: ByEarMatchResponse, onResponseChange = jest.fn()) {
  const utils = render(
    <ByEarMatch
      instance={inst}
      response={response}
      graded={null}
      strand="rhythm"
      onResponseChange={onResponseChange}
      onPlayMusic={jest.fn()}
    />,
  );
  return { ...utils, onResponseChange };
}

describe('by_ear_match interaction — when the item may be graded', () => {
  test('AE3: "different" with no position chosen cannot be checked', () => {
    expect(spec.canCheck({ verdict: 'different', position: null })).toBe(false);
  });

  test('"same" is a complete answer on its own — there is nowhere to point', () => {
    expect(spec.canCheck({ verdict: 'same', position: null })).toBe(true);
  });

  test('choosing a position after "different" completes the answer', () => {
    expect(spec.canCheck({ verdict: 'different', position: 2 })).toBe(true);
  });

  test('an untouched card cannot be checked', () => {
    expect(spec.canCheck(spec.emptyResponse(instance()))).toBe(false);
    expect(spec.emptyResponse(instance())).toEqual(emptyByEarMatchResponse);
  });
});

describe('by_ear_match interaction — grading', () => {
  test('the right verdict AND the right position is correct', () => {
    const inst = instance(0);
    const { verdict, position } = canonicalOf(inst);
    expect(spec.grade(inst, { verdict, position })).toBe(true);
  });

  test('the right verdict with the wrong position is still wrong', () => {
    const inst = instance(0);
    const { verdict, position } = canonicalOf(inst);
    expect(verdict).toBe('different'); // else this case does not exist
    const other = (inst.interaction.config as { positions: number[] }).positions.find((p) => p !== position)!;
    expect(spec.grade(inst, { verdict, position: other })).toBe(false);
  });

  test('the wrong verdict is wrong however the position falls', () => {
    const inst = instance(0);
    expect(spec.grade(inst, { verdict: 'same', position: null })).toBe(false);
  });
});

describe('by_ear_match interaction — every wrong answer names a misconception', () => {
  test('answering "same" to an altered item resolves the "same" line', () => {
    const inst = instance(0);
    expect(canonicalOf(inst).verdict).toBe('different');
    const key = spec.selectedValue!(inst, { verdict: 'same', position: null }) as string;
    expect(key).toBe('same');
    expect(typeof inst.feedback.by_distractor?.[key]).toBe('string');
  });

  test('tapping an unaltered position resolves that position’s line', () => {
    const inst = instance(0);
    const { position } = canonicalOf(inst);
    const other = (inst.interaction.config as { positions: number[] }).positions.find((p) => p !== position)!;
    const key = spec.selectedValue!(inst, { verdict: 'different', position: other }) as string;
    expect(key).toBe(`pos:${other}`);
    expect(typeof inst.feedback.by_distractor?.[key]).toBe('string');
  });

  test('a correct answer has no misconception to name', () => {
    const inst = instance(0);
    const { verdict, position } = canonicalOf(inst);
    expect(spec.selectedValue!(inst, { verdict, position })).toBeUndefined();
  });

  test('every key selectedValue can return is a declared distractor', () => {
    for (let seed = 0; seed < 12; seed++) {
      const inst = instance(seed);
      const positions = (inst.interaction.config as { positions: number[] }).positions;
      const responses: ByEarMatchResponse[] = [
        { verdict: 'same', position: null },
        ...positions.map((p) => ({ verdict: 'different' as const, position: p })),
      ];
      for (const response of responses) {
        const key = spec.selectedValue!(inst, response);
        if (key === undefined) continue;
        expect(inst.distractors).toContain(key);
      }
    }
  });
});

describe('by_ear_match interaction — the card', () => {
  test('the position row appears only after "different" is chosen', () => {
    const { queryByTestId } = renderCard(instance(0), { verdict: null, position: null });
    expect(queryByTestId('by-ear-where')).toBeNull();
    const shown = renderCard(instance(0), { verdict: 'different', position: null });
    expect(shown.queryByTestId('by-ear-where')).not.toBeNull();
  });

  test('switching back to "same" clears the position, so no stale index is graded', () => {
    const { getByTestId, onResponseChange } = renderCard(instance(0), { verdict: 'different', position: 2 });
    fireEvent.press(getByTestId('by-ear-verdict-same'));
    expect(onResponseChange).toHaveBeenCalledWith({ verdict: 'same', position: null });
  });

  test('tapping a note cell records that position', () => {
    const inst = instance(0);
    const first = (inst.interaction.config as { positions: number[] }).positions[0];
    const { getByTestId, onResponseChange } = renderCard(inst, { verdict: 'different', position: null });
    fireEvent.press(getByTestId(`by-ear-position-${first}`));
    expect(onResponseChange).toHaveBeenCalledWith({ verdict: 'different', position: first });
  });

  test('the card carries its own play affordance, and it plays the ALTERED music', () => {
    const inst = instance(0);
    const onPlayMusic = jest.fn();
    const { getByTestId } = render(
      <ByEarMatch
        instance={inst}
        response={emptyByEarMatchResponse}
        graded={null}
        strand="rhythm"
        onResponseChange={jest.fn()}
        onPlayMusic={onPlayMusic}
      />,
    );
    fireEvent.press(getByTestId('by-ear-listen'));
    expect(onPlayMusic).toHaveBeenCalledWith((inst.interaction.config as { played_music: unknown }).played_music);
  });

  test('a graded card ignores further taps', () => {
    const inst = instance(0);
    const onResponseChange = jest.fn();
    const { getByTestId } = render(
      <ByEarMatch
        instance={inst}
        response={{ verdict: 'different', position: null }}
        graded={false}
        strand="rhythm"
        onResponseChange={onResponseChange}
        onPlayMusic={jest.fn()}
      />,
    );
    fireEvent.press(getByTestId('by-ear-verdict-same'));
    expect(onResponseChange).not.toHaveBeenCalled();
  });
});
