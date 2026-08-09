// Your plan (design step 3): three model-setting cards + the warm-up hand-off (R3).
//
// Since R1 this screen takes no grade. Placement seeds seven independent depths,
// so there is no single grade to print — the one thing left to know is whether
// the learner is inside the exam ladder or below it.

import { fireEvent, render } from '@testing-library/react-native';

import { warmUpFor } from '../../learn/warm-up';
import { PlanScreen } from './PlanScreen';

describe('PlanScreen — sets the mental model, then funnels to the warm-up (R3)', () => {
  test('renders the three plan cards and the warm-up block', () => {
    const { getByTestId, getByText } = render(<PlanScreen firstSteps={false} onStartWarmUp={jest.fn()} />);

    expect(getByTestId('plan-screen')).toBeTruthy();
    expect(getByText('Short lessons')).toBeTruthy();
    expect(getByText('Quick exercises')).toBeTruthy();
    expect(getByText('A real practice exam')).toBeTruthy();
    expect(getByText(warmUpFor(null).title)).toBeTruthy();
  });

  // R1: seven depths, no headline grade. Printing one here would re-assert on the
  // third screen the rank placement exists to stop making.
  test('it names no grade number at all', () => {
    const { queryByText } = render(<PlanScreen firstSteps={false} onStartWarmUp={jest.fn()} />);
    expect(queryByText(/grade \d/i)).toBeNull();
  });

  // fyu.3: free grade access removed the exam-clear requirement, so the exam card
  // must read as advisory (design 7c's exact copy), never as gated.
  test('the exam card is advisory (design 7c), not the old "unlocks as you master" gated copy', () => {
    const { getByText, queryByText } = render(<PlanScreen firstSteps={false} onStartWarmUp={jest.fn()} />);

    expect(getByText("Sit it whenever you like — we'll tell you when you look ready.")).toBeTruthy();
    expect(queryByText(/unlocks as you master/i)).toBeNull();
  });

  test('"Try your first question" starts the warm-up', () => {
    const onStartWarmUp = jest.fn();
    const { getByTestId } = render(<PlanScreen firstSteps={false} onStartWarmUp={onStartWarmUp} />);

    fireEvent.press(getByTestId('plan-start-warmup'));
    expect(onStartWarmUp).toHaveBeenCalledTimes(1);
  });
});

// First steps is reachable from the skip screen, so this is the FIRST thing a
// beginner sees after choosing it. Two things it must not do: print the forbidden
// words, and sell an exam that does not exist.
describe('PlanScreen — First steps has no paper, and no grade number', () => {
  test('it names the level rather than a grade number', () => {
    const { getByText, queryByText } = render(<PlanScreen firstSteps onStartWarmUp={jest.fn()} />);

    expect(getByText("Here's how First steps works")).toBeTruthy();
    expect(queryByText(/grade 0/i)).toBeNull();
  });

  // One definition drives the generator, the recorded atom, the accent and this
  // line. Naming a warm-up the learner will not be given is how they drift apart.
  test('the warm-up block names the First steps warm-up, not the grade-1 one', () => {
    const { getByText, queryByText } = render(<PlanScreen firstSteps onStartWarmUp={jest.fn()} />);

    expect(getByText(warmUpFor(0).title)).toBeTruthy();
    expect(queryByText(warmUpFor(1).title)).toBeNull();
  });

  // Three cards either way. Dropping the exam card without replacing it left a
  // visible hole on the device, which reads as unfinished rather than deliberate.
  test('the exam card is replaced, not removed — the level ends in Grade 1 instead', () => {
    const { getByText, queryByText } = render(<PlanScreen firstSteps onStartWarmUp={jest.fn()} />);

    expect(queryByText('A real practice exam')).toBeNull();
    expect(queryByText(/Sit it whenever you like/)).toBeNull();
    expect(getByText('Then Grade 1')).toBeTruthy();
  });

  test('the two cards are exclusive — never both, on either route', () => {
    const below = render(<PlanScreen firstSteps onStartWarmUp={jest.fn()} />);
    expect(below.queryByText('A real practice exam')).toBeNull();

    const inside = render(<PlanScreen firstSteps={false} onStartWarmUp={jest.fn()} />);
    expect(inside.queryByText('Then Grade 1')).toBeNull();
  });
});
