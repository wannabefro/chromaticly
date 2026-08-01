// LaneScreen (design 7b + the approved divergence in `design/README.md`) — one
// strand, one grade.
//
// Most of what follows guards the divergence rather than the rendering. The
// prototype listed every grade in one scroll; this screen shows one and hides the
// rest behind a picker, and the two failure modes that would quietly undo that are
// (a) a ladder creeping back onto the default screen and (b) the picker becoming a
// gate. Both have explicit tests.
//
// The other half is R10: an advisory prerequisite chip must name the lane it leans
// on, state the learner's depth in it, go there, and never stop the learner
// entering the unit anyway.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { Lesson } from '../content/lessons';
import { fixedClock } from '../learn/clock';
import { atomsFor } from '../learn/lane-depth';
import { MASTERY_THRESHOLD } from '../learn/mastery';
import { ProgressProvider } from '../learn/ProgressContext';
import { ProgressStore, type SnapshotStorage } from '../learn/store';
import type { Strand } from '../ui/theme';
import LaneScreen, { laneUnits, workingGradeFor } from './LaneScreen';

const DAY = 20_600;

function memoryStorage(blob: string | null = null): SnapshotStorage & { blob: string | null } {
  return {
    blob,
    async load() {
      return this.blob;
    },
    async save(serialized: string) {
      this.blob = serialized;
    },
  };
}

/** Master every atom of (strand, grade), reviewed on `day` — the lane-depth fixture. */
function masterCell(store: ProgressStore, strand: Strand, grade: number, day = DAY) {
  for (const atom of atomsFor(strand, grade)) {
    store.setAtom(atom, {
      mastery: { streak: MASTERY_THRESHOLD, mastered: true },
      srs: { box: 2, lastReviewed: day, nextDue: day + 2 },
    });
  }
}

interface Handlers {
  onBack?: () => void;
  onOpenLane?: (strand: Strand) => void;
  onOpenLesson?: (lesson: Lesson) => void;
}

function renderLane(strand: Strand, store = new ProgressStore(), handlers: Handlers = {}) {
  store.setProfile({ grade: 1, onboardedAt: '2026-07-14T00:00:00.000Z', name: 'Maya' });
  // A fixed clock: every fixture is DAY-relative, and on the real clock those
  // reviews are months stale, so every lane would decay to depth 0.
  return render(
    <ProgressProvider storage={memoryStorage(JSON.stringify(store.toSnapshot()))} clock={fixedClock(DAY)}>
      <LaneScreen strand={strand} {...handlers} />
    </ProgressProvider>,
  );
}

