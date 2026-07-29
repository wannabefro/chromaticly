// SetRunner (U7/U9): drives a fixed 8-item set for a lesson (design 2b header →
// items → 2f). Cycles the lesson's templates (itemIndex % templates.length) so a
// multi-template lesson varies its interaction across the set — a single-template
// lesson is unaffected (i % 1 === 0 always picks templates[0]).
//
// SEEDS ROTATE PER PLAY. They used to be 0..7 every time, which made a lesson the
// same eight questions forever: replaying changed nothing, and any atom those
// eight seeds did not select could never be asked. Measured before the fix, that
// was 88 of the curriculum's 262 atoms — 34% — and review could not recover them
// either, because Practice only selects atoms the learner has ATTEMPTED.
//
// So the seed is `itemIndex + SET_SIZE * plays`. The first play is still 0..7, so
// a set is deterministic and every pinned generator snapshot and Maestro flow is
// byte-identical; the second play is 8..15, and so on. Measured after the fix,
// 22 of the 25 short lessons reach every atom within 2-4 plays.
// Feeds ExerciseLoop, and on each Continue records the atom exactly once (A2) and
// the per-item mastery gem. On the 8th it marks the lesson complete once (A2) and
// shows SetComplete. The notation surface persists across items (perf refactor).

import { useCallback, useMemo, useState } from 'react';
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
  const { ready, recordAtom, recordFlashcardGrade, complete, isFactCollected, collectFact, store, markNudgeSeen, clock } =
    useProgressContext();
  // Lessons with teach content open on the teach/read phase (design 4a/4b); the
  // sticky "Start exercises" CTA advances into the set. Lessons without teach
  // content drop straight into exercises, unchanged.
  const [phase, setPhase] = useState<'teach' | 'set'>(lesson.teach ? 'teach' : 'set');
  const [itemIndex, setItemIndex] = useState(0);
  // The play offset, held stable for the whole set: the count advances when THIS
  // set completes, and a seed that shifted mid-set would rebuild the question the
  // learner is looking at.
  //
  // `ready` is a dependency and `revision` deliberately is not. A lazy `useState`
  // initializer looks right here and is wrong: it runs on the first render, which
  // can be before the snapshot has loaded, and would pin every learner to offset 0
  // forever. Keying on `ready` recomputes exactly once, when the store arrives and
  // before any item can be answered. Keying on `revision` would instead re-read it
  // at the end of the set, when `complete()` bumps the count.
  const seedBase = useMemo(
    () => (store?.getLesson(lesson.id).plays ?? 0) * SET_SIZE,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is excluded on purpose; see above
    [store, ready, lesson.id],
  );
  const [setState, setSetState] = useState(emptySet());
  const [done, setDone] = useState(false);
  // Whether to overlay the account nudge (design 6c), and its stats. The gate is decided
  // in `advance` (an event handler, imperative fresh store reads) and stored here as real
  // state — NEVER read off the store in render, where React Compiler would memoize the
  // count on the stable store identity and miss the 2→3 completion transition on device.
  const [nudgeStats, setNudgeStats] = useState<{ lessons: number; stars: number; dueCount: number } | null>(null);
  const strand = lesson.strand as Strand;

  const templateId = lesson.templates[itemIndex % lesson.templates.length];

  // Music in Context is a passage, not a question (8d): one score with several
  // sub-questions asked over it. It is still ONE item in the set — the gem is the
  // passage as a whole — but each sub-question is its own mark and its own atom.
  const isPassage = templateId === 'music_in_context';

  const passage = useMemo(
    () => (isPassage ? buildContextPassage({ grade: lesson.grade, seed: seedBase + itemIndex, atoms: lesson.atoms }) : null),
    [isPassage, seedBase, itemIndex, lesson.atoms, lesson.grade],
  );

  const instance = useMemo(
    () => (isPassage ? null : generate(templateId, { grade: lesson.grade, seed: seedBase + itemIndex, atoms: lesson.atoms })),
    [isPassage, templateId, seedBase, itemIndex, lesson.atoms, lesson.grade],
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
        setDone(true);
        // Decide the nudge HERE, imperatively — `transitioned` is true only on the first
        // completion (not a replay), and the store reads below are fresh (an event handler,
        // not a memoized render). Gate: three lessons in, unnamed, not already seen.
        if (
          transitioned &&
          store &&
          !store.isNamed() &&
          !store.isNudgeSeen() &&
          store.completedLessonCount() >= NUDGE_AFTER_LESSONS
        ) {
          setNudgeStats(accountNudgeStats(store, LESSONS, clock.now()));
        }
      } else {
        setItemIndex((i) => i + 1);
      }
    },
    [complete, lesson, store],
  );

  // Optional chaining, not a non-null assertion: on a passage item `instance` really
  // is null, and the React Compiler hoists a deref like `instance.srs_tags[0]` out of
  // the callback into render scope — where it would crash the screen before the
  // callback could ever be called. (Device-only: jest has no compiler.)
  const handleResult = useCallback(
    async (result: AttemptResult) => {
      const atom = instance?.srs_tags[0];
      if (atom === undefined) return;
      await recordAtom(atom, result, clock.now()); // A2: record the atom once, here
      await advance(recordItem(setState, result));
    },
    [instance, recordAtom, setState, advance, clock],
  );

  // A passage's sub-questions each carry their own atom, so mastery moves per
  // sub-question — but the SET sees one item, whose gem is clean only if the learner
  // got the whole passage right. Answering three of four is not a clean read of the
  // music.
  const handleSubResult = useCallback(
    async (result: AttemptResult) => {
      if (result.atom !== null) await recordAtom(result.atom, result, clock.now());
    },
    [recordAtom, clock],
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
      await recordFlashcardGrade(atom, grade, clock.now());
      await advance(recordItem(setState, { correct: grade !== 'again', hintsUsed: grade === 'hard' ? 1 : 0 }));
    },
    [instance, recordFlashcardGrade, setState, advance, clock],
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
    // Design 6c: the nudge overlays the dimmed complete screen. Whether to show it was
    // decided in `advance` (nudgeStats set ⇒ show); render reads only that real state.
    return (
      <Screen>
        <SetComplete gems={gems(setState)} score={score(setState)} total={SET_SIZE} strand={strand} onNext={() => onDone?.()} />
        {nudgeStats && (
          <AccountNudgeSheet
            lessons={nudgeStats.lessons}
            stars={nudgeStats.stars}
            dueCount={nudgeStats.dueCount}
            onCreate={() => onCreateAccount?.()}
            onDismiss={async () => {
              await markNudgeSeen(); // once-only; awaited so the flag persists before we move on (KTD7)
              setNudgeStats(null);
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
