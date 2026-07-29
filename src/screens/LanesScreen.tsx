// The Learn tab as seven lanes (design 7a, `design/Progression Screens C.dc.html`).
// The radar unrolled and made enterable: each strand sits at its own depth, and
// every one of them is open (R2) — deepen a strong lane or repair a short one.
//
// This screen is the approved exception to one-accent-per-screen. It IS the strand
// radar, so it carries all seven hues at once; its own accent stays neutral
// (`colors.text`) so no strand reads as "current", and every hue is paired with its
// glyph and full name. Recorded in `design/README.md`, approved 2026-07-28 — the
// same question `TabBar.tsx` answers for the shell.
//
// R1: nothing here asserts a single current grade. There is no grade pill, because
// under this model "what grade are you?" has seven answers.
//
// STRIPPED TO 1e (approved 2026-07-29, recorded in design/README.md). The greeting,
// the two-line explanation and the "Choose for me" button are gone, and so is the
// mono depth beside every bar. Each of the four said something the screen was
// already showing: the bar draws the depth, the seven rows ARE "seven skills at
// their own depths", and the recommendation is now a two-word tag on the one row it
// applies to rather than a full-width button that needed a sentence to explain
// itself. 62 words to 1.

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { atomsFor, contentGradesFor, laneDepths, STRAND_ORDER, type LaneDepth } from '../learn/lane-depth';
import { useProgressContext } from '../learn/ProgressContext';
import { selectDue } from '../learn/srs';
import type { ProgressStore } from '../learn/store';
import { LaneRow } from '../ui/components/LaneRow';
import { Screen } from '../ui/Screen';
import { colors, shape, type as typo, type Strand } from '../ui/theme';

export interface LanesScreenProps {
  /** Tapping a lane opens its detail (7b) — the shell routes it. */
  onOpenLane?: (strand: Strand) => void;
}

/** The one lane the screen nudges toward, and the tag it wears.
 *
 *  `tag` is learner-facing and deliberately tiny — it is the whole of what used to
 *  be a button plus a sentence. It must stay TRUE to the rule that fired: "due"
 *  claims something is actually overdue, so a lane picked for being shallow says
 *  "start here" instead. Getting that backwards would put a false claim on the one
 *  row the screen emphasises. */
export interface LaneSuggestion {
  strand: Strand;
  tag: string;
}

/** The atoms each strand teaches, across every grade — built once, same shape and
 *  rationale as practice-plan's ATOM_TEMPLATE map. */
const STRAND_ATOMS: Map<Strand, Set<string>> = new Map(
  STRAND_ORDER.map((strand) => [strand, new Set(contentGradesFor(strand).flatMap((g) => atomsFor(strand, g)))]),
);

/** Pick the lane to nudge the learner toward.
 *
 *  Repair before depth, deliberately: the first rule counts OVERDUE attempted atoms,
 *  so the affordance sends a learner back to what they are losing rather than
 *  further up whatever they are already best at. Ties go to the shallower lane for
 *  the same reason.
 *
 *  With nothing overdue there is nothing to repair, so it falls to the shallowest
 *  lane that still has content above its depth. With neither — every lane at its
 *  ceiling and nothing due — it returns null, and the screen says so instead of
 *  inventing a recommendation. Ordering is `STRAND_ORDER` throughout, so the same
 *  store always yields the same suggestion. */
export function chooseLane(store: ProgressStore, now: number): LaneSuggestion | null {
  const depths = laneDepths(store, now);
  const due = new Set(selectDue(store.atomEntries(), now));

  const overdue = (strand: Strand) => {
    const atoms = STRAND_ATOMS.get(strand);
    let count = 0;
    for (const atom of due) if (atoms?.has(atom)) count += 1;
    return count;
  };

  let best: { strand: Strand; count: number; depth: number } | null = null;
  for (const strand of STRAND_ORDER) {
    const count = overdue(strand);
    if (count === 0) continue;
    const depth = depths[strand].depth;
    if (!best || count > best.count || (count === best.count && depth < best.depth)) {
      best = { strand, count, depth };
    }
  }
  if (best) return { strand: best.strand, tag: 'due' };

  let shallowest: { strand: Strand; depth: number } | null = null;
  for (const strand of STRAND_ORDER) {
    const lane = depths[strand];
    if (!hasContentAhead(lane)) continue;
    if (!shallowest || lane.depth < shallowest.depth) shallowest = { strand, depth: lane.depth };
  }
  return shallowest ? { strand: shallowest.strand, tag: 'start here' } : null;
}

/** Whether the lane teaches anything the learner has not yet held. A lane at its
 *  ceiling has nothing left to deepen, so it can never be the suggestion. */
function hasContentAhead(lane: LaneDepth): boolean {
  return lane.contentGrades.some((grade) => grade > lane.depth);
}

export default function LanesScreen({ onOpenLane }: LanesScreenProps = {}) {
  const { ready, store, revision, clock } = useProgressContext();

  const depths = useMemo(() => {
    if (!store) return null;
    return laneDepths(store, clock.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6), not read directly above
  }, [store, revision, clock]);

  const suggestion = useMemo(() => {
    if (!store) return null;
    return chooseLane(store, clock.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6)
  }, [store, revision, clock]);

  if (!ready || !store || !depths) {
    return (
      <Screen testID="lanes-loading">
        <Text style={styles.muted}>Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen testID="lanes-screen">
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Learn</Text>

        <View style={styles.lanes}>
          {STRAND_ORDER.map((strand) => (
            <LaneRow
              key={strand}
              strand={strand}
              depth={depths[strand]}
              note={suggestion?.strand === strand ? suggestion.tag : undefined}
              onPress={() => onOpenLane?.(strand)}
              testID={`lane-row-${strand}`}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: shape.spaceStack,
    // See LaneScreen: `Screen` insets the top edge only, so the screen gutter is
    // the scroll content's own job.
    paddingHorizontal: shape.spaceScreenX,
    paddingBottom: shape.spaceStack,
  },
  title: {
    ...typo.title,
    color: colors.text,
  },
  lanes: {
    gap: 7,
  },
  muted: {
    ...typo.body,
    color: colors.textMuted,
  },
});
