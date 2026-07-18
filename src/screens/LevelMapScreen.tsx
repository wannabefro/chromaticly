// Level map (U2, design 3a): the grade home (R1/KD1 — "grade" and "level" are
// the same axis). A vertical path of levels; Level 1 (the only unlocked level)
// renders expanded with its units + a locked exam-gate seal (R2/R3); Levels
// 2-5 render locked with their prerequisite (R4). Tapping an unlocked unit
// launches its set — the level map is now the only way into a lesson, so this
// keeps existing exercise-loop behavior reachable (previously DashboardScreen's
// "Begin" hero); the design's "continue ›" cue on the active unit implies the
// same tap-to-enter affordance.
//
// AD6: star/state derivation reads the mutable ProgressStore, so it's recomputed
// in a useMemo keyed explicitly on `revision` (not just `store`, whose identity
// never changes under in-place mutation) — jest stays green either way; revision
// is what keeps the map fresh on device after React Compiler auto-memoizes it.

import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { LESSONS, lessonById } from '../content/lessons';
import { LEVELS } from '../content/levels';
import { unitStates } from '../learn/mastery-rollup';
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

function prerequisiteTitleFor(unitId: string): string | undefined {
  return LESSONS.find((l) => l.unlocks === unitId)?.title;
}

function accentHueFor(rows: UnitRows): string {
  const frontier = rows.find((r) => r.state === 'active' || r.state === 'started');
  const lesson = frontier ? lessonById(frontier.unitId) : undefined;
  return lesson ? strandDef(lesson.strand as Strand).hue : ACCENT;
}

export interface LevelMapScreenProps {
  /** Told when a lesson or an exam takes over the screen, so the shell can drop its
   *  tab bar — an exercise is immersive, and an exam paper must not offer a tab out of
   *  itself mid-paper. */
  onImmersive?: (immersive: boolean) => void;
}

export default function LevelMapScreen({ onImmersive }: LevelMapScreenProps = {}) {
  const { ready, store, revision, markNudgeSeen } = useProgressContext();
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
      if (level.unlocked) {
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

  const currentLevel = LEVELS.find((l) => l.unlocked) ?? LEVELS[0];

  return (
    <Screen style={styles.screen} testID="level-map-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Learn</Text>
        <View style={styles.gradePill}>
          <Text style={styles.gradePillText}>Grade {currentLevel.grade}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {LEVELS.map((level) => {
          if (!level.unlocked) {
            return <LevelNode key={level.id} level={level} expanded={false} testID={`level-node-${level.id}`} />;
          }

          const rows = statesByLevel.get(level.id) ?? [];
          const doneCount = rows.filter((r) => r.state === 'done').length;

          return (
            <LevelNode
              key={level.id}
              level={level}
              expanded
              summary={{ doneCount, total: rows.length }}
              accentHue={accentHueFor(rows)}
              testID={`level-node-${level.id}`}
            >
              {rows.map((row) => {
                const lesson = lessonById(row.unitId);
                if (!lesson) return null;
                const locked = row.state === 'locked';
                return (
                  <UnitRow
                    key={row.unitId}
                    strand={lesson.strand as Strand}
                    title={lesson.title}
                    stars={row.stars}
                    state={row.state}
                    prerequisiteTitle={locked ? prerequisiteTitleFor(row.unitId) : undefined}
                    onPress={locked ? undefined : () => setActiveLessonId(row.unitId)}
                    testID={`unit-row-${row.unitId}`}
                  />
                );
              })}
              <ExamGateNode
                levelGrade={level.grade}
                unitsRequired={level.unitIds.length}
                onPress={
                  rows.reduce((sum, r) => sum + r.stars, 0) >= level.examGate.unlockAtStars
                    ? () => setExamGrade(level.grade)
                    : undefined
                }
                testID={`exam-gate-${level.id}`}
              />
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
    paddingTop: 4,
    paddingBottom: shape.spaceInline,
  },
  title: { ...typo.title, color: colors.text },
  gradePill: {
    backgroundColor: colors.surfaceCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    borderRadius: shape.radiusChip,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  gradePillText: { ...typo.label, color: colors.text },
  list: {
    paddingHorizontal: shape.spaceScreenX,
    paddingBottom: shape.spaceStack,
    gap: shape.spaceStack,
  },
});
