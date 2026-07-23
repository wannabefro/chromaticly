// Acceptance tests for the exam-gate seal node (design 3a). Free grade access
// (fyu.3): the node is advisory, not locked — no 🔒 ever, and tappability is
// gated on `hasPaper`, not on star readiness.

import { fireEvent, render } from '@testing-library/react-native';

import { ExamGateNode } from './ExamGateNode';

describe('ExamGateNode', () => {
  test('renders the level exam title and advisory readiness copy, never "unlocks at"', () => {
    const { getByText, queryByText } = render(<ExamGateNode levelGrade={1} unitsRequired={7} />);

    expect(getByText('Level 1 Exam Paper')).toBeTruthy();
    expect(getByText('take it any time · best after 7 units ★')).toBeTruthy();
    expect(queryByText(/unlocks at/i)).toBeNull();
  });

  // The seal is advisory, never a lock — no 🔒 in any state (design 3a).
  test('without onPress it is display-only but shows no lock and no chevron', () => {
    const { getByTestId, queryByText } = render(<ExamGateNode levelGrade={1} unitsRequired={7} testID="exam-gate" />);

    const node = getByTestId('exam-gate');
    expect(node.props.onPress).toBeUndefined();
    expect(queryByText('🔒')).toBeNull();
    expect(queryByText('›')).toBeNull();
    expect(() => fireEvent.press(node)).not.toThrow();
  });

  test('is a tappable exam entry any time a paper exists, with the same advisory copy', () => {
    const onPress = jest.fn();
    const { getByTestId, getByText } = render(
      <ExamGateNode levelGrade={1} unitsRequired={7} onPress={onPress} testID="exam-gate" />,
    );

    expect(getByText('take it any time · best after 7 units ★')).toBeTruthy();
    expect(getByText('›')).toBeTruthy();
    fireEvent.press(getByTestId('exam-gate'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('a single required unit renders "unit" singular, not "units"', () => {
    const { getByText, queryByText } = render(<ExamGateNode levelGrade={2} unitsRequired={1} />);

    expect(getByText('take it any time · best after 1 unit ★')).toBeTruthy();
    expect(queryByText('take it any time · best after 1 units ★')).toBeNull();
  });

  // D8: a grade with no exam paper yet (hasPaper=false) must never promise a paper
  // that doesn't exist — it reads "Coming soon" instead of the advisory copy.
  describe('hasPaper=false (D8 — no exam paper yet)', () => {
    test('renders "Coming soon", no lock, no chevron, and stays inert', () => {
      const { getByTestId, getByText, queryByText } = render(
        <ExamGateNode levelGrade={2} unitsRequired={1} hasPaper={false} testID="exam-gate" />,
      );

      expect(getByText('Coming soon')).toBeTruthy();
      expect(queryByText(/take it any time/i)).toBeNull();
      expect(queryByText('🔒')).toBeNull();
      expect(queryByText('›')).toBeNull();
      expect(getByTestId('exam-gate').props.onPress).toBeUndefined();
    });

    // D8 hardening: even a caller mistake (passing onPress with no real paper)
    // must never open onto nothing — the rendered node itself carries no press
    // handler, so a real tap on the physical screen has nothing to fire.
    test('a caller-supplied onPress is never wired to the rendered node when there is no paper', () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <ExamGateNode levelGrade={2} unitsRequired={1} hasPaper={false} onPress={onPress} testID="exam-gate" />,
      );

      expect(getByTestId('exam-gate').props.onPress).toBeUndefined();
    });

    test('hasPaper defaults to true — omitting it keeps the advisory-copy behavior', () => {
      const { queryByText } = render(<ExamGateNode levelGrade={1} unitsRequired={7} />);
      expect(queryByText('Coming soon')).toBeNull();
    });
  });
});
