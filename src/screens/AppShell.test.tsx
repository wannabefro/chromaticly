// 302.7 — the tab shell (design 2a). Before this the level map WAS the app: Practice
// had a route nothing linked to and the exam could only be reached by scrolling to the
// bottom of the map. What must hold is that all four tabs are reachable, and that the
// bar gets out of the way when a screen takes over — an exam paper offering a tab out
// of itself mid-paper would be a way to dodge the clock.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { buildExamPaper } from '../learn/exam';
import { ProgressStore } from '../learn/store';
import { ProgressProvider } from '../learn/ProgressContext';
import type { SnapshotStorage } from '../learn/store';
import { assembleOptions } from '../ui/grading';
import AppShell from './AppShell';

const examPaper = buildExamPaper(0);

function memoryStorage(): SnapshotStorage & { blob: string | null } {
  return {
    blob: null,
    async load() {
      return this.blob;
    },
    async save(serialized: string) {
      this.blob = serialized;
    },
  };
}

/** A shell that boots on an already-onboarded profile, which is the only way to
 *  exercise a grade-dependent route — the empty store has no grade at all. */
function renderShellAtGrade(grade: number) {
  const store = new ProgressStore();
  store.setProfile({ grade, onboardedAt: '2026-08-06T00:00:00.000Z' });
  const blob = JSON.stringify(store.toSnapshot());
  return render(
    <ProgressProvider storage={{ async load() { return blob; }, async save() {} }}>
      <AppShell />
    </ProgressProvider>,
  );
}

function renderShell() {
  return render(
    <ProgressProvider storage={memoryStorage()}>
      <AppShell />
    </ProgressProvider>,
  );
}

describe('AppShell — the tab shell (302.7)', () => {
  test('opens on Learn, with all four tabs reachable', async () => {
    const { getByTestId } = renderShell();
    await waitFor(() => expect(getByTestId('tab-bar')).toBeTruthy());

    expect(getByTestId('tab-learn').props.accessibilityState?.selected).toBe(true);
    for (const tab of ['learn', 'practice', 'exams', 'profile']) {
      expect(getByTestId(`tab-${tab}`)).toBeTruthy();
    }
  });

  test('each tab shows its own screen', async () => {
    const { getByTestId } = renderShell();
    await waitFor(() => expect(getByTestId('tab-bar')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('tab-exams')));
    await waitFor(() => expect(getByTestId('exams-screen')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('tab-profile')));
    await waitFor(() => expect(getByTestId('profile-screen')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('tab-learn')));
    await waitFor(() => expect(getByTestId('lanes-screen')).toBeTruthy());
  });

  // G6 U7: the Learn pane is a two-level navigator — the lane list, then one lane's
  // detail — with the shell holding which lane is open, so switching tabs and coming
  // back does not throw the learner out of the lane they were reading.
  test('the Learn pane opens a lane and keeps it open across a tab round-trip', async () => {
    const { getByTestId } = renderShell();
    await waitFor(() => expect(getByTestId('lanes-screen')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('lane-row-pitch')));
    await waitFor(() => expect(getByTestId('lane-screen')).toBeTruthy());
    expect(getByTestId('lane-heading').props.children).toBe('Pitch & Notation');

    act(() => fireEvent.press(getByTestId('tab-practice')));
    act(() => fireEvent.press(getByTestId('tab-learn')));
    await waitFor(() => expect(getByTestId('lane-screen')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('lane-back')));
    await waitFor(() => expect(getByTestId('lanes-screen')).toBeTruthy());
  });


  // An exercise is immersive, and an exam paper especially so: a tab bar over a timed
  // paper is a way to walk out of it mid-question. The bar gets out of the way.
  test('the tab bar disappears once a lesson takes over the screen', async () => {
    const { getByTestId, queryByTestId } = renderShell();
    await waitFor(() => expect(getByTestId('tab-bar')).toBeTruthy());

    // G6 U7: lessons are entered from a lane, so the tap goes through the lane
    // list first. fyu.3: the tap still switches the working grade (setGrade), so
    // the handler is async — await it inside act() rather than firing bare.
    act(() => fireEvent.press(getByTestId('lane-row-pitch')));
    await waitFor(() => expect(getByTestId('unit-row-treble-notes')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByTestId('unit-row-treble-notes'));
    });

    await waitFor(() => expect(getByTestId('set-runner')).toBeTruthy());
    expect(queryByTestId('tab-bar')).toBeNull();
  });

  // Profile's readiness card is about the paper, so it takes you there.
  test('Profile’s exam-readiness card opens the Exams tab', async () => {
    const { getByTestId } = renderShell();
    await waitFor(() => expect(getByTestId('tab-bar')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('tab-profile')));
    await waitFor(() => expect(getByTestId('profile-readiness')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('profile-readiness')));
    await waitFor(() => expect(getByTestId('exams-screen')).toBeTruthy());
  });
});

