// U2 acceptance tests for level-path entries (design 3a).

import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { Level } from '../../content/levels';
import { LevelNode } from './LevelNode';

const LOCKED_LEVEL: Level = {
  id: 'level-2',
  grade: 2,
  title: 'Grade 2',
  unlocked: false,
  prerequisite: 'Clear the Level 1 exam to unlock',
  unitIds: [],
  examGate: { unlockAtStars: 0 },
};

const UNLOCKED_LEVEL: Level = {
  id: 'level-1',
  grade: 1,
  title: 'Grade 1',
  unlocked: true,
  unitIds: ['a', 'b'],
  examGate: { unlockAtStars: 6 },
};

describe('LevelNode', () => {
  // R1/R4: locked levels (2-5) show the prerequisite reason and no unit content.
  test('a locked level shows its title and prerequisite copy, with no children rendered', () => {
    const { getByText, queryByText } = render(
      <LevelNode level={LOCKED_LEVEL} expanded={false} testID="level-node">
        <Text>should never render</Text>
      </LevelNode>,
    );

    expect(getByText('Grade 2')).toBeTruthy();
    expect(getByText('Clear the Level 1 exam to unlock')).toBeTruthy();
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
});
