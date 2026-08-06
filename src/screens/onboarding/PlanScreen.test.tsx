// Your plan (design step 3): three model-setting cards + the warm-up hand-off (R3).

import { fireEvent, render } from '@testing-library/react-native';

import { PlanScreen } from './PlanScreen';

describe('PlanScreen — sets the mental model, then funnels to the warm-up (R3)', () => {
  test('renders the three plan cards, the warm-up block, and the grade in the copy', () => {
    const { getByTestId, getByText } = render(<PlanScreen grade={1} onStartWarmUp={jest.fn()} />);

    expect(getByTestId('plan-screen')).toBeTruthy();
    expect(getByText("Here's how Grade 1 works")).toBeTruthy();
    expect(getByText('Short lessons')).toBeTruthy();
    expect(getByText('Quick exercises')).toBeTruthy();
    expect(getByText('A real practice exam')).toBeTruthy();
    expect(getByText('Note values warm-up')).toBeTruthy();
  });

  // fyu.3: free grade access removed the exam-clear requirement, so the exam card
  // must read as advisory (design 7c's exact copy), never as gated.
  test('the exam card is advisory (design 7c), not the old "unlocks as you master" gated copy', () => {
    const { getByText, queryByText } = render(<PlanScreen grade={1} onStartWarmUp={jest.fn()} />);

    expect(getByText("Sit it whenever you like — we'll tell you when you look ready.")).toBeTruthy();
    expect(queryByText(/unlocks as you master/i)).toBeNull();
  });

  test('"Try your first question" starts the warm-up', () => {
    const onStartWarmUp = jest.fn();
    const { getByTestId } = render(<PlanScreen grade={1} onStartWarmUp={onStartWarmUp} />);

    fireEvent.press(getByTestId('plan-start-warmup'));
    expect(onStartWarmUp).toHaveBeenCalledTimes(1);
  });
});

// First steps is reachable from the picker as of the 2026-08-06 design ruling, so
// this screen is now the FIRST thing a beginner sees after choosing it. Two things
// it must not do: print the forbidden words, and sell an exam that does not exist.
describe('PlanScreen — First steps has no paper, and no grade number', () => {
  test('it names the level rather than a grade number', () => {
    const { getByText, queryByText } = render(<PlanScreen grade={0} onStartWarmUp={jest.fn()} />);

    expect(getByText("Here's how First steps works")).toBeTruthy();
    expect(queryByText(/grade 0/i)).toBeNull();
  });

  // Three cards either way. Dropping the exam card without replacing it left a
  // visible hole on the device, which reads as unfinished rather than deliberate.
  test('the exam card is replaced, not removed — the level ends in Grade 1 instead', () => {
    const { getByText, queryByText } = render(<PlanScreen grade={0} onStartWarmUp={jest.fn()} />);

    expect(queryByText('A real practice exam')).toBeNull();
    expect(queryByText(/Sit it whenever you like/)).toBeNull();
    expect(getByText('Then Grade 1')).toBeTruthy();
  });

  // Driven by examGate, never by a grade === 0 special case, so a level that later
  // gains a paper gets the right card without anyone remembering to add it.
  test('the grades keep the exam card and never get the hand-off one', () => {
    for (const grade of [1, 2, 3, 4, 5]) {
      const { getByText, queryByText } = render(<PlanScreen grade={grade} onStartWarmUp={jest.fn()} />);
      expect(getByText('A real practice exam')).toBeTruthy();
      expect(queryByText('Then Grade 1')).toBeNull();
    }
  });
});
