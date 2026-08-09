// Your plan (design screen 7c, "step 3 · your plan"): sets the mental model in
// three cards (lesson → exercise → exam), then funnels into the 2-min coached
// warm-up — NOT a full lesson (R3). The CTA promises one question, not a course.
//
// fyu.3: the exam card is advisory, not gated — "sit it whenever you like" is the
// design's exact copy (7c), replacing the old "it unlocks as you master topics"
// framing that free grade access made false (there is no exam-clear requirement).

import { StyleSheet, Text, View } from 'react-native';

import { warmUpFor } from '../../learn/warm-up';
import { Button } from '../../ui/components/Button';
import { colors, shape, type } from '../../ui/theme';

export interface PlanScreenProps {
  /** Which ending the third card describes. Under R1 there is no grade to name
   *  here — placement seeds seven depths — so the one thing this screen still
   *  needs to know is whether the learner is inside the exam ladder or below it. */
  firstSteps: boolean;
  onStartWarmUp: () => void;
}

const PLAN_CARDS = [
  { title: 'Short lessons', body: 'Read a little, hear a lot — every example plays.' },
  { title: 'Quick exercises', body: 'One question per screen. Wrong answers explain why.' },
] as const;

/** The third card is the level's ENDING, and the two levels end differently. A
 *  level that cannot be sat must not be sold on an exam it will never offer —
 *  and dropping the card without replacing it left a screen with a hole in it,
 *  which reads as unfinished rather than as deliberate (device capture). */
const EXAM_CARD = {
  title: 'A real practice exam',
  body: "Sit it whenever you like — we'll tell you when you look ready.",
} as const;

const HANDOFF_CARD = {
  title: 'Then Grade 1',
  body: 'No exam here — when these five are done, Grade 1 picks up right where they leave off.',
} as const;

export function PlanScreen({ firstSteps, onStartWarmUp }: PlanScreenProps) {
  // The title, never the number — "Grade 0" is the words the naming decision forbids.
  const name = firstSteps ? 'First steps' : 'Chromaticly';
  const cards = [...PLAN_CARDS, firstSteps ? HANDOFF_CARD : EXAM_CARD];
  const warmUp = warmUpFor(firstSteps ? 0 : null);

  return (
    <View style={styles.container} testID="plan-screen">
      <View style={styles.head}>
        <Text style={styles.overline}>{name} · ready</Text>
        <Text style={styles.title}>Here&apos;s how {name} works</Text>
      </View>

      <View style={styles.cards}>
        {cards.map((card) => (
          <View key={card.title} style={styles.card}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardBody}>{card.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.warmupBlock}>
        <Text style={styles.overline}>First up · 2 min</Text>
        <Text style={styles.warmupTitle}>{warmUp.title}</Text>
        <Text style={styles.warmupBody}>3 quick questions to draw your first mastery point.</Text>
      </View>

      <View style={styles.footer}>
        <Button label="Try your first question" onPress={onStartWarmUp} testID="plan-start-warmup" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceScreenTop,
    paddingBottom: shape.spaceScreenBottom,
    gap: shape.spaceStack,
  },
  head: { gap: shape.spaceSnug },
  overline: {
    fontFamily: type.overline.fontFamily,
    fontSize: type.overline.fontSize,
    lineHeight: type.overline.lineHeight,
    letterSpacing: type.overline.letterSpacing,
    textTransform: type.overline.textTransform,
    color: colors.textFaint,
  },
  title: {
    fontFamily: type.title.fontFamily,
    fontSize: type.title.fontSize,
    lineHeight: type.title.lineHeight,
    color: colors.text,
  },
  cards: { gap: shape.spaceInline },
  card: {
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
    paddingVertical: shape.spaceCard,
    paddingHorizontal: shape.spaceCard,
    gap: shape.spaceTight,
  },
  cardTitle: {
    fontFamily: type.cardTitle.fontFamily,
    fontSize: type.cardTitle.fontSize,
    lineHeight: type.cardTitle.lineHeight,
    color: colors.text,
  },
  cardBody: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: colors.textMuted,
  },
  warmupBlock: {
    marginTop: 'auto',
    borderRadius: shape.radiusCard,
    backgroundColor: colors.surfaceCardSunken,
    paddingVertical: shape.spaceCard,
    paddingHorizontal: shape.spaceCard,
    gap: shape.spaceTight,
  },
  warmupTitle: {
    fontFamily: type.prompt.fontFamily,
    fontSize: type.prompt.fontSize,
    lineHeight: type.prompt.lineHeight,
    color: colors.text,
  },
  warmupBody: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: colors.textMuted,
  },
  footer: { gap: shape.spaceInline },
});
