// U6 acceptance tests for the reskinned exercise item. Flow is select → Check →
// FeedbackSheet → Continue (Check disabled until a pick; onResult fires at Continue).
// WebView is mocked and mounts are counted to prove the notation surface persists
// across items rather than remounting (the perf refactor's invariant).

// `posted` captures every command the surface's persistent ref sends via
// postMessage (encoded SurfaceCommand JSON) — the wiring guard for U3's
// highlightNote needs to see the command was actually issued, not just defined.
const mockSurface = { mounts: 0, posted: [] as string[] };
jest.mock('react-native-webview', () => {
  const React = require('react');
  return {
    WebView: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useEffect(() => {
        mockSurface.mounts += 1;
        // A real surface boots and reports 'ready' shortly after mount; the
        // component gates commands (render, and the note ring) on that signal —
        // a postMessage sent before boot is dropped by a real WebView. Emit it
        // once per mount so wiring tests observe the surface's steady ready state.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onMessage = props.onMessage as any;
        onMessage?.({ nativeEvent: { data: JSON.stringify({ type: 'ready' }) } });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      React.useImperativeHandle(ref, () => ({
        postMessage: (data: string) => {
          mockSurface.posted.push(data);
        },
      }));
      return null;
    }),
  };
});

import { fireEvent, render } from '@testing-library/react-native';

import { generate } from '../engine/generators';
import { spellInKeySig } from '../engine/generators/key-spelling';
import type { ExerciseInstance } from '../engine/schema';
import { diatonicPitchesInRange } from '../engine/scope';
import { highlightLocator } from '../music/abc-emitter';
import type { Music } from '../music/types';
import { noteY, PAPER_INSET } from './interactions/stave-geometry';
import { ProgressProvider } from '../learn/ProgressContext';
import type { SnapshotStorage } from '../learn/store';
import { ExerciseLoop } from './ExerciseLoop';
import { assembleOptions } from './grading';

const mcqInstance: ExerciseInstance = {
  id: 'test-mcq-1',
  template_id: 'note_naming',
  grade: 1,
  strand: 'pitch',
  prompt: 'Name this note.',
  stimulus: { music: null, text: null },
  interaction: { type: 'mcq', config: {} },
  answer: { canonical: 'C', accepted_alternatives: [] },
  distractors: ['D', 'E'],
  hints: ['Count up from middle C.', 'It sits on the bottom line.'],
  feedback: { correct: 'Nice!', incorrect: 'Not quite — try again.' },
  srs_tags: ['pitch:test'],
  kb_version: 'test',
};

function optionIndex(instance: ExerciseInstance, correct: boolean): number {
  const options = assembleOptions(instance);
  const index = options.findIndex((o) => o.correct === correct);
  if (index === -1) throw new Error('no matching option in fixture');
  return index;
}

describe('ExerciseLoop — MCQ select → Check → feedback', () => {
  test('Check is disabled until an option is selected', () => {
    const { getByTestId } = render(<ExerciseLoop instance={mcqInstance} onResult={jest.fn()} />);
    // Check exists but is disabled pre-selection.
    expect(getByTestId('check').props.accessibilityState?.disabled).toBe(true);
  });

  test('a correct pick, then Check, shows correct feedback; Continue fires onResult correct:true', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = render(<ExerciseLoop instance={mcqInstance} onResult={onResult} />);

    fireEvent.press(getByTestId(`option-${optionIndex(mcqInstance, true)}`));
    fireEvent.press(getByTestId('check'));

    expect(getByText(mcqInstance.feedback.correct)).toBeTruthy();
    expect(onResult).not.toHaveBeenCalled(); // not until Continue

    fireEvent.press(getByTestId('feedback-sheet-continue'));
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: true, hintsUsed: 0 }));
  });

  test('a wrong pick, then Check, shows incorrect feedback and fires onResult correct:false', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = render(<ExerciseLoop instance={mcqInstance} onResult={onResult} />);

    fireEvent.press(getByTestId(`option-${optionIndex(mcqInstance, false)}`));
    fireEvent.press(getByTestId('check'));

    expect(getByText(mcqInstance.feedback.incorrect)).toBeTruthy();
    fireEvent.press(getByTestId('feedback-sheet-continue'));
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });
});

