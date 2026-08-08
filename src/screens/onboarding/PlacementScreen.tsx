// Placement (design A1/A2, `design/Placement A vs B.dc.html`) — shape A, one mixed
// pass of roughly one item per strand, and the same runner in ladder mode for a
// per-skill re-test (R7a).
//
// ONE runner serves both, because they are the same walk with a different budget
// and a different starting grade (KTD6). Building the re-test as a second screen
// would have meant two places that decide what "answering a placement item" means.
//
// Items render through `ExerciseLoop` and the interaction registry, NOT through
// `AnswerOption` directly. That is not incidental: the placement bank is "any
// generated interaction that is not self-graded", which is wider than MCQ —
// context's only template generates `find_the_bar`, which needs score-tap wiring
// rather than answer cards. An AnswerOption-only build would silently make context
// unmeasurable and leave the vector six strands wide, and nothing would fail. It is
// also what R8 means by leaving the exercise loop untouched.
//
// Hints are off. A hinted answer measures the hint, not the learner — and unlike a
// lesson there is no second attempt here to recover from a wrong one.
//
// Nothing here writes. Each walk is stamped as it resolves (so its `seq` orders
// against any attempt made later — KTD7) and handed to the caller; the commit
// happens after the rest of onboarding.

import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  answerPlacement,
  currentItem,
  isPlacementComplete,
  LADDER_BUDGET,
  placeableStrands,
  startPlacement,
  startWalk,
  walkDepth,
  type PlacementSession,
  type StrandWalk,
} from '../../learn/placement';
import { useProgressContext } from '../../learn/ProgressContext';
import type { SeededDepth } from '../../learn/store';
import { ExerciseLoop } from '../../ui/ExerciseLoop';
import { Screen } from '../../ui/Screen';
import { colors, fonts, shape, strandDef, type as typo, type Strand } from '../../ui/theme';

export interface PlacementScreenProps {
  /** Run the up-to-four-question ladder on ONE strand instead of the mixed pass
   *  (R7a). Skips the expectation-setting screen: a re-test is chosen
   *  deliberately, so explaining it again would be furniture. */
  retestStrand?: Strand;
  /** The measured strands, stamped but unpersisted, plus how many questions were
   *  actually asked. */
  onDone: (staged: Record<string, SeededDepth>, asked: number) => void;
  /** "Skip — start from the beginning." Seeds nothing; every lane then reads its
   *  derived depth, which for an untouched store is 0 (KTD3, R7 as amended). */
  onSkip?: () => void;
  /** Varies the draw so a re-test does not re-ask the identical item. */
  seedBase?: number;
}

