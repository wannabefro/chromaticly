// LanesScreen (design 7a) — the Learn tab as seven lanes.
//
// Two invariants beyond "it renders": R1 (no single current grade is asserted
// anywhere on this screen) and the `chooseLane` rule, which decides where a learner
// who does not want to decide is sent. That rule repairs before it deepens, and the
// tests below are what stop it quietly inverting.
//
// Since design 1e the rule surfaces as a two-word tag on one row rather than a
// button. That makes the tag's WORDING load-bearing in a way a neutral "Choose for
// me" never was: "due" is a factual claim, so it may only appear when something is
// actually overdue.

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

  // R7: depth 0 is a real value, not a floor at 1. Design 1e stopped WRITING it —
  // the bar draws it — so the claim is now made twice over: no segment is filled,
  // and the accessibility label still says it for anyone who cannot see the bar.
  test('a fresh learner sees every lane at "not started", not at grade 1', async () => {
    const { findByTestId, getByTestId, queryByTestId } = renderLanes();
    await findByTestId('lanes-screen');

    for (const strand of STRAND_ORDER) {
      expect(getByTestId(`lane-row-${strand}`).props.accessibilityLabel).toContain('not started');
      for (const grade of [1, 2, 3, 4, 5]) {
        expect(queryByTestId(`lane-row-${strand}-seg-${grade}-filled`)).toBeNull();
      }
    }
  });

  // 1e: four things came off this screen, and each was already being said by
  // something that stayed. This is the guard against any of them creeping back.
  test('carries no greeting, no explainer, no per-row depth text and no chooser button', async () => {
    const store = new ProgressStore();
    overdue(store, 'terms_signs', 3);
    const { findByTestId, queryByTestId, queryByText, getByText } = renderLanes(store);
    await findByTestId('lanes-screen');

    expect(getByText('Learn')).toBeTruthy();
    expect(queryByText(/Where to today/)).toBeNull();
    expect(queryByText(/nothing is locked/)).toBeNull();
    expect(queryByTestId('lanes-choose-for-me')).toBeNull();
    for (const strand of STRAND_ORDER) {
      expect(queryByTestId(`lane-row-${strand}-depth`)).toBeNull();
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

  // Exactly one row wears the tag. Two would be two recommendations, which is none.
  test('the suggested lane, and only that lane, carries the tag — and it opens', async () => {
    const store = new ProgressStore();
    overdue(store, 'terms_signs', 3);
    const onOpenLane = jest.fn();
    const { findByTestId, getByTestId, queryByTestId } = renderLanes(store, onOpenLane);
    await findByTestId('lanes-screen');

    await waitFor(() => expect(getByTestId('lane-row-terms_signs-note').props.children).toBe('due'));
    for (const strand of STRAND_ORDER.filter((s) => s !== 'terms_signs')) {
      expect(queryByTestId(`lane-row-${strand}-note`)).toBeNull();
    }

    await act(async () => {
      fireEvent.press(getByTestId('lane-row-terms_signs'));
    });
    expect(onOpenLane).toHaveBeenCalledWith('terms_signs');
  });

  // The tag is a claim, not a label. A lane picked for being SHALLOW has nothing
  // overdue in it, so calling it "due" would be false on the one row the screen
  // emphasises — the exact place a false claim costs most.
  test('a lane suggested for being shallow says "start here", never "due"', async () => {
    const store = new ProgressStore();
    for (const grade of contentGradesFor('context')) masterCell(store, 'context', grade);
    masterCell(store, 'rhythm', 1);
    const { findByTestId, getByTestId } = renderLanes(store);
    await findByTestId('lanes-screen');

    const picked = chooseLane(store, DAY)!;
    await waitFor(() => expect(getByTestId(`lane-row-${picked.strand}-note`).props.children).toBe('start here'));
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

    expect(chooseLane(store, DAY)).toEqual({ strand: 'terms_signs', tag: 'due' });
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
    expect(picked?.tag).toBe('due');
  });

  test('with nothing overdue it falls to the shallowest lane that still has content ahead', () => {
    const store = new ProgressStore();
    // Everything held is fresh (not due), so the overdue rule finds nothing.
    for (const grade of contentGradesFor('context')) masterCell(store, 'context', grade);
    masterCell(store, 'rhythm', 1);

    const picked = chooseLane(store, DAY);
    expect(picked?.tag).toBe('start here');
    // context is fully held, so it can never be the suggestion despite being depth-1
    expect(picked?.strand).not.toBe('context');
  });

  test('a lane at its ceiling is never suggested — there is nothing left to deepen', () => {
    const store = new ProgressStore();
    for (const grade of contentGradesFor('context')) masterCell(store, 'context', grade);

    expect(chooseLane(store, DAY)?.strand).not.toBe('context');
  });

  // Nothing to recommend now says nothing, rather than saying so in a disabled
  // control. Seven fully-held lanes are self-evidently a free choice.
  test('every lane at its ceiling with nothing overdue returns null, and no row is tagged', async () => {
    const store = new ProgressStore();
    for (const strand of STRAND_ORDER) {
      for (const grade of contentGradesFor(strand)) masterCell(store, strand, grade);
    }
    expect(chooseLane(store, DAY)).toBeNull();

    const { findByTestId, queryByTestId } = renderLanes(store);
    await findByTestId('lanes-screen');

    for (const strand of STRAND_ORDER) {
      expect(queryByTestId(`lane-row-${strand}-note`)).toBeNull();
    }
  });

  test('the same store always yields the same suggestion — ordering is deterministic', () => {
    const store = new ProgressStore();
    overdue(store, 'rhythm', 2);
    overdue(store, 'intervals', 2);

    const first = chooseLane(store, DAY);
    expect(chooseLane(store, DAY)).toEqual(first);
  });
});
