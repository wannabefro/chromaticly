// tap_placement (chromaticly-51o). The rules that came out of the design ruling:
// tap toggles, order never matters, and marking shows both what the learner put
// and what they missed.

// registry.tsx pulls in NotationCard -> MusicSurface -> react-native-webview,
// which has no native module under jest. Mocked as registry.test.ts does.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { fireEvent, render } from '@testing-library/react-native';

import { generate } from '../../engine/generators';
import { lookupInteraction } from './registry';
import { TapPlacement, noteCount, noteGlyphs, toggleBarline, type TapPlacementResponse } from './TapPlacement';

const ATOMS = ['add_barlines:2/4', 'add_barlines:3/4', 'add_barlines:4/4'];
const instance = () => generate('add_barlines', { grade: 1, seed: 0, atoms: ATOMS });

const spec = () => lookupInteraction('tap_placement');

describe('tapPlacementSpec — grading is set equality (the template spec)', () => {
  test('the same positions in any order grade correct', () => {
    const inst = instance();
    const answer = inst.answer.canonical as number[];
    expect(spec().grade(inst, [...answer])).toBe(true);
    expect(spec().grade(inst, [...answer].reverse())).toBe(true);
  });

  test('one extra bar-line is wrong, and so is one missing', () => {
    const inst = instance();
    const answer = inst.answer.canonical as number[];
    expect(spec().grade(inst, [...answer, answer[0] + 1])).toBe(false);
    expect(spec().grade(inst, answer.slice(1))).toBe(false);
  });

  test('an empty response cannot be checked', () => {
    expect(spec().canCheck([])).toBe(false);
    expect(spec().canCheck([2])).toBe(true);
  });

  test('the empty response is empty, so a new item starts blank', () => {
    expect(spec().emptyResponse(instance())).toEqual([]);
  });

  test('the check label counts what is placed', () => {
    const inst = instance();
    expect(spec().checkLabel!(inst, [])).toBe('Check');
    expect(spec().checkLabel!(inst, [3, 5])).toBe('Check — 2 placed');
  });
});

// Ruling 1: tap again to remove. The gap has one behaviour whether or not a
// line is in it.
describe('toggleBarline', () => {
  test('a tap places, and a second tap on the same gap removes', () => {
    expect(toggleBarline([], 4)).toEqual([4]);
    expect(toggleBarline([4], 4)).toEqual([]);
  });

  test('positions stay ascending however they were tapped', () => {
    expect(toggleBarline(toggleBarline([9], 2), 5)).toEqual([2, 5, 9]);
  });
});

describe('TapPlacement component', () => {
  const strand = 'rhythm' as const;

  test('a gap exists after every note but the last', () => {
    const inst = instance();
    const { queryByTestId } = render(
      <TapPlacement instance={inst} response={[]} graded={null} strand={strand} onResponseChange={() => {}} />,
    );
    const total = noteCount(inst);
    for (let at = 1; at < total; at++) expect(queryByTestId(`gap-${at}`)).not.toBeNull();
    expect(queryByTestId(`gap-${total}`)).toBeNull();
  });

  test('tapping a gap reports the toggled positions upward', () => {
    const inst = instance();
    let reported: TapPlacementResponse = [];
    const { getByTestId } = render(
      <TapPlacement instance={inst} response={[]} graded={null} strand={strand} onResponseChange={(r) => { reported = r; }} />,
    );
    fireEvent.press(getByTestId('gap-3'));
    expect(reported).toEqual([3]);
  });

  test('a graded item accepts no more taps', () => {
    const inst = instance();
    let reported: TapPlacementResponse | null = null;
    const { getByTestId } = render(
      <TapPlacement instance={inst} response={[2]} graded={false} strand={strand} onResponseChange={(r) => { reported = r; }} />,
    );
    fireEvent.press(getByTestId('gap-3'));
    expect(reported).toBeNull();
  });

  test('the strip shows the drawn rhythm, one glyph per note', () => {
    const inst = instance();
    expect(noteGlyphs(inst)).toHaveLength(noteCount(inst));
  });

  test('a missing note count throws rather than rendering an unanswerable strip', () => {
    const inst = instance();
    inst.interaction.config = {};
    expect(() => noteCount(inst)).toThrow(/config.notes/);
  });
});
