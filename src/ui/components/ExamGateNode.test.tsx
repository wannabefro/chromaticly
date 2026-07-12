// U2 acceptance tests for the exam-gate seal node (design 3a, KD5/AE2).

import { fireEvent, render } from '@testing-library/react-native';

import { ExamGateNode } from './ExamGateNode';

describe('ExamGateNode', () => {
  // R3: the node names its unlock condition.
  test('renders the level exam title and unlock condition', () => {
    const { getByText } = render(<ExamGateNode levelGrade={1} unitsRequired={7} />);

    expect(getByText('Level 1 Exam Paper')).toBeTruthy();
    expect(getByText('Practice paper · unlocks at 7 units ★')).toBeTruthy();
  });

  // AE2: the node is display-only — selecting it starts no exam. It exposes no
  // onPress at all, so tapping it is a structural no-op, not a handled no-op.
  test('is inert on tap — pressing it throws nothing and has no onPress prop', () => {
    const { getByTestId } = render(<ExamGateNode levelGrade={1} unitsRequired={7} testID="exam-gate" />);

    const node = getByTestId('exam-gate');
    expect(node.props.onPress).toBeUndefined();
    expect(() => fireEvent.press(node)).not.toThrow();
  });
});
