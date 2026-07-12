// Landed (design step 6): the "3 for 3" payoff + both hand-off CTAs (R6).

import { fireEvent, render } from '@testing-library/react-native';

import { LandedScreen } from './LandedScreen';

describe('LandedScreen — the first-point payoff and hand-off (R6)', () => {
  test('renders the "3 for 3" copy and both CTAs', () => {
    const { getByTestId, getByText } = render(
      <LandedScreen onContinue={jest.fn()} onExplore={jest.fn()} />,
    );

    expect(getByTestId('landed-screen')).toBeTruthy();
    expect(getByText("You're in. 3 for 3.")).toBeTruthy();
    expect(getByTestId('landed-continue')).toBeTruthy();
    expect(getByTestId('landed-explore')).toBeTruthy();
  });

  test('Continue and Explore each fire their handler', () => {
    const onContinue = jest.fn();
    const onExplore = jest.fn();
    const { getByTestId } = render(<LandedScreen onContinue={onContinue} onExplore={onExplore} />);

    fireEvent.press(getByTestId('landed-continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('landed-explore'));
    expect(onExplore).toHaveBeenCalledTimes(1);
  });
});
