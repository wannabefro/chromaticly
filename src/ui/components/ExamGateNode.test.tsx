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

  // Locked (no onPress): inert display, shows the lock and the unlock condition.
  test('is inert while locked — no onPress, lock shown', () => {
    const { getByTestId, getByText } = render(<ExamGateNode levelGrade={1} unitsRequired={7} testID="exam-gate" />);

    const node = getByTestId('exam-gate');
    expect(node.props.onPress).toBeUndefined();
    expect(getByText('🔒')).toBeTruthy();
    expect(() => fireEvent.press(node)).not.toThrow();
  });

  // Unlocked (onPress provided, 302.2): tappable exam entry, no lock, ready copy.
  test('is a tappable exam entry once unlocked', () => {
    const onPress = jest.fn();
    const { getByTestId, getByText } = render(
      <ExamGateNode levelGrade={1} unitsRequired={7} onPress={onPress} testID="exam-gate" />,
    );

    expect(getByText('Ready — tap to start the practice paper')).toBeTruthy();
    fireEvent.press(getByTestId('exam-gate'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