// chromaticly-7tb / never-violate rule 5. The sheet must name the mistake that
// was made, so the copy has to be chosen from the RESPONSE, not the instance —
// two learners picking two different wrong options must read two different
// sheets. These render through ExerciseLoop rather than calling
// `misconceptionFor` directly, because the defect being guarded is a wiring one:
// the lookup can be correct while the sheet still shows the instance-wide string.
describe('ExerciseLoop — the incorrect sheet names WHICH mistake was made', () => {
  const diagnosed: ExerciseInstance = {
    ...mcqInstance,
    id: 'test-mcq-diagnosed',
    feedback: {
      correct: 'Nice!',
      incorrect: 'Not quite — try again.',
      by_distractor: { D: 'That is the next line up.', E: 'That is the note on the other clef.' },
    },
  };

  test.each([
    ['D', 'That is the next line up.'],
    ['E', 'That is the note on the other clef.'],
  ])('picking %s shows its own copy, not the instance-wide string', (value, expected) => {
    const options = assembleOptions(diagnosed);
    const index = options.findIndex((o) => o.value === value);
    const { getByTestId, getByText, queryByText } = render(<ExerciseLoop instance={diagnosed} onResult={jest.fn()} />);

    fireEvent.press(getByTestId(`option-${index}`));
    fireEvent.press(getByTestId('check'));

    expect(getByText(expected)).toBeTruthy();
    expect(queryByText(diagnosed.feedback.incorrect)).toBeNull();
  });

  // The near-miss this guards: an mcq response is an option INDEX, and
  // interval_naming's answers are interval NUMBERS. Both are numbers, so a
  // lookup on the raw response would read the copy for "a 2nd" when the learner
  // happened to tap the option at index 2. Nothing would throw and nothing would
  // look wrong — the sheet would simply explain a different mistake.
  test('an index is never mistaken for a numeric answer — the copy follows the option, not its position', () => {
    const numeric: ExerciseInstance = {
      ...mcqInstance,
      id: 'test-mcq-numeric',
      answer: { canonical: 5, accepted_alternatives: [] },
      distractors: [4, 6],
      feedback: {
        correct: 'Nice!',
        incorrect: 'Not quite.',
        by_distractor: { '4': 'copy for the interval 4', '6': 'copy for the interval 6' },
      },
    };
    const options = assembleOptions(numeric);
    const index = options.findIndex((o) => o.value === 4);
    const { getByTestId, getByText } = render(<ExerciseLoop instance={numeric} onResult={jest.fn()} />);

    fireEvent.press(getByTestId(`option-${index}`));
    fireEvent.press(getByTestId('check'));

    expect(getByText('copy for the interval 4')).toBeTruthy();
  });

  test('an instance with no per-distractor copy still shows its own incorrect string — the fallback is not dropped', () => {
    const { getByTestId, getByText } = render(<ExerciseLoop instance={mcqInstance} onResult={jest.fn()} />);
    fireEvent.press(getByTestId(`option-${optionIndex(mcqInstance, false)}`));
    fireEvent.press(getByTestId('check'));
    expect(getByText(mcqInstance.feedback.incorrect)).toBeTruthy();
  });
});

describe('ExerciseLoop — text_input grading', () => {
  const textInstance: ExerciseInstance = {
    ...mcqInstance,
    id: 'test-text-1',
    interaction: { type: 'text_input', config: {} },
    answer: { canonical: 'E flat', accepted_alternatives: ['Eb', 'E♭'] },
  };

  test('is case-insensitive and honors accepted_alternatives ("eb" for "E flat")', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = render(<ExerciseLoop instance={textInstance} onResult={onResult} />);

    fireEvent.changeText(getByTestId('text-input'), 'eb');
    fireEvent.press(getByTestId('check'));

    expect(getByText(textInstance.feedback.correct)).toBeTruthy();
    fireEvent.press(getByTestId('feedback-sheet-continue'));
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
  });

  test('rejects an answer matching neither canonical nor an alternative', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText } = render(<ExerciseLoop instance={textInstance} onResult={onResult} />);

    fireEvent.changeText(getByTestId('text-input'), 'F sharp');
    fireEvent.press(getByTestId('check'));

    expect(getByText(textInstance.feedback.incorrect)).toBeTruthy();
    fireEvent.press(getByTestId('feedback-sheet-continue'));
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });
});

