// U8 acceptance tests for the tap-to-place stave input (design 2d). No
// react-native-webview dependency here (unlike Flashcard/registry's tests) —
// StaveInput never touches MusicSurface; the given-note stimulus is rendered
// separately by ExerciseLoop's own NotationCard.

import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { G1_NOTE_VALUES } from '../../engine/scope';
import type { ExerciseInstance } from '../../engine/schema';
import { SettingsProvider } from '../../learn/SettingsContext';
import type { SnapshotStorage } from '../../learn/store';
import { applyAccidental, slotCount, slotToPitch, StaveInput, type Accidental, type StaveInputResponse } from './StaveInput';

const instance: ExerciseInstance = {
  id: 'test-stave-input-1',
  template_id: 'interval_naming_stave_input',
  grade: 1,
  strand: 'intervals',
  prompt: 'Write the note a 3rd higher than the given note, as a crotchet.',
  stimulus: {
    music: { clef: 'treble', key_sig: 'C_major', time_sig: null, voices: [{ events: [{ type: 'note', pitch: 'C4', dur: 'semibreve' }] }] },
    text: null,
  },
  interaction: { type: 'stave_input', config: {} },
  answer: { canonical: { pitch: 'E4', dur: 'crotchet' }, accepted_alternatives: [] },
  distractors: [],
  hints: [],
  feedback: { correct: 'Correct!', incorrect: 'Not quite.' },
  srs_tags: ['interval:3'],
  kb_version: 'test',
};

function renderStave(response: StaveInputResponse, graded: boolean | null = null, onResponseChange = jest.fn()) {
  return { onResponseChange, ...render(
    <StaveInput instance={instance} response={response} graded={graded} strand="intervals" onResponseChange={onResponseChange} />,
  ) };
}

describe('slotToPitch — deterministic per-clef slot -> pitch mapping (pure, jest-testable)', () => {
  test('slot 0 is the lowest in-range diatonic pitch; slots ascend by natural letter', () => {
    expect(slotToPitch('treble', 0)).toBe('C4');
    expect(slotToPitch('treble', 1)).toBe('D4');
    expect(slotToPitch('treble', 2)).toBe('E4');
    expect(slotToPitch('bass', 0)).toBe('E2');
  });

  test('is a pure deterministic function — repeated calls with the same input agree', () => {
    for (let i = 0; i < slotCount('treble'); i++) {
      expect(slotToPitch('treble', i)).toBe(slotToPitch('treble', i));
    }
  });

  test('throws on an out-of-range slot index (fail loud, never a silent undefined pitch)', () => {
    expect(() => slotToPitch('treble', slotCount('treble'))).toThrow();
    expect(() => slotToPitch('treble', -1)).toThrow();
  });
});

describe('applyAccidental — replaces a pitch\'s accidental, keeping its letter and octave', () => {
  test.each([
    ['F4', 'sharp', 'F#4'],
    ['F#4', 'natural', 'F4'],
    ['B4', 'flat', 'Bb4'],
    ['Bb4', 'sharp', 'B#4'],
    ['C5', 'natural', 'C5'],
  ] as [string, Accidental, string][])('applyAccidental(%s, %s) -> %s', (pitch, accidental, expected) => {
    expect(applyAccidental(pitch, accidental)).toBe(expected);
  });
});

describe('StaveInput — tapping a ghost slot places a note (the pure slot -> pitch mapping wired to a real press)', () => {
  test('tapping the slot for the canonical pitch reports that pitch at the default (crotchet) duration', () => {
    const { onResponseChange, getByTestId } = renderStave(null);
    fireEvent.press(getByTestId('stave-slot-2')); // slot 2 == E4 (see slotToPitch tests)
    expect(onResponseChange).toHaveBeenCalledWith({ pitch: 'E4', dur: 'crotchet' });
  });

  test('a placed note renders a halo and no ghost slot at that position', () => {
    const { getByTestId, queryByTestId } = renderStave({ pitch: 'E4', dur: 'crotchet' });
    expect(getByTestId('stave-input-halo')).toBeTruthy();
    expect(queryByTestId('stave-slot-2-ghost')).toBeNull();
  });

  test('an unplaced instance shows a ghost slot and no halo', () => {
    const { getByTestId, queryByTestId } = renderStave(null);
    expect(getByTestId('stave-slot-2-ghost')).toBeTruthy();
    expect(queryByTestId('stave-input-halo')).toBeNull();
  });
});

describe('StaveInput — accidental picker (only shown once a note is placed)', () => {
  test('no picker before a note is placed', () => {
    const { queryByTestId } = renderStave(null);
    expect(queryByTestId('accidental-picker')).toBeNull();
  });

  test('picking sharp/flat/natural updates the placed note\'s pitch, keeping its duration', () => {
    const { onResponseChange, getByTestId } = renderStave({ pitch: 'E4', dur: 'crotchet' });
    fireEvent.press(getByTestId('accidental-sharp'));
    expect(onResponseChange).toHaveBeenCalledWith({ pitch: 'E#4', dur: 'crotchet' });
  });

  test('natural clears a previously-applied accidental', () => {
    const { onResponseChange, getByTestId } = renderStave({ pitch: 'E#4', dur: 'crotchet' });
    fireEvent.press(getByTestId('accidental-natural'));
    expect(onResponseChange).toHaveBeenCalledWith({ pitch: 'E4', dur: 'crotchet' });
  });

  test('flat applies a flat', () => {
    const { onResponseChange, getByTestId } = renderStave({ pitch: 'E4', dur: 'crotchet' });
    fireEvent.press(getByTestId('accidental-flat'));
    expect(onResponseChange).toHaveBeenCalledWith({ pitch: 'Eb4', dur: 'crotchet' });
  });
});

