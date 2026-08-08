// Level map (U2, design 3a): the grade home (R1/KD1 — "grade" and "level" are
// the same axis). Free grade access (fyu.3): nothing is locked. Content-ful
// levels (1-3) render expanded with their units + an always-advisory exam-gate
// seal; content-less levels (4-5, until their epics) render collapsed with a
// readiness chip instead of a lock — the only levels that hide/lock are the
// ones with no content to show. Tapping any unit (or a level's header) switches
// the working grade to that level's AND launches its set — the level map is the
// only way into a lesson, so this keeps existing exercise-loop behavior
// reachable (previously DashboardScreen's "Begin" hero); the design's
// "continue ›" cue on the active unit implies the same tap-to-enter affordance.
//
// AD6: star/state derivation reads the mutable ProgressStore, so it's recomputed
// in a useMemo keyed explicitly on `revision` (not just `store`, whose identity
// never changes under in-place mutation) — jest stays green either way; revision
// is what keeps the map fresh on device after React Compiler auto-memoizes it.

import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { LESSONS, lessonById } from '../content/lessons';
import { LEVELS, type Level } from '../content/levels';
import { hasExamPaper } from '../learn/exam';
import { currentLevel, isLevelUnlocked, unitStates } from '../learn/mastery-rollup';
import { useProgressContext } from '../learn/ProgressContext';
import { AccountCreateScreen } from './AccountCreateScreen';
import { ExamGateNode } from '../ui/components/ExamGateNode';
import { LevelNode } from '../ui/components/LevelNode';
import { UnitRow } from '../ui/components/UnitRow';
import { ExamRunner } from '../ui/exam/ExamRunner';
import { Screen } from '../ui/Screen';
import { SetRunner } from '../ui/SetRunner';
import { ACCENT, colors, shape, strandDef, type as typo, type Strand } from '../ui/theme';

type UnitRows = ReturnType<typeof unitStates>;

function accentHueFor(rows: UnitRows): string {
  const frontier = rows.find((r) => r.state === 'active' || r.state === 'started');
  const lesson = frontier ? lessonById(frontier.unitId) : undefined;
  return lesson ? strandDef(lesson.strand as Strand).hue : ACCENT;
}

/** The unit a level-wide "start" tap should open: the active unit, else the first
 *  row. Nothing is locked since G6 U3, so there is no unreachable row to skip. */
function frontierUnitId(rows: UnitRows): string | undefined {
  return (rows.find((r) => r.state === 'active') ?? rows[0])?.unitId;
}

/** Readiness chip for a content-less level (design 3a: "builds on L3" / "assumes
 *  L1-4" replace the old lock). The topmost level "assumes" the whole chain
 *  behind it; every other content-less level just "builds on" its immediate
 *  predecessor. */
function readinessNoteFor(level: Level, levels: Level[]): string {
  const isTopmost = levels[levels.length - 1]?.id === level.id && levels.length > 2;
  return isTopmost ? `assumes L1–${level.grade - 1}` : `builds on L${level.grade - 1}`;
}

export interface LevelMapScreenProps {
  /** Told when a lesson or an exam takes over the screen, so the shell can drop its
   *  tab bar — an exercise is immersive, and an exam paper must not offer a tab out of
   *  itself mid-paper. */
  onImmersive?: (immersive: boolean) => void;
}

