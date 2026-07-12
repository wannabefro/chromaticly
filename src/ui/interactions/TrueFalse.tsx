// True/false per-bar interaction (U5/R11): one tick/cross toggle pair per bar,
// mapped to bars by array index against the generator's bar-identity metadata
// (F10) — never by reading rendered stave geometry. No dedicated Grade 1
// mockup exists for this exact presentation (see the filed design bd issue);
// this derives from the design system's closest precedent — the "is each
// bar's rhythm valid? toggle pinned under each bar" pattern in
// design/Chromaticly Core Flows.dc.html's true/false-per-bar board card —
// using AnswerOption/FeedbackSheet's established selected/correct/incorrect
// state machine and design tokens (never a raw hex, no-raw-hex.test.ts).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, shape, type as typo } from '../theme';
import type { InteractionComponentProps } from './types';

export type TrueFalseResponse = (boolean | null)[];

type ToggleState = 'default' | 'selected' | 'correct' | 'incorrect';

function toggleState(buttonValue: boolean, response: boolean | null, correctVerdict: boolean, graded: boolean | null): ToggleState {
  if (graded === null) return response === buttonValue ? 'selected' : 'default';
  if (buttonValue === correctVerdict) return 'correct';
  if (response === buttonValue) return 'incorrect';
  return 'default';
}

function setAt<T>(array: T[], index: number, value: T): T[] {
  const next = array.slice();
  next[index] = value;
  return next;
}

interface BarToggleProps {
  glyph: '✓' | '✗';
  state: ToggleState;
  onPress?: () => void;
  testID?: string;
}

function BarToggle({ glyph, state, onPress, testID }: BarToggleProps) {
  const containerStyle = [
    styles.toggle,
    state === 'selected' && (glyph === '✓' ? styles.toggleTickSelected : styles.toggleCrossSelected),
    state === 'correct' && styles.toggleCorrect,
    state === 'incorrect' && styles.toggleIncorrect,
  ];
  const glyphStyle = [
    styles.toggleGlyph,
    (state === 'selected' || state === 'correct' || state === 'incorrect') && styles.toggleGlyphActive,
  ];
  return (
    <Pressable testID={testID} accessibilityLabel={glyph === '✓' ? 'valid' : 'invalid'} onPress={onPress} style={containerStyle}>
      <Text style={glyphStyle}>{glyph}</Text>
    </Pressable>
  );
}

export function TrueFalse({ instance, response, graded, onResponseChange }: InteractionComponentProps<TrueFalseResponse>) {
  const perItem = (instance.answer.per_item ?? []) as boolean[];

  return (
    <View style={styles.container} testID="true-false">
      {response.map((value, index) => {
        const correctVerdict = perItem[index];
        return (
          <View key={index} style={styles.barGroup} testID={`bar-${index}`}>
            <Text style={styles.barLabel}>{`Bar ${index + 1}`}</Text>
            <View style={styles.togglePair}>
              <BarToggle
                glyph="✓"
                state={toggleState(true, value, correctVerdict, graded)}
                testID={`bar-${index}-true`}
                onPress={graded === null ? () => onResponseChange(setAt(response, index, true)) : undefined}
              />
              <BarToggle
                glyph="✗"
                state={toggleState(false, value, correctVerdict, graded)}
                testID={`bar-${index}-false`}
                onPress={graded === null ? () => onResponseChange(setAt(response, index, false)) : undefined}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: shape.spaceInline },
  barGroup: { alignItems: 'center', gap: 6 },
  barLabel: { ...typo.overline, color: colors.textMuted },
  togglePair: { flexDirection: 'row', gap: 5 },
  toggle: {
    width: 34,
    height: 30,
    borderRadius: shape.radiusControl - 2,
    borderWidth: shape.borderWActive,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTickSelected: { borderColor: colors.correct, backgroundColor: colors.correctSurface },
  toggleCrossSelected: { borderColor: colors.incorrect, backgroundColor: colors.incorrectSurface },
  toggleCorrect: { borderColor: colors.correct, backgroundColor: colors.correctSurface },
  toggleIncorrect: { borderColor: colors.incorrect, backgroundColor: colors.incorrectSurface },
  toggleGlyph: { ...typo.option, color: colors.textFaint },
  toggleGlyphActive: { color: colors.text },
});
