// Lane detail (design 7b + the approved divergence in `design/README.md`, G6 U7).
// One strand, one grade, everything ahead enterable.
//
// Three things about this screen were decided against the prototype and are load-
// bearing, so they are stated here rather than left to be re-derived:
//
//  • ONE GRADE AT A TIME. A grade is not quick to study for; listing five of them
//    implies a pace nobody works at. The screen opens on the grade the learner is
//    actually working — the first content-bearing grade ABOVE their depth, since
//    depth means "held", not "in progress".
//  • THE OTHER GRADES ARE REACHABLE, NOT ADVERTISED. No ladder, no chip row. One
//    muted control opens the picker, which is the only place the five are ever
//    listed — and the only honest home for a sparse strand's "nothing here yet"
//    (KTD3). R2 is untouched: every grade is one tap away and nothing refuses
//    entry. A grade above the learner says so and offers the way back.
//  • THE STRAND IS THE HEADING; THE GRADE IS THE SECTION LABEL. "You're at grade 3
//    here" is retired — it asserted a rank, and depth is a derived reading that
//    decays (R5), so a lane that slid back down would turn that sentence into a
//    lie. The depth readout is not repeated here at all: `LanesScreen` (7a) carries
//    it and every visit passes through it.
//
// One accent per screen (rule 3): this lane's hue. The single exception is
// PrereqChip, which is deliberately the OTHER strand's hue because pointing at
// another lane is its entire job.
//
// AD6: every derivation reads the mutable ProgressStore, so it is recomputed in a
// useMemo keyed explicitly on `revision`.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LESSONS, type Lesson } from '../content/lessons';
import { prerequisitesFor } from '../content/prerequisites';
import { laneDepths, type LaneDepth } from '../learn/lane-depth';
import { deriveStars } from '../learn/mastery-rollup';
import { useProgressContext } from '../learn/ProgressContext';
import { PrereqChip } from '../ui/components/PrereqChip';
import { UnitRow, type UnitState } from '../ui/components/UnitRow';
import { Screen } from '../ui/Screen';
import { colors, fonts, shape, strandDef, type as typo, type Strand } from '../ui/theme';

/** The five ABRSM grades the picker always lists, so a sparse strand can say
 *  "nothing here yet" rather than silently omitting a grade. */
const GRADES = [1, 2, 3, 4, 5];

export interface LaneScreenProps {
  strand: Strand;
  /** Open on a specific grade rather than wherever the learner is working (7e).
   *  An exam result sends them here about the grade the PAPER examined, so landing
   *  on their working grade would answer a question the paper did not ask — a
   *  learner who just scored 0/4 on the grade-1 terms section must not be dropped
   *  into grade 4 because their lane depth happens to be 3. */
  initialGrade?: number;
  /** Back to the lane list (7a). */
  onBack?: () => void;
  /** A prerequisite chip taps into the lane it names. */
  onOpenLane?: (strand: Strand) => void;
  /** Entering a unit. The shell owns the runner, so this screen never renders one. */
  onOpenLesson?: (lesson: Lesson) => void;
}

/** One grade's units for one strand, in authored order.
 *
 *  Ordered by walking the grade's `unlocks` chain and keeping this strand's links,
 *  not by `LESSONS` order: `unlocks` is the authored teaching sequence and it is
 *  retained precisely for this (KTD4). It no longer gates anything — since U3 every
 *  unit is enterable — so it survives purely as an ordering. Any lesson the chain
 *  misses is appended rather than dropped, so a malformed chain loses order, never
 *  a unit. */
export function laneUnits(strand: Strand, grade: number): Lesson[] {
  const inGrade = LESSONS.filter((lesson) => lesson.grade === grade);
  const unlocked = new Set(inGrade.map((lesson) => lesson.unlocks).filter((id): id is string => id !== null));

  const ordered: Lesson[] = [];
  const walked = new Set<string>();
  let cursor = inGrade.find((lesson) => !unlocked.has(lesson.id));
  while (cursor && !walked.has(cursor.id)) {
    walked.add(cursor.id);
    if (cursor.strand === strand) ordered.push(cursor);
    const next: string | null = cursor.unlocks;
    cursor = next === null ? undefined : inGrade.find((lesson) => lesson.id === next);
  }
  for (const lesson of inGrade) {
    if (lesson.strand === strand && !walked.has(lesson.id)) ordered.push(lesson);
  }
  return ordered;
}

/** The grade the screen opens on: the first content-bearing grade ABOVE the
 *  learner's depth — the one they are actually working, since depth means the
 *  deepest grade they HOLD. A lane at its ceiling has nothing above, so it opens on
 *  its deepest grade instead of on nothing. */
export function workingGradeFor(lane: LaneDepth): number {
  const ahead = lane.contentGrades.find((grade) => grade > lane.depth);
  if (ahead !== undefined) return ahead;
  return lane.contentGrades[lane.contentGrades.length - 1] ?? 1;
}

