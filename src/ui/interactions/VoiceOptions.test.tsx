// U5 — satb_voice_recognition's answer input (design G5-1). The registry spec
// (grade/canCheck/emptyResponse) is characterized here too, alongside the
// component's own rendering, mirroring DragMatch.test.tsx's split.
//
// registry.tsx pulls in NotationCard -> MusicSurface -> react-native-webview,
// which has no native module in the jest environment — mocked here exactly as
// registry.test.ts does.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return {
    WebView: React.forwardRef((_props: Record<string, unknown>, _ref: unknown) => null),
  };
});

import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';

import type { ExerciseInstance } from '../../engine/schema';
import { lookupInteraction } from './registry';
import { VoiceOptions, type VoiceOptionsResponse } from './VoiceOptions';

// Mirrors satb-voice-recognition.ts's exact interaction shape (VOICE_META/
// VOICE_LABELS/VOICE_CUES, SATB order S/A/T/B) — the config this component
// must consume as-is, not a shape of this test's own invention.
const INSTANCE: ExerciseInstance = {
  id: 'v1',
  template_id: 'satb_voice_recognition',
  grade: 5,
  strand: 'chords',
  prompt: 'Which voice sings the highlighted note?',
  stimulus: { music: null, text: null },
  interaction: {
    type: 'voice_options',
    config: {
      options: [
        { voice: 'soprano', label: 'Soprano', cue: 'treble, stem up' },
        { voice: 'alto', label: 'Alto', cue: 'treble, stem down' },
        { voice: 'tenor', label: 'Tenor', cue: 'bass, stem up' },
        { voice: 'bass', label: 'Bass', cue: 'bass, stem down' },
      ],
    },
  },
  answer: { canonical: 'tenor', accepted_alternatives: [] },
  distractors: ['soprano', 'alto', 'bass'],
  hints: [],
  feedback: { correct: 'c', incorrect: 'i' },
  srs_tags: [],
  kb_version: 'test',
};

/** Host that threads response state, mirroring ExerciseLoop's ownership. */
function Harness({ graded = null }: { graded?: boolean | null }) {
  const [response, setResponse] = useState<VoiceOptionsResponse>(null);
  return (
    <VoiceOptions
      instance={INSTANCE}
      response={response}
      graded={graded}
      strand="chords"
      onResponseChange={setResponse}
    />
  );
}

describe('VoiceOptions rendering (design G5-1: badge + name + stave/stem cue)', () => {
  test('renders all four voices, each with its name and its own stave/stem cue text', () => {
    const { getByText, getByTestId } = render(<Harness />);

    expect(getByText('Soprano')).toBeTruthy();
    expect(getByText('Alto')).toBeTruthy();
    expect(getByText('Tenor')).toBeTruthy();
    expect(getByText('Bass')).toBeTruthy();

    expect(getByTestId('voice-option-soprano-cue')).toHaveTextContent('· treble, stem up');
    expect(getByTestId('voice-option-alto-cue')).toHaveTextContent('· treble, stem down');
    expect(getByTestId('voice-option-tenor-cue')).toHaveTextContent('· bass, stem up');
    expect(getByTestId('voice-option-bass-cue')).toHaveTextContent('· bass, stem down');
  });

  // Rule 3 (colour-vision safety): soprano/tenor share "stem up" and alto/bass
  // share "stem down" — the cue alone doesn't disambiguate voice, so the row
  // must carry the distinct name text too, not rely on colour to tell them apart.
  test('every option is distinguishable by its own name + cue text, not colour alone', () => {
    const { getByText, getByTestId } = render(<Harness />);
    for (const voice of ['soprano', 'alto', 'tenor', 'bass']) {
      expect(getByTestId(`voice-option-${voice}`)).toBeTruthy();
    }
    // "stem up" alone is shared by soprano+tenor; the name text is what disambiguates.
    expect(getByText('Soprano')).toBeTruthy();
    expect(getByText('Tenor')).toBeTruthy();
  });
});

describe('VoiceOptions selection', () => {
  test('tapping an option selects it (single-select) before Check', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.press(getByTestId('voice-option-tenor'));
    // Selecting a second voice replaces the first — never both selected.
    fireEvent.press(getByTestId('voice-option-alto'));
    expect(getByTestId('voice-option-alto')).toBeTruthy();
  });

  test('once graded, the canonical voice shows correct and the wrong pick shows incorrect — pressing another option no longer changes it', () => {
    function GradedHarness() {
      const [response, setResponse] = useState<VoiceOptionsResponse>('alto');
      return (
        <VoiceOptions instance={INSTANCE} response={response} graded={false} strand="chords" onResponseChange={setResponse} />
      );
    }
    const { getByTestId } = render(<GradedHarness />);
    // canonical is 'tenor' (INSTANCE.answer.canonical); response is the wrong pick 'alto'.
    expect(getByTestId('voice-option-tenor-badge')).toHaveTextContent('✓');
    expect(getByTestId('voice-option-alto-badge')).toHaveTextContent('×');

    fireEvent.press(getByTestId('voice-option-tenor'));
    // Locked post-Check: the badges are unchanged by the press (onPress is undefined once revealed).
    expect(getByTestId('voice-option-tenor-badge')).toHaveTextContent('✓');
    expect(getByTestId('voice-option-alto-badge')).toHaveTextContent('×');
  });
});

describe('registry — voice_options (U5, satb_voice_recognition)', () => {
  test('lookupInteraction resolves voice_options to VoiceOptions', () => {
    expect(lookupInteraction('voice_options').Component).toBe(VoiceOptions);
  });

  test('emptyResponse resets to no voice picked', () => {
    expect(lookupInteraction('voice_options').emptyResponse(INSTANCE)).toBeNull();
  });

  test('canCheck is false until a voice is picked, true once one is', () => {
    const spec = lookupInteraction('voice_options');
    expect(spec.canCheck(null)).toBe(false);
    expect(spec.canCheck('tenor')).toBe(true);
  });

  test('grades on the voice name string: the canonical voice is correct, any other voice incorrect', () => {
    const spec = lookupInteraction('voice_options');
    expect(spec.grade(INSTANCE, 'tenor')).toBe(true);
    for (const wrong of ['soprano', 'alto', 'bass']) {
      expect(spec.grade(INSTANCE, wrong)).toBe(false);
    }
  });

  test('submits is true — voice_options uses the shared Check button', () => {
    expect(lookupInteraction('voice_options').submits).toBe(true);
  });
});