describe('ExerciseLoop — hints', () => {
  test('reveal one at a time; hint use carries into the emitted result (KTD10)', () => {
    const onResult = jest.fn();
    const { getByTestId, getByText, queryByText } = render(
      <ExerciseLoop instance={mcqInstance} onResult={onResult} />,
    );

    expect(queryByText(mcqInstance.hints[0])).toBeNull();
    fireEvent.press(getByTestId('show-hint'));
    expect(getByText(mcqInstance.hints[0])).toBeTruthy();
    fireEvent.press(getByTestId('show-hint'));
    expect(getByText(mcqInstance.hints[1])).toBeTruthy();

    fireEvent.press(getByTestId(`option-${optionIndex(mcqInstance, true)}`));
    fireEvent.press(getByTestId('check'));
    fireEvent.press(getByTestId('feedback-sheet-continue'));

    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ hintsUsed: 2 }));
  });
});

describe('ExerciseLoop — stimulus + surface persistence', () => {
  const musicInstance: ExerciseInstance = {
    ...mcqInstance,
    id: 'test-music-1',
    stimulus: {
      music: {
        clef: 'treble',
        key_sig: null,
        time_sig: null,
        voices: [{ events: [{ type: 'note', pitch: 'C4', dur: 'semibreve' }] }],
      },
      text: null,
    },
  };

  test('a music stimulus renders a NotationCard with a play control', () => {
    const { getByTestId } = render(<ExerciseLoop instance={musicInstance} onResult={jest.fn()} />);
    expect(getByTestId('stimulus-music')).toBeTruthy();
    expect(getByTestId('notation-card-play')).toBeTruthy();
  });

  // The whole question is "does what you hear match what is written". A second
  // play control on the card would answer it by ear alone.
  test('a by-ear item shows only its own Listen control, never the card play', () => {
    const inst = generate('by_ear_verify', { grade: 1, seed: 0, atoms: ['rest:minim'], source: 'rest_completion' });
    const { getByTestId, queryByTestId } = render(<ExerciseLoop instance={inst} onResult={jest.fn()} />);
    expect(getByTestId('by-ear-verify-listen')).toBeTruthy();
    expect(queryByTestId('notation-card-play')).toBeNull();
  });

  test('advancing to a new instance resets state without remounting the notation surface', () => {
    mockSurface.mounts = 0;
    const next: ExerciseInstance = { ...musicInstance, id: 'test-music-2', prompt: 'Name this note (again).' };
    const { getByTestId, queryByTestId, rerender } = render(
      <ExerciseLoop instance={musicInstance} onResult={jest.fn()} />,
    );
    expect(mockSurface.mounts).toBe(1);

    // Grade correct (no answer-card mounted), continue, advance.
    fireEvent.press(getByTestId(`option-${optionIndex(musicInstance, true)}`));
    fireEvent.press(getByTestId('check'));
    expect(getByTestId('feedback-sheet-correct')).toBeTruthy();

    rerender(<ExerciseLoop instance={next} onResult={jest.fn()} />);

    // Feedback cleared, a fresh Check is back, and the surface was never torn down.
    expect(queryByTestId('feedback-sheet-correct')).toBeNull();
    expect(getByTestId('check')).toBeTruthy();
    expect(mockSurface.mounts).toBe(1);
  });
});

