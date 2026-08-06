// Landed (design step 6): the "3 for 3" payoff + both hand-off CTAs (R6).

import { fireEvent, render } from '@testing-library/react-native';

import { LandedScreen } from './LandedScreen';
import { type GemState } from '../../ui/components/MasteryGems';

const CLEAN: GemState[] = ['clean', 'clean', 'clean'];

describe('LandedScreen — the first-point payoff and hand-off (R6)', () => {
  test('renders the "3 for 3" copy and both CTAs', () => {
    const { getByTestId, getByText } = render(
      <LandedScreen onContinue={jest.fn()} onExplore={jest.fn()} gems={CLEAN} />,
    );

    expect(getByTestId('landed-screen')).toBeTruthy();
    expect(getByText("You're in. 3 for 3.")).toBeTruthy();
    expect(getByTestId('landed-continue')).toBeTruthy();
    expect(getByTestId('landed-explore')).toBeTruthy();
  });

  // The copy said "your first Rhythm point is on the board" and nothing showed it.
  test('shows one gem per warm-up item, and a retried item is not clean', () => {
    const { getByTestId } = render(
      <LandedScreen onContinue={jest.fn()} onExplore={jest.fn()} gems={['clean', 'hinted', 'clean']} />,
    );

    expect(getByTestId('landed-gems')).toBeTruthy();
    expect(getByTestId('gem-1-hinted')).toBeTruthy();
  });

  test('Continue and Explore each fire their handler', () => {
    const onContinue = jest.fn();
    const onExplore = jest.fn();
    const { getByTestId } = render(
      <LandedScreen onContinue={onContinue} onExplore={onExplore} gems={CLEAN} />,
    );

    fireEvent.press(getByTestId('landed-continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('landed-explore'));
    expect(onExplore).toHaveBeenCalledTimes(1);
  });
});
