// Your plan (design step 3): three model-setting cards + the warm-up hand-off (R3).

import { fireEvent, render } from '@testing-library/react-native';

import { PlanScreen } from './PlanScreen';

describe('PlanScreen — sets the mental model, then funnels to the warm-up (R3)', () => {
  test('renders the three plan cards, the warm-up block, and the grade in the copy', () => {
    const { getByTestId, getByText } = render(<PlanScreen grade={1} onStartWarmUp={jest.fn()} />);

    expect(getByTestId('plan-screen')).toBeTruthy();
    expect(getByText("Here's how Grade 1 works")).toBeTruthy();
    expect(getByText('Short lessons')).toBeTruthy();
    expect(getByText('Quick exercises')).toBeTruthy();
    expect(getByText('A real practice exam')).toBeTruthy();
    expect(getByText('Note values warm-up')).toBeTruthy();
  });

  test('"Try your first question" starts the warm-up', () => {
    const onStartWarmUp = jest.fn();
    const { getByTestId } = render(<PlanScreen grade={1} onStartWarmUp={onStartWarmUp} />);

    fireEvent.press(getByTestId('plan-start-warmup'));
    expect(onStartWarmUp).toHaveBeenCalledTimes(1);
  });
});
