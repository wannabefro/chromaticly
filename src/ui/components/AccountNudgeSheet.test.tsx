import { fireEvent, render } from '@testing-library/react-native';

import { AccountNudgeSheet } from './AccountNudgeSheet';

function renderSheet(overrides = {}) {
  const onCreate = jest.fn();
  const onDismiss = jest.fn();
  const utils = render(
    <AccountNudgeSheet lessons={3} stars={2} dueCount={12} onCreate={onCreate} onDismiss={onDismiss} {...overrides} />,
  );
  return { onCreate, onDismiss, ...utils };
}

describe('AccountNudgeSheet (design 6c)', () => {
  test('shows the three real stats from props', () => {
    const { getByText } = renderSheet();
    expect(getByText(/3 lessons complete/)).toBeTruthy();
    expect(getByText(/2★ mastery earned/)).toBeTruthy();
    expect(getByText(/12 terms in your review queue/)).toBeTruthy();
  });

  // Why: the governing principle — no fake numbers, no promises the app can't keep.
  // Guards against regressing to the design-verbatim overpromises (XP, "sync to the web app").
  test('never renders XP or a save/sync promise', () => {
    const { queryByText } = renderSheet();
    expect(queryByText(/XP/)).toBeNull();
    expect(queryByText(/sync/i)).toBeNull();
    expect(queryByText(/Save my progress/i)).toBeNull();
  });

  test('the primary CTA fires onCreate, the secondary fires onDismiss', () => {
    const { getByTestId, onCreate, onDismiss } = renderSheet();
    fireEvent.press(getByTestId('account-nudge-sheet-create'));
    expect(onCreate).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId('account-nudge-sheet-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('singularises a one-lesson / one-term card', () => {
    const { getByText } = renderSheet({ lessons: 1, dueCount: 1 });
    expect(getByText(/1 lesson complete/)).toBeTruthy();
    expect(getByText(/1 term in your review queue/)).toBeTruthy();
  });
});
