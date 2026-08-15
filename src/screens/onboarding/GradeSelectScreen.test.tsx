// "I know my grade" — the fork's second door (design 5a).
//
// These tests guard the four 2026-08-06 rulings the restored ladder brings back.

import { fireEvent, render } from '@testing-library/react-native';

import { GradeSelectScreen } from './GradeSelectScreen';

describe('GradeSelectScreen — "I know my grade" (5a)', () => {
  test('renders the question, First steps, and all five rungs', () => {
    const { getByTestId, getByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    expect(getByTestId('grade-select-screen')).toBeTruthy();
    expect(getByText('Where should we start?')).toBeTruthy();
    for (let g = 0; g <= 5; g++) expect(getByTestId(`start-point-${g}`)).toBeTruthy();
  });

  test('one mono group label separates the lead-in card from the ladder', () => {
    const { getByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(getByText('or pick your grade')).toBeTruthy();
  });

  // A sixth numeral would assert First steps IS the grade below Grade 1.
  test('the five rungs are numbered and First steps is not', () => {
    const { getByTestId, queryByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    for (let g = 1; g <= 5; g++) expect(getByTestId(`start-point-${g}-numeral`)).toHaveTextContent(String(g));
    expect(queryByTestId('start-point-0-numeral')).toBeNull();
  });

  // Superseded by placement itself (chromaticly-302.14, closed 2026-08-09): a
  // single-grade recommendation is exactly what R1 deletes.
  test('the disabled placement-quiz card is gone', () => {
    const { queryByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(queryByTestId('placement-quiz')).toBeNull();
  });

  // First steps is read first, not chosen.
  test('Grade 1 is the default, and First steps is not preselected', () => {
    const onSelectGrade = jest.fn();
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={onSelectGrade} />);

    expect(getByTestId('start-grade')).toHaveTextContent('Start Grade 1');
    fireEvent.press(getByTestId('start-grade'));
    expect(onSelectGrade).toHaveBeenCalledWith(1);
  });

  test('every rung is selectable and reports its own grade', () => {
    for (let g = 2; g <= 5; g++) {
      const onSelectGrade = jest.fn();
      const { getByTestId } = render(<GradeSelectScreen onSelectGrade={onSelectGrade} />);

      fireEvent.press(getByTestId(`start-point-${g}`));
      expect(getByTestId('start-grade')).toHaveTextContent(`Start Grade ${g}`);
      fireEvent.press(getByTestId('start-grade'));
      expect(onSelectGrade).toHaveBeenCalledWith(g);
    }
  });

  test('First steps is still reachable, and reports grade 0', () => {
    const onSelectGrade = jest.fn();
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={onSelectGrade} />);

    fireEvent.press(getByTestId('start-point-0'));
    expect(getByTestId('start-grade')).toHaveTextContent('Start First steps');
    fireEvent.press(getByTestId('start-grade'));
    expect(onSelectGrade).toHaveBeenCalledWith(0);
  });

  // The level has no exam and no place in exam readiness, and "Grade 0" reads as
  // a failing mark to an adult beginner. The internal key never surfaces.
  test('the words "Grade 0" appear nowhere', () => {
    const { queryByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(queryByText(/grade 0/i)).toBeNull();
  });

  test('the First steps card says it carries no exam', () => {
    const { getByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(getByText('First steps')).toBeTruthy();
    expect(getByText(/No exam\./)).toBeTruthy();
  });

  // One accent per screen (rule 3): exactly one card holds it.
  test('selecting a card moves the accent rather than adding one', () => {
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    const state = (g: number) => getByTestId(`start-point-${g}`).props.accessibilityState?.selected;
    const chosen = () => [0, 1, 2, 3, 4, 5].filter((g) => state(g) === true);

    expect(chosen()).toEqual([1]);
    fireEvent.press(getByTestId('start-point-4'));
    expect(chosen()).toEqual([4]);
    fireEvent.press(getByTestId('start-point-0'));
    expect(chosen()).toEqual([0]);
  });

  test('Back returns to the placement pass, and is absent when there is nowhere to go', () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} onBack={onBack} />);
    fireEvent.press(getByTestId('grade-select-back'));
    expect(onBack).toHaveBeenCalledTimes(1);

    const { queryByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(queryByTestId('grade-select-back')).toBeNull();
  });
});