export default function LevelMapScreen({ onImmersive }: LevelMapScreenProps = {}) {
  const { ready, store, revision, markNudgeSeen, setGrade } = useProgressContext();
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [examGrade, setExamGrade] = useState<number | null>(null);
  // The account nudge (design 6c) routed here from SetRunner (KTD6); this screen owns the
  // name-your-account step so SetRunner (ui layer) never renders a screen.
  const [accountFlow, setAccountFlow] = useState(false);

  useEffect(() => {
    onImmersive?.(activeLessonId !== null || examGrade !== null || accountFlow);
  }, [onImmersive, activeLessonId, examGrade, accountFlow]);

  const statesByLevel = useMemo(() => {
    const map = new Map<string, UnitRows>();
    if (!store) return map;
    for (const level of LEVELS) {
      if (isLevelUnlocked(level, store)) {
        map.set(level.id, unitStates(level.unitIds, store, (id) => lessonById(id)?.atoms ?? []));
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the mutation signal (AD6), not read directly above
  }, [store, revision]);

  if (!ready || !store) {
    return (
      <Screen style={styles.screen} testID="level-map-loading">
        <Text style={styles.loading}>Loading…</Text>
      </Screen>
    );
  }

  if (examGrade != null) {
    return <ExamRunner grade={examGrade} onExit={() => setExamGrade(null)} />;
  }

  // Name-your-account (design 6b) — reached from the nudge's "Name my account". Marks the
  // nudge seen only on success (KTD7); a cancel leaves it unseen so it can re-fire later.
  if (accountFlow) {
    return (
      <AccountCreateScreen
        onCreated={async () => {
          await markNudgeSeen();
          setAccountFlow(false);
          setActiveLessonId(null);
        }}
        onCancel={() => {
          setAccountFlow(false);
          setActiveLessonId(null);
        }}
      />
    );
  }

  if (activeLessonId) {
    const lesson = lessonById(activeLessonId);
    if (lesson) {
      return <SetRunner lesson={lesson} onDone={() => setActiveLessonId(null)} onCreateAccount={() => setAccountFlow(true)} />;
    }
  }

  const activeLevel = currentLevel(LEVELS, store);

  return (
    <Screen style={styles.screen} testID="level-map-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Learn</Text>
        <View style={styles.gradePill}>
          {/* The level TITLE, never the number — a learner in First steps must not
              be shown "Grade 0", and the title is right for the five as well. */}
          <Text style={styles.gradePillText} testID="grade-pill">
            {activeLevel.title}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {LEVELS.map((level) => {
          if (!isLevelUnlocked(level, store)) {
            return (
              <LevelNode
                key={level.id}
                level={level}
                expanded={false}
                readinessNote={readinessNoteFor(level, LEVELS)}
                testID={`level-node-${level.id}`}
              />
            );
          }

          const rows = statesByLevel.get(level.id) ?? [];
          const doneCount = rows.filter((r) => r.state === 'done').length;

          // Design 3a: "tapping [a level] starts it, which is also how you switch
          // grades" — every entry point into a level's content sets it as the
          // working grade first, then routes as it did before (fyu.3).
          const startLevel = (unitId: string) => async () => {
            await setGrade(level.grade);
            setActiveLessonId(unitId);
          };
          const frontier = frontierUnitId(rows);

          return (
            <LevelNode
              key={level.id}
              level={level}
              expanded
              summary={{ doneCount, total: rows.length }}
              accentHue={accentHueFor(rows)}
              onStart={frontier ? startLevel(frontier) : undefined}
              startTestID={`level-tap-${level.grade}`}
              testID={`level-node-${level.id}`}
            >
              {rows.map((row) => {
                const lesson = lessonById(row.unitId);
                if (!lesson) return null;
                return (
                  <UnitRow
                    key={row.unitId}
                    strand={lesson.strand as Strand}
                    title={lesson.title}
                    stars={row.stars}
                    state={row.state}
                    onPress={startLevel(row.unitId)}
                    testID={`unit-row-${row.unitId}`}
                  />
                );
              })}
              {/* A level with no examGate cannot be sat (First steps), so it caps
                  with nothing rather than a seal promising a paper that will
                  never exist. */}
              {level.examGate != null && (
                <ExamGateNode
                  levelGrade={level.grade}
                  unitsRequired={level.unitIds.length}
                  hasPaper={hasExamPaper(level.grade)}
                  onPress={hasExamPaper(level.grade) ? () => setExamGrade(level.grade) : undefined}
                  testID={`exam-gate-${level.id}`}
                />
              )}
            </LevelNode>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { ...typo.body, color: colors.textMuted, padding: shape.spaceScreenX },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceTight,
    paddingBottom: shape.spaceInline,
  },
  title: { ...typo.title, color: colors.text },
  gradePill: {
    backgroundColor: colors.surfaceCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    borderRadius: shape.radiusChip,
    paddingHorizontal: shape.spaceInline,
    paddingVertical: shape.spaceSnug,
  },
  gradePillText: { ...typo.label, color: colors.text },
  list: {
    paddingHorizontal: shape.spaceScreenX,
    paddingBottom: shape.spaceStack,
    gap: shape.spaceStack,
  },
});
