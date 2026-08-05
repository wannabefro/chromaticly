// by_ear_verify's card (stage-two U1). The invariant KTD6 exists for: the play
// control must sound the ALTERED music. Typed as plain mcq it would offer the
// written stimulus instead, and the question would be unanswerable.

import { fireEvent, render } from '@testing-library/react-native';

// registry.tsx reaches NotationCard -> MusicSurface -> the native WebView module.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef(() => null) };
});

import { generate } from '../../engine/generators';
import { INTERACTIONS } from './registry';

const ATOMS = ['note_read:treble:C4', 'note_read:treble:D4', 'note_read:treble:E4'];

function instance(seed = 0) {
  return generate('by_ear_verify', { grade: 1, seed, atoms: ATOMS, source: 'note_naming' });
}

const spec = INTERACTIONS.by_ear_verify!;

function renderCard(inst: ReturnType<typeof instance>, onPlayMusic = jest.fn()) {
  const utils = render(
    <spec.Component
      instance={inst}
      response={spec.emptyResponse(inst)}
      graded={null}
      strand="pitch"
      onResponseChange={jest.fn()}
      onPlayMusic={onPlayMusic}
    />,
  );
  return { ...utils, onPlayMusic };
}

describe('by_ear_verify card — the learner can hear what they are asked about', () => {
  test('the play control sounds the altered music, not the written stimulus', () => {
    const inst = instance();
    const { getByTestId, onPlayMusic } = renderCard(inst);

    fireEvent.press(getByTestId('by-ear-verify-listen'));

    expect(onPlayMusic).toHaveBeenCalledWith(inst.interaction.config.played_music);
  });

  test('what it plays is not the notation on screen when the verdict is Different', () => {
    const differing = Array.from({ length: 12 }, (_, seed) => instance(seed)).find(
      (i) => i.answer.canonical === 'Different',
    )!;
    const { getByTestId, onPlayMusic } = renderCard(differing);

    fireEvent.press(getByTestId('by-ear-verify-listen'));

    expect(onPlayMusic.mock.calls[0][0]).not.toEqual(differing.stimulus.music);
  });

  test('the card carries a play affordance at all — design rule 2', () => {
    const { getByTestId } = renderCard(instance());

    expect(getByTestId('by-ear-verify-listen')).toBeTruthy();
  });
});
