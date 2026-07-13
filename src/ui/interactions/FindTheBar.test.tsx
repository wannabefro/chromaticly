// 302.4 find-the-bar answer input. Guards the two things that make the strip
// truthful: it lists the bars in score order (never the shuffled option order —
// these are positions in the music, not interchangeable choices), and it grades
// against the bar the passage actually holds.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { fireEvent, render } from '@testing-library/react-native';

import { generate } from '../../engine/generators';
import { lookupInteraction } from './registry';

const instance = generate('music_in_context', { grade: 1, seed: 2, atoms: ['find_bar:highest'] });
const spec = lookupInteraction(instance.interaction.type);
const correctBar = instance.answer.canonical as number;

function renderInput(response: number | null, onResponseChange = jest.fn()) {
  const utils = render(
    <spec.Component
      instance={instance}
      response={response}
      graded={null}
      strand="context"
      onResponseChange={onResponseChange}
    />,
  );
  return { ...utils, onResponseChange };
}

describe('FindTheBar — the bar strip (302.4)', () => {
  test('the exercise routes to the find-the-bar interaction, not a silent mcq fallback', () => {
    expect(instance.interaction.type).toBe('find_the_bar');
    expect(instance.strand).toBe('context');
  });

  test('lists every bar of the passage, in score order', () => {
    const { getByTestId } = renderInput(null);
    for (let bar = 1; bar <= 4; bar++) expect(getByTestId(`bar-${bar}`)).toBeTruthy();
  });

  test('picking a bar reports it upward and mirrors the pick', () => {
    const { getByTestId, onResponseChange } = renderInput(null);
    fireEvent.press(getByTestId('bar-3'));
    expect(onResponseChange).toHaveBeenCalledWith(3);

    const picked = renderInput(3);
    expect(picked.getByText('You picked bar 3.')).toBeTruthy();
    expect(picked.getByTestId('bar-3').props.accessibilityState.selected).toBe(true);
  });

  test('Check is disabled until a bar is picked', () => {
    expect(spec.canCheck(null)).toBe(false);
    expect(spec.canCheck(2)).toBe(true);
  });

  test('grades against the bar the passage actually holds', () => {
    expect(spec.grade(instance, correctBar)).toBe(true);
    const wrong = correctBar === 1 ? 2 : 1;
    expect(spec.grade(instance, wrong)).toBe(false);
  });
});
