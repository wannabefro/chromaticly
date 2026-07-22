// U2 acceptance tests for the play affordance (design/components/core/
// PlayButton.prompt.md, never-violate rule 2: every notation display carries a
// play affordance — solid triangle in a circle).

import { fireEvent, render } from '@testing-library/react-native';

import { PlayButton } from './PlayButton';

describe('PlayButton', () => {
  test('renders with the given testID', () => {
    const { getByTestId } = render(<PlayButton testID="play" onPress={jest.fn()} />);
    expect(getByTestId('play')).toBeTruthy();
  });

  test('fires onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<PlayButton testID="play" onPress={onPress} />);

    fireEvent.press(getByTestId('play'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // D9: the transposition answer card's play is disabled until there's an
  // answer to hear — disabled must actually suppress the press, not just look dim.
  test('disabled suppresses onPress', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<PlayButton testID="play" disabled onPress={onPress} />);

    expect(getByTestId('play').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(getByTestId('play'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
