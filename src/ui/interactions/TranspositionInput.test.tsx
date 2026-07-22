// U6 acceptance tests for the octave-transposition answer stave (design 9a/9b).
// The component itself never touches MusicSurface — the given-note stimulus is
// rendered separately by ExerciseLoop's own NotationCard — but this file also
// imports transpositionCorrectAnswerView indirectly via the module, which pulls
// in NotationCard -> MusicSurface -> react-native-webview (no native module in
// the jest environment), mocked exactly as ExerciseLoop.test.tsx/registry.test.ts do.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return {
    WebView: React.forwardRef((_props: Record<string, unknown>, _ref: unknown) => null),
  };
});

import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { ExerciseInstance } from '../../engine/schema';
import { transpositionBeginFix, type TranspositionResponse } from '../grading';
import { noteY, PAPER_INSET } from './stave-geometry';
import { TranspositionInput, transpositionCanCheck, transpositionEmptyResponse } from './TranspositionInput';

const instance: ExerciseInstance = {
  id: 'test-transposition-1',
  template_id: 'octave_transposition',
  grade: 3,
  strand: 'pitch',
  prompt: 'Rewrite this melody one octave lower, in the bass clef — same letter names, same rhythm.',
  stimulus: {
    music: {
      clef: 'treble',
      key_sig: 'C_major',
      time_sig: '4/4',
      voices: [
        {
          events: [
            { type: 'note', pitch: 'C5', dur: 'crotchet' },
            { type: 'note', pitch: 'E5', dur: 'crotchet' },
            { type: 'note', pitch: 'G5', dur: 'minim' },
            { type: 'barline', style: 'double' },
          ],
        },
      ],
    },
    text: null,
  },
  interaction: { type: 'transposition_input', config: { answerClef: 'bass', direction: 'down' } },
  answer: {
    canonical: [
      { pitch: 'C4', dur: 'crotchet' },
      { pitch: 'E4', dur: 'crotchet' },
      { pitch: 'G4', dur: 'minim' },
    ],
    accepted_alternatives: [],
    per_item: [
      { pitch: 'C4', dur: 'crotchet' },
      { pitch: 'E4', dur: 'crotchet' },
      { pitch: 'G4', dur: 'minim' },
    ],
  },
  distractors: [],
  hints: [],
  feedback: { correct: 'Correct!', incorrect: 'Not quite.' },
  srs_tags: ['transpose:octave'],
  kb_version: 'test',
};

function emptyResponse(): TranspositionResponse {
  return transpositionEmptyResponse(instance);
}

function renderInput(response: TranspositionResponse, graded: boolean | null = null, onResponseChange = jest.fn()) {
  return {
    onResponseChange,
    ...render(
      <TranspositionInput instance={instance} response={response} graded={graded} strand="pitch" onResponseChange={onResponseChange} />,
    ),
  };
}

describe('TranspositionInput — placement is pitch-only and sequential', () => {
  test('the first tap fills slot 0 with the tapped pitch — the learner never chooses a duration', () => {
    const { onResponseChange, getByTestId } = renderInput(emptyResponse());
    fireEvent.press(getByTestId('transposition-pitch-C4'));
    expect(onResponseChange).toHaveBeenCalledWith({ placements: ['C4', null, null], locked: [] });
  });

  test('a subsequent tap advances to the next unfilled slot, not back to slot 0', () => {
    const afterFirst: TranspositionResponse = { placements: ['C4', null, null], locked: [] };
    const { onResponseChange, getByTestId } = renderInput(afterFirst);
    fireEvent.press(getByTestId('transposition-pitch-E4'));
    expect(onResponseChange).toHaveBeenCalledWith({ placements: ['C4', 'E4', null], locked: [] });
  });

  test('once every slot is filled, no pitch row renders — there is nothing left to place', () => {
    const full: TranspositionResponse = { placements: ['C4', 'E4', 'G4'], locked: [] };
    const { queryByTestId } = renderInput(full);
    expect(queryByTestId('transposition-pitch-C4')).toBeNull();
  });
});

