// Set-complete payoff (U7, design 2f): the mastery-gems row + a score ring, the
// satisfying end of a set. Presentational — SetRunner owns marking the lesson
// complete (A2); this only displays the result and offers the next move.

import { StyleSheet, Text, View } from 'react-native';

import { MasteryGems } from './components/MasteryGems';
import { Button } from './components/Button';
import type { Gem } from '../learn/exercise-set';
import { colors, fonts, shape, strandDef, type as typo, type Strand } from './theme';

export interface SetCompleteProps {
  gems: Gem[];
  score: number;
  total: number;
  strand: Strand;
  onNext: () => void;
  testID?: string;
}

export function SetComplete({ gems, score, total, strand, onNext, testID = 'set-complete' }: SetCompleteProps) {
  const def = strandDef(strand);
  return (
    <View style={styles.container} testID={testID}>
      <Text style={[styles.overline, { color: def.hue }]}>
        {def.glyph} {def.label} · set complete
      </Text>
      <Text style={styles.title}>Lesson mastered</Text>

      <MasteryGems items={gems} hue={def.hue} testID="set-gems" />

      <View style={[styles.ring, { borderColor: def.hue }]} testID="score-ring">
        <Text style={styles.score} testID="score-value">
          {score}/{total}
        </Text>
        <Text style={styles.scoreLabel}>correct</Text>
      </View>

      <Button label="Next lesson" strand={strand} onPress={onNext} testID="set-next" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: shape.spaceStack, padding: shape.spaceScreenX, alignItems: 'center', justifyContent: 'center' },
  overline: { ...typo.overline },
  title: { ...typo.hero, color: colors.text },
  ring: {
    width: 140,
    height: 140,
    borderRadius: shape.radiusChip,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: shape.spaceStack,
  },
  score: { ...typo.hero, color: colors.text, fontFamily: fonts.monoMedium },
  scoreLabel: { ...typo.label, color: colors.textMuted },
});