/** The row's status within its grade. Only the first unfinished unit is the
 *  frontier; the rest are plain rows whose stars say how far they got. */
function rowState(index: number, stars: 0 | 1 | 2 | 3, frontier: number): UnitState {
  if (stars === 3) return 'done';
  return index === frontier ? 'current' : 'started';
}

export default function LaneScreen({ strand, initialGrade, onBack, onOpenLane, onOpenLesson }: LaneScreenProps) {
  const { ready, store, revision, clock } = useProgressContext();
  const [picking, setPicking] = useState(false);
  /** null = "wherever the learner is working", recomputed as the store changes.
   *  A grade chosen from the picker pins the view until they leave the screen. */
  const [chosen, setChosen] = useState<number | null>(initialGrade ?? null);

  const depths = useMemo(() => {
    if (!store) return null;
    return laneDepths(store, clock.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6), not read directly above
  }, [store, revision, clock]);

  const lane = depths?.[strand] ?? null;
  const working = lane ? workingGradeFor(lane) : 1;
  const grade = chosen ?? working;

  const units = useMemo(() => laneUnits(strand, grade), [strand, grade]);

  const rows = useMemo(() => {
    if (!store) return [];
    const stars = units.map((lesson) => deriveStars(lesson.atoms, store));
    const frontier = stars.findIndex((s) => s < 3);
    return units.map((lesson, i) => ({ lesson, stars: stars[i], state: rowState(i, stars[i], frontier) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6)
  }, [units, store, revision]);

  if (!ready || !store || !lane || !depths) {
    return (
      <Screen testID="lane-loading">
        <Text style={styles.muted}>Loading…</Text>
      </Screen>
    );
  }

  const def = strandDef(strand);
  const ahead = grade - working;
  const frontierRow = rows.find((row) => row.state === 'current');

  return (
    <Screen testID="lane-screen">
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Pressable testID="lane-back" onPress={onBack} accessibilityRole="button" style={styles.back}>
          <Text style={styles.backLabel}>‹ All skills</Text>
        </Pressable>

        {/* The heading names the STRAND and does not change between grades. */}
        <View style={styles.header}>
          <Text style={[styles.glyph, { color: def.hue }]}>{def.glyph}</Text>
          <Text style={[styles.title, { color: def.hue }]} testID="lane-heading">
            {def.label}
          </Text>
        </View>

        {ahead > 0 ? (
          <Text style={styles.lead} testID="lane-ahead-note">
            {ahead === 1 ? 'One grade' : `${ahead} grades`} above where you are. Nothing stops you — it just leans on
            a few things.
          </Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel} testID="lane-grade-label">
            Grade {grade}
            {grade === working ? ' · where you are' : ''}
          </Text>
          <Text style={styles.sectionCount}>{units.length === 1 ? '1 unit' : `${units.length} units`}</Text>
        </View>

        {units.length === 0 ? (
          <View style={styles.empty} testID="lane-empty">
            <Text style={styles.emptyText}>{def.label} has nothing at grade {grade} yet.</Text>
            <Text style={styles.emptyHint}>Pick another grade below — this skill picks up elsewhere.</Text>
          </View>
        ) : null}

        {rows.map((row) => {
          // An edge only speaks when it is unmet: a chip on a prerequisite the
          // learner already holds is noise, and R10 is advice, not bookkeeping.
          const unmet = prerequisitesFor(row.lesson.id).filter(
            (edge) => depths[edge.requiresStrand as Strand].depth < edge.requiresGrade,
          );

          return (
            <View key={row.lesson.id} style={styles.unit}>
              <UnitRow
                strand={strand}
                title={row.lesson.title}
                stars={row.stars}
                state={row.state}
                showStrand={false}
                onPress={() => onOpenLesson?.(row.lesson)}
                testID={`unit-row-${row.lesson.id}`}
              />
              {unmet.map((edge) => (
                <View key={edge.requiresStrand} style={styles.chipWrap}>
                  <PrereqChip
                    strand={edge.requiresStrand as Strand}
                    depth={depths[edge.requiresStrand as Strand].depth}
                    why={edge.why}
                    onPress={() => onOpenLane?.(edge.requiresStrand as Strand)}
                    testID={`prereq-chip-${row.lesson.id}-${edge.requiresStrand}`}
                  />
                </View>
              ))}
            </View>
          );
        })}

        {/* Above the learner's depth the primary action is the way back, so a look
            ahead can never strand anyone (R2). Entry is never withdrawn. */}
        {ahead > 0 ? (
          <Pressable testID="lane-return" onPress={() => setChosen(null)} accessibilityRole="button" style={styles.ghost}>
            <Text style={styles.ghostLabel}>Back to grade {working}</Text>
          </Pressable>
        ) : frontierRow ? (
          <Pressable
            testID="lane-primary"
            onPress={() => onOpenLesson?.(frontierRow.lesson)}
            accessibilityRole="button"
            style={[styles.primary, { backgroundColor: def.hue }]}
          >
            <Text style={styles.primaryLabel}>
              {frontierRow.stars === 0 ? 'Start' : 'Continue'} · {frontierRow.lesson.title.toLowerCase()}
            </Text>
          </Pressable>
        ) : null}

        {/* The whole of the other-grade navigation: one muted line. */}
        <Pressable testID="lane-other-grades" onPress={() => setPicking((open) => !open)} accessibilityRole="button">
          <Text style={styles.more}>Other grades {picking ? '⌃' : '⌄'}</Text>
        </Pressable>

        {picking ? (
          <View style={styles.picker} testID="lane-grade-picker">
            <Text style={styles.pickerHead}>{def.label} · other grades</Text>
            {GRADES.map((g) => {
              const hasContent = lane.contentGrades.includes(g);
              const note = !hasContent
                ? 'nothing here yet'
                : g === grade
                  ? 'where you are'
                  : lane.heldGrades.includes(g)
                    ? 'held'
                    : `${laneUnits(strand, g).length} units`;

              // A grade with no content is not a lock, it is an absence — so it is
              // stated plainly and simply has nothing to open.
              if (!hasContent) {
                return (
                  <View key={g} style={styles.gradeRow} testID={`lane-grade-option-${g}`}>
                    <Text style={[styles.gradeName, styles.dim]}>Grade {g}</Text>
                    <Text style={[styles.gradeNote, styles.dim]} testID={`lane-grade-option-${g}-note`}>
                      {note}
                    </Text>
                  </View>
                );
              }

              return (
                <Pressable
                  key={g}
                  testID={`lane-grade-option-${g}`}
                  accessibilityRole="button"
                  onPress={() => {
                    setChosen(g);
                    setPicking(false);
                  }}
                  style={[styles.gradeRow, g === grade && { borderColor: def.hue, backgroundColor: `${def.hue}1f` }]}
                >
                  <Text style={styles.gradeName}>Grade {g}</Text>
                  <Text style={[styles.gradeNote, g === grade && { color: def.hue }]} testID={`lane-grade-option-${g}-note`}>
                    {note}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: shape.spaceInline,
    // `Screen` insets the top edge only, so the screen gutter is the scroll
    // content's own job — without it every row runs to the bezel (caught
    // dogfooding, not by jest: the layout-free renderer finds the row either way).
    paddingHorizontal: shape.spaceScreenX,
    paddingBottom: shape.spaceStack,
  },
  back: {
    paddingVertical: shape.spaceTight,
  },
  backLabel: {
    ...typo.label,
    color: colors.textGhost,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceSnug,
  },
  glyph: {
    fontFamily: fonts.music,
    fontSize: 19,
  },
  title: {
    ...typo.overline,
  },
  lead: {
    ...typo.body,
    color: colors.textMuted,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: shape.spaceHairline,
  },
  sectionLabel: {
    ...typo.overline,
    color: colors.textFaint,
  },
  sectionCount: {
    ...typo.label,
    color: colors.textGhost,
  },
  unit: {
    gap: shape.spaceSnug,
  },
  chipWrap: {
    paddingLeft: shape.spaceInline,
  },
  empty: {
    borderWidth: shape.borderW,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: shape.radiusCard,
    padding: shape.spaceCard,
    gap: shape.spaceSnug,
  },
  emptyText: {
    ...typo.body,
    color: colors.textMuted,
  },
  emptyHint: {
    ...typo.label,
    color: colors.textGhost,
  },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: shape.spaceCard,
    borderRadius: shape.radiusButton,
    minHeight: shape.tapMin,
    marginTop: shape.spaceHairline,
  },
  primaryLabel: {
    ...typo.option,
    fontSize: 15,
    color: colors.bg,
  },
  ghost: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: shape.spaceCard,
    borderRadius: shape.radiusButton,
    borderWidth: shape.borderWActive,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
    minHeight: shape.tapMin,
    marginTop: shape.spaceHairline,
  },
  ghostLabel: {
    ...typo.option,
    fontSize: 15,
    color: colors.text,
  },
  more: {
    ...typo.label,
    color: colors.textGhost,
    paddingVertical: shape.spaceSnug,
  },
  picker: {
    backgroundColor: colors.surfaceCardSunken,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    borderRadius: shape.radiusCard,
    padding: shape.spaceInline,
    gap: shape.spaceTight,
  },
  pickerHead: {
    ...typo.overline,
    color: colors.textFaint,
    marginBottom: shape.spaceTight,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: shape.spaceInline,
    paddingVertical: shape.spaceInline,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: 'transparent',
    minHeight: shape.tapMin,
  },
  gradeName: {
    ...typo.option,
    fontSize: 14,
    color: colors.text,
  },
  gradeNote: {
    ...typo.label,
    color: colors.textFaint,
  },
  dim: {
    color: colors.textGhost,
  },
  muted: {
    ...typo.body,
    color: colors.textMuted,
  },
});
