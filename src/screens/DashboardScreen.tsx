// Day-1 dashboard (U10, design 6d): the onboarded landing. A welcome header, a
// "Begin" hero that launches the first Grade 1 lesson set, and the 7-strand mastery
// row (empty at day 1 — principle 5 / A12: mastery is visible on the dashboard).
// Begin runs the SetRunner in place (kept under the index route, no extra deep-link).

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LESSONS } from '../content/lessons';
import { SetRunner } from '../ui/SetRunner';
import { Screen } from '../ui/Screen';
import { Button } from '../ui/components/Button';
import { colors, shape, STRAND_DEFS, strandDef, type as typo, type Strand } from '../ui/theme';

const FIRST_LESSON = LESSONS[0];
const STRAND_ORDER: Strand[] = ['rhythm', 'pitch', 'scales_keys', 'intervals', 'chords', 'terms_signs', 'context'];

export default function DashboardScreen() {
  const [begun, setBegun] = useState(false);

  if (begun) {
    return <SetRunner lesson={FIRST_LESSON} onDone={() => setBegun(false)} />;
  }

  const strand = FIRST_LESSON.strand as Strand;

  return (
    <Screen style={styles.screen} testID="dashboard-screen">
      <View style={styles.header}>
        <Text style={styles.hello}>Welcome!</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>Grade 1 · guest</Text>
          <View style={styles.dayChip}>
            <Text style={styles.dayChipText}>day 1</Text>
          </View>
        </View>
      </View>

      <View style={[styles.hero, { borderColor: strandDef(strand).hue }]} testID="begin-hero">
        <Text style={[styles.heroKicker, { color: strandDef(strand).hue }]}>Your first lesson</Text>
        <Text style={styles.heroTitle}>{FIRST_LESSON.title}</Text>
        <Text style={styles.heroBody}>A gentle start — read a few notes, hear each one, and you&apos;re off.</Text>
        <Button label="Begin" strand={strand} onPress={() => setBegun(true)} testID="begin-lesson" />
      </View>

      <View style={styles.mastery} testID="strand-mastery">
        <Text style={styles.masteryLabel}>Your strands</Text>
        <View style={styles.strandRow}>
          {STRAND_ORDER.map((s) => (
            <View key={s} style={styles.strandDot} testID={`strand-${s}`}>
              <Text style={[styles.strandGlyph, { color: colors.textFaint }]}>{STRAND_DEFS[s].glyph}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.masteryHint}>Fills in as you answer — your first set draws the first point.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: shape.spaceScreenX, gap: shape.spaceStack },
  header: { gap: 6 },
  hello: { ...typo.title, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceInline },
  meta: { ...typo.label, color: colors.textMuted },
  dayChip: { backgroundColor: colors.surfaceCard, borderRadius: shape.radiusChip, paddingHorizontal: 10, paddingVertical: 3 },
  dayChipText: { ...typo.label, color: colors.textMuted },
  hero: {
    backgroundColor: colors.surfaceCard,
    borderRadius: shape.radiusCardLg,
    borderWidth: shape.borderWActive,
    padding: shape.spaceCard,
    gap: shape.spaceInline,
  },
  heroKicker: { ...typo.overline },
  heroTitle: { ...typo.cardTitle, color: colors.text },
  heroBody: { ...typo.body, color: colors.textMuted },
  mastery: { gap: shape.spaceInline, marginTop: shape.spaceStack },
  masteryLabel: { ...typo.overline, color: colors.textMuted },
  strandRow: { flexDirection: 'row', justifyContent: 'space-between' },
  strandDot: {
    width: 40,
    height: 40,
    borderRadius: shape.radiusChip,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strandGlyph: { fontSize: 18 },
  masteryHint: { ...typo.body, color: colors.textFaint },
});
