// 302.3 teach phase (design 4a/4b): the concept intro before the exercise set.
// Guards that the core cards render from lesson content, that the worked example
// is shown pre-solved (correct option highlighted), and that the sticky CTA hands
// off to the set — a lesson with teach content must never drop straight into
// exercises.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { fireEvent, render } from '@testing-library/react-native';

import { lessonById } from '../content/lessons';
import { TeachPhase } from './TeachPhase';

const trebleNotes = lessonById('treble-notes')!;
const terms = lessonById('terms-and-signs')!;

describe('TeachPhase — teach/read cards before the set (302.3)', () => {
  test('renders objectives, concept, and smart tip from the lesson teach content', () => {
    const { getByTestId, getByText } = render(<TeachPhase lesson={trebleNotes} onStart={jest.fn()} />);
    expect(getByTestId('teach-phase')).toBeTruthy();
    expect(getByText("In this lesson you'll learn")).toBeTruthy();
    expect(getByText(trebleNotes.teach!.objectives[0])).toBeTruthy();
    expect(getByText(trebleNotes.teach!.concept.title)).toBeTruthy();
    expect(getByTestId('teach-smart-tip')).toBeTruthy();
  });

  test('the concept card renders notation on paper (rules 1/2 — the stave is the hero)', () => {
    const { getByTestId } = render(<TeachPhase lesson={trebleNotes} onStart={jest.fn()} />);
    expect(getByTestId('teach-concept-card')).toBeTruthy();
    // Every notation display carries a play affordance (rule 2).
    expect(getByTestId('teach-concept-card-play')).toBeTruthy();
  });

  test('the worked example is shown pre-solved with the correct option highlighted', () => {
    const { getByTestId } = render(<TeachPhase lesson={trebleNotes} onStart={jest.fn()} />);
    expect(getByTestId('teach-worked-example')).toBeTruthy();
    expect(getByTestId('teach-worked-correct')).toBeTruthy();
  });

  test('the sticky CTA starts the exercise set; the chevron closes', () => {
    const onStart = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = render(<TeachPhase lesson={trebleNotes} onStart={onStart} onClose={onClose} />);
    fireEvent.press(getByTestId('teach-start'));
    expect(onStart).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId('teach-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('a flashcard lesson (no MCQ options) shows no worked-example card but still teaches', () => {
    const { getByTestId, queryByTestId } = render(<TeachPhase lesson={terms} onStart={jest.fn()} />);
    expect(getByTestId('teach-phase')).toBeTruthy();
    expect(getByTestId('teach-smart-tip')).toBeTruthy();
    expect(queryByTestId('teach-worked-example')).toBeNull();
  });

  test('the did-you-know card renders and collecting fires once on first view', () => {
    const onCollectFact = jest.fn();
    const { getByTestId, getByText } = render(
      <TeachPhase lesson={trebleNotes} onStart={jest.fn()} factCollected={false} onCollectFact={onCollectFact} />,
    );
    expect(getByTestId('teach-did-you-know')).toBeTruthy();
    expect(getByText(trebleNotes.teach!.didYouKnow!)).toBeTruthy();
    expect(onCollectFact).toHaveBeenCalledTimes(1);
  });

  test('an already-collected fact is not re-collected on view', () => {
    const onCollectFact = jest.fn();
    render(<TeachPhase lesson={trebleNotes} onStart={jest.fn()} factCollected onCollectFact={onCollectFact} />);
    expect(onCollectFact).not.toHaveBeenCalled();
  });
});
