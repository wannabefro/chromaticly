// SetRunner (U7/U9): drives a fixed 8-item set for a lesson (design 2b header →
// items → 2f). Cycles the lesson's templates (itemIndex % templates.length, seeds
// 0..7) so a multi-template lesson varies its interaction across the set — a
// single-template lesson is unaffected (i % 1 === 0 always picks templates[0]).
// Feeds ExerciseLoop, and on each Continue records the atom exactly once (A2) and
// the per-item mastery gem. On the 8th it marks the lesson complete once (A2) and
// shows SetComplete. The notation surface persists across items (perf refactor).

import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LESSONS, type Lesson } from '../content/lessons';
import { generate } from '../engine/generators';
import { emptySet, gems, isComplete, recordItem, score, segmentStates, SET_SIZE, type ExerciseSetState } from '../learn/exercise-set';
import { accountNudgeStats } from '../learn/mastery-rollup';
import { useProgressContext } from '../learn/ProgressContext';
import type { SrsGrade } from '../learn/srs';
import { buildContextPassage } from '../engine/generators/context-passage';
import { ContextRunner } from './ContextRunner';
import { ExerciseLoop } from './ExerciseLoop';
import { AccountNudgeSheet } from './components/AccountNudgeSheet';
import { ProgressSegments } from './components/ProgressSegments';
import { SetComplete } from './SetComplete';
import { TeachPhase } from './TeachPhase';
import type { AttemptResult } from './grading';
import { Screen } from './Screen';
import { colors, shape, type as typo, type Strand } from './theme';

/** The learner has invested enough to be worth an account nudge (design 6c). */
const NUDGE_AFTER_LESSONS = 3;

export interface SetRunnerProps {
  lesson: Lesson;
  onDone?: () => void;
  /** The account nudge's "Name my account" was tapped (design 6c). The host owns the
   *  account-creation screen (KTD6); it marks the nudge seen only on account success (KTD7). */
  onCreateAccount?: () => void;
}

