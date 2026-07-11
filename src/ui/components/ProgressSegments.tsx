// U3: slim segmented progress bar (design/components/core/ProgressSegments.prompt.md).
// Sits in the exercise header between close (×) and the count.

import { StyleSheet, View } from 'react-native';

import { ACCENT, colors, shape, strandDef, type Strand } from '../theme';

export type SegmentState = 'done' | 'incorrect' | 'current' | 'todo';

export interface ProgressSegmentsProps {
  states: SegmentState[];
  strand?: Strand;
  testID?: string;
}

export function ProgressSegments({ states, strand, testID }: ProgressSegmentsProps) {
  const hue = strand ? strandDef(strand).hue : ACCENT;

  return (
    <View style={styles.row} testID={testID}>
      {states.map((state, index) => (
        <View
          key={index}
          testID={`segment-${index}`}
          style={[styles.segment, segmentStyle(state, hue)]}
        />
      ))}
    </View>
  );
}

function segmentStyle(state: SegmentState, hue: string) {
  switch (state) {
    case 'done':
      return { backgroundColor: hue };
    case 'incorrect':
      return { backgroundColor: colors.incorrect };
    case 'current':
      return { backgroundColor: colors.surfaceCard, borderWidth: shape.borderWActive, borderColor: hue };
    case 'todo':
      return { backgroundColor: colors.border };
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: shape.radiusChip,
  },
});
