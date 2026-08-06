// Grade select (design step 2): the only setup question. Invariant this guards —
// only grades WITH CONTENT are selectable, so onboarding can never start an
// ungenerated grade (R2). As of chromaticly-ehp (Grade 5 shipping its content
// slice) every grade 1-5 has content, so every pill is selectable — there is
// no content-less grade left to lock.

import { fireEvent, render } from '@testing-library/react-native';

import { LEVELS } from '../../content/levels';
import { isLevelUnlocked } from '../../learn/mastery-rollup';
import { placeableStrands } from '../../learn/placement';
import { ProgressStore } from '../../learn/store';
import { GradeSelectScreen } from './GradeSelectScreen';

describe('GradeSelectScreen — every content-ful grade is selectable; onboarding never starts an ungenerated grade (R2, fyu.2)', () => {
  test('renders the question, all five grade pills, and the reassurance line', () => {
    const { getByTestId, getByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    expect(getByTestId('grade-select-screen')).toBeTruthy();
    for (let g = 1; g <= 5; g++) expect(getByTestId(`grade-pill-${g}`)).toBeTruthy();
    expect(getByText('You can switch grades any time in Profile.')).toBeTruthy();
  });

  test('all five grades (1-5) are content-ful and enabled — no pill is disabled', () => {
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    for (const g of [1, 2, 3, 4, 5]) {
      expect(getByTestId(`grade-pill-${g}`).props.accessibilityState?.disabled).toBeFalsy();
    }
  });

  test('the placement-quiz affordance is present but disabled (deferred)', () => {
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(getByTestId('placement-quiz').props.accessibilityState?.disabled).toBe(true);
  });

  // The card promised 8 questions while placement asks one per placeable strand,
  // which is 7 (design ruling 7c, 2026-07-31: the count is derived).
  test('the quiz card promises one question per placeable strand, never a literal', () => {
    const { getByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(getByText(new RegExp(`^${placeableStrands().length} questions`))).toBeTruthy();
  });

  test('starting selects Grade 1', () => {
    const onSelectGrade = jest.fn();
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={onSelectGrade} />);

    fireEvent.press(getByTestId('grade-pill-1'));
    fireEvent.press(getByTestId('start-grade'));
    expect(onSelectGrade).toHaveBeenCalledWith(1);
  });

  // chromaticly-ehp: Grade 5 shipped its content slice, so there is no longer
  // a locked/content-less pill to exercise the "disabled tap is a no-op" path
  // against — Grade 5 is now content-ful and selectable, same as every other
  // grade, so tapping it behaves like tapping any other content-ful grade.
  test('tapping the now-content-ful Grade 5 changes the selection and starts Grade 5', () => {
    const onSelectGrade = jest.fn();
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={onSelectGrade} />);

    fireEvent.press(getByTestId('grade-pill-5'));
    fireEvent.press(getByTestId('start-grade'));
    expect(onSelectGrade).toHaveBeenCalledTimes(1);
    expect(onSelectGrade).toHaveBeenCalledWith(5);
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
  // Level 5 is reachable (content-ful) even on a store where every exam is recorded
  // cleared, and the default selection stays Grade 1 rather than jumping to a
  // later startable grade.
  test('selectability is unaffected by any store/exam state; every grade pill stays enabled and Grade 1 stays the default even with every exam cleared', () => {
    const store = new ProgressStore();
    store.recordExamCleared(1);
    store.recordExamCleared(2);
    store.recordExamCleared(3);
    store.recordExamCleared(4);
    expect(isLevelUnlocked(LEVELS[4], store)).toBe(true); // guards the premise: Level 5 is content-ful and reachable

    // ...and GradeSelectScreen never reads the store at all, so its selectability is unaffected either way.
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(getByTestId('grade-pill-1').props.accessibilityState?.disabled).toBeFalsy();
    expect(getByTestId('grade-pill-2').props.accessibilityState?.disabled).toBeFalsy();
    expect(getByTestId('grade-pill-5').props.accessibilityState?.disabled).toBeFalsy();
    expect(getByTestId('start-grade')).toHaveTextContent('Start Grade 1');
  });
});

// First steps (grade 0, chromaticly-dhe) is a real level and is reachable — it is
// just not offered HERE yet. design 5a draws exactly five cards and `design/` has
// no screen for a sixth, so how it should appear is an open design decision. These
// assertions hold the line until that ruling lands, and go red the moment someone
// adds the level to this picker without one.
describe('grade select — First steps stays off the picker until the design rules on it', () => {
  test('exactly the grade-1..5 levels get a pill, and grade 0 gets none', () => {
    const { getByTestId, queryByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    expect(queryByTestId('grade-pill-0')).toBeNull();
    for (const level of LEVELS.filter((l) => l.grade >= 1)) {
      expect(getByTestId(`grade-pill-${level.grade}`)).toBeTruthy();
    }
  });

  test('the words "Grade 0" appear nowhere on the screen', () => {
    const { queryByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(queryByText(/grade 0/i)).toBeNull();
  });

  test('Grade 1 is the default even though a lower level now exists', () => {
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(getByTestId('start-grade')).toHaveTextContent('Start Grade 1');
  });

  test('the level itself is real — the pill is filtered, not the level', () => {
    expect(LEVELS.find((l) => l.grade === 0)!.unitIds.length).toBeGreaterThan(0);
  });
});
