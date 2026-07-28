// Free practice (U12): an endless SRS-driven exercise stream. Each step asks
// practice-plan for the weakest-due unlocked template (falling back to a
// rotation once nothing is due) and generates fresh from it.

import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { generate } from '../engine/generators';
import { useProgressContext } from '../learn/ProgressContext';
import { nextPracticeTemplate } from '../learn/practice-plan';
import { ExerciseLoop } from './ExerciseLoop';
import type { AttemptResult } from './grading';

export function Practice() {
  const { store, recordAtom, isUnlocked, clock } = useProgressContext();
  const [step, setStep] = useState(0);

  const pick = useMemo(
    () => (store ? nextPracticeTemplate(store.atomEntries(), clock.now(), isUnlocked, step) : null),
    [store, isUnlocked, step, clock],
  );

  const instance = useMemo(
    () => (pick ? generate(pick.template, { grade: pick.grade, seed: step, atoms: pick.atoms }) : null),
    [pick, step],
  );

  // Continue on the FeedbackSheet fires onResult; record and advance the stream here.
  const handleResult = useCallback(
    async (result: AttemptResult) => {
      if (!instance) return;
      const atom = instance.srs_tags[0];
      await recordAtom(atom, result, clock.now());
      setStep((s) => s + 1);
    },
    [instance, recordAtom, clock],
  );

  if (!instance) {
    return (
      <View style={styles.empty} testID="practice-empty">
        <Text>No practice available yet — unlock a lesson first.</Text>
      </View>
    );
  }

  // flex:1, not padded: ExerciseLoop's own root is flex:1 and it supplies its body
  // padding. A non-flex wrapper collapses the loop's ScrollView to zero height on
  // device (only the notation card peeks) while jest's layout-free renderer stays
  // green — the same trap SetRunner avoids by hosting ExerciseLoop in a flex Screen.
  return (
    <View style={styles.active} testID="practice-active">
      <ExerciseLoop instance={instance} onResult={handleResult} />
    </View>
  );
}

const styles = StyleSheet.create({
  active: { flex: 1 },
  empty: { gap: 12, padding: 16 },
});
