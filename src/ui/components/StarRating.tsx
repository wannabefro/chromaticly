// U2 fix: the literal 0-3★ unit-mastery meter on the level map (design 3a).
// Distinct from MasteryGems (a per-item set-complete row: clean/hinted/missed
// diamonds) — 3a renders a unit's rating as filled/empty ★ glyphs, e.g.
// "3.1 Rhythm Part 1 … ★★★" and a 2-star unit as "★★" + one dim star. Stars
// are uniformly amber regardless of strand — the 3a markup's filled-star
// colour is exactly the `--hint` token's value (design/tokens/colors.css).
// An empty star is the *same* amber dimmed by opacity (3a's empty star is a
// dim warm amber, not a cool neutral), so it stays in the amber hue family
// with only the one token.

import { StyleSheet, Text, View } from 'react-native';

import { colors, type as typo } from '../theme';

/** Opacity of an unfilled star — dims the amber to 3a's warm dim-star tone
 *  without a second colour token. */
const EMPTY_STAR_OPACITY = 0.28;

export interface StarRatingProps {
  filled: 0 | 1 | 2 | 3;
  max?: number;
  testID?: string;
}

export function StarRating({ filled, max = 3, testID }: StarRatingProps) {
  const stars = Array.from({ length: max }, (_, index) => index < filled);

  return (
    <View style={styles.row} testID={testID}>
      {stars.map((isFilled, index) => (
        <Text
          key={index}
          testID={testID ? `${testID}-star-${index}-${isFilled ? 'filled' : 'empty'}` : undefined}
          style={[styles.star, isFilled ? styles.filled : styles.empty]}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    ...typo.label,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.hint,
  },
  filled: {
    opacity: 1,
  },
  empty: {
    opacity: EMPTY_STAR_OPACITY,
  },
});
