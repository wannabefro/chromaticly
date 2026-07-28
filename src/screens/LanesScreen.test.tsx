// LanesScreen (design 7a) — the Learn tab as seven lanes.
//
// Two invariants beyond "it renders": R1 (no single current grade is asserted
// anywhere on this screen) and the "Choose for me" rule, which decides where a
// learner who does not want to decide is sent. That rule repairs before it deepens,
// and the tests below are what stop it quietly inverting.

jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_p: Record<string, unknown>, _r: unknown) => null) };
});

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { fixedClock } from '../learn/clock';
import { atomsFor, contentGradesFor, STRAND_ORDER } from '../learn/lane-depth';
import { ProgressProvider } from '../learn/ProgressContext';
import { MASTERY_THRESHOLD } from '../learn/mastery';
import { ProgressStore, type SnapshotStorage } from '../learn/store';
import { strandDef, type Strand } from '../ui/theme';
import LanesScreen, { chooseLane } from './LanesScreen';

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
function masterCell(store: ProgressStore, strand: Strand, grade: number, day = DAY, box = 2) {
  for (const atom of atomsFor(strand, grade)) {
    store.setAtom(atom, {
      mastery: { streak: MASTERY_THRESHOLD, mastered: true },
      srs: { box, lastReviewed: day, nextDue: day + box },
    });
  }
}

/** Leave `count` of a strand's lowest-grade atoms overdue at DAY, WITHOUT
 *  un-mastering them — a mastered atom falling due is the ordinary case, and
 *  clearing `mastered` would silently change the lane's depth and confuse the
 *  tie-break fixtures with a second variable. */
function overdue(store: ProgressStore, strand: Strand, count: number) {
  const grade = contentGradesFor(strand)[0];
  for (const atom of atomsFor(strand, grade).slice(0, count)) {
    const before = store.getAtom(atom);
    store.setAtom(atom, {
      mastery: before.mastery,
      srs: { box: 0, lastReviewed: DAY - 10, nextDue: DAY - 5 },
    });
  }
}

function renderLanes(store = new ProgressStore(), onOpenLane?: (s: Strand) => void) {
  store.setProfile({ grade: 1, onboardedAt: '2026-07-14T00:00:00.000Z', name: 'Maya' });
  // A fixed clock, because every fixture is written in DAY-relative terms: on the
  // real clock those reviews are months stale and every lane decays to 0.
  return render(
    <ProgressProvider storage={memoryStorage(JSON.stringify(store.toSnapshot()))} clock={fixedClock(DAY)}>
      <LanesScreen onOpenLane={onOpenLane} />
    </ProgressProvider>,
  );
}

describe('LanesScreen — seven lanes, each at its own depth (7a)', () => {
  test('renders all seven strands in canonical order, each with hue AND glyph (rule 3)', async () => {
    const { findByTestId, getByTestId, getByText } = renderLanes();
    await findByTestId('lanes-screen');

    for (const strand of STRAND_ORDER) {
      const def = strandDef(strand);
      expect(getByTestId(`lane-row-${strand}`)).toBeTruthy();
      expect(getByTestId(`lane-row-${strand}-glyph`).props.children).toBe(def.glyph);
      expect(getByText(def.label)).toBeTruthy();
    }
  });

  // R1: "what grade are you?" has seven answers on this model, so the screen must
  // not carry the single-grade pill the level map does.
  test('asserts no single current grade — there is no grade pill', async () => {
    const { findByTestId, queryByTestId, queryByText } = renderLanes();
    await findByTestId('lanes-screen');

    expect(queryByTestId('grade-pill')).toBeNull();
    expect(queryByText(/^Grade \d$/)).toBeNull();
  });

  test('a fresh learner sees every lane at "not started", not at grade 1', async () => {
    const { findByTestId, getByTestId } = renderLanes();
    await findByTestId('lanes-screen');

    for (const strand of STRAND_ORDER) {
      expect(getByTestId(`lane-row-${strand}-depth`).props.children[0]).toBe('not started');
    }
  });

  test('tapping a lane fires onOpenLane with that strand', async () => {
    const onOpenLane = jest.fn();
    const { findByTestId, getByTestId } = renderLanes(new ProgressStore(), onOpenLane);
    await findByTestId('lanes-screen');

    await act(async () => {
      fireEvent.press(getByTestId('lane-row-intervals'));
    });
    expect(onOpenLane).toHaveBeenCalledWith('intervals');
  });

  test('the suggested lane is highlighted with the reason, and "Choose for me" opens it', async () => {
    const store = new ProgressStore();
    overdue(store, 'terms_signs', 3);
    const onOpenLane = jest.fn();
    const { findByTestId, getByTestId } = renderLanes(store, onOpenLane);
    await findByTestId('lanes-screen');

    await waitFor(() =>
      expect(getByTestId('lane-row-terms_signs-depth').props.children[1]).toBe(' · most overdue'),
    );

    await act(async () => {
      fireEvent.press(getByTestId('lanes-choose-for-me'));
    });
    expect(onOpenLane).toHaveBeenCalledWith('terms_signs');
  });
});

