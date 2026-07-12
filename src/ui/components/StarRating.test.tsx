// U2 fix acceptance tests for the 0-3★ unit-mastery meter (design 3a).

import { render } from '@testing-library/react-native';

import { StarRating } from './StarRating';

function flatten(style: unknown) {
  return Object.assign({}, ...(Array.isArray(style) ? style : [style]));
}

describe('StarRating', () => {
  // Invariant: the meter always shows exactly `max` positions, `filled` of
  // them lit — a 2-star unit renders 2 filled + 1 empty, never fewer stars.
  test('renders `filled` filled stars and the remainder empty, out of `max`', () => {
    const { getByTestId } = render(<StarRating filled={2} testID="rating" />);

    expect(getByTestId('rating-star-0-filled')).toBeTruthy();
    expect(getByTestId('rating-star-1-filled')).toBeTruthy();
    expect(getByTestId('rating-star-2-empty')).toBeTruthy();
  });

  test('0 filled -> all three empty', () => {
    const { getByTestId } = render(<StarRating filled={0} testID="rating" />);

    expect(getByTestId('rating-star-0-empty')).toBeTruthy();
    expect(getByTestId('rating-star-1-empty')).toBeTruthy();
    expect(getByTestId('rating-star-2-empty')).toBeTruthy();
  });

  test('3 filled -> all three filled', () => {
    const { getByTestId } = render(<StarRating filled={3} testID="rating" />);

    expect(getByTestId('rating-star-0-filled')).toBeTruthy();
    expect(getByTestId('rating-star-1-filled')).toBeTruthy();
    expect(getByTestId('rating-star-2-filled')).toBeTruthy();
  });

  // Invariant: a filled star must be visually distinct from an empty one
  // (design 3a: filled stars are amber, empty stars are the same amber dimmed) —
  // magnitude is carried by opacity, not hue, so both keep the single `--hint`
  // token and an empty star reads as a dim warm star rather than a cool neutral.
  test('a filled star is visually distinct (dimmer) from an empty star', () => {
    const { getByTestId } = render(<StarRating filled={1} testID="rating" />);

    const filled = flatten(getByTestId('rating-star-0-filled').props.style);
    const empty = flatten(getByTestId('rating-star-1-empty').props.style);

    // Same amber hue, distinguished by opacity — empty is dimmer.
    expect(filled.color).toBe(empty.color);
    expect(empty.opacity).toBeLessThan(filled.opacity ?? 1);
  });
});
