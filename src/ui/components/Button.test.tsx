// U2 acceptance tests for the CTA button (design/components/core/Button.prompt.md).

import { fireEvent, render } from '@testing-library/react-native';

import { Button } from './Button';

describe('Button', () => {
  test('renders its label', () => {
    const { getByText } = render(<Button label="Check" onPress={jest.fn()} />);
    expect(getByText('Check')).toBeTruthy();
  });

  test('fires onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<Button label="Check" onPress={onPress} testID="cta" />);

    fireEvent.press(getByTestId('cta'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('disabled is the pre-selection state — it does not fire onPress', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Button label="Check" onPress={onPress} disabled testID="cta" />,
    );

    fireEvent.press(getByTestId('cta'));

    expect(onPress).not.toHaveBeenCalled();
  });

  test('secondary variant renders text-only (no fill)', () => {
    const { getByTestId } = render(
      <Button label="Review 1 mistake" variant="secondary" testID="cta" />,
    );

    const button = getByTestId('cta');
    const flatStyle = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style)
      : button.props.style;

    expect(flatStyle.backgroundColor).toBe('transparent');
  });
});
