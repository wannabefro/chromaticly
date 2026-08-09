// The skip destination (R1). This screen used to be the grade ladder — five
// numbered pills plus a disabled placement-quiz card. Placement replaced all of
// it, so what is guarded here is the OPPOSITE invariant to the old file's: that
// no numbered rung survives, and that a learner who declines the questions still
// gets a real choice between the two starting points.
//
// The design/README.md ruling "First steps sits above the grade ladder, not
// inside it" is now preserved by construction — there is no ladder to sit inside.

import { fireEvent, render } from '@testing-library/react-native';

import { GradeSelectScreen } from './GradeSelectScreen';

describe('GradeSelectScreen — the skip destination, with no grade ladder left (R1)', () => {
  test('renders the question and both starting points', () => {
    const { getByTestId, getByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    expect(getByTestId('grade-select-screen')).toBeTruthy();
    expect(getByText('Where should we start?')).toBeTruthy();
    expect(getByTestId('start-point-0')).toBeTruthy();
    expect(getByTestId('start-point-1')).toBeTruthy();
  });

  // R1's whole claim is that there is no single current grade to pick. A numbered
  // rung is that claim contradicted on the first screen after placement.
  test('no numbered grade pill survives', () => {
    const { queryByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    for (let g = 1; g <= 5; g++) expect(queryByTestId(`grade-pill-${g}`)).toBeNull();
  });

  // Superseded by placement itself (chromaticly-302.14, closed 2026-08-09): a
  // single-grade recommendation is exactly what R1 deletes.
  test('the disabled placement-quiz card is gone', () => {
    const { queryByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(queryByTestId('placement-quiz')).toBeNull();
  });

  // "Skip — start from the beginning" is the CTA that lands here, so the beginning
  // is what it must offer. A Grade 1 default would make the copy a lie.
  test('First steps is preselected, so Continue alone starts at the beginning', () => {
    const onSelectGrade = jest.fn();
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={onSelectGrade} />);

    expect(getByTestId('start-grade')).toHaveTextContent('Start First steps');
    fireEvent.press(getByTestId('start-grade'));
    expect(onSelectGrade).toHaveBeenCalledWith(0);
  });

  test('Grade 1 is the second choice, for a reader who declined the questions', () => {
    const onSelectGrade = jest.fn();
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={onSelectGrade} />);

    fireEvent.press(getByTestId('start-point-1'));
    expect(getByTestId('start-grade')).toHaveTextContent('Start Grade 1');

    fireEvent.press(getByTestId('start-grade'));
    expect(onSelectGrade).toHaveBeenCalledWith(1);
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

  // One accent per screen (never-violate rule 3), and here it means "selected".
  test('selecting the other card moves the accent rather than adding one', () => {
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    const state = (g: number) => getByTestId(`start-point-${g}`).props.accessibilityState?.selected;

    expect(state(0)).toBe(true);
    expect(state(1)).toBe(false);

    fireEvent.press(getByTestId('start-point-1'));
    expect(state(0)).toBe(false);
    expect(state(1)).toBe(true);
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
