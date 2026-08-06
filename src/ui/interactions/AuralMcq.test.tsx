// aural_mcq's card (chromaticly-dhe). Two invariants, and both are things the
// learner would notice: the play control must sound `config.played_music`, and
// the card must draw NO notation — First steps lesson 1 teaches pulse before any
// symbol, so a stave on screen defeats the lesson.
//
// Built from a hand-written instance rather than a generator: this file tests the
// interaction, and the templates that emit it land in a later unit.

import { fireEvent, render } from '@testing-library/react-native';

// registry.tsx reaches NotationCard -> MusicSurface -> the native WebView module.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef(() => null) };
});

import type { ExerciseInstance } from '../../engine/schema';
import type { Music } from '../../music/types';
import { DEFAULT_LISTEN_PROMPT } from './AuralMcq';
import { INTERACTIONS, lookupInteraction } from './registry';

const PLAYED: Music = {
  clef: 'treble',
  key_sig: null,
  time_sig: '4/4',
  voices: [{ events: [{ type: 'note', pitch: 'C4', dur: 'crotchet' }] }],
};

function instance(config: Record<string, unknown> = {}): ExerciseInstance {
  return {
    id: 'aural_mcq:0:0',
    template_id: 'pulse_count',
    grade: 0,
    strand: 'rhythm',
    prompt: 'How many beats did you hear?',
    stimulus: { music: null, text: null },
    interaction: { type: 'aural_mcq', config: { played_music: PLAYED, ...config } },
    answer: { canonical: '4', accepted_alternatives: [] },
    distractors: ['2', '3'],
    hints: [],
    feedback: { correct: 'Yes — four beats.', incorrect: 'Count again with the pulse.', by_distractor: {} },
    srs_tags: ['pulse:beat'],
    kb_version: '1',
  } as ExerciseInstance;
}

const spec = INTERACTIONS.aural_mcq!;

function renderCard(inst: ExerciseInstance, onPlayMusic = jest.fn()) {
  const utils = render(
    <spec.Component
      instance={inst}
      response={spec.emptyResponse(inst)}
      graded={null}
      strand="rhythm"
      onResponseChange={jest.fn()}
      onPlayMusic={onPlayMusic}
    />,
  );
  return { ...utils, onPlayMusic };
}

describe('aural_mcq card — hear it, answer it, never read it', () => {
  test('the play control sounds config.played_music', () => {
    const inst = instance();
    const { getByTestId, onPlayMusic } = renderCard(inst);

    fireEvent.press(getByTestId('aural-mcq-listen'));

    expect(onPlayMusic).toHaveBeenCalledWith(inst.interaction.config.played_music);
  });

  test('it draws a play affordance and the answer options, and no notation at all', () => {
    const { getByTestId, queryByTestId } = renderCard(instance());

    expect(getByTestId('aural-mcq-listen')).toBeTruthy();
    expect(getByTestId('mcq')).toBeTruthy();
    expect(queryByTestId('stimulus-music')).toBeNull();
    expect(queryByTestId('answer-notation')).toBeNull();
  });

  test('a generator may supply its own listen prompt, and gets the default when it does not', () => {
    expect(renderCard(instance()).getByText(DEFAULT_LISTEN_PROMPT)).toBeTruthy();
    expect(renderCard(instance({ listen_prompt: 'Listen for the strong beat.' })).getByText('Listen for the strong beat.')).toBeTruthy();
  });
});

describe('aural_mcq spec — registered, checked, and diagnosable', () => {
  test('lookupInteraction resolves it rather than throwing', () => {
    expect(lookupInteraction('aural_mcq')).toBe(spec);
  });

  // Both terms of the guard, not just the enabled one.
  test('Check is disabled with no selection and enabled after one', () => {
    expect(spec.canCheck(null)).toBe(false);
    expect(spec.canCheck(0)).toBe(true);
  });

  test('it grades the picked option, right and wrong', () => {
    const inst = instance();
    const options = require('../grading').assembleOptions(inst) as { value: string; correct: boolean }[];
    const right = options.findIndex((o) => o.correct);
    expect(spec.grade(inst, right)).toBe(true);
    expect(spec.grade(inst, right === 0 ? 1 : 0)).toBe(false);
  });

  // by_distractor is keyed by the option VALUE. Returning the index would let
  // index 2 read the copy written for the answer "2" — right shape, wrong meaning.
  test('selectedValue reports the option value, never its index', () => {
    const inst = instance();
    const options = require('../grading').assembleOptions(inst) as { value: string }[];
    for (let i = 0; i < options.length; i++) {
      expect(spec.selectedValue!(inst, i)).toBe(options[i].value);
    }
    expect(spec.selectedValue!(inst, null)).toBeUndefined();
  });

  // The whole reason this is not by_ear_verify: that spec renders stimulus.music,
  // which is null here, so a wrong answer would reveal nothing.
  test('the correct-answer view names the answer even with no notation to draw', () => {
    const view = spec.correctAnswerView(instance()) as { props: { testID?: string } };
    expect(view.props.testID).toBe('answer-label');
  });

  test('the shared Check button submits it, and it is not self-graded', () => {
    expect(spec.submits).toBe(true);
    const { SELF_GRADED_INTERACTIONS } = require('../../engine/schema');
    expect(SELF_GRADED_INTERACTIONS.has('aural_mcq')).toBe(false);
  });
});