export function SetRunner({ lesson, onDone, onCreateAccount }: SetRunnerProps) {
  const { recordAtom, recordFlashcardGrade, complete, isFactCollected, collectFact, store, isNamed, nudgeSeen, markNudgeSeen } =
    useProgressContext();
  // Lessons with teach content open on the teach/read phase (design 4a/4b); the
  // sticky "Start exercises" CTA advances into the set. Lessons without teach
  // content drop straight into exercises, unchanged.
  const [phase, setPhase] = useState<'teach' | 'set'>(lesson.teach ? 'teach' : 'set');
  const [itemIndex, setItemIndex] = useState(0);
  const [setState, setSetState] = useState(emptySet());
  const [done, setDone] = useState(false);
  // The nudge (design 6c) fires only on a real completion TRANSITION, not a replay of an
  // already-complete lesson (KTD2/KTD5) — `complete()` returns false on a replay.
  const [justCompleted, setJustCompleted] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const tickRef = useRef(0);
  const strand = lesson.strand as Strand;

  const templateId = lesson.templates[itemIndex % lesson.templates.length];

  // Music in Context is a passage, not a question (8d): one score with several
  // sub-questions asked over it. It is still ONE item in the set — the gem is the
  // passage as a whole — but each sub-question is its own mark and its own atom.
  const isPassage = templateId === 'music_in_context';

  const passage = useMemo(
    () => (isPassage ? buildContextPassage({ grade: 1, seed: itemIndex, atoms: lesson.atoms }) : null),
    [isPassage, itemIndex, lesson.atoms],
  );

  const instance = useMemo(
    () => (isPassage ? null : generate(templateId, { grade: 1, seed: itemIndex, atoms: lesson.atoms })),
    [isPassage, templateId, itemIndex, lesson.atoms],
  );

  // Shared by both the checked (handleResult) and self-graded (handleSelfGrade)
  // paths: fold one item's gem into the set and either advance or complete the
  // lesson exactly once (A2) — the only thing that differs between them is how
  // the atom itself gets recorded (recordAtom vs recordFlashcardGrade, AD4b).
  const advance = useCallback(
    async (nextState: ExerciseSetState) => {
      setSetState(nextState);
      if (isComplete(nextState)) {
        const transitioned = await complete(lesson); // A2: complete the lesson exactly once
        setJustCompleted(transitioned); // true only on the first completion, not a replay
        setDone(true);
      } else {
        setItemIndex((i) => i + 1);
      }
    },
    [complete, lesson],
  );

  // Optional chaining, not a non-null assertion: on a passage item `instance` really
  // is null, and the React Compiler hoists a deref like `instance.srs_tags[0]` out of
  // the callback into render scope — where it would crash the screen before the
  // callback could ever be called. (Device-only: jest has no compiler.)
  const handleResult = useCallback(
    async (result: AttemptResult) => {
      const atom = instance?.srs_tags[0];
      if (atom === undefined) return;
      await recordAtom(atom, result, tickRef.current++); // A2: record the atom once, here
      await advance(recordItem(setState, result));
    },
    [instance, recordAtom, setState, advance],
  );

  // A passage's sub-questions each carry their own atom, so mastery moves per
  // sub-question — but the SET sees one item, whose gem is clean only if the learner
  // got the whole passage right. Answering three of four is not a clean read of the
  // music.
  const handleSubResult = useCallback(
    async (result: AttemptResult) => {
      if (result.atom !== null) await recordAtom(result.atom, result, tickRef.current++);
    },
    [recordAtom],
  );

  const handlePassageDone = useCallback(
    async (results: AttemptResult[]) => {
      await advance(
        recordItem(setState, {
          correct: results.every((r) => r.correct),
          hintsUsed: results.reduce((n, r) => n + r.hintsUsed, 0),
        }),
      );
    },
    [setState, advance],
  );

  // U7/AD4b: a flashcard has no correct/incorrect verdict, so it never reaches
  // handleResult — Good/Easy count as a clean gem, Hard as hinted, Again as
  // missed, mirroring the same mapping recordFlashcardGrade applies to mastery.
  const handleSelfGrade = useCallback(
    async (grade: SrsGrade) => {
      const atom = instance?.srs_tags[0];
      if (atom === undefined) return;
      await recordFlashcardGrade(atom, grade, tickRef.current++);
      await advance(recordItem(setState, { correct: grade !== 'again', hintsUsed: grade === 'hard' ? 1 : 0 }));
    },
    [instance, recordFlashcardGrade, setState, advance],
  );

  if (phase === 'teach' && lesson.teach) {
    return (
      <Screen testID="set-runner">
        <TeachPhase
          lesson={lesson}
          onStart={() => setPhase('set')}
          onClose={() => onDone?.()}
          factCollected={isFactCollected(lesson.id)}
          onCollectFact={() => collectFact(lesson.id)}
        />
      </Screen>
    );
  }

  if (done) {
    // Design 6c: a one-time save-progress nudge over the dimmed complete screen, only on a
    // real completion transition, only for an unnamed learner who hasn't seen it, ≥3 lessons
    // in. `store` is present here (ready long before any set completes).
    const showNudge =
      justCompleted && !isNamed && !nudgeSeen && !nudgeDismissed && store != null && store.completedLessonCount() >= NUDGE_AFTER_LESSONS;
    const stats = showNudge && store ? accountNudgeStats(store, LESSONS, tickRef.current) : null;
    return (
      <Screen>
        <SetComplete gems={gems(setState)} score={score(setState)} total={SET_SIZE} strand={strand} onNext={() => onDone?.()} />
        {stats && (
          <AccountNudgeSheet
            lessons={stats.lessons}
            stars={stats.stars}
            dueCount={stats.dueCount}
            onCreate={() => onCreateAccount?.()}
            onDismiss={async () => {
              await markNudgeSeen(); // once-only; awaited so the flag persists before we move on (KTD7)
              setNudgeDismissed(true);
            }}
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen} testID="set-runner">
      <View style={styles.header}>
        <Pressable testID="set-close" onPress={() => onDone?.()} hitSlop={12}>
          <Text style={styles.close}>×</Text>
        </Pressable>
        <View style={styles.segments}>
          <ProgressSegments states={segmentStates(setState)} strand={strand} />
        </View>
        <Text style={styles.count} testID="set-count">
          {itemIndex + 1}/{SET_SIZE}
        </Text>
      </View>
      {passage ? (
        <ContextRunner passage={passage} onSubResult={handleSubResult} onDone={handlePassageDone} />
      ) : (
        <ExerciseLoop instance={instance!} onResult={handleResult} onSelfGrade={handleSelfGrade} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceInline,
  },
  close: { ...typo.title, color: colors.textMuted },
  segments: { flex: 1 },
  count: { ...typo.label, color: colors.textMuted },
});
