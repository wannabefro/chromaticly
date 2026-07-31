// Placement result (design 7c, `design/Progression Screens C.dc.html`) — and the
// same surface every later "have I actually moved?" moment reaches (R7a).
//
// Placement seeds SEVEN depths, not one grade (R7, R1). Shown honestly uneven
// rather than averaged into a headline, because averaging is the thing the whole
// model exists to stop.
//
// Three things here are load-bearing:
//
//  • The rows are the REAL `LaneRow`, not a lookalike. The very next screen the
//    learner sees is the Learn tab (7a), which draws the identical fact; rendering
//    the same component makes R3's "these surfaces must never disagree" structural
//    instead of a convention. It also means the bar's grammar comes for free —
//    dashed gaps say "chords teaches nothing below grade 4", which a bare number
//    cannot, so a low chords reading stops looking like three grades of failure.
//  • The depths come from `laneDepths` over a TRANSIENT snapshot carrying the
//    staged seeds (KTD5) — never from the staged numbers directly. The preview and
//    the post-commit Learn tab are then the same function, so a preview that lies
//    is impossible rather than merely unlikely.
//  • Nothing here is persisted. The commit happens at Landed, after the warm-up
//    (KTD6). A learner who kills the app mid-placement restarts onboarding, which
//    is the honest consequence of a single persistence point.
//
// A strand the pass never asked about reads "not asked" in a footnote rather than
// as a row state: it is a fact about the PASS, not about the learner, and drawing
// it as an empty lane would be a claim placement never made.

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { laneDepths, STRAND_ORDER } from '../../learn/lane-depth';
import { useProgressContext } from '../../learn/ProgressContext';
import { ProgressStore, type SeededDepth } from '../../learn/store';
import { LaneRow } from '../../ui/components/LaneRow';
import { Screen } from '../../ui/Screen';
import { colors, fonts, shape, strandDef, type as typo, type Strand } from '../../ui/theme';

export interface PlacementResultScreenProps {
  /** Every strand the pass measured, stamped but NOT yet persisted. A strand
   *  missing from this map was not asked — distinct from one measured at 0. */
  staged: Record<string, SeededDepth>;
  /** How many questions the pass actually asked, for the overline. Derived by the
   *  caller from the placeable strands, never hardcoded: it must stay true when
   *  chords gains a grade-3 lesson. */
  asked: number;
  /** Re-test one strand — four questions on that skill alone (R7a). The design's
   *  alternative was a nudge-up/nudge-down slider, which is self-assessment. */
  onRetest: (strand: Strand) => void;
  /** Accept the vector and continue onboarding. */
  onAccept: () => void;
}

export function PlacementResultScreen({ staged, asked, onRetest, onAccept }: PlacementResultScreenProps) {
  const { store, clock, revision } = useProgressContext();

  // The preview store is thrown away on every render — it exists only so the one
  // depth derivation can be asked a hypothetical question.
  const depths = useMemo(() => {
    const snapshot = store ? (JSON.parse(JSON.stringify(store.toSnapshot())) as ReturnType<ProgressStore['toSnapshot']>) : undefined;
    const transient = new ProgressStore(snapshot, clock.now());
    for (const [strand, seed] of Object.entries(staged)) transient.setSeededDepth(strand, seed);
    return laneDepths(transient, clock.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6), not read directly above
  }, [store, revision, clock, staged]);

  const notAsked = STRAND_ORDER.filter((strand) => staged[strand] === undefined);

  return (
    <Screen style={styles.screen} testID="placement-result">
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.over}>
          Placement · {asked} question{asked === 1 ? '' : 's'}
        </Text>
        {/* No name: onboarding has none. A display name is not captured until
            account creation (6b), so 7c's "Here's where you are, Maya" cannot be
            honoured on the screen it was drawn for. */}
        <Text style={styles.title}>Here&rsquo;s where you are</Text>
        <Text style={styles.blurb}>
          Uneven is normal — most people are. Think one&rsquo;s wrong? Tap it and we&rsquo;ll ask four more.
        </Text>

        <View style={styles.rows}>
          {STRAND_ORDER.map((strand) => (
            <LaneRow
              key={strand}
              strand={strand}
              depth={depths[strand]}
              onPress={() => onRetest(strand)}
              testID={`placement-row-${strand}`}
            />
          ))}
        </View>

        {notAsked.length > 0 && (
          <Text style={styles.notAsked} testID="placement-not-asked">
            Not asked this time: {notAsked.map((strand) => strandDef(strand).label).join(', ')}.
          </Text>
        )}

        {/* R5 continuity: the drift warning is here, before any drift happens, so a
            later drop reads as the thing we said would happen rather than as a bug. */}
        <View style={styles.tip} testID="placement-drift-tip">
          <Text style={styles.tipGlyph}>💡</Text>
          <Text style={styles.tipText}>
            We only asked one question per skill, so this is a rough start. It moves with every answer you give — and a
            skill you leave alone will quietly slide back down.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.primary} onPress={onAccept} testID="placement-accept">
          <Text style={styles.primaryLabel}>Looks about right</Text>
        </Pressable>
        <Text style={styles.foot}>a re-test is 4 questions on that skill alone</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: shape.spaceScreenX, gap: shape.spaceInline, paddingBottom: 24 },
  over: { ...typo.label, fontFamily: fonts.mono, color: colors.textFaint, letterSpacing: 1 },
  title: { ...typo.title, color: colors.text },
  blurb: { ...typo.body, color: colors.textMuted },
  // This screen IS the radar, so it carries all seven hues and keeps its own accent
  // neutral — the same approved exception LanesScreen and TabBar take.
  rows: { gap: 2, marginTop: shape.spaceInline },
  notAsked: { ...typo.label, color: colors.textGhost },
  tip: {
    flexDirection: 'row',
    gap: shape.spaceInline,
    backgroundColor: colors.hintSurface,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.hint,
    padding: shape.spaceCard,
    marginTop: shape.spaceInline,
  },
  tipGlyph: { ...typo.body },
  tipText: { ...typo.label, color: colors.hint, flex: 1 },
  footer: { padding: shape.spaceScreenX, gap: shape.spaceInline, alignItems: 'center' },
  primary: {
    width: '100%',
    minHeight: shape.tapMin,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: shape.radiusButton,
    backgroundColor: colors.text,
  },
  primaryLabel: { ...typo.cardTitle, color: colors.bg },
  foot: { ...typo.label, color: colors.textFaint },
});
