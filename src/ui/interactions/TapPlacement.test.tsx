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

// Stage 2 (chromaticly-51o): the tap lands in the score, and the paper draws it.
describe('tapPlacementSpec — the in-score gap protocol', () => {
  test('it asks for the gap zones, so no other template gets them', () => {
    expect(spec().usesSurfaceGaps).toBe(true);
    expect(lookupInteraction('mcq').usesSurfaceGaps).toBeUndefined();
    expect(lookupInteraction('find_the_bar').usesSurfaceGaps).toBeUndefined();
  });

  test('a gap tap in the score toggles exactly as a strip tap does', () => {
    expect(spec().onSurfaceGapTap!(4, [])).toEqual(toggleBarline([], 4));
    expect(spec().onSurfaceGapTap!(4, [4])).toEqual([]);
    expect(spec().onSurfaceGapTap!(2, [9])).toEqual([2, 9]);
  });

  test('before grading the paper draws what was placed and marks nothing', () => {
    const inst = instance();
    expect(spec().surfaceBarlines!(inst, [3, 7], null)).toEqual({
      gaps: [3, 7],
      marks: { wrong: [], missed: [] },
    });
  });

  // Ruling 3: the learner's wrong line AND the one they missed, together.
  test('after grading it marks the wrong lines and the missed ones separately', () => {
    const inst = instance();
    const answer = inst.answer.canonical as number[];
    const response = [answer[0], answer[1] + 1];
    const drawn = spec().surfaceBarlines!(inst, response, false);
    expect(drawn.gaps).toEqual(response);
    expect(drawn.marks.wrong).toEqual([answer[1] + 1]);
    expect(drawn.marks.missed).toEqual(answer.slice(1));
  });

  test('a fully correct answer marks nothing wrong and nothing missed', () => {
    const inst = instance();
    const drawn = spec().surfaceBarlines!(inst, inst.answer.canonical as number[], true);
    expect(drawn.marks).toEqual({ wrong: [], missed: [] });
  });
});