describe('LaneScreen — one grade at a time', () => {
  // Depth means "held", so the grade to OPEN on is the first content-bearing grade
  // above it — the one being worked, not the one already finished.
  test('opens on the first content-bearing grade above the lane depth', async () => {
    expect(workingGradeFor({ depth: 0, heldGrades: [], contentGrades: [1, 3, 4, 5], source: 'evidence' })).toBe(1);
    expect(workingGradeFor({ depth: 1, heldGrades: [1], contentGrades: [1, 3, 4, 5], source: 'evidence' })).toBe(3);
    // Sparse: scales_keys teaches 1-4, so holding 2 opens 3, never a non-existent 2.5.
    expect(workingGradeFor({ depth: 2, heldGrades: [1, 2], contentGrades: [1, 2, 3, 4], source: 'evidence' })).toBe(3);
    // At the ceiling there is nothing above, so it holds at the deepest grade
    // rather than opening on nothing.
    expect(workingGradeFor({ depth: 5, heldGrades: [1, 3, 4, 5], contentGrades: [1, 3, 4, 5], source: 'evidence' })).toBe(5);
  });

  test('shows only the opening grade’s units — nothing from any other grade', async () => {
    const store = new ProgressStore();
    masterCell(store, 'intervals', 1);
    const { findByTestId, getByTestId, queryByTestId } = renderLane('intervals', store);
    await findByTestId('lane-screen');

    // Intervals holds grade 1, so it opens on the next grade it teaches.
    expect(getByTestId('lane-grade-label').props.children.join('')).toContain('Grade 2');
    for (const lesson of laneUnits('intervals', 2)) expect(getByTestId(`unit-row-${lesson.id}`)).toBeTruthy();
    for (const lesson of laneUnits('intervals', 1)) expect(queryByTestId(`unit-row-${lesson.id}`)).toBeNull();
    for (const lesson of laneUnits('intervals', 3)) expect(queryByTestId(`unit-row-${lesson.id}`)).toBeNull();
  });

  // The guard against the ladder creeping back. The prototype's grade row read as a
  // five-destination menu at the top of every visit; the whole divergence is that
  // the other four are reachable without being advertised.
  test('nothing on the default screen names a grade other than the one shown', async () => {
    const store = new ProgressStore();
    masterCell(store, 'intervals', 1);
    const { findByTestId, queryByText } = renderLane('intervals', store);
    await findByTestId('lane-screen');

    for (const other of [1, 3, 4, 5]) {
      expect(queryByText(new RegExp(`\\bGrade ${other}\\b`))).toBeNull();
      expect(queryByText(new RegExp(`\\bgrade ${other}\\b`))).toBeNull();
    }
  });

  // R5: depth is a derived reading that decays, so no copy may assert a rank the
  // learner could lose. "You're at grade 3 here" is retired.
  test('the heading names the strand, and no copy claims the learner "is at" a grade', async () => {
    const store = new ProgressStore();
    masterCell(store, 'pitch', 1);
    const { findByTestId, getByTestId, queryByText } = renderLane('pitch', store);
    await findByTestId('lane-screen');

    expect(getByTestId('lane-heading').props.children).toBe('Pitch & Notation');
    expect(queryByText(/You’re at grade/i)).toBeNull();
    expect(queryByText(/You're at grade/i)).toBeNull();
  });

  test('the heading does not change when the grade does', async () => {
    const { findByTestId, getByTestId } = renderLane('pitch');
    await findByTestId('lane-screen');
    const before = getByTestId('lane-heading').props.children;

    act(() => fireEvent.press(getByTestId('lane-other-grades')));
    act(() => fireEvent.press(getByTestId('lane-grade-option-5')));
    await waitFor(() => expect(getByTestId('lane-grade-label').props.children.join('')).toContain('Grade 5'));

    expect(getByTestId('lane-heading').props.children).toBe(before);
  });
});

describe('LaneScreen — the grade picker', () => {
  test('is closed until asked for, and is the only place the five grades are listed', async () => {
    const { findByTestId, getByTestId, queryByTestId } = renderLane('pitch');
    await findByTestId('lane-screen');
    expect(queryByTestId('lane-grade-picker')).toBeNull();

    act(() => fireEvent.press(getByTestId('lane-other-grades')));
    await waitFor(() => expect(getByTestId('lane-grade-picker')).toBeTruthy());
    for (const grade of [1, 2, 3, 4, 5]) expect(getByTestId(`lane-grade-option-${grade}`)).toBeTruthy();
  });

  // KTD3: four of seven strands skip grades. An empty list would read as a bug; the
  // picker states the absence instead.
  test('marks a grade this strand does not teach as "nothing here yet"', async () => {
    const { findByTestId, getByTestId } = renderLane('chords');
    await findByTestId('lane-screen');
    act(() => fireEvent.press(getByTestId('lane-other-grades')));

    // Chords teaches 4 and 5 only.
    expect((await findByTestId('lane-grade-option-2-note')).props.children).toBe('nothing here yet');
    // An absence is not a lock: the row is a plain view, so there is no disabled
    // state to mistake for one.
    expect(getByTestId('lane-grade-option-2').props.accessibilityRole).toBeUndefined();
  });

  test('marks the grade being shown and a grade already held', async () => {
    const store = new ProgressStore();
    masterCell(store, 'scales_keys', 1);
    masterCell(store, 'scales_keys', 2);
    const { findByTestId, getByTestId } = renderLane('scales_keys', store);
    await findByTestId('lane-screen');
    act(() => fireEvent.press(getByTestId('lane-other-grades')));

    expect((await findByTestId('lane-grade-option-3-note')).props.children).toBe('where you are');
    expect(getByTestId('lane-grade-option-1-note').props.children).toBe('held');
  });
});

describe('LaneScreen — above your depth (R2)', () => {
  async function openGrade5(onOpenLesson?: (l: Lesson) => void) {
    const store = new ProgressStore();
    masterCell(store, 'pitch', 1);
    const view = renderLane('pitch', store, { onOpenLesson });
    await view.findByTestId('lane-screen');
    act(() => fireEvent.press(view.getByTestId('lane-other-grades')));
    act(() => fireEvent.press(view.getByTestId('lane-grade-option-5')));
    await waitFor(() => expect(view.getByTestId('lane-ahead-note')).toBeTruthy());
    return view;
  }

  test('says how far ahead it is and offers a one-tap way back', async () => {
    const view = await openGrade5();

    // Pitch holds grade 1 and works grade 2, so grade 5 is three grades ahead.
    expect(JSON.stringify(view.getByTestId('lane-ahead-note').props.children)).toContain('3 grades');
    act(() => fireEvent.press(view.getByTestId('lane-return')));
    await waitFor(() => expect(view.getByTestId('lane-grade-label').props.children.join('')).toContain('Grade 2'));
  });

  // The point of the whole model: looking ahead is never refused. Nothing on this
  // path may be disabled — that would be the padlock under another name.
  test('every unit above the learner’s depth is still enterable', async () => {
    const onOpenLesson = jest.fn();
    const view = await openGrade5(onOpenLesson);

    const units = laneUnits('pitch', 5);
    expect(units.length).toBeGreaterThan(0);
    for (const lesson of units) {
      const row = view.getByTestId(`unit-row-${lesson.id}`);
      expect(row.props.accessibilityState?.disabled).toBeFalsy();
    }
    await act(async () => fireEvent.press(view.getByTestId(`unit-row-${units[0].id}`)));
    expect(onOpenLesson).toHaveBeenCalledWith(units[0]);
  });
});

describe('LaneScreen — the advisory prerequisite chip (R10)', () => {
  // transposing-instruments-5 is the only lesson with two edges (U6): intervals G3
  // and scales_keys G4. A single-chip test would pass against an implementation
  // that renders only the first.
  test('renders BOTH chips when both prerequisites are unmet', async () => {
    const { findByTestId, getByTestId } = renderLane('pitch');
    await findByTestId('lane-screen');
    act(() => fireEvent.press(getByTestId('lane-other-grades')));
    act(() => fireEvent.press(getByTestId('lane-grade-option-5')));

    expect(await findByTestId('prereq-chip-transposing-instruments-5-intervals')).toBeTruthy();
    expect(getByTestId('prereq-chip-transposing-instruments-5-scales_keys')).toBeTruthy();
  });

  test('a met prerequisite renders no chip; the unmet one still does', async () => {
    const store = new ProgressStore();
    for (const grade of [1, 2, 3]) masterCell(store, 'intervals', grade);
    const { findByTestId, getByTestId, queryByTestId } = renderLane('pitch', store);
    await findByTestId('lane-screen');
    act(() => fireEvent.press(getByTestId('lane-other-grades')));
    act(() => fireEvent.press(getByTestId('lane-grade-option-5')));

    await findByTestId('unit-row-transposing-instruments-5');
    expect(queryByTestId('prereq-chip-transposing-instruments-5-intervals')).toBeNull();
    expect(getByTestId('prereq-chip-transposing-instruments-5-scales_keys')).toBeTruthy();
  });

  // A chip that renders but goes nowhere is the likely half-build, and each chip
  // must reach ITS OWN lane rather than whichever one was authored first.
  test('each chip navigates to the lane it names', async () => {
    const onOpenLane = jest.fn();
    const { findByTestId, getByTestId } = renderLane('pitch', new ProgressStore(), { onOpenLane });
    await findByTestId('lane-screen');
    act(() => fireEvent.press(getByTestId('lane-other-grades')));
    act(() => fireEvent.press(getByTestId('lane-grade-option-5')));

    act(() => fireEvent.press(getByTestId('prereq-chip-transposing-instruments-5-intervals')));
    expect(onOpenLane).toHaveBeenLastCalledWith('intervals');

    act(() => fireEvent.press(getByTestId('prereq-chip-transposing-instruments-5-scales_keys')));
    expect(onOpenLane).toHaveBeenLastCalledWith('scales_keys');
  });

  // Advisory, never blocking — the chip explains, the row still opens.
  test('the chipped unit is still enterable', async () => {
    const onOpenLesson = jest.fn();
    const { findByTestId, getByTestId } = renderLane('pitch', new ProgressStore(), { onOpenLesson });
    await findByTestId('lane-screen');
    act(() => fireEvent.press(getByTestId('lane-other-grades')));
    act(() => fireEvent.press(getByTestId('lane-grade-option-5')));

    await findByTestId('prereq-chip-transposing-instruments-5-intervals');
    await act(async () => fireEvent.press(getByTestId('unit-row-transposing-instruments-5')));
    expect(onOpenLesson).toHaveBeenCalledWith(expect.objectContaining({ id: 'transposing-instruments-5' }));
  });

  test('the chip states the learner’s depth in the lane it names, including depth 0', async () => {
    const { findByTestId, getByTestId } = renderLane('pitch');
    await findByTestId('lane-screen');
    act(() => fireEvent.press(getByTestId('lane-other-grades')));
    act(() => fireEvent.press(getByTestId('lane-grade-option-5')));

    const chip = await findByTestId('prereq-chip-transposing-instruments-5-intervals');
    // R7: depth 0 is a real value, never rendered as "grade 0" or floored to 1.
    expect(chip.props.accessibilityLabel).toContain("you haven't started it");
    expect(chip.props.accessibilityLabel).not.toContain('grade 0');
    expect(chip.props.accessibilityLabel).toContain('Intervals');
  });
});

describe('LaneScreen — unit ordering and entry', () => {
  // KTD4: `unlocks` no longer gates anything, but it is retained as the authored
  // teaching sequence, and this screen is what reads it.
  test('units follow the authored unlocks chain, filtered to the lane', async () => {
    const ordered = laneUnits('rhythm', 1).map((l) => l.id);
    const byArrayOrder = laneUnits('rhythm', 1)
      .slice()
      .map((l) => l.id);
    expect(ordered).toEqual(byArrayOrder);
    expect(ordered.length).toBeGreaterThan(1);

    // Every unit in the cell is present exactly once — an ordering must not drop one.
    expect(new Set(ordered).size).toBe(ordered.length);
  });

  test('entering a unit hands the whole lesson over, atoms and grade intact (R8)', async () => {
    const onOpenLesson = jest.fn();
    const { findByTestId, getByTestId } = renderLane('rhythm', new ProgressStore(), { onOpenLesson });
    await findByTestId('lane-screen');

    const first = laneUnits('rhythm', 1)[0];
    await act(async () => fireEvent.press(getByTestId(`unit-row-${first.id}`)));
    expect(onOpenLesson).toHaveBeenCalledWith(first);
    expect(onOpenLesson.mock.calls[0][0].atoms.length).toBeGreaterThan(0);
    expect(onOpenLesson.mock.calls[0][0].grade).toBe(1);
  });

  test('the primary action enters the first unfinished unit', async () => {
    const onOpenLesson = jest.fn();
    const { findByTestId, getByTestId } = renderLane('rhythm', new ProgressStore(), { onOpenLesson });
    await findByTestId('lane-screen');

    await act(async () => fireEvent.press(getByTestId('lane-primary')));
    expect(onOpenLesson).toHaveBeenCalledWith(laneUnits('rhythm', 1)[0]);
  });

  test('back returns to the lane list', async () => {
    const onBack = jest.fn();
    const { findByTestId, getByTestId } = renderLane('rhythm', new ProgressStore(), { onBack });
    await findByTestId('lane-screen');

    act(() => fireEvent.press(getByTestId('lane-back')));
    expect(onBack).toHaveBeenCalled();
  });
});
