// fyu.12 — the tap-to-pair flow of the drag_match interaction (design 5f):
// select a meaning from the pool, tap a term to pair it, tap a filled term to
// return its meaning to the pool. The registry spec test covers grade/canCheck/
// emptyResponse; this covers the component's own pairing state transitions.

import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';

import type { ExerciseInstance } from '../../engine/schema';
import { DragMatch, type DragMatchResponse } from './DragMatch';

const INSTANCE: ExerciseInstance = {
  id: 'd1',
  template_id: 'instrument_knowledge',
  grade: 4,
  strand: 'terms_signs',
  prompt: 'Match each direction to its meaning.',
  stimulus: { music: null, text: null },
  interaction: { type: 'drag_match', config: { left: ['arco', 'pizzicato'], right: ['plucked', 'with the bow'] } },
  answer: { canonical: { arco: 'with the bow', pizzicato: 'plucked' }, accepted_alternatives: [] },
  distractors: [],
  hints: [],
  feedback: { correct: 'c', incorrect: 'i' },
  srs_tags: [],
  kb_version: 'test',
};

/** Host that threads response state, mirroring ExerciseLoop's ownership. */
function Harness({ graded = null }: { graded?: boolean | null }) {
  const [response, setResponse] = useState<DragMatchResponse>({ arco: null, pizzicato: null });
  return (
    <DragMatch
      instance={INSTANCE}
      response={response}
      graded={graded}
      strand="terms_signs"
      onResponseChange={(r) => setResponse(r as DragMatchResponse)}
    />
  );
}

describe('DragMatch tap-to-pair', () => {
  test('selecting a pool meaning then tapping a term pairs them, removing it from the pool', () => {
    const { getByTestId, queryByTestId } = render(<Harness />);

    fireEvent.press(getByTestId('drag-match-pool-with the bow'));
    fireEvent.press(getByTestId('drag-match-term-arco'));

    // The meaning left the pool (now paired to arco).
    expect(queryByTestId('drag-match-pool-with the bow')).toBeNull();
    expect(queryByTestId('drag-match-pool-plucked')).toBeTruthy();
  });

  test('tapping a filled term with no held pick returns its meaning to the pool', () => {
    const { getByTestId, queryByTestId } = render(<Harness />);

    fireEvent.press(getByTestId('drag-match-pool-plucked'));
    fireEvent.press(getByTestId('drag-match-term-pizzicato'));
    expect(queryByTestId('drag-match-pool-plucked')).toBeNull();

    // Tap the filled term again (nothing held) → clears it back to the pool.
    fireEvent.press(getByTestId('drag-match-term-pizzicato'));
    expect(queryByTestId('drag-match-pool-plucked')).toBeTruthy();
  });

  test('when graded, the pool is hidden and every term shows its canonical meaning', () => {
    const { getByText, queryByTestId } = render(<Harness graded={false} />);
    expect(queryByTestId('drag-match-pool')).toBeNull();
    expect(getByText('with the bow')).toBeTruthy();
    expect(getByText('plucked')).toBeTruthy();
  });
});
