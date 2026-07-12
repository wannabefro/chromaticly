// U5 acceptance tests for the per-bar true/false tick-cross interaction. No
// dedicated Grade 1 design mockup exists for this presentation (see the filed
// design bd issue) — these tests pin the derived state machine (selected while
// answering, correct/incorrect once graded) rather than any visual spec.

import { fireEvent, render } from '@testing-library/react-native';

import type { ExerciseInstance } from '../../engine/schema';
import { colors } from '../theme';
import { TrueFalse, type TrueFalseResponse } from './TrueFalse';

const instance: ExerciseInstance = {
  id: 'test-bar-validity-1',
  template_id: 'bar_validity',
  grade: 1,
  strand: 'rhythm',
  prompt: 'Does each bar add up to 4/4? Tick the bars that are correct.',
  stimulus: { music: null, text: null },
  interaction: {
    type: 'true_false',
    config: { bars: [{ start: 0, end: 1 }, { start: 1, end: 3 }, { start: 3, end: 5 }] },
  },
  answer: { canonical: [true, false, true], accepted_alternatives: [], per_item: [true, false, true] },
  distractors: [],
  hints: [],
  feedback: { correct: 'Correct!', incorrect: 'Not quite.' },
  srs_tags: ['bar_validity'],
  kb_version: 'test',
};

function flatStyle(el: { props: { style?: unknown } }): Record<string, unknown> {
  const style = el.props.style;
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>) ?? {};
}

describe('TrueFalse — one tick/cross control pair per bar (bar-identity metadata, not geometry)', () => {
  test('renders exactly one bar group per interaction.config.bars entry', () => {
    const response: TrueFalseResponse = [null, null, null];
    const { getByTestId } = render(
      <TrueFalse instance={instance} response={response} graded={null} strand="rhythm" onResponseChange={jest.fn()} />,
    );
    expect(getByTestId('bar-0')).toBeTruthy();
    expect(getByTestId('bar-1')).toBeTruthy();
    expect(getByTestId('bar-2')).toBeTruthy();
  });
});

describe('TrueFalse — responding, while unanswered', () => {
  test('pressing tick on a bar reports that bar set true, leaving the others untouched', () => {
    const onResponseChange = jest.fn();
    const response: TrueFalseResponse = [null, null, null];
    const { getByTestId } = render(
      <TrueFalse instance={instance} response={response} graded={null} strand="rhythm" onResponseChange={onResponseChange} />,
    );

    fireEvent.press(getByTestId('bar-1-true'));

    expect(onResponseChange).toHaveBeenCalledWith([null, true, null]);
  });

  test('pressing cross on a bar reports that bar set false', () => {
    const onResponseChange = jest.fn();
    const response: TrueFalseResponse = [null, null, null];
    const { getByTestId } = render(
      <TrueFalse instance={instance} response={response} graded={null} strand="rhythm" onResponseChange={onResponseChange} />,
    );

    fireEvent.press(getByTestId('bar-2-false'));

    expect(onResponseChange).toHaveBeenCalledWith([null, null, false]);
  });

  test('once graded, pressing a toggle no longer reports a response change (locked)', () => {
    const onResponseChange = jest.fn();
    const response: TrueFalseResponse = [true, false, true];
    const { getByTestId } = render(
      <TrueFalse instance={instance} response={response} graded={true} strand="rhythm" onResponseChange={onResponseChange} />,
    );

    fireEvent.press(getByTestId('bar-0-false'));

    expect(onResponseChange).not.toHaveBeenCalled();
  });
});

describe('TrueFalse — graded state highlights the correct verdict and any wrong pick', () => {
  test('a fully correct attempt shows every bar\'s matching control in the correct colour', () => {
    const response: TrueFalseResponse = [true, false, true]; // matches per_item exactly
    const { getByTestId } = render(
      <TrueFalse instance={instance} response={response} graded={true} strand="rhythm" onResponseChange={jest.fn()} />,
    );

    expect(flatStyle(getByTestId('bar-0-true')).borderColor).toBe(colors.correct);
    expect(flatStyle(getByTestId('bar-1-false')).borderColor).toBe(colors.correct);
    expect(flatStyle(getByTestId('bar-2-true')).borderColor).toBe(colors.correct);
  });

  test('a wrong pick is marked incorrect while the correct verdict is still marked correct', () => {
    // bar 0's correct verdict is true, but the learner picked false.
    const response: TrueFalseResponse = [false, false, true];
    const { getByTestId } = render(
      <TrueFalse instance={instance} response={response} graded={false} strand="rhythm" onResponseChange={jest.fn()} />,
    );

    expect(flatStyle(getByTestId('bar-0-false')).borderColor).toBe(colors.incorrect);
    expect(flatStyle(getByTestId('bar-0-true')).borderColor).toBe(colors.correct);
  });
});
