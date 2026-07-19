// Grade select (design step 2): the only setup question. Invariant this guards —
// only Grade 1 is selectable (Grades 2–5 have no content), so onboarding can never
// start an ungenerated grade (R2).

import { fireEvent, render } from '@testing-library/react-native';

import { LEVELS } from '../../content/levels';
import { isLevelUnlocked } from '../../learn/mastery-rollup';
import { ProgressStore } from '../../learn/store';
import { GradeSelectScreen } from './GradeSelectScreen';

describe('GradeSelectScreen — only Grade 1 is selectable; the rest are locked (R2)', () => {
  test('renders the question, all five grade pills, and the reassurance line', () => {
    const { getByTestId, getByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    expect(getByTestId('grade-select-screen')).toBeTruthy();
    for (let g = 1; g <= 5; g++) expect(getByTestId(`grade-pill-${g}`)).toBeTruthy();
    expect(getByText('You can switch grades any time in Profile.')).toBeTruthy();
  });

  test('Grade 1 is enabled while Grades 2–5 are disabled ("coming soon")', () => {
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    expect(getByTestId('grade-pill-1').props.accessibilityState?.disabled).toBeFalsy();
    for (const g of [2, 3, 4, 5]) {
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

  test('tapping a locked grade never changes the selection or starts an unsupported grade', () => {
    const onSelectGrade = jest.fn();
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={onSelectGrade} />);

    // Disabled pills don't fire onPress; the CTA must still start Grade 1, never 2.
    fireEvent.press(getByTestId('grade-pill-2'));
    fireEvent.press(getByTestId('start-grade'));
    expect(onSelectGrade).toHaveBeenCalledTimes(1);
    expect(onSelectGrade).toHaveBeenCalledWith(1);
  });

  // D14: onboarding's start-grade is a static content concept, deliberately decoupled
  // from progression unlock — a device where Level 2 is reachable must not offer it to
  // a brand-new profile at onboarding.
  test('still offers only Grade 1, and defaults to it, even on a store where Level 2 is unlocked', () => {
    const store = new ProgressStore();
    store.recordExamCleared(1);
    expect(isLevelUnlocked(LEVELS[1], store)).toBe(true); // Level 2 IS reachable on this store...

    // ...but GradeSelectScreen never reads the store, so its selectability is unaffected.
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(getByTestId('grade-pill-1').props.accessibilityState?.disabled).toBeFalsy();
    expect(getByTestId('grade-pill-2').props.accessibilityState?.disabled).toBe(true);
    expect(getByTestId('start-grade')).toHaveTextContent('Start Grade 1');
  });
});
