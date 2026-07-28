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
    // scales_keys is the one dense lane below grade 4 (content at 1-4), so this is
    // the case where "N filled" and "up to grade N" happen to coincide.
    expect(contentGradesFor('scales_keys')).toEqual([1, 2, 3, 4]);
    const { getByTestId } = render(
      <LaneRow strand="scales_keys" depth={lane('scales_keys', 3)} testID="lane-row" />,
    );

    for (const grade of [1, 2, 3]) expect(getByTestId(`lane-row-seg-${grade}-filled`)).toBeTruthy();
    expect(getByTestId('lane-row-seg-4-empty')).toBeTruthy();
    expect(getByTestId('lane-row-seg-5-gap')).toBeTruthy(); // scales_keys teaches nothing at 5
    expect(getByTestId('lane-row-depth').props.children).toEqual(['grade 3', '']);
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

    expect(getByTestId('lane-row-depth').props.children).toEqual(['not started', '']);
    for (const grade of [1, 2, 3, 4, 5]) expect(queryByTestId(`lane-row-seg-${grade}-filled`)).toBeNull();
  });

  test('a suggested row states WHY it is suggested, beside its depth', () => {
    const { getByTestId } = render(
      <LaneRow strand="chords" depth={lane('chords', 4)} note="your shortest" testID="lane-row" />,
    );
    expect(getByTestId('lane-row-depth').props.children).toEqual(['grade 4', ' · your shortest']);
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
