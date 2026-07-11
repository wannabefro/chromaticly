// Minimal runnable practice harness (U12 shell, step 1): generate a real Grade 1
// exercise and mount the ExerciseLoop, rotating through all five templates so a
// device dogfood exercises notation render + audio (note/interval/rhythm/key)
// and the text-only term path. No mastery/persistence yet — that arrives with
// Lesson/Practice proper (U11 UI). Its job is to make the slice runnable so the
// owed on-device checks (U3 audio, U10 notation) can finally happen.

import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { GENERATORS, generate } from '../engine/generators';
import { ExerciseLoop } from '../ui/ExerciseLoop';
import type { AttemptResult } from '../ui/grading';

const TEMPLATES = Object.keys(GENERATORS);

export default function PracticeScreen() {
  const [step, setStep] = useState(0);
  const [answered, setAnswered] = useState(false);

  const templateId = TEMPLATES[step % TEMPLATES.length];
  const instance = useMemo(() => generate(templateId, { grade: 1, seed: step }), [templateId, step]);

  const handleResult = useCallback((_r: AttemptResult) => setAnswered(true), []);
  const next = useCallback(() => {
    setAnswered(false);
    setStep((s) => s + 1);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container} testID="practice-screen">
      <Text testID="template-label" style={styles.label}>
        {templateId}
      </Text>
      {/* key={step} remounts the loop so its hint/graded state resets each exercise. */}
      <ExerciseLoop key={step} instance={instance} onResult={handleResult} />
      {answered && (
        <Pressable testID="next" style={styles.next} onPress={next}>
          <Text style={styles.nextText}>Next exercise</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, padding: 16 },
  label: { fontSize: 12, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1 },
  next: { padding: 14, borderRadius: 8, backgroundColor: '#2a6', alignItems: 'center' },
  nextText: { color: '#fff', fontWeight: '600' },
});
