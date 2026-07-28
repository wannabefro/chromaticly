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
// Not wired into the shell yet — U7 performs the swap once lane detail exists.

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

/** What "Choose for me" picks, and why. The `why` is learner-facing copy shown on
 *  the suggested row, so the highlight always explains itself rather than being an
 *  unexplained emphasis. */
export interface LaneSuggestion {
  strand: Strand;
  why: string;
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
  if (best) return { strand: best.strand, why: 'most overdue' };

  let shallowest: { strand: Strand; depth: number } | null = null;
  for (const strand of STRAND_ORDER) {
    const lane = depths[strand];
    if (!hasContentAhead(lane)) continue;
    if (!shallowest || lane.depth < shallowest.depth) shallowest = { strand, depth: lane.depth };
  }
  return shallowest ? { strand: shallowest.strand, why: 'your shortest' } : null;
}

/** Whether the lane teaches anything the learner has not yet held. A lane at its
 *  ceiling has nothing left to deepen, so it can never be the suggestion. */
function hasContentAhead(lane: LaneDepth): boolean {
  return lane.contentGrades.some((grade) => grade > lane.depth);
}

export default function LanesScreen({ onOpenLane }: LanesScreenProps = {}) {
  const { ready, store, revision, name, clock } = useProgressContext();

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
        <View style={styles.header}>
          <Text style={styles.title}>{name ? `Where to today, ${name}?` : 'Where to today?'}</Text>
          <Text style={styles.sub}>
            Seven skills, each at its own depth. Deepen a strong one or repair a short one — nothing is locked.
          </Text>
        </View>

        <View style={styles.lanes}>
          {STRAND_ORDER.map((strand) => (
            <LaneRow
              key={strand}
              strand={strand}
              depth={depths[strand]}
              note={suggestion?.strand === strand ? suggestion.why : undefined}
              onPress={() => onOpenLane?.(strand)}
              testID={`lane-row-${strand}`}
            />
          ))}
        </View>

        <Pressable
          testID="lanes-choose-for-me"
          disabled={suggestion === null}
          onPress={() => suggestion && onOpenLane?.(suggestion.strand)}
          style={[styles.choose, suggestion === null && styles.chooseDisabled]}
        >
          <Text style={[styles.chooseLabel, suggestion === null && styles.chooseLabelDisabled]}>
            {suggestion === null ? 'Nothing due — pick any skill' : 'Choose for me'}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: shape.spaceStack,
    paddingBottom: shape.spaceStack,
  },
  header: {
    gap: 6,
  },
  title: {
    ...typo.title,
    color: colors.text,
  },
  sub: {
    ...typo.body,
    color: colors.textMuted,
  },
  lanes: {
    gap: 7,
  },
  choose: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
    minHeight: shape.tapMin,
    justifyContent: 'center',
  },
  chooseDisabled: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  chooseLabel: {
    ...typo.option,
    fontSize: 14,
    color: colors.text,
  },
  chooseLabelDisabled: {
    color: colors.textFaint,
  },
  muted: {
    ...typo.body,
    color: colors.textMuted,
  },
});
