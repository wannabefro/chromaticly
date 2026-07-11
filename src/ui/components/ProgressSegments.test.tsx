// U3 acceptance tests for the segmented progress bar.

import { render } from '@testing-library/react-native';

import { ProgressSegments } from './ProgressSegments';

describe('ProgressSegments', () => {
  // Invariant: one segment renders per state entry — the bar must track item
  // count exactly, or the header misrepresents progress through the set.
  test('renders one segment per state entry', () => {
    const states = ['done', 'done', 'incorrect', 'current', 'todo', 'todo', 'todo', 'todo'] as const;
    const { getByTestId } = render(<ProgressSegments states={[...states]} strand="pitch" />);

    states.forEach((_, index) => {
      expect(getByTestId(`segment-${index}`)).toBeTruthy();
    });
  });

  test('renders no segments for an empty states array', () => {
    const { queryByTestId } = render(<ProgressSegments states={[]} />);

    expect(queryByTestId('segment-0')).toBeNull();
  });

  test('applies the parent testID', () => {
    const { getByTestId } = render(<ProgressSegments states={['todo']} testID="set-progress" />);

    expect(getByTestId('set-progress')).toBeTruthy();
  });
});