// G6 U8. Both cross-tab drills are asserted HERE, at the shell, not only as a
// screen callback: a callback-level test proves the tap fired, not that the strand
// survived the tab change. The shell used to hold a bare tab key with no target
// payload, so "route to Learn" and "route to the pitch lane" were different claims
// and only one of them was true. An exact strand is asserted for each entry point.
describe('AppShell — a short strand routes to its lane, not just to Learn (7d)', () => {
  test('the Exams readiness card opens that lane in Learn', async () => {
    const { getByTestId } = renderShell();
    await waitFor(() => expect(getByTestId('tab-bar')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('tab-exams')));
    await waitFor(() => expect(getByTestId('readiness-card-short-pitch')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('readiness-card-short-pitch')));
    await waitFor(() => expect(getByTestId('lane-screen')).toBeTruthy());
    expect(getByTestId('lane-heading').props.children).toBe('Pitch & Notation');
  });

  // 7e/U9. The result's primary action leaves the Exams tab entirely, and the plan
  // is explicit that this cannot be proved at the runner boundary: `ExamRunner` only
  // fires a callback and `ExamsScreen` used to terminate it locally. Driven through
  // the shell, end to end, with the exact strand the paper picked.
  test('the exam result routes to the worst-scoring lane, not back to the Exams list', async () => {
    const { getByTestId } = renderShell();
    await waitFor(() => expect(getByTestId('tab-bar')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('tab-exams')));
    await waitFor(() => expect(getByTestId('readiness-card-sit')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByTestId('readiness-card-sit'));
    });
    await waitFor(() => expect(getByTestId('exam-begin')).toBeTruthy());
    act(() => fireEvent.press(getByTestId('exam-begin')));

    // Everything right except intervals, so intervals is the paper's worst section.
    for (let i = 0; i < examPaper.questions.length; i++) {
      const options = assembleOptions(examPaper.questions[i].instance);
      const wantCorrect = examPaper.questions[i].section !== 'intervals';
      act(() => fireEvent.press(getByTestId(`exam-option-${options.findIndex((o) => o.correct === wantCorrect)}`)));
      act(() => fireEvent.press(getByTestId('exam-next')));
    }

    await waitFor(() => expect(getByTestId('exam-revise-worst')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByTestId('exam-revise-worst'));
    });

    await waitFor(() => expect(getByTestId('lane-screen')).toBeTruthy());
    expect(getByTestId('lane-heading').props.children).toBe('Intervals');
    // ...and at the grade the PAPER examined, not wherever the learner is working.
    // A learner who scored 0/4 on a grade-1 section must not land in grade 4 because
    // their lane depth happens to be higher — the paper asked a grade-1 question.
    expect(getByTestId('lane-grade-label')).toHaveTextContent('Grade 1', { exact: false });

    // The drill is the result screen's PRIMARY action, so it must not cost the
    // learner the other three tabs. `exam-revise-worst` clears the exam grade and
    // switches tab in one commit, which unmounts ExamsScreen before its immersive
    // effect can report false — and the tab bar then stays hidden until the app is
    // restarted. The other exit (`exam-back-to-learn`) never had this problem, which
    // is why nothing caught it.
    expect(getByTestId('tab-bar')).toBeTruthy();
  });

  // The grade pin is a second state slot beside the lane, and only the exam drill
  // sets it. Any later lane opened from the LIST must not inherit it: pinned to
  // grade 1, Chords renders an empty state with its return affordance hidden,
  // because the pin sits below the working grade and `ahead` goes negative.
  test('a lane opened from the list after an exam drill is not still pinned to the paper’s grade', async () => {
    const { getByTestId, queryByTestId } = renderShell();
    await waitFor(() => expect(getByTestId('tab-bar')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('tab-exams')));
    await waitFor(() => expect(getByTestId('readiness-card-sit')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByTestId('readiness-card-sit'));
    });
    await waitFor(() => expect(getByTestId('exam-begin')).toBeTruthy());
    act(() => fireEvent.press(getByTestId('exam-begin')));

    for (let i = 0; i < examPaper.questions.length; i++) {
      const options = assembleOptions(examPaper.questions[i].instance);
      const wantCorrect = examPaper.questions[i].section !== 'intervals';
      act(() => fireEvent.press(getByTestId(`exam-option-${options.findIndex((o) => o.correct === wantCorrect)}`)));
      act(() => fireEvent.press(getByTestId('exam-next')));
    }
    await waitFor(() => expect(getByTestId('exam-revise-worst')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByTestId('exam-revise-worst'));
    });
    await waitFor(() => expect(getByTestId('lane-grade-label')).toHaveTextContent('Grade 1', { exact: false }));

    // Back to the list, then into a DIFFERENT lane.
    act(() => fireEvent.press(getByTestId('lane-back')));
    await waitFor(() => expect(getByTestId('lane-row-chords')).toBeTruthy());
    act(() => fireEvent.press(getByTestId('lane-row-chords')));

    await waitFor(() => expect(getByTestId('lane-screen')).toBeTruthy());
    expect(getByTestId('lane-heading').props.children).toBe('Chords');
    // Chords teaches nothing below grade 4, so a leaked grade-1 pin shows as the
    // empty state rather than as a wrong number.
    expect(queryByTestId('lane-grade-label')).not.toHaveTextContent('Grade 1', { exact: false });
  });

  // The Profile entry point, via its own readiness card. The radar's drill pill is
  // the other one, but it only renders for a strand the learner has STARTED
  // (`value > 0 && value < 1`), so it cannot be exercised on the fresh store this
  // shell test uses — the card's shortfall row is the same `onDrillStrand` seam.
  test('a short skill on Profile opens that lane in Learn, and does not just switch tabs', async () => {
    const { getByTestId } = renderShell();
    await waitFor(() => expect(getByTestId('tab-bar')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('tab-profile')));
    await waitFor(() => expect(getByTestId('profile-readiness-card-short-rhythm')).toBeTruthy());

    act(() => fireEvent.press(getByTestId('profile-readiness-card-short-rhythm')));
    await waitFor(() => expect(getByTestId('lane-screen')).toBeTruthy());
    expect(getByTestId('lane-heading').props.children).toBe('Rhythm');
  });
});


