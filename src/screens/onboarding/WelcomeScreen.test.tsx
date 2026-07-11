// U9 acceptance test for Welcome (6a): guest is the primary, functional path;
// sign-in is present but inert this slice (R1).

import { fireEvent, render } from '@testing-library/react-native';

import { WelcomeScreen } from './WelcomeScreen';

describe('WelcomeScreen — guest is the primary path, sign-in is non-functional (R1)', () => {
  test('renders the welcome screen and fires onStart from "Start learning"', () => {
    const onStart = jest.fn();
    const { getByTestId } = render(<WelcomeScreen onStart={onStart} />);

    expect(getByTestId('welcome-screen')).toBeTruthy();
    fireEvent.press(getByTestId('start-learning'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  test('sign-in buttons are disabled and never fire', () => {
    const onStart = jest.fn();
    const { getByTestId } = render(<WelcomeScreen onStart={onStart} />);

    for (const testID of ['signin-apple', 'signin-google', 'signin-email']) {
      const button = getByTestId(testID);
      expect(button.props.accessibilityState?.disabled).toBe(true);
      fireEvent.press(button);
    }
    expect(onStart).not.toHaveBeenCalled();
  });
});
