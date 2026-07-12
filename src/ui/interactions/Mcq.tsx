// MCQ interaction (U6 reskin): a controlled grid of AnswerOption cards. Selection is
// reported upward; grading happens on Check in ExerciseLoop — pressing an option no
// longer grades (select → Check → feedback). When graded, the correct option shows
// ✓ and a wrong pick shows ×.

import { StyleSheet, View } from 'react-native';

import { AnswerOption } from '../components/AnswerOption';
import type { Option } from '../grading';
import { shape, type Strand } from '../theme';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export interface McqProps {
  options: Option[];
  selectedIndex: number | null;
  graded: boolean | null;
  strand: Strand;
  onSelectIndex: (index: number) => void;
}

export function Mcq({ options, selectedIndex, graded, strand, onSelectIndex }: McqProps) {
  return (
    <View style={styles.container} testID="mcq">
      {options.map((option, index) => {
        let state: 'default' | 'selected' | 'correct' | 'incorrect' = 'default';
        if (graded !== null) {
          if (option.correct) state = 'correct';
          else if (index === selectedIndex) state = 'incorrect';
        } else if (index === selectedIndex) {
          state = 'selected';
        }
        return (
          <AnswerOption
            key={index}
            testID={`option-${index}`}
            letter={LETTERS[index] ?? String(index + 1)}
            label={option.label}
            state={state}
            strand={strand}
            music={option.music}
            meta={graded !== null && index === selectedIndex && !option.correct ? 'your pick' : undefined}
            onPress={graded === null ? () => onSelectIndex(index) : undefined}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: shape.spaceInline },
});
