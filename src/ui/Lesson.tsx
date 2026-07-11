// Lesson runner (U12): worked example (if any) → a stream of generated
// exercises → completion. MVP completion rule is 5 hint-free correct answers
// (cumulative, not consecutive) on the lesson's first template — generators can't yet target the
// specific atoms a lesson lists, so per-atom mastery is still recorded (for
// Practice/SRS) but does not gate lesson completion here.

import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Lesson as LessonContent } from '../content/lessons';
import { generate } from '../engine/generators';
import { useProgressContext } from '../learn/ProgressContext';
import { MusicSurface } from '../music-surface/MusicSurface';
import { ExerciseLoop } from './ExerciseLoop';
import { type AttemptResult, optionLabel } from './grading';

const LESSON_TARGET = 5;

export interface LessonProps {
  lesson: LessonContent;
  onDone?: () => void;
}

export function Lesson({ lesson, onDone }: LessonProps) {
  const { recordAtom, complete } = useProgressContext();
  const [started, setStarted] = useState(lesson.worked_example == null);
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [awaitingNext, setAwaitingNext] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  // Session-local monotonic clock driving SRS `now`; resets on app restart —
  // cross-session SRS precision is out of MVP scope.
  const tickRef = useRef(0);

  const workedInstance = useMemo(
    () =>
      lesson.worked_example
        ? generate(lesson.worked_example.template_id, {
            grade: lesson.worked_example.grade,
            seed: lesson.worked_example.seed,
          })
        : null,
    [lesson],
  );

  const instance = useMemo(
    () => generate(lesson.templates[0], { grade: 1, seed: attemptIndex }),
    [lesson, attemptIndex],
  );

  const handleResult = useCallback(
    async (result: AttemptResult) => {
      const atom = instance.srs_tags[0];
      await recordAtom(atom, result, tickRef.current++);
      setAwaitingNext(true);
      if (result.correct && result.hintsUsed === 0) {
        const next = correctCount + 1;
        setCorrectCount(next);
        if (next >= LESSON_TARGET) {
          await complete(lesson);
          setDone(true);
        }
      }
    },
    [instance, recordAtom, correctCount, complete, lesson],
  );

  const handleNext = useCallback(() => {
    setAwaitingNext(false);
    setAttemptIndex((i) => i + 1);
  }, []);

  if (done) {
    return (
      <View style={styles.container} testID="lesson-complete">
        <Text style={styles.title}>Lesson complete!</Text>
        {lesson.unlocks && <Text testID="unlock-message">Next lesson unlocked.</Text>}
        <Pressable testID="back-to-map" style={styles.button} onPress={() => onDone?.()}>
          <Text style={styles.buttonText}>Back to lessons</Text>
        </Pressable>
      </View>
    );
  }

  if (!started && workedInstance) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Worked example</Text>
        <Text testID="worked-prompt">{workedInstance.prompt}</Text>
        {workedInstance.stimulus.music ? (
          <MusicSurface music={workedInstance.stimulus.music} />
        ) : (
          workedInstance.stimulus.text != null && (
            <Text testID="worked-stimulus-text">{workedInstance.stimulus.text}</Text>
          )
        )}
        <Text testID="worked-answer">{optionLabel(workedInstance.answer.canonical)}</Text>
        <Pressable testID="start-lesson" style={styles.button} onPress={() => setStarted(true)}>
          <Text style={styles.buttonText}>Start</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExerciseLoop key={attemptIndex} instance={instance} onResult={handleResult} />
      {awaitingNext && (
        <Pressable testID="next" style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>Next</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 12, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1 },
  button: { padding: 14, borderRadius: 8, backgroundColor: '#2a6', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
