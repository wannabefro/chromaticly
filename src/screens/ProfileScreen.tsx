// Profile (design 5c, amended by 7d): who you are, how ready you are for the paper,
// and what you've collected.
//
// Two parts of 5c are NOT here, deliberately:
//
//  - The XP total and day-streak in the header. Neither exists: the store tracks
//    per-atom mastery streaks (a different thing entirely) and no XP at all. Inventing
//    numbers on the one screen whose job is telling the learner where they stand would
//    be the worst place in the app to fake something. Filed (302.35).
//  - The settings block is PARTIAL. Only the two settings with real, wired effects
//    ship: notation size (re-scales the score) and left-hand stave input (mirrors the
//    input controls). Terminology (UK/US), colour-vision palette, and feedback audio
//    are omitted — each needs a large refactor, new design tokens, or an audio
//    dependency, and a toggle that flips and changes nothing is a lie. Filed as
//    follow-ups off 302.36.
//
// NO GRADE UI (G6 U8, F8/R1). The "Grade N" heading, the five-pill switcher and the
// "Working grade" row are gone. Under the seven-lane model there is no single current
// grade to switch: a learner holds seven depths at once, and a control that picks one
// number would be asserting something untrue about them. `Profile.grade` survives in
// the store as hidden onboarding/legacy state (KTD6); nothing on this screen reads it.
// The lane list is where grade is chosen now, one lane at a time.

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LESSONS } from '../content/lessons';
import { EXAM_PAPER_GRADE, GRADE1_EXAM_SECTIONS, QUESTIONS_PER_SECTION } from '../learn/exam';
import { writtenLaneDepths } from '../learn/lane-depth';
import { examReadiness, strandMastery } from '../learn/mastery-rollup';
import { useProgressContext } from '../learn/ProgressContext';
import { Screen } from '../ui/Screen';
import { SettingsBlock } from '../ui/components/SettingsBlock';
import { ReadinessCard } from '../ui/components/ReadinessCard';
import { StrandRadar } from '../ui/components/StrandRadar';
import { colors, shape, type as typo, type Strand } from '../ui/theme';

export interface ProfileScreenProps {
  /** "Exam readiness ›" takes the learner to the paper it is talking about. */
  onOpenExams?: () => void;
  /** A tap on the mastery radar — or on a short strand in the readiness card —
   *  drills into that strand (design 6d/7d). The shell carries the target across the
   *  tab change into Learn's lane detail. */
  onDrillStrand?: (strand: Strand) => void;
}

export default function ProfileScreen({ onOpenExams, onDrillStrand }: ProfileScreenProps = {}) {
  const { ready, store, revision, name, clock } = useProgressContext();

  const readiness = useMemo(() => {
    if (!store) return null;
    return examReadiness(EXAM_PAPER_GRADE, GRADE1_EXAM_SECTIONS, writtenLaneDepths(store, clock.now()), QUESTIONS_PER_SECTION);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6), not read directly above
  }, [store, revision, clock]);

  // Every authored lesson, since G6 U3: nothing is gated, so there is no
  // "reachable subset" left to compute — the collection is the whole curriculum.
  const collected = useMemo(() => {
    if (!store) return 0;
    return LESSONS.filter((lesson) => store.isFactCollected(lesson.id)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6)
  }, [store, revision]);

  // R3: the radar projects the FULL `laneDepths`, by-ear included. Readiness
  // above reads `writtenLaneDepths` instead — the two numbers differ on purpose.
  const mastery = useMemo(() => {
    if (!store) return {};
    return strandMastery(store, clock.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6)
  }, [store, revision, clock]);

  if (!ready || !store || !readiness) {
    return (
      <Screen testID="profile-loading">
        <Text style={styles.muted}>Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen} testID="profile-screen">
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{(name ?? 'G').charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.name}>{name ?? 'Guest'}</Text>
          </View>
        </View>

        {/* The same derivation and the same card the Exams tab shows (R3): two
            surfaces reading one `examReadiness` cannot drift apart. "Sit the paper"
            lives on the Exams tab, so here the card routes there instead. */}
        <Pressable testID="profile-readiness" onPress={onOpenExams}>
          <ReadinessCard readiness={readiness} onOpenLane={onDrillStrand} testID="profile-readiness-card" />
        </Pressable>

        <StrandRadar mastery={mastery} onDrill={onDrillStrand} />

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Fact-card collection</Text>
            <Text style={styles.value} testID="profile-facts">
              {collected} of {LESSONS.length}
            </Text>
          </View>
          <Text style={styles.cardNote}>One to find in every lesson’s teach phase.</Text>
        </View>

        {/* The "Grade N" heading, the five-pill switcher and the "Working grade"
            row all came out here (G6 U8, F8/R1). There is no single current grade
            to display: the learner has seven depths, and the lane list plus the
            readiness card above say what those are. `Profile.grade` survives as
            hidden onboarding/legacy state (KTD6) — nothing renders it. */}

        <SettingsBlock />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: shape.spaceScreenX, gap: shape.spaceCard },
  muted: { ...typo.body, color: colors.textMuted, padding: shape.spaceScreenX },

  head: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceInline },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: shape.radiusCardLg,
    backgroundColor: colors.surfaceCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { ...typo.title, color: colors.text },
  name: { ...typo.title, color: colors.text },
  sub: { ...typo.label, color: colors.textMuted },

  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    padding: shape.spaceCard,
    gap: shape.spaceInline,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...typo.cardTitle, color: colors.text },
  cardNote: { ...typo.body, color: colors.textMuted },
  value: { ...typo.label, color: colors.text },


});
