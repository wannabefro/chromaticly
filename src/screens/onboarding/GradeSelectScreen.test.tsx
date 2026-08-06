// Grade select (design step 2): the only setup question. Invariant this guards —
// only grades WITH CONTENT are selectable, so onboarding can never start an
// ungenerated grade (R2). As of chromaticly-ehp (Grade 5 shipping its content
// slice) every grade 1-5 has content, so every pill is selectable — there is
// no content-less grade left to lock.

import { fireEvent, render, within } from '@testing-library/react-native';

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
    expect(getByText('You can switch any time in Profile.')).toBeTruthy();
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

// First steps (grade 0) leads the picker as a set-apart lead-in card, never as a
// sixth rung of the grade ladder — design/README.md, "First steps sits above the
// grade ladder, not inside it" (approved 2026-08-06). Each assertion below pins
// one clause of that ruling, so a later edit that quietly turns it back into a
// sixth grade goes red.
describe('grade select — First steps leads the picker without joining the ladder', () => {
  test('it is offered, and it is offered FIRST — order is the whole reason for the shape', () => {
    const { getByTestId, getAllByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    expect(getByTestId('grade-pill-0')).toBeTruthy();
    const ids = getAllByTestId(/^grade-pill-\d$/).map((n) => n.props.testID);
    expect(ids[0]).toBe('grade-pill-0');
  });

  // The level has no exam, no gate and no place in exam readiness, and "Grade 0"
  // reads as a failing mark to an adult beginner. The internal key never surfaces.
  test('the words "Grade 0" appear nowhere on the screen', () => {
    const { queryByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(queryByText(/grade 0/i)).toBeNull();
  });

  test('its card names the level and says it carries no exam', () => {
    const { getByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(getByText('First steps')).toBeTruthy();
    expect(getByText(/No exam\./)).toBeTruthy();
  });

  // Ruling clause 4. A default that drops every tap-through learner into the
  // beginner level is worse than one that misses a beginner.
  test('Grade 1 stays the default selection, even though a lower level now leads the list', () => {
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(getByTestId('start-grade')).toHaveTextContent('Start Grade 1');
  });

  // Ruling clause 5. `Start Grade ${grade}` would print the forbidden words, so
  // the button reads the level TITLE — which is also still right for the five.
  test('selecting it makes the button read the level title, and starting it passes grade 0', () => {
    const onSelectGrade = jest.fn();
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={onSelectGrade} />);

    fireEvent.press(getByTestId('grade-pill-0'));
    expect(getByTestId('start-grade')).toHaveTextContent('Start First steps');

    fireEvent.press(getByTestId('start-grade'));
    expect(onSelectGrade).toHaveBeenCalledWith(0);
  });

  // Ruling clause 2: one mono label carries the distinction, so the five below it
  // stay a ladder of five rather than becoming a list of six.
  test('a group label separates it from the grades it is not one of', () => {
    const { getByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(getByText('or pick your grade')).toBeTruthy();
  });

  test('the headline is 5a\'s question, not the "do you know your grade?" drift', () => {
    const { getByText, queryByText } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    expect(getByText('Where should we start?')).toBeTruthy();
    expect(queryByText(/do you know your grade/i)).toBeNull();
  });
});

// The grade numerals (design/README.md, "The grade cards are numbered, in one
// accent"). 5a gave each of the five badges its OWN hue, which spends the
// screen's single accent five times to encode nothing — so the numeral
// identifies the rung and the accent states which one is chosen.
describe('grade select — the five are numbered rungs, and First steps is not one', () => {
  test('each grade card shows its own numeral', () => {
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    for (const g of [1, 2, 3, 4, 5]) {
      expect(within(getByTestId(`grade-pill-${g}`)).getByText(String(g))).toBeTruthy();
    }
  });

  // The whole argument for putting First steps above the ladder was that a sixth
  // numeral would assert it is the grade below Grade 1. A badge here would undo it.
  test('First steps carries no numeral, which is what keeps it out of the ladder', () => {
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    const starter = within(getByTestId('grade-pill-0'));
    for (const g of [0, 1, 2, 3, 4, 5]) expect(starter.queryByText(String(g))).toBeNull();
  });

  // One accent per screen. A badge that is accent-hued at rest would put the
  // screen's accent on all five cards, and it would stop meaning "selected".
  test('only the selected card draws its numeral in the accent', () => {
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);

    const badgeStyle = (g: number) => {
      const numeral = within(getByTestId(`grade-pill-${g}`)).getByText(String(g));
      return JSON.stringify(numeral.props.style);
    };
    expect(badgeStyle(1)).not.toEqual(badgeStyle(2)); // 1 is the default selection
    expect(badgeStyle(2)).toEqual(badgeStyle(3));
    expect(badgeStyle(3)).toEqual(badgeStyle(5));
  });

  test('selecting another grade moves the accent rather than adding one', () => {
    const { getByTestId } = render(<GradeSelectScreen onSelectGrade={jest.fn()} />);
    const numeralStyle = (g: number) =>
      JSON.stringify(within(getByTestId(`grade-pill-${g}`)).getByText(String(g)).props.style);

    const restingStyle = numeralStyle(3);
    fireEvent.press(getByTestId('grade-pill-3'));

    expect(numeralStyle(3)).not.toEqual(restingStyle);
    expect(numeralStyle(1)).toEqual(restingStyle); // grade 1 handed the accent back
  });
});
