// Free practice (U12): an endless SRS-driven exercise stream. Each step asks
// practice-plan for the weakest-due unlocked template (falling back to a
// rotation once nothing is due) and generates fresh from it.

import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { generate } from '../engine/generators';
import { useProgressContext } from '../learn/ProgressContext';
import { nextPracticeTemplate } from '../learn/practice-plan';
import { ExerciseLoop } from './ExerciseLoop';
import type { AttemptResult } from './grading';

export function Practice() {
  const { store, recordAtom, isUnlocked } = useProgressContext();
  const [step, setStep] = useState(0);
  // Session-local monotonic clock driving SRS `now`; resets on app restart —
  // cross-session SRS precision is out of MVP scope.
  const tickRef = useRef(0);

  const pick = useMemo(
    () => (store ? nextPracticeTemplate(store.atomEntries(), tickRef.current, isUnlocked, step) : null),
    [store, isUnlocked, step],
  );

  const instance = useMemo(
    () => (pick ? generate(pick.template, { grade: 1, seed: step, atoms: pick.atoms }) : null),
    [pick, step],
  );

  // Continue on the FeedbackSheet fires onResult; record and advance the stream here.
  const handleResult = useCallback(
    async (result: AttemptResult) => {
      if (!instance) return;
      const atom = instance.srs_tags[0];
      await recordAtom(atom, result, tickRef.current++);
      setStep((s) => s + 1);
    },
    [instance, recordAtom],
  );

  if (!instance) {
    return (
      <View style={styles.container} testID="practice-empty">
        <Text>No practice available yet — unlock a lesson first.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExerciseLoop instance={instance} onResult={handleResult} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16 },
});
