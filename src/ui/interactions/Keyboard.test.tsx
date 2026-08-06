// keyboard_tap (design 5e). The load-bearing assertions are the two the design
// states as numbers — 1.5 octaves, and white keys at or above the 44pt tap
// minimum — plus the black-key pattern, which is not decoration here: the
// two-then-three grouping IS what First steps lesson 3 teaches.

import { fireEvent, render } from '@testing-library/react-native';

// registry.tsx reaches NotationCard -> MusicSurface -> the native WebView module.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef(() => null) };
});

import type { ExerciseInstance } from '../../engine/schema';
import { BLACK_KEYS, BLACK_KEY_WIDTH, KeyboardView, WHITE_KEYS, WHITE_KEY_WIDTH } from './Keyboard';
import { INTERACTIONS, lookupInteraction } from './registry';

/** The phone width design 5e sizes the keyboard for. */
const NARROW_SCREEN_PT = 360;

function instance(canonical = 'D4'): ExerciseInstance {
  return {
    id: 'keyboard_find:0:0',
    template_id: 'keyboard_find',
    grade: 0,
    strand: 'pitch',
    prompt: 'Find D on the keyboard.',
    stimulus: { music: null, text: 'D' },
    interaction: { type: 'keyboard_tap', config: {} },
    answer: { canonical, accepted_alternatives: [] },
    distractors: [],
    hints: [],
    feedback: { correct: 'That is D.', incorrect: 'D sits between the two black keys.' },
    srs_tags: ['keyboard:D'],
    kb_version: '1',
  } as ExerciseInstance;
}

const spec = INTERACTIONS.keyboard_tap!;

describe('keyboard geometry — the numbers design 5e states', () => {
  test('it spans 1.5 octaves: 11 white keys, C4 to F5', () => {
    expect(WHITE_KEYS).toHaveLength(11);
    expect(WHITE_KEYS[0]).toBe('C4');
    expect(WHITE_KEYS[WHITE_KEYS.length - 1]).toBe('F5');
  });

  // The boundary itself, not a value inside it. 5e: "white keys >= 44px wide".
  test('a white key is at least 44pt wide, and a black key is narrower', () => {
    expect(WHITE_KEY_WIDTH).toBeGreaterThanOrEqual(44);
    expect(BLACK_KEY_WIDTH).toBeLessThan(WHITE_KEY_WIDTH);
  });

  // This is why 5e says "swipe to scroll octaves" — the keyboard cannot fit, so
  // the scroll is structural rather than a nicety.
  test('the full span cannot fit a 360pt screen, so it must scroll', () => {
    expect(WHITE_KEYS.length * WHITE_KEY_WIDTH).toBeGreaterThan(NARROW_SCREEN_PT);
  });

  // The subject of lesson 3. A wrong grouping would misteach it.
  test('the black keys group two, then three, then two', () => {
    const groups: number[] = [];
    let run = 0;
    let previous = -2;
    for (const { after } of BLACK_KEYS) {
      if (after === previous + 1) run += 1;
      else {
        if (run) groups.push(run);
        run = 1;
      }
      previous = after;
    }
    groups.push(run);
    expect(groups).toEqual([2, 3, 2]);
    expect(BLACK_KEYS).toHaveLength(7);
  });

  test('no black key follows E or B — the gap is the pattern', () => {
    const afters = BLACK_KEYS.map((b) => b.after);
    expect(afters).not.toContain(WHITE_KEYS.indexOf('E4'));
    expect(afters).not.toContain(WHITE_KEYS.indexOf('B4'));
    expect(afters).not.toContain(WHITE_KEYS.indexOf('E5'));
  });
});

describe('keyboard card — tapping answers the question', () => {
  test('tapping a white key reports that pitch', () => {
    const onResponseChange = jest.fn();
    const { getByTestId } = render(<KeyboardView selected={null} strand="pitch" onSelect={onResponseChange} />);

    fireEvent.press(getByTestId('key-D4'));

    expect(onResponseChange).toHaveBeenCalledWith('D4');
  });

  test('tapping a black key reports that pitch too', () => {
    const onResponseChange = jest.fn();
    const { getByTestId } = render(<KeyboardView selected={null} strand="pitch" onSelect={onResponseChange} />);

    fireEvent.press(getByTestId('key-F#4'));

    expect(onResponseChange).toHaveBeenCalledWith('F#4');
  });

  test('every key in the span is tappable and carries its pitch as its label', () => {
    const { getByTestId } = render(<KeyboardView selected={null} strand="pitch" onSelect={jest.fn()} />);
    for (const pitch of [...WHITE_KEYS, ...BLACK_KEYS.map((b) => b.pitch)]) {
      expect(getByTestId(`key-${pitch}`).props.accessibilityLabel).toBe(pitch);
    }
  });

  // The read-only variant is what the feedback sheet renders. A learner must not
  // be able to change their answer from the sheet that is marking it.
  test('with no onSelect the keys are inert', () => {
    const { getByTestId } = render(<KeyboardView selected="D4" strand="pitch" />);
    expect(getByTestId('key-D4').props.accessibilityState?.disabled).toBe(true);
  });
});

describe('keyboard_tap spec — registered, checked, and revealed', () => {
  test('lookupInteraction resolves it rather than throwing', () => {
    expect(lookupInteraction('keyboard_tap')).toBe(spec);
  });

  test('Check is disabled before any tap and enabled after one', () => {
    expect(spec.canCheck(null)).toBe(false);
    expect(spec.canCheck('D4')).toBe(true);
  });

  test('only the canonical pitch grades correct', () => {
    const inst = instance('D4');
    expect(spec.grade(inst, 'D4')).toBe(true);
    expect(spec.grade(inst, 'E4')).toBe(false);
    expect(spec.grade(inst, 'D5')).toBe(false); // right letter, wrong octave
  });

  test('an unanswered response grades false rather than throwing', () => {
    expect(spec.grade(instance(), null)).toBe(false);
  });

  // 5e: "correct key highlighted after Check".
  test('the correct-answer view lights the canonical key and no other', () => {
    const { getByTestId } = render(<>{spec.correctAnswerView(instance('D4'))}</>);
    const lit = getByTestId('key-D4').props.style.flat().filter(Boolean);
    const unlit = getByTestId('key-E4').props.style.flat().filter(Boolean);
    expect(JSON.stringify(lit)).not.toEqual(JSON.stringify(unlit));
  });

  test('it uses the shared Check button and is not self-graded', () => {
    expect(spec.submits).toBe(true);
    const { SELF_GRADED_INTERACTIONS } = require('../../engine/schema');
    expect(SELF_GRADED_INTERACTIONS.has('keyboard_tap')).toBe(false);
  });
});
