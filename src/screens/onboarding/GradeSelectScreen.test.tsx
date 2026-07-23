// Grade select (design step 2): the only setup question. Invariant this guards —
// only grades WITH CONTENT are selectable (fyu.2: Grades 1-3 now; Grades 4-5 have
// no content yet), so onboarding can never start an ungenerated grade (R2).

import { fireEvent, render } from '@testing-library/react-native';

import { LEVELS } from '../../content/levels';
import { isLevelUnlocked } from '../../learn/mastery-rollup';
import { ProgressStore } from '../../learn/store';
import { GradeSelectScreen } from './GradeSelectScreen';

describe('GradeSelectScreen — only content-ful grades are selectable; content-less ones are locked (R2, fyu.2)', () => {
  test('renders the question, all five grade pills, and the reassurance line', () => {
    const { getByTestId, getByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    expect(getByTestId('grade-select-screen')).toBeTruthy();
    for (let g = 1; g <= 5; g++) expect(getByTestId(`grade-pill-${g}`)).toBeTruthy();
    expect(getByText('You can switch grades any time in Profile.')).toBeTruthy();
  });

  test('Grades 1-3 (content-ful) are enabled while Grades 4-5 (content-less) are disabled ("coming soon")', () => {
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    for (const g of [1, 2, 3]) {
      expect(getByTestId(`grade-pill-${g}`).props.accessibilityState?.disabled).toBeFalsy();
    }
    for (const g of [4, 5]) {
      expect(getByTestId(`grade-pill-${g}`).props.accessibilityState?.disabled).toBe(true);
    }
  });

  test('the placement-quiz affordance is present but disabled (deferred)', () => {
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(getByTestId('placement-quiz').props.accessibilityState?.disabled).toBe(true);
  });

  test('starting selects Grade 1', () => {
    const onSelectGrade = jest.fn();
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={onSelectGrade} />);

    fireEvent.press(getByTestId('grade-pill-1'));
    fireEvent.press(getByTestId('start-grade'));
    expect(onSelectGrade).toHaveBeenCalledWith(1);
  });

  test('tapping a locked (content-less) grade never changes the selection or starts an unsupported grade', () => {
    const onSelectGrade = jest.fn();
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={onSelectGrade} />);

    // Disabled pills don't fire onPress; the CTA must still start Grade 1, never 4.
    fireEvent.press(getByTestId('grade-pill-4'));
    fireEvent.press(getByTestId('start-grade'));
    expect(onSelectGrade).toHaveBeenCalledTimes(1);
    expect(onSelectGrade).toHaveBeenCalledWith(1);
  });

  // fyu.2: Grades 2-3 are newly selectable (content-ful) — a new invariant worth
  // guarding now that more than one grade can be chosen at onboarding.
  test('tapping a content-ful grade (e.g. Grade 2) changes the selection and the CTA', () => {
    const onSelectGrade = jest.fn();
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={onSelectGrade} />);

    fireEvent.press(getByTestId('grade-pill-2'));
    expect(getByTestId('start-grade')).toHaveTextContent('Start Grade 2');

    fireEvent.press(getByTestId('start-grade'));
    expect(onSelectGrade).toHaveBeenCalledWith(2);
  });

  // D14: onboarding's start-grade is a static content concept, deliberately decoupled
  // from progression unlock (`isLevelUnlocked`/the store) — GradeSelectScreen's
  // selectability never moves with exam/store state, only with content presence.
  // Level 4 stays locked even on a store where every exam is recorded cleared, and
  // the default selection stays Grade 1 rather than jumping to a later startable grade.
  test('selectability is unaffected by any store/exam state; Grade 4 stays locked and Grade 1 stays the default even with every exam cleared', () => {
    const store = new ProgressStore();
    store.recordExamCleared(1);
    store.recordExamCleared(2);
    store.recordExamCleared(3);
    expect(isLevelUnlocked(LEVELS[3], store)).toBe(false); // Level 4 stays content-less-unreachable regardless

    // ...and GradeSelectScreen never reads the store at all, so its selectability is unaffected either way.
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(getByTestId('grade-pill-1').props.accessibilityState?.disabled).toBeFalsy();
    expect(getByTestId('grade-pill-2').props.accessibilityState?.disabled).toBeFalsy();
    expect(getByTestId('grade-pill-4').props.accessibilityState?.disabled).toBe(true);
    expect(getByTestId('start-grade')).toHaveTextContent('Start Grade 1');
  });
});
