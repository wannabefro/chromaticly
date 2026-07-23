// U2 acceptance tests for level-path entries (design 3a). Free grade access
// (fyu.3): nothing on the map is locked — a collapsed (content-less) level shows
// a readiness chip, never a 🔒.

import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { Level } from '../../content/levels';
import { LevelNode } from './LevelNode';

const COLLAPSED_LEVEL: Level = {
  id: 'level-4',
  grade: 4,
  title: 'Grade 4',
  prerequisite: 'Clear the Level 3 exam to unlock',
  unitIds: [],
  examGate: { unlockAtStars: 0 },
};

const UNLOCKED_LEVEL: Level = {
  id: 'level-1',
  grade: 1,
  title: 'Grade 1',
  unitIds: ['a', 'b'],
  examGate: { unlockAtStars: 6 },
};

describe('LevelNode', () => {
  test('a collapsed (content-less) level shows its title and a readiness chip, no lock, and no children', () => {
    const { getByText, queryByText } = render(
      <LevelNode level={COLLAPSED_LEVEL} expanded={false} readinessNote="builds on L3" testID="level-node">
        <Text>should never render</Text>
      </LevelNode>,
    );

    expect(getByText('Grade 4')).toBeTruthy();
    expect(getByText('builds on L3')).toBeTruthy();
    expect(queryByText('🔒')).toBeNull();
    expect(queryByText('should never render')).toBeNull();
  });

  test('an expanded level shows the unit summary and renders its children', () => {
    const { getByText } = render(
      <LevelNode
        level={UNLOCKED_LEVEL}
        expanded
        summary={{ doneCount: 1, total: 2 }}
        accentHue="#f0666f"
      >
        <Text>unit rows go here</Text>
      </LevelNode>,
    );

    expect(getByText('Grade 1')).toBeTruthy();
    expect(getByText('1 of 2 units · in progress')).toBeTruthy();
    expect(getByText('unit rows go here')).toBeTruthy();
  });

  // Design 3a: "tapping [a level] starts it, which is also how you switch grades" —
  // the header is a level-wide start affordance when `onStart` is given.
  test('an expanded level with onStart makes the header a tappable start affordance', () => {
    const onStart = jest.fn();
    const { getByTestId } = render(
      <LevelNode
        level={UNLOCKED_LEVEL}
        expanded
        onStart={onStart}
        startTestID="level-tap-1"
        testID="level-node"
      >
        <Text>unit rows go here</Text>
      </LevelNode>,
    );

    fireEvent.press(getByTestId('level-tap-1'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  test('an expanded level without onStart keeps the header inert', () => {
    const { getByTestId } = render(
      <LevelNode level={UNLOCKED_LEVEL} expanded testID="level-node">
        <Text>unit rows go here</Text>
      </LevelNode>,
    );

    const header = getByTestId('level-node-header');
    expect(header.props.onPress).toBeUndefined();
  });
});
