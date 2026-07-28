// U7 acceptance tests for the self-graded flashcard interaction (design 2g
// front / 2h revealed). Flashcard reads the atom's current SRS state via
// ProgressContext for the interval preview, so every render wraps a
// ProgressProvider (unlike the other interaction components, which are pure
// props-in). WebView is mocked like ExerciseLoop.test.tsx — NotationCard/
// MusicSurface are pulled in transitively even when no exemplar is rendered.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_props: Record<string, unknown>, _ref: unknown) => null) };
});

import { fireEvent, render } from '@testing-library/react-native';

import type { ExerciseInstance } from '../../engine/schema';
import { ProgressProvider } from '../../learn/ProgressContext';
import type { SnapshotStorage } from '../../learn/store';
import type { Music } from '../../music/types';
import { Flashcard, type FlashcardResponse } from './Flashcard';

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

const baseInstance: ExerciseInstance = {
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

function renderFlashcard(instance: ExerciseInstance, response: FlashcardResponse, onResponseChange = jest.fn(), onSelfGrade = jest.fn()) {
  return render(
    <ProgressProvider storage={memoryStorage()}>
      <Flashcard instance={instance} response={response} graded={null} strand="terms_signs" onResponseChange={onResponseChange} onSelfGrade={onSelfGrade} />
    </ProgressProvider>,
  );
}

describe('Flashcard — front (unrevealed, design 2g)', () => {
  test('shows the term but not the meaning, and no distractors exist to grade against', () => {
    const { getByText, queryByText } = renderFlashcard(baseInstance, { revealed: false, picked: null });
    expect(getByText('Staccato')).toBeTruthy();
    expect(queryByText('detached')).toBeNull();
    expect(baseInstance.distractors).toEqual([]);
  });

  test('the 4 grade buttons render but are disabled before reveal — tapping one does nothing', () => {
    const onSelfGrade = jest.fn();
    const { getByTestId } = renderFlashcard(baseInstance, { revealed: false, picked: null }, jest.fn(), onSelfGrade);

    expect(getByTestId('grade-again').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(getByTestId('grade-good'));
    expect(onSelfGrade).not.toHaveBeenCalled();
  });

  test('tapping the card reports revealed:true, with no grade picked yet', () => {
    const onResponseChange = jest.fn();
    const { getByTestId } = renderFlashcard(baseInstance, { revealed: false, picked: null }, onResponseChange);

    fireEvent.press(getByTestId('flashcard-card'));

    expect(onResponseChange).toHaveBeenCalledWith({ revealed: true, picked: null });
  });
});

describe('Flashcard — revealed (design 2h): term -> meaning, no shared Check button', () => {
  test('shows the term, the meaning, and no distractors', () => {
    const { getByText } = renderFlashcard(baseInstance, { revealed: true, picked: null });
    expect(getByText('Staccato')).toBeTruthy();
    expect(getByText('detached')).toBeTruthy();
  });

  test('all 4 grade buttons — Again, Hard, Good, Easy, in that order — are active once revealed', () => {
    const { getByTestId } = renderFlashcard(baseInstance, { revealed: true, picked: null });
    for (const grade of ['again', 'hard', 'good', 'easy']) {
      expect(getByTestId(`grade-${grade}`).props.accessibilityState?.disabled).toBe(false);
    }
  });

  test.each([
    ['grade-again', 'again'],
    ['grade-hard', 'hard'],
    ['grade-good', 'good'],
    ['grade-easy', 'easy'],
  ])('pressing %s reports onSelfGrade("%s") — routes to the SRS path, not a correct/incorrect verdict', (testId, grade) => {
    const onSelfGrade = jest.fn();
    const { getByTestId } = renderFlashcard(baseInstance, { revealed: true, picked: null }, jest.fn(), onSelfGrade);

    fireEvent.press(getByTestId(testId));

    expect(onSelfGrade).toHaveBeenCalledWith(grade);
  });

  test('once a grade is picked, the buttons lock (no double-submit)', () => {
    const onSelfGrade = jest.fn();
    const { getByTestId } = renderFlashcard(baseInstance, { revealed: true, picked: 'good' }, jest.fn(), onSelfGrade);

    fireEvent.press(getByTestId('grade-easy'));

    expect(onSelfGrade).not.toHaveBeenCalled();
  });
});

describe('Flashcard — interval preview is computed from the engine (AD4), in real days', () => {
  // Before G6 U1 the engine's time unit was a per-session tick, so this label read
  // "3 ticks" and the test asserted the ABSENCE of a day label — the honest thing
  // to render given what the engine then knew. U1 made the unit whole days, so the
  // design mock's calendar wording is now correct rather than aspirational.
  test('every grade button shows a day-based interval, and Again < Hard < Good < Easy (strict monotonic, AE4)', () => {
    const { getByTestId } = renderFlashcard(baseInstance, { revealed: true, picked: null });
    const text = (testId: string) => getByTestId(testId).props.children as string;
    const parseDays = (label: string) => (label === 'now' ? 0 : label === 'tomorrow' ? 1 : parseInt(label, 10));

    const again = parseDays(text('grade-again-interval'));
    const hard = parseDays(text('grade-hard-interval'));
    const good = parseDays(text('grade-good-interval'));
    const easy = parseDays(text('grade-easy-interval'));

    expect(again).toBeLessThan(hard);
    expect(hard).toBeLessThan(good);
    expect(good).toBeLessThan(easy);

    // The unit is named, and it is days — never the old tick label.
    expect(text('grade-easy-interval')).toMatch(/^(now|tomorrow|\d+ days)$/);
    expect(text('grade-hard-interval')).not.toMatch(/tick/i);
  });
});

describe('Flashcard — optional notated exemplar (design: "where meaningful")', () => {
  const exemplar: Music = {
    clef: 'treble',
    key_sig: null,
    time_sig: null,
    voices: [{ events: [{ type: 'note', pitch: 'C4', dur: 'crotchet' }] }],
  };
  const instanceWithExemplar: ExerciseInstance = {
    ...baseInstance,
    interaction: { type: 'flashcard', config: { term: 'Staccato', category: 'other_terms', exemplar } },
  };

  test('front shows a "hear it played" affordance when an exemplar is present', () => {
    const { getByTestId } = renderFlashcard(instanceWithExemplar, { revealed: false, picked: null });
    expect(getByTestId('flashcard-preview-play')).toBeTruthy();
  });

  test('no "hear it played" affordance when the entry has no exemplar (most G1 terms today)', () => {
    const { queryByTestId } = renderFlashcard(baseInstance, { revealed: false, picked: null });
    expect(queryByTestId('flashcard-preview-play')).toBeNull();
  });

  test('revealed shows the exemplar notated on the paper card, with play (rules 1/2)', () => {
    const { getByTestId } = renderFlashcard(instanceWithExemplar, { revealed: true, picked: null });
    expect(getByTestId('flashcard-exemplar')).toBeTruthy();
    expect(getByTestId('flashcard-exemplar-play')).toBeTruthy();
  });
});
