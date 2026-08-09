// U2 acceptance tests for the unit row (design 3a).

import { fireEvent, render } from '@testing-library/react-native';

import { UnitRow } from './UnitRow';

describe('UnitRow', () => {
  // Rule 3: strand colour is always paired with a glyph/label — never colour alone.
  test('shows the strand glyph and label alongside the title', () => {
    const { getByText } = render(
      <UnitRow strand="rhythm" title="Note values and rhythm sums" stars={0} state="active" />,
    );

    expect(getByText('Rhythm')).toBeTruthy();
    expect(getByText('𝅘𝅥')).toBeTruthy();
    expect(getByText('Note values and rhythm sums')).toBeTruthy();
  });

  test('a fully-mastered unit renders 3 filled stars', () => {
    const { getByTestId } = render(
      <UnitRow strand="pitch" title="Reading notes" stars={3} state="done" testID="unit-row" />,
    );

    expect(getByTestId('unit-row-stars')).toBeTruthy();
    expect(getByTestId('unit-row-stars-star-0-filled')).toBeTruthy();
    expect(getByTestId('unit-row-stars-star-1-filled')).toBeTruthy();
    expect(getByTestId('unit-row-stars-star-2-filled')).toBeTruthy();
  });

  // A 2★ unit shows 2 filled + 1 empty — the meter reflects `stars` exactly,
  // not a rounded-up or rounded-down approximation.
  test('a 2-star unit shows 2 filled stars and 1 empty star', () => {
    const { getByTestId, queryByTestId } = render(
      <UnitRow strand="pitch" title="Reading notes" stars={2} state="started" testID="unit-row" />,
    );

    expect(getByTestId('unit-row-stars-star-0-filled')).toBeTruthy();
    expect(getByTestId('unit-row-stars-star-1-filled')).toBeTruthy();
    expect(getByTestId('unit-row-stars-star-2-empty')).toBeTruthy();
    expect(queryByTestId('unit-row-stars-star-2-filled')).toBeNull();
  });

  test('a partial (1-star) unit shows the derived star count, not a full 3', () => {
    const { getByTestId, queryByTestId } = render(
      <UnitRow strand="pitch" title="Reading notes" stars={1} state="started" testID="unit-row" />,
    );

    expect(getByTestId('unit-row-stars-star-0-filled')).toBeTruthy();
    expect(getByTestId('unit-row-stars-star-1-empty')).toBeTruthy();
    expect(getByTestId('unit-row-stars-star-2-empty')).toBeTruthy();
    expect(queryByTestId('unit-row-stars-star-1-filled')).toBeNull();
  });

  // R2 (G6 U3): there is no locked variant left. Every row is enterable, and none
  // carries a 🔒 or a "finish X to unlock" note — the advisory prerequisite chip
  // that replaces that affordance is a separate component (PrereqChip).
  test('every state fires onPress when tapped, and none renders a lock affordance', () => {
    for (const state of ['active', 'started', 'done'] as const) {
      const onPress = jest.fn();
      const { getByTestId, queryByText, unmount } = render(
        <UnitRow strand="rhythm" title="Rhythm" stars={0} state={state} onPress={onPress} testID="unit-row" />,
      );

      expect(queryByText('🔒')).toBeNull();
      expect(queryByText(/to unlock$/)).toBeNull();

      fireEvent.press(getByTestId('unit-row'));
      expect(onPress).toHaveBeenCalledTimes(1);
      unmount();
    }
  });
});