// The affordance for a learner who does not want to choose. It repairs before it
// deepens — otherwise "choose for me" reliably sends people further up whatever they
// are already best at, which is the opposite of what the seven-lane model is for.
describe('chooseLane — repair first, then the shallowest lane (R2/R5)', () => {
  test('the lane with the most overdue attempted atoms wins', () => {
    const store = new ProgressStore();
    overdue(store, 'rhythm', 1);
    overdue(store, 'terms_signs', 3);

    expect(chooseLane(store, DAY)).toEqual({ strand: 'terms_signs', why: 'most overdue' });
  });

  test('a tie on overdue count goes to the SHALLOWER lane — repair, never deepen', () => {
    const store = new ProgressStore();
    // pitch is deep (grades 1 and 3 held), context is a single grade-1 lesson;
    // both have exactly one atom overdue, so only depth can break the tie.
    masterCell(store, 'pitch', 1);
    masterCell(store, 'pitch', 3);
    masterCell(store, 'context', 1);
    overdue(store, 'pitch', 1);
    overdue(store, 'context', 1);

    const picked = chooseLane(store, DAY);
    expect(picked?.strand).toBe('context');
    expect(picked?.why).toBe('most overdue');
  });

  test('with nothing overdue it falls to the shallowest lane that still has content ahead', () => {
    const store = new ProgressStore();
    // Everything held is fresh (not due), so the overdue rule finds nothing.
    for (const grade of contentGradesFor('context')) masterCell(store, 'context', grade);
    masterCell(store, 'rhythm', 1);

    const picked = chooseLane(store, DAY);
    expect(picked?.why).toBe('your shortest');
    // context is fully held, so it can never be the suggestion despite being depth-1
    expect(picked?.strand).not.toBe('context');
  });

  test('a lane at its ceiling is never suggested — there is nothing left to deepen', () => {
    const store = new ProgressStore();
    for (const grade of contentGradesFor('context')) masterCell(store, 'context', grade);

    expect(chooseLane(store, DAY)?.strand).not.toBe('context');
  });

  test('every lane at its ceiling with nothing overdue returns null, and the control says so', async () => {
    const store = new ProgressStore();
    for (const strand of STRAND_ORDER) {
      for (const grade of contentGradesFor(strand)) masterCell(store, strand, grade);
    }
    expect(chooseLane(store, DAY)).toBeNull();

    const onOpenLane = jest.fn();
    const { findByTestId, getByTestId, getByText } = renderLanes(store, onOpenLane);
    await findByTestId('lanes-screen');

    await waitFor(() => expect(getByText('Nothing due — pick any skill')).toBeTruthy());
    fireEvent.press(getByTestId('lanes-choose-for-me'));
    expect(onOpenLane).not.toHaveBeenCalled();
  });

  test('the same store always yields the same suggestion — ordering is deterministic', () => {
    const store = new ProgressStore();
    overdue(store, 'rhythm', 2);
    overdue(store, 'intervals', 2);

    const first = chooseLane(store, DAY);
    expect(chooseLane(store, DAY)).toEqual(first);
  });
});
