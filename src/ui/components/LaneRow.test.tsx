// LaneRow (design 7a). The row is a pure presentation of one `LaneDepth`, so what
// these tests guard is the reading: a sparse matrix must not read as "behind", and
// depth 0 must not read as "one grade in".

import { fireEvent, render } from '@testing-library/react-native';

import { contentGradesFor, type LaneDepth } from '../../learn/lane-depth';
import { strandDef } from '../theme';
import { LaneRow } from './LaneRow';

/** A LaneDepth fixture: the strand's real content grades, held up to `depth`. */
function lane(strand: Parameters<typeof contentGradesFor>[0], depth: number): LaneDepth {
  const contentGrades = contentGradesFor(strand);
  return {
    depth,
    heldGrades: contentGrades.filter((g) => g <= depth),
    contentGrades,
    source: 'evidence',
  };
}

describe('LaneRow — one strand at its own depth (design 7a)', () => {
  test('colour is never the only signal: the row carries the strand glyph and its full name (rule 3)', () => {
    const { getByTestId, getByText } = render(
      <LaneRow strand="rhythm" depth={lane('rhythm', 4)} testID="lane-row" />,
    );

    const def = strandDef('rhythm');
    expect(getByTestId('lane-row-glyph').props.children).toBe(def.glyph);
    expect(getByText(def.label)).toBeTruthy();
    // and the hue rides along with it, not instead of it
    expect(getByTestId('lane-row-glyph').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: def.hue })]),
    );
  });

  test('depth 3 fills every content grade up to 3, and the rest read empty', () => {
    // scales_keys is the one lane with content at every grade, so this is the
    // case where "N filled" and "up to grade N" happen to coincide.
    expect(contentGradesFor('scales_keys')).toEqual([1, 2, 3, 4, 5]);
    const { getByTestId } = render(
      <LaneRow strand="scales_keys" depth={lane('scales_keys', 3)} testID="lane-row" />,
    );

    for (const grade of [1, 2, 3]) expect(getByTestId(`lane-row-seg-${grade}-filled`)).toBeTruthy();
    for (const grade of [4, 5]) expect(getByTestId(`lane-row-seg-${grade}-empty`)).toBeTruthy();
    // Design 1e removed the written depth; it survives where the bar cannot be seen.
    expect(getByTestId('lane-row').props.accessibilityLabel).toBe('Scales & Keys, grade 3');
  });

  // The trap the "N filled of 5" reading falls into: pitch teaches nothing at
  // grade 2, so a learner at pitch depth 3 has THREE content grades held (1, 3, 4
  // are its grades) but only two filled slots below the gap. The bar shows what is
  // actually there, never a synthetic run.
  test('a gap INSIDE the run is drawn as a gap, not filled through', () => {
    expect(contentGradesFor('pitch')).toEqual([1, 3, 4, 5]);
    const { getByTestId } = render(<LaneRow strand="pitch" depth={lane('pitch', 3)} testID="lane-row" />);

    expect(getByTestId('lane-row-seg-1-filled')).toBeTruthy();
    expect(getByTestId('lane-row-seg-2-gap')).toBeTruthy();
    expect(getByTestId('lane-row-seg-3-filled')).toBeTruthy();
    expect(getByTestId('lane-row-seg-4-empty')).toBeTruthy();
  });

  // KTD3: the matrix is sparse. Chords teaches nothing below grade 4, so grades 1-3
  // are GAPS — nothing to earn — not three unearned empties that read as "behind".
  test('a grade with no content renders as a gap segment, never as an unearned empty one', () => {
    expect(contentGradesFor('chords')).toEqual([4, 5]); // otherwise this proves nothing
    const { getByTestId, queryByTestId } = render(
      <LaneRow strand="chords" depth={lane('chords', 4)} testID="lane-row" />,
    );

    for (const grade of [1, 2, 3]) {
      expect(getByTestId(`lane-row-seg-${grade}-gap`)).toBeTruthy();
      expect(queryByTestId(`lane-row-seg-${grade}-empty`)).toBeNull();
      expect(queryByTestId(`lane-row-seg-${grade}-filled`)).toBeNull();
    }
    expect(getByTestId('lane-row-seg-4-filled')).toBeTruthy();
    expect(getByTestId('lane-row-seg-5-empty')).toBeTruthy();
  });

  // R7: depth 0 is a real value meaning "nothing held here yet" — there is no floor
  // at grade 1, so the bar must be empty rather than one segment in.
  test('depth 0 reads "not started" with no filled segment', () => {
    const { getByTestId, queryByTestId } = render(
      <LaneRow strand="intervals" depth={lane('intervals', 0)} testID="lane-row" />,
    );

    expect(getByTestId('lane-row').props.accessibilityLabel).toBe('Intervals, not started');
    for (const grade of [1, 2, 3, 4, 5]) expect(queryByTestId(`lane-row-seg-${grade}-filled`)).toBeNull();
  });

  // Design 1e: the row carries a tag only when it is the suggested one, and it is
  // the only place the row says anything beyond its own name.
  test('a suggested row wears its tag; an ordinary row wears nothing', () => {
    const tagged = render(
      <LaneRow strand="chords" depth={lane('chords', 4)} note="start here" testID="lane-row" />,
    );
    expect(tagged.getByTestId('lane-row-note').props.children).toBe('start here');
    tagged.unmount();

    const plain = render(<LaneRow strand="chords" depth={lane('chords', 4)} testID="lane-row" />);
    expect(plain.queryByTestId('lane-row-note')).toBeNull();
  });

  test('tapping the row fires onPress', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <LaneRow strand="terms_signs" depth={lane('terms_signs', 2)} onPress={onPress} testID="lane-row" />,
    );

    fireEvent.press(getByTestId('lane-row'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

// R5 — drift is honest and unpunished. `laneDepths` has produced `decayedFrom` since
// G6 U2 and nothing rendered it, so a lane that slid from 4 to 2 was indistinguishable
// from one that only ever reached 2. These tests fix the reading of the difference.
describe('LaneRow — a lane that has slid back says so (R5, chromaticly-cel)', () => {
  /** scales_keys teaches at 1-4, so a 4→2 slide has two slipped grades and no gaps
   *  in the way — the clean case for reading the three marks apart. */
  function decayed(depth: number, decayedFrom: number): LaneDepth {
    return { ...lane('scales_keys', depth), decayedFrom };
  }

  test('grades between the current depth and the pre-decay depth are drawn slipped, not empty', () => {
    const { getByTestId } = render(
      <LaneRow strand="scales_keys" depth={decayed(2, 4)} testID="lane-row" />,
    );

    expect(getByTestId('lane-row-seg-1-filled')).toBeTruthy();
    expect(getByTestId('lane-row-seg-2-filled')).toBeTruthy();
    expect(getByTestId('lane-row-seg-3-slipped')).toBeTruthy();
    expect(getByTestId('lane-row-seg-4-slipped')).toBeTruthy();
  });

  // The whole point of the third mark: "earned and gone stale" is a different fact
  // from "never reached", and a learner who worked for grade 4 should see that they
  // did. A lane at depth 2 that never decayed must look different from this one.
  test('an undecayed lane at the same depth draws those grades empty instead', () => {
    const { getByTestId, queryByTestId } = render(
      <LaneRow strand="scales_keys" depth={lane('scales_keys', 2)} testID="lane-row" />,
    );

    expect(getByTestId('lane-row-seg-3-empty')).toBeTruthy();
    expect(queryByTestId('lane-row-seg-3-slipped')).toBeNull();
  });

  test('the slipped mark is the strand’s own hue, not a warning colour — drift is unpunished', () => {
    const { getByTestId } = render(
      <LaneRow strand="scales_keys" depth={decayed(2, 4)} testID="lane-row" />,
    );

    expect(getByTestId('lane-row-seg-3-slipped').props.style).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([expect.objectContaining({ borderColor: strandDef('scales_keys').hue })]),
      ]),
    );
  });

  test('the accessibility label carries what the bar draws — the depth now, and the depth before', () => {
    const { getByLabelText } = render(
      <LaneRow strand="scales_keys" depth={decayed(2, 4)} testID="lane-row" />,
    );
    expect(getByLabelText('Scales & Keys, grade 2, was grade 4')).toBeTruthy();
  });

  test('an undecayed lane says nothing about a previous depth', () => {
    const { getByLabelText } = render(
      <LaneRow strand="scales_keys" depth={lane('scales_keys', 2)} testID="lane-row" />,
    );
    expect(getByLabelText('Scales & Keys, grade 2')).toBeTruthy();
  });

  // A lane can decay all the way back. Depth 0 is a real value (R7), and it must not
  // start reading as grade 1 just because something was once held above it.
  test('a lane decayed to nothing still reads "not started", with the earned grades hollow', () => {
    const { getByTestId, getByLabelText } = render(
      <LaneRow strand="scales_keys" depth={decayed(0, 3)} testID="lane-row" />,
    );

    expect(getByLabelText('Scales & Keys, not started, was grade 3')).toBeTruthy();
    expect(getByTestId('lane-row-seg-1-slipped')).toBeTruthy();
    expect(getByTestId('lane-row-seg-4-empty')).toBeTruthy();
  });
});