// U3: the highlightNote command exists (surface-html.test.ts) but must also be
// CALLED — without this wiring the ring is defined and never issued. Mirrors the
// existing highlightBar wiring (response -> surfaceHighlight), but keyed off the
// stimulus's own locator instead of the response.
describe('ExerciseLoop — SATB stimulus wiring (U3): highlightNote is actually issued', () => {
  const satbMusic: Music = {
    clef: 'treble',
    key_sig: 'C_major',
    time_sig: '4/4',
    staves: ['treble', 'bass'],
    voices: [
      { name: 'soprano', staff: 0, stem: 'up', events: [{ type: 'note', pitch: 'G4', dur: 'semibreve' }] },
      { name: 'alto', staff: 0, stem: 'down', events: [{ type: 'note', pitch: 'E4', dur: 'semibreve' }] },
      { name: 'tenor', staff: 1, stem: 'up', events: [{ type: 'note', pitch: 'C4', dur: 'semibreve', highlight: true }] },
      { name: 'bass', staff: 1, stem: 'down', events: [{ type: 'note', pitch: 'C3', dur: 'semibreve' }] },
    ],
  };
  const satbInstance: ExerciseInstance = {
    ...mcqInstance,
    id: 'test-satb-1',
    stimulus: { music: satbMusic, text: null },
  };

  function postedCommands(): Array<Record<string, unknown>> {
    return mockSurface.posted.map((s) => JSON.parse(s));
  }

  test('rendering a highlighted SATB stimulus issues highlightNote with the stimulus locator (tenor, not a neighbouring voice)', () => {
    mockSurface.posted = [];
    render(<ExerciseLoop instance={satbInstance} onResult={jest.fn()} />);

    // The invariant that matters: the wiring must carry the SAME locator the
    // core computes — a hand-typed locator here would drift from the real one.
    const expectedLocator = highlightLocator(satbMusic);
    expect(expectedLocator).toEqual({ staff: 1, voice: 2, noteIndex: 0 }); // tenor

    const highlightNoteCmds = postedCommands().filter((c) => c.type === 'highlightNote');
    expect(highlightNoteCmds.length).toBeGreaterThan(0);
    expect(highlightNoteCmds[highlightNoteCmds.length - 1]).toEqual(
      expect.objectContaining({ type: 'highlightNote', locator: expectedLocator }),
    );
  });

  test('a music stimulus with no highlighted note issues highlightNote with a null locator (clears any stale ring)', () => {
    mockSurface.posted = [];
    const noHighlight: ExerciseInstance = {
      ...mcqInstance,
      id: 'test-no-highlight-1',
      stimulus: { music: { ...satbMusic, voices: satbMusic.voices.map((v) => ({ ...v, events: [{ type: 'note', pitch: 'G4', dur: 'semibreve' }] })) }, text: null },
    };
    render(<ExerciseLoop instance={noHighlight} onResult={jest.fn()} />);

    const highlightNoteCmds = postedCommands().filter((c) => c.type === 'highlightNote');
    expect(highlightNoteCmds.length).toBeGreaterThan(0);
    expect(highlightNoteCmds[highlightNoteCmds.length - 1]).toEqual(
      expect.objectContaining({ type: 'highlightNote', locator: null }),
    );
  });
});

describe('ExerciseLoop — self-graded flashcard (U7): routes away from Check/FeedbackSheet entirely', () => {
  function memoryStorage(): SnapshotStorage {
    let blob: string | null = null;
    return {
      async load() {
        return blob;
      },
      async save(serialized: string) {
        blob = serialized;
      },
    };
  }

  const flashcardInstance: ExerciseInstance = {
    id: 'test-flashcard-1',
    template_id: 'term_meaning_flashcard',
    grade: 1,
    strand: 'terms_signs',
    prompt: 'What does "Staccato" mean?',
    stimulus: { music: null, text: null },
    interaction: { type: 'flashcard', config: { term: 'Staccato', category: 'other_terms' } },
    answer: { canonical: { value: 'detached', category: 'other_terms' }, accepted_alternatives: [] },
    distractors: [],
    hints: [],
    feedback: { correct: 'Correct!', incorrect: 'Not quite.' },
    srs_tags: ['term:staccato'],
    kb_version: 'test',
  };

  function renderFlashcardLoop(onResult = jest.fn(), onSelfGrade = jest.fn()) {
    return {
      onResult,
      onSelfGrade,
      ...render(
        <ProgressProvider storage={memoryStorage()}>
          <ExerciseLoop instance={flashcardInstance} onResult={onResult} onSelfGrade={onSelfGrade} />
        </ProgressProvider>,
      ),
    };
  }

  test('never renders the shared Check button — flashcard owns its own submission', () => {
    const { queryByTestId } = renderFlashcardLoop();
    expect(queryByTestId('check')).toBeNull();
  });

  test('picking a grade calls onSelfGrade, never onResult, and no correct/incorrect FeedbackSheet ever renders', () => {
    const { getByTestId, queryByTestId, onResult, onSelfGrade } = renderFlashcardLoop();

    fireEvent.press(getByTestId('flashcard-card'));
    fireEvent.press(getByTestId('grade-good'));

    expect(onSelfGrade).toHaveBeenCalledWith('good');
    expect(onResult).not.toHaveBeenCalled();
    expect(queryByTestId('feedback-sheet')).toBeNull();
  });
});