describe('StaveInput — duration palette', () => {
  // Ruling A3: the tiles carry a glyph and nothing else, and the selected duration's
  // name is echoed on its own line. A word inside each tile wrapped mid-word
  // ("semibr eve") the moment Grade 1 needed a fourth value; a glyph cannot wrap.
  test('the tiles are glyph-only and the selection is named on its own line', () => {
    const { getByTestId, queryByText } = renderStave(null);

    for (const dur of G1_NOTE_VALUES) {
      expect(queryByText(dur)).toBeNull(); // no duration NAME inside any tile
    }
    expect(getByTestId('duration-selected')).toHaveTextContent('selected: crotchet');

    fireEvent.press(getByTestId('duration-semibreve'));
    expect(getByTestId('duration-selected')).toHaveTextContent('selected: semibreve');
  });

  test('changing duration on an already-placed note updates its duration, keeping the pitch', () => {
    const { onResponseChange, getByTestId } = renderStave({ pitch: 'E4', dur: 'crotchet' });
    fireEvent.press(getByTestId('duration-minim'));
    expect(onResponseChange).toHaveBeenCalledWith({ pitch: 'E4', dur: 'minim' });
  });

  test('picking a duration before any note is placed only stages it locally — no response change yet', () => {
    const { onResponseChange, getByTestId } = renderStave(null);
    fireEvent.press(getByTestId('duration-minim'));
    expect(onResponseChange).not.toHaveBeenCalled();
  });

  test('a staged duration is used once a note is subsequently placed', () => {
    const { onResponseChange, getByTestId } = renderStave(null);
    fireEvent.press(getByTestId('duration-minim'));
    fireEvent.press(getByTestId('stave-slot-2'));
    expect(onResponseChange).toHaveBeenLastCalledWith({ pitch: 'E4', dur: 'minim' });
  });
});

describe('StaveInput — undo', () => {
  test('undo clears a placed note back to no placement (canCheck-driving state)', () => {
    const { onResponseChange, getByTestId } = renderStave({ pitch: 'E4', dur: 'crotchet' });
    fireEvent.press(getByTestId('stave-input-undo'));
    expect(onResponseChange).toHaveBeenCalledWith(null);
  });
});

describe('StaveInput — once graded, the input locks (no further edits)', () => {
  test('tapping a slot after grading reports nothing further', () => {
    const { onResponseChange, getByTestId } = renderStave({ pitch: 'E4', dur: 'crotchet' }, true);
    fireEvent.press(getByTestId('stave-slot-3'));
    expect(onResponseChange).not.toHaveBeenCalled();
  });
});

describe('StaveInput — layout: the duration palette/undo never overlap the input stave (design 2d)', () => {
  test('the stave card and the duration palette are structurally separate siblings, not nested', () => {
    const { getByTestId } = renderStave({ pitch: 'E4', dur: 'crotchet' });
    const stave = getByTestId('stave-input-stave');
    const palette = getByTestId('stave-input-palette');
    expect(within(stave).queryByTestId('stave-input-palette')).toBeNull();
    expect(within(palette).queryByTestId('stave-input-stave')).toBeNull();
  });

  test('the accidental picker renders inside the stave card, never inside the duration palette', () => {
    const { getByTestId } = renderStave({ pitch: 'E4', dur: 'crotchet' });
    const stave = getByTestId('stave-input-stave');
    const palette = getByTestId('stave-input-palette');
    expect(within(stave).getByTestId('accidental-picker')).toBeTruthy();
    expect(within(palette).queryByTestId('accidental-picker')).toBeNull();
  });
});

describe('StaveInput — left-hand input mirrors the accidental picker (design 5c)', () => {
  function storageWith(handedness: 'right' | 'left'): SnapshotStorage {
    const blob = JSON.stringify({ version: 1, settings: { notationScale: 'medium', handedness } });
    return { load: async () => blob, save: async () => {} };
  }

  function renderWithHand(handedness: 'right' | 'left') {
    return render(
      <SettingsProvider storage={storageWith(handedness)}>
        <StaveInput
          instance={instance}
          response={{ pitch: 'E4', dur: 'crotchet' }}
          graded={null}
          strand="intervals"
          onResponseChange={jest.fn()}
        />
      </SettingsProvider>,
    );
  }

  test('defaults (right-handed) sit the picker on the right edge, not the left', () => {
    const { getByTestId } = renderWithHand('right');
    const style = StyleSheet.flatten(getByTestId('accidental-picker').props.style);
    expect(style.right).toBeGreaterThan(0);
    expect(style.left).toBeUndefined();
  });

  test('left-handed mirrors the picker to the left edge, clearing the right inset', async () => {
    const { getByTestId } = renderWithHand('left');
    await waitFor(() => {
      const style = StyleSheet.flatten(getByTestId('accidental-picker').props.style);
      expect(style.left).toBeGreaterThan(0);
      expect(style.right).toBeUndefined();
    });
  });
});
