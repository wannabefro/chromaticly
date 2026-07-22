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
import { noteY, PAPER_INSET, STEP } from './stave-geometry';
import { pitchAtStaveY, TranspositionInput, transpositionCanCheck, transpositionEmptyResponse } from './TranspositionInput';

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

// The stave is a single tap surface (design "tap-vertical = pitch"); a tap at a
// given diatonic pitch's y places that pitch. locationY is card-relative, and
// the surface sits at top:0, so it equals PAPER_INSET + noteY(clef, pitch).
function tapPitch(getByTestId: (id: string) => { props: unknown }, pitch: string, clef: 'treble' | 'bass' = 'bass') {
  fireEvent.press(getByTestId('transposition-tap-surface') as never, {
    nativeEvent: { locationY: PAPER_INSET + noteY(clef, pitch) },
  });
}

function renderInput(response: TranspositionResponse, graded: boolean | null = null, onResponseChange = jest.fn()) {
  return {
    onResponseChange,
    ...render(
      <TranspositionInput instance={instance} response={response} graded={graded} strand="pitch" onResponseChange={onResponseChange} />,
    ),
  };
}

describe('pitchAtStaveY — a tap snaps to the nearest in-range diatonic pitch, spelled in-key', () => {
  test('a tap exactly on a pitch position returns that pitch', () => {
    expect(pitchAtStaveY('bass', 3, 'C_major', noteY('bass', 'C4'))).toBe('C4');
    expect(pitchAtStaveY('bass', 3, 'C_major', noteY('bass', 'E4'))).toBe('E4');
  });

  test('a tap between two positions snaps to the nearer one (< half a step away)', () => {
    const nearC4 = noteY('bass', 'C4') - STEP * 0.4; // drift toward D4 but still closest to C4
    expect(pitchAtStaveY('bass', 3, 'C_major', nearC4)).toBe('C4');
  });

  test('the placed letter is spelled by the key signature (F -> F# in G major)', () => {
    expect(pitchAtStaveY('bass', 3, 'G_major', noteY('bass', 'F3'))).toBe('F#3');
  });

  test('a tap beyond the reading range clamps to the range edge, never off-staff nonsense', () => {
    const wayHigh = noteY('bass', 'G4') - STEP * 20;
    const placed = pitchAtStaveY('bass', 3, 'C_major', wayHigh);
    expect(placed).toBe('G4'); // bass grade-3 reading ceiling
  });
});

describe('TranspositionInput — placement is pitch-only and sequential', () => {
  test('the first tap fills slot 0 with the tapped pitch — the learner never chooses a duration', () => {
    const { onResponseChange, getByTestId } = renderInput(emptyResponse());
    tapPitch(getByTestId, 'C4');
    expect(onResponseChange).toHaveBeenCalledWith({ placements: ['C4', null, null], locked: [] });
  });

  test('a subsequent tap advances to the next unfilled slot, not back to slot 0', () => {
    const afterFirst: TranspositionResponse = { placements: ['C4', null, null], locked: [] };
    const { onResponseChange, getByTestId } = renderInput(afterFirst);
    tapPitch(getByTestId, 'E4');
    expect(onResponseChange).toHaveBeenCalledWith({ placements: ['C4', 'E4', null], locked: [] });
  });

  test('once every slot is filled, the tap surface is gone — there is nothing left to place', () => {
    const full: TranspositionResponse = { placements: ['C4', 'E4', 'G4'], locked: [] };
    const { queryByTestId } = renderInput(full);
    expect(queryByTestId('transposition-tap-surface')).toBeNull();
  });
});

describe('TranspositionInput — a tapped pitch row is spelled in the given key, like the given melody', () => {
  test('tapping the "F" position in a sharp key places the key-spelled pitch (F#), not the bare natural', () => {
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
    tapPitch(getByTestId, 'F3');
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
    tapPitch(getByTestId, 'E4');
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

// U7/D9: the answer card's own PlayButton plays what the LEARNER placed, never
// the given melody — the "hear yours" affordance built from the response, not
// the stimulus, sent up through onPlayMusic.
describe('TranspositionInput — "hear yours" (D9): the answer card\'s play sends the answer, not the stimulus', () => {
  test('the play button is disabled until at least one note is placed', () => {
    const { getByTestId } = renderInput(emptyResponse());
    expect(getByTestId('transposition-play').props.accessibilityState?.disabled).toBe(true);
  });

  test('pressing play builds Music from the PLACED pitches with copied durs — stopping at the first unplaced slot, never the stimulus melody', () => {
    const onPlayMusic = jest.fn();
    const partial: TranspositionResponse = { placements: ['C4', 'E4', null], locked: [] };
    const { getByTestId } = render(
      <TranspositionInput
        instance={instance}
        response={partial}
        graded={null}
        strand="pitch"
        onResponseChange={jest.fn()}
        onPlayMusic={onPlayMusic}
      />,
    );

    fireEvent.press(getByTestId('transposition-play'));

    expect(onPlayMusic).toHaveBeenCalledTimes(1);
    const music = onPlayMusic.mock.calls[0][0];
    expect(music.clef).toBe('bass'); // the answer clef — never the stimulus's treble
    expect(music.key_sig).toBe(instance.stimulus.music!.key_sig);
    expect(music.voices[0].events).toEqual([
      { type: 'note', pitch: 'C4', dur: 'crotchet' },
      { type: 'note', pitch: 'E4', dur: 'crotchet' },
    ]); // the 3rd (unplaced) slot is truncated — the given melody's G5 minim never appears
  });

  test('pressing play with every slot filled plays the full answer, copied durs and dots included', () => {
    const onPlayMusic = jest.fn();
    const full: TranspositionResponse = { placements: ['C4', 'E4', 'G4'], locked: [] };
    const { getByTestId } = render(
      <TranspositionInput
        instance={instance}
        response={full}
        graded={null}
        strand="pitch"
        onResponseChange={jest.fn()}
        onPlayMusic={onPlayMusic}
      />,
    );

    fireEvent.press(getByTestId('transposition-play'));

    const music = onPlayMusic.mock.calls[0][0];
    expect(music.voices[0].events).toEqual([
      { type: 'note', pitch: 'C4', dur: 'crotchet' },
      { type: 'note', pitch: 'E4', dur: 'crotchet' },
      { type: 'note', pitch: 'G4', dur: 'minim' }, // per_item's copied duration, not a placement-owned one
    ]);
  });
});