// U4 (Grade 3 octave transposition): exercises the new protocol members
// (partialFeedback/checkLabel/beginFix) through the real registered
// transposition_input spec — the loop-side wiring these tests pin doesn't
// depend on TranspositionInput's own rendering choices, only on the shared
// contract every future per-item-graded interaction will also use.
describe('ExerciseLoop — transposition_input (U4/D5/D6): per-item grading protocol wiring', () => {
  const transpositionInstance = generate('octave_transposition', { grade: 3, seed: 1, atoms: ['transpose:octave'] });
  const perItem = transpositionInstance.answer.per_item as { pitch: string }[];
  const answerClef = transpositionInstance.interaction.config.answerClef as 'treble' | 'bass';
  const keySig = transpositionInstance.stimulus.music!.key_sig;

  function spelledOf(naturalPitch: string): string {
    return keySig ? spellInKeySig(naturalPitch, keySig) : naturalPitch;
  }

  /** A tappable natural row whose key-spelled pitch differs from per_item[index]'s
   *  target — lets a test deliberately place a wrong note at a known slot. */
  function wrongNaturalFor(index: number): string {
    const wrong = diatonicPitchesInRange(answerClef, 3).find((p) => spelledOf(p) !== perItem[index].pitch);
    if (!wrong) throw new Error('fixture: no wrong candidate found — widen the pitch range or pick a different seed');
    return wrong;
  }

  function correctNaturalFor(index: number): string {
    return perItem[index].pitch.replace(/[#b]/g, '');
  }

  // The answer stave is a single tap surface (design "tap-vertical = pitch"): a
  // tap at a natural pitch's y snaps to that pitch, then spells it in-key.
  function tapNatural(getByTestId: ReturnType<typeof render>['getByTestId'], naturalPitch: string) {
    fireEvent.press(getByTestId('transposition-tap-surface'), {
      nativeEvent: { locationY: PAPER_INSET + noteY(answerClef, naturalPitch) },
    });
  }

  function placeAllWrong(getByTestId: ReturnType<typeof render>['getByTestId']) {
    for (let i = 0; i < perItem.length; i++) {
      tapNatural(getByTestId, wrongNaturalFor(i));
    }
  }

  function placeOneWrongRestCorrect(getByTestId: ReturnType<typeof render>['getByTestId']) {
    tapNatural(getByTestId, wrongNaturalFor(0));
    for (let i = 1; i < perItem.length; i++) {
      tapNatural(getByTestId, correctNaturalFor(i));
    }
  }

  test('checkLabel drives the disabled Check copy before every slot is placed', () => {
    const { getByTestId } = render(<ExerciseLoop instance={transpositionInstance} onResult={jest.fn()} />);
    expect(getByTestId('check')).toHaveTextContent(`Check — ${perItem.length} notes left`);
    expect(getByTestId('check').props.accessibilityState?.disabled).toBe(true);
  });

  test('a some-right-some-wrong response shows the amber partial sheet with a Fix action, not the plain incorrect sheet', () => {
    const { getByTestId, queryByTestId } = render(<ExerciseLoop instance={transpositionInstance} onResult={jest.fn()} />);
    placeOneWrongRestCorrect(getByTestId);
    fireEvent.press(getByTestId('check'));

    expect(getByTestId('feedback-sheet-partial')).toBeTruthy();
    expect(queryByTestId('feedback-sheet-incorrect')).toBeNull();
    expect(getByTestId('feedback-sheet-secondary')).toBeTruthy();
  });

  test('an all-wrong response routes to the plain incorrect sheet, not the amber partial register (D5)', () => {
    const { getByTestId, queryByTestId } = render(<ExerciseLoop instance={transpositionInstance} onResult={jest.fn()} />);
    placeAllWrong(getByTestId);
    fireEvent.press(getByTestId('check'));

    expect(getByTestId('feedback-sheet-incorrect')).toBeTruthy();
    expect(queryByTestId('feedback-sheet-partial')).toBeNull();
  });

  // The load-bearing invariant (D6): this MUST fail if fix-mode is ever changed
  // to award a clean pass on a repaired attempt.
  test('check fails -> Fix -> re-check passes: Continue still reports correct: false (no-grade-laundering)', () => {
    const onResult = jest.fn();
    const { getByTestId } = render(<ExerciseLoop instance={transpositionInstance} onResult={onResult} />);

    placeOneWrongRestCorrect(getByTestId);
    fireEvent.press(getByTestId('check'));
    expect(getByTestId('feedback-sheet-partial')).toBeTruthy();

    fireEvent.press(getByTestId('feedback-sheet-secondary')); // "Fix note 1"
    tapNatural(getByTestId, correctNaturalFor(0));
    fireEvent.press(getByTestId('check'));
    expect(getByTestId('feedback-sheet-correct')).toBeTruthy();

    fireEvent.press(getByTestId('feedback-sheet-continue'));
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });
});