// Council finding 1: the picker offered grade 0 and no mounted screen could open
// its lessons, because the Learn tab routes through the lane matrix and the
// readiness firewall keeps grade 0 out of it. The fix is a route, not a lower
// floor — so what must hold is that the Learn tab BRANCHES on the working grade.
describe('AppShell — the Learn tab at grade 0 is First steps, not the seven lanes', () => {
  test('a grade-0 profile opens First steps', async () => {
    const { getByTestId, queryByTestId, findByTestId } = renderShellAtGrade(0);
    await findByTestId('first-steps-screen');

    expect(queryByTestId('lanes-screen')).toBeNull();
    expect(getByTestId('tab-learn').props.accessibilityState?.selected).toBe(true);
  });

  test('every other grade still opens the seven lanes', async () => {
    for (const grade of [1, 3, 5]) {
      const { queryByTestId, findByTestId, unmount } = renderShellAtGrade(grade);
      await findByTestId('lanes-screen');
      expect(queryByTestId('first-steps-screen')).toBeNull();
      unmount();
    }
  });

  // The tab bar is how a beginner reaches Practice and Profile. A route that
  // replaced the whole shell rather than the tab's pane would strand them.
  test('First steps keeps the tab bar, and the other three tabs still open', async () => {
    const { getByTestId, findByTestId } = renderShellAtGrade(0);
    await findByTestId('first-steps-screen');

    expect(getByTestId('tab-bar')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId('tab-practice'));
    });
    expect(getByTestId('practice-screen')).toBeTruthy();
  });
});
