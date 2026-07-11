// U3 acceptance tests for the mastery-gems row.

import { render } from '@testing-library/react-native';

import { MasteryGems } from './MasteryGems';

describe('MasteryGems', () => {
  // Invariant: one gem renders per item — the row must track the full 8-item
  // set exactly, or the set-complete payoff misrepresents the result.
  test('renders one gem per item', () => {
    const items = ['clean', 'clean', 'hinted', 'clean', 'missed', 'clean'] as const;
    const { getByTestId } = render(<MasteryGems items={[...items]} hue="#2fbfae" />);

    items.forEach((state, index) => {
      expect(getByTestId(`gem-${index}-${state}`)).toBeTruthy();
    });
  });

  // Invariant: a missed gem must be distinguishable from clean/hinted (it is
  // never rendered with the strand hue) — colour-vision-safety depends on this.
  test('a missed gem is visually distinct from clean and hinted gems', () => {
    const { getByTestId } = render(<MasteryGems items={['clean', 'hinted', 'missed']} />);

    const clean = getByTestId('gem-0-clean');
    const hinted = getByTestId('gem-1-hinted');
    const missed = getByTestId('gem-2-missed');

    const flatten = (style: unknown) =>
      Object.assign({}, ...(Array.isArray(style) ? style : [style]));

    expect(flatten(missed.props.style).borderColor).not.toBe(flatten(clean.props.style).borderColor);
    expect(flatten(missed.props.style).borderColor).not.toBe(flatten(hinted.props.style).borderColor);
  });

  test('applies the parent testID', () => {
    const { getByTestId } = render(<MasteryGems items={['clean']} testID="set-gems" />);

    expect(getByTestId('set-gems')).toBeTruthy();
  });
});
