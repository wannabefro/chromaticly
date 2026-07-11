// Post-submission feedback (U10): shows the instance's single correct/
// incorrect string. Per-distractor misconception feedback is deferred — the
// generators only emit one incorrect string today (see ExerciseLoop.tsx).

import { Text } from 'react-native';

export interface FeedbackProps {
  correct: boolean;
  message: string;
}

export function Feedback({ correct, message }: FeedbackProps) {
  return (
    <Text testID="feedback" accessibilityLabel={correct ? 'correct' : 'incorrect'}>
      {message}
    </Text>
  );
}