export function PlacementScreen({ retestStrand, onDone, onSkip, seedBase = 0 }: PlacementScreenProps) {
  const { stampDepth } = useProgressContext();

  // A re-test starts on its question; the mixed pass sets expectations first.
  const [started, setStarted] = useState(retestStrand !== undefined);
  const [session, setSession] = useState<PlacementSession>(() =>
    retestStrand !== undefined
      ? { walks: [startWalk(retestStrand, LADDER_BUDGET, 0)], index: 0 }
      : startPlacement(),
  );

  // Staged seeds live in a ref, not state: they are accumulated across answers and
  // handed over whole at the end, and re-rendering on each one buys nothing.
  const staged = useRef<Record<string, SeededDepth>>({});
  const asked = useRef(0);

  const total = useMemo(() => (retestStrand !== undefined ? LADDER_BUDGET : placeableStrands().length), [retestStrand]);
  const item = useMemo(() => currentItem(session, seedBase + asked.current), [session, seedBase]);

  const handleResult = useCallback(
    (correct: boolean) => {
      const index = session.index;
      const walk: StrandWalk | undefined = session.walks[index];
      if (!walk) return;

      const next = answerPlacement(session, correct);
      asked.current += 1;

      // Stamp the moment the walk RESOLVES, never at the commit. This is where the
      // clock and the write counter meet, and doing it later would let an attempt
      // made in between be wrongly out-ranked by this older measurement (KTD6/KTD7).
      const resolved = next.walks[index];
      if (resolved.pending === null) {
        staged.current = { ...staged.current, [walk.strand]: stampDepth(walkDepth(resolved)) };
      }

      if (isPlacementComplete(next)) onDone(staged.current, asked.current);
      else setSession(next);
    },
    [session, stampDepth, onDone],
  );

  if (!started) {
    return (
      <Screen style={styles.screen} testID="placement-intro">
        <View style={styles.introBody}>
          <Text style={styles.title}>
            {total} quick question{total === 1 ? '' : 's'}
          </Text>
          <Text style={styles.blurb}>
            About two minutes. They cover all seven skills, so we can start you in roughly the right place in each — not
            one grade for everything.
          </Text>

          <View style={styles.tip} testID="placement-intro-tip">
            <Text style={styles.tipGlyph}>💡</Text>
            <Text style={styles.tipText}>
              A rough start is fine. Nothing gets locked, and every answer you give from here on keeps moving it.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.primary} onPress={() => setStarted(true)} testID="placement-start">
            <Text style={styles.primaryLabel}>Start</Text>
          </Pressable>
          {/* A peer action, not a buried one — and the copy no longer promises grade
              1, because under R7 skipping seeds nothing at all (KTD3). */}
          <Pressable style={styles.skip} onPress={onSkip} testID="placement-skip">
            <Text style={styles.skipLabel}>Skip — start from the beginning</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // No item means every walk resolved — `onDone` has already fired from
  // handleResult, and this is the frame before the parent swaps the screen out.
  if (!item) return (
    <Screen testID="placement-empty">
      <View />
    </Screen>
  );

  const def = strandDef(item.strand);

  return (
    <Screen style={styles.screen} testID="placement-item">
      <View style={styles.head}>
        {onSkip && (
          <Pressable onPress={onSkip} hitSlop={12} testID="placement-close">
            <Text style={styles.close}>×</Text>
          </Pressable>
        )}
        {/* "~4" on a re-test, exactly as B2 draws it: the never-revisit rule
            usually stops a short ladder early, so a bare "/4" would promise
            questions the walk will never ask. The mixed pass IS its total. */}
        <Text style={styles.counter} testID="placement-counter">
          {Math.min(asked.current + 1, total)}/{retestStrand !== undefined ? '~' : ''}
          {total}
        </Text>
      </View>

      <View style={styles.loop}>
        <ExerciseLoop
          key={item.instance.id}
          instance={item.instance}
          showHints={false}
          onResult={(result) => handleResult(result.correct)}
        />
      </View>

      {/* Naming the strand on every item is what teaches the seven-lane model
          before the learner ever reaches 7a. `ExerciseLoop`'s own StrandChip does
          the accent; this says what a wrong answer costs, which the chip cannot. */}
      <Text style={[styles.foot, { color: def.hue }]} testID="placement-foot">
        not sure? skip it — that&rsquo;s an answer too
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  introBody: { flex: 1, justifyContent: 'center', padding: shape.spaceScreenX, gap: shape.spaceInline },
  title: { ...typo.title, color: colors.text },
  blurb: { ...typo.body, color: colors.textMuted },
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

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceTight,
  },
  close: { ...typo.title, color: colors.textMuted },
  counter: { ...typo.label, fontFamily: fonts.mono, color: colors.textMuted },
  // ExerciseLoop's root is flex:1 and supplies its own padding, so it MUST have a
  // flex parent giving it height — without this its inner ScrollView collapses to
  // zero on device and only the top of the notation card shows. Jest cannot see it.
  loop: { flex: 1 },
  foot: { ...typo.label, textAlign: 'center', paddingBottom: shape.spaceInline },

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
  skip: { minHeight: shape.tapMin, justifyContent: 'center', alignItems: 'center' },
  skipLabel: { ...typo.body, color: colors.textMuted },
});