describe('TranspositionInput — a tapped pitch row is spelled in the given key, like the given melody', () => {
  test('tapping the "F" row in a sharp key places the key-spelled pitch (F#), not the bare natural', () => {
    const gMajorInstance: ExerciseInstance = {
      ...instance,
      stimulus: { ...instance.stimulus, music: { ...instance.stimulus.music!, key_sig: 'G_major' } },
      answer: {
        canonical: [{ pitch: 'F#3', dur: 'crotchet' }],
        accepted_alternatives: [],
        per_item: [{ pitch: 'F#3', dur: 'crotchet' }],
      },
    };
    const onResponseChange = jest.fn();
    const { getByTestId } = render(
      <TranspositionInput instance={gMajorInstance} response={{ placements: [null], locked: [] }} graded={null} strand="pitch" onResponseChange={onResponseChange} />,
    );
    fireEvent.press(getByTestId('transposition-pitch-F3'));
    expect(onResponseChange).toHaveBeenCalledWith({ placements: ['F#3'], locked: [] });
  });
});

describe('TranspositionInput — undo removes the LAST placement only', () => {
  test('slots 0..k-2 survive an undo', () => {
    const twoPlaced: TranspositionResponse = { placements: ['C4', 'E4', null], locked: [] };
    const { onResponseChange, getByTestId } = renderInput(twoPlaced);
    fireEvent.press(getByTestId('transposition-undo'));
    expect(onResponseChange).toHaveBeenCalledWith({ placements: ['C4', null, null], locked: [] });
  });

  test('undo is disabled with nothing placed', () => {
    const { getByTestId } = renderInput(emptyResponse());
    expect(getByTestId('transposition-undo').props.accessibilityState?.disabled).toBe(true);
  });
});

describe('TranspositionInput — per-note marks match the verdicts, not the overall grade', () => {
  test('one wrong note among three shows exactly one ✗ mark, not a uniform pass/fail tint', () => {
    const oneWrong: TranspositionResponse = { placements: ['C4', 'F4', 'G4'], locked: [] }; // E4 -> F4 wrong
    const { getByTestId, queryAllByText } = renderInput(oneWrong, false);
    expect(getByTestId('transposition-mark-0')).toHaveTextContent('✓');
    expect(getByTestId('transposition-mark-1')).toHaveTextContent('✗');
    expect(getByTestId('transposition-mark-2')).toHaveTextContent('✓');
    expect(queryAllByText('✗')).toHaveLength(1);
  });

  test('no marks render before Check (graded === null)', () => {
    const { queryByTestId } = renderInput({ placements: ['C4', 'F4', 'G4'], locked: [] }, null);
    expect(queryByTestId('transposition-mark-0')).toBeNull();
  });
});

describe("TranspositionInput — the ghost circle sits at the target pitch's staff position", () => {
  test('y equals PAPER_INSET + noteY(answerClef, per_item[wrong].pitch) — the octave-spot affordance', () => {
    const oneWrong: TranspositionResponse = { placements: ['C4', 'F4', 'G4'], locked: [] };
    const { getByTestId } = renderInput(oneWrong, false);
    const ghost = getByTestId('transposition-mark-1-ghost');
    const top = StyleSheet.flatten(ghost.props.style).top;
    expect(top).toBe(PAPER_INSET + noteY('bass', 'E4') - 6);
  });
});

describe('TranspositionInput — fix-mode locks correct slots', () => {
  test('a locked slot is never the active slot — every tap places into the one cleared (wrong) slot', () => {
    const oneWrong: TranspositionResponse = { placements: ['C4', 'F4', 'G4'], locked: [] };
    const fixed = transpositionBeginFix(instance, oneWrong);
    expect(fixed).toEqual({ placements: ['C4', null, 'G4'], locked: [true, false, true] });

    const { onResponseChange, getByTestId } = renderInput(fixed, null);
    fireEvent.press(getByTestId('transposition-pitch-E4'));
    // Slot 0 (locked, correct) and slot 2 (locked, correct) are untouched;
    // only slot 1 — the sole unlocked slot — receives the new placement.
    expect(onResponseChange).toHaveBeenCalledWith({ placements: ['C4', 'E4', 'G4'], locked: [true, false, true] });
  });
});

describe('registry — transposition_input (U6)', () => {
  test('emptyResponse sizes placements from the per_item target count, with locked empty until fix-mode', () => {
    expect(transpositionEmptyResponse(instance)).toEqual({ placements: [null, null, null], locked: [] });
  });

  test('canCheck is false until every slot is placed, true once all are', () => {
    expect(transpositionCanCheck({ placements: [null, null, null], locked: [] })).toBe(false);
    expect(transpositionCanCheck({ placements: ['C4', null, null], locked: [] })).toBe(false);
    expect(transpositionCanCheck({ placements: ['C4', 'E4', 'G4'], locked: [] })).toBe(true);
  });
});
