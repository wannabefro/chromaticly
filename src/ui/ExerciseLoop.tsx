// Exercise loop shell (U10): the RN presentational layer over grading.ts.
// Renders the prompt, stimulus (notation or text), the interaction
// component dispatched by interaction.type, a Hints control, and feedback
// after grading. Grading/labelling logic stays in grading.ts — this
// component only wires user input to it and emits the AttemptResult.

import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ExerciseInstance } from '../engine/schema';
import { MusicSurface, type MusicSurfaceHandle } from '../music-surface/MusicSurface';
import { Feedback } from './Feedback';
import { type AttemptResult, gradeMcq, gradeText, toResult } from './grading';
import { Hints } from './Hints';
import { Mcq } from './interactions/Mcq';
import { TextInputInteraction } from './interactions/TextInput';

export interface ExerciseLoopProps {
  instance: ExerciseInstance;
  onResult: (result: AttemptResult) => void;
}

export function ExerciseLoop({ instance, onResult }: ExerciseLoopProps) {
  const [graded, setGraded] = useState<boolean | null>(null);
  const hintsUsedRef = useRef(0);
  const surfaceRef = useRef<MusicSurfaceHandle>(null);

  // Reset per-exercise state when the instance changes — without remounting this
  // component. Practice/Lesson pass a fresh instance per step, so identity change
  // is the "next exercise" signal. Resetting here (rather than via a parent key=)
  // keeps the MusicSurface WebView mounted across exercises: notation arrives as a
  // cheap render message instead of reloading ~520KB abcjs + cold-initing the synth
  // every time. `reset.key` remounts only the (cheap) interaction/hints subtree so
  // Mcq/TextInput/Hints internal state clears the same way a full remount used to.
  const [reset, setReset] = useState({ instance, key: 0 });
  if (instance !== reset.instance) {
    setReset((r) => ({ instance, key: r.key + 1 }));
    setGraded(null);
    hintsUsedRef.current = 0;
  }

  const submit = useCallback(
    (correct: boolean) => {
      setGraded(correct);
      onResult(toResult(instance, correct, hintsUsedRef.current));
    },
    [instance, onResult],
  );

  const handleSelect = useCallback((value: unknown) => submit(gradeMcq(instance, value)), [instance, submit]);
  const handleSubmitText = useCallback((text: string) => submit(gradeText(instance, text)), [instance, submit]);
  const handleHintUsed = useCallback((count: number) => {
    hintsUsedRef.current = count;
  }, []);

  return (
    <View style={styles.container}>
      <Text testID="prompt" style={styles.prompt}>
        {instance.prompt}
      </Text>

      {instance.stimulus.music ? (
        <View style={styles.stimulus} testID="stimulus-music">
          <MusicSurface ref={surfaceRef} music={instance.stimulus.music} />
          <Pressable testID="play" onPress={() => surfaceRef.current?.play()}>
            <Text>Play</Text>
          </Pressable>
        </View>
      ) : (
        instance.stimulus.text != null && (
          <Text testID="stimulus-text" style={styles.stimulus}>
            {instance.stimulus.text}
          </Text>
        )
      )}

      <View key={reset.key} style={styles.interaction}>
        {graded === null &&
          (instance.interaction.type === 'text_input' ? (
            <TextInputInteraction onSubmit={handleSubmitText} />
          ) : (
            <Mcq instance={instance} onSelect={handleSelect} />
          ))}

        <Hints hints={instance.hints} onHintUsed={handleHintUsed} />

        {graded !== null && (
          <Feedback correct={graded} message={graded ? instance.feedback.correct : instance.feedback.incorrect} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16 },
  prompt: { fontSize: 18, fontWeight: '600' },
  stimulus: { marginVertical: 8 },
  interaction: { gap: 12 },
});
