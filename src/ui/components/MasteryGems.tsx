// U3: diamond mastery-gem row (design/components/core/MasteryGems.prompt.md).
// Set-complete summary; also the hint-dimmed state in the exercise footer.

import { StyleSheet, View } from 'react-native';

import { colors, shape } from '../theme';

export type GemState = 'clean' | 'hinted' | 'missed';

export interface MasteryGemsProps {
  items: GemState[];
  hue?: string;
  testID?: string;
}

export function MasteryGems({ items, hue = colors.correct, testID }: MasteryGemsProps) {
  return (
    <View style={styles.row} testID={testID}>
      {items.map((item, index) => (
        <View
          key={index}
          testID={`gem-${index}-${item}`}
          style={[styles.gem, gemStyle(item, hue)]}
        />
      ))}
    </View>
  );
}

function gemStyle(item: GemState, hue: string) {
  switch (item) {
    case 'clean':
      return { backgroundColor: hue, borderColor: hue };
    case 'hinted':
      return { backgroundColor: 'transparent', borderColor: hue };
    case 'missed':
      return { backgroundColor: 'transparent', borderColor: colors.incorrect };
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
  },
  gem: {
    width: 14,
    height: 14,
    borderWidth: shape.borderWActive,
    borderRadius: shape.radiusSwatch,
    transform: [{ rotate: '45deg' }],
  },
});
