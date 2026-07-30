// One strand's lane on the Learn tab (design 7a, `design/Progression Screens C.dc.html`).
// A hue-tinted glyph tile, the strand's name, a five-segment depth bar and the depth
// in mono — the radar's spoke, unrolled into something you can tap.
//
// Three things this renders that a naive "N of 5 filled" bar would get wrong:
//
//  • The matrix is SPARSE. Chords teaches nothing below grade 4; context is a single
//    grade-1 lesson. A grade with no content is drawn as a distinct GAP segment, not
//    as an unearned empty one (KTD3) — otherwise chords reads as 3 grades behind for
//    material that does not exist.
//  • Depth 0 is a real value, not a floor at 1 (R7). It reads "not started" with an
//    empty bar, never a filled first segment.
//  • Colour is never the only signal (never-violate rule 3): the hue always rides
//    with the strand's glyph and its full name.
//  • The depth is DRAWN, not written (design 1e). The mono "grade 3" / "not started"
//    that used to sit beside the bar said what the bar already says, seven times
//    over. It survives in the accessibility label, where the bar cannot be read.
//  • A lane that has SLID BACK says so in the bar, not in words (R5). The grades it
//    used to hold are drawn as hollow hue — the shape of what was earned, without the
//    fill — between the depth it reads now and the depth it read before. This is
//    deliberately not a fourth tag: design 1e reserves the tag slot for the one
//    suggested lane, and several lanes can decay at once. Drift is honest and
//    unpunished: nothing here says "lost", and the segments are the strand's own hue
//    rather than a warning colour.
//
// The row does not decide anything — `laneDepths` is the single derivation behind
// this, the radar, exam readiness and the placement result (R3).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LaneDepth } from '../../learn/lane-depth';
import { colors, fonts, shape, strandDef, type as typo, type Strand } from '../theme';

/** The five ABRSM grades the bar always shows, so every lane is read against the
 *  same ruler — a lane with content at 4-5 only still occupies five slots, with
 *  the first three drawn as gaps. */
const GRADES = [1, 2, 3, 4, 5];

export interface LaneRowProps {
  strand: Strand;
  depth: LaneDepth;
  /** Why this lane is being suggested, e.g. "your shortest" — rendered beside the
   *  depth and paired with the emphasised border. Omitted on every other row, so
   *  exactly one lane can carry the suggestion. */
  note?: string;
  onPress?: () => void;
  testID?: string;
}

export function LaneRow({ strand, depth, note, onPress, testID }: LaneRowProps) {
  const def = strandDef(strand);
  const suggested = note !== undefined;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${def.label}, ${depthLabel(depth.depth)}${
        depth.decayedFrom !== undefined ? `, was grade ${depth.decayedFrom}` : ''
      }`}
      style={[styles.row, suggested && { borderColor: def.hue, backgroundColor: `${def.hue}1f` }]}
    >
      <View style={[styles.glyphTile, { backgroundColor: `${def.hue}1f` }]}>
        <Text style={[styles.glyph, { color: def.hue }]} testID={testID ? `${testID}-glyph` : undefined}>
          {def.glyph}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.name}>{def.label}</Text>
        <View style={styles.segs}>
          {GRADES.map((grade) => {
            const state = segmentState(grade, depth);
            return (
              <View
                key={grade}
                testID={testID ? `${testID}-seg-${grade}-${state}` : undefined}
                style={[
                  styles.seg,
                  state === 'filled' && { backgroundColor: def.hue },
                  state === 'slipped' && [styles.segSlipped, { borderColor: def.hue }],
                  state === 'gap' && styles.segGap,
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* The one tag on the one suggested lane. It replaces a full-width button
          that needed its own sentence to explain what it would do. */}
      {note ? (
        <Text style={[styles.note, { color: def.hue }]} testID={testID ? `${testID}-note` : undefined}>
          {note}
        </Text>
      ) : null}
      <Text style={[styles.chev, suggested && { color: def.hue }]}>›</Text>
    </Pressable>
  );
}

/** `filled` — held and at or below the lane's depth. `slipped` — inside the depth
 *  this lane used to read before decay, so it was earned and has gone stale (R5).
 *  `gap` — the strand teaches nothing at this grade, so there is nothing to earn.
 *  `empty` — real content, not yet reached.
 *
 *  `slipped` is checked after `filled`, so a lane that decayed from 4 to 2 draws
 *  1-2 filled and 3-4 hollow rather than the whole span one way or the other. */
function segmentState(grade: number, depth: LaneDepth): 'filled' | 'slipped' | 'empty' | 'gap' {
  if (!depth.contentGrades.includes(grade)) return 'gap';
  if (grade <= depth.depth) return 'filled';
  if (depth.decayedFrom !== undefined && grade <= depth.decayedFrom) return 'slipped';
  return 'empty';
}

function depthLabel(depth: number): string {
  return depth === 0 ? 'not started' : `grade ${depth}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderWActive,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
    minHeight: shape.tapMin,
  },
  glyphTile: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontFamily: fonts.music,
    fontSize: 17,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typo.cardTitle,
    fontSize: 14.5,
    lineHeight: 18,
    color: colors.text,
  },
  segs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 7,
  },
  seg: {
    width: 20,
    height: 5,
    flexShrink: 0,
    borderRadius: shape.radiusChip,
    backgroundColor: colors.borderStrong,
  },
  // Hollow hue: the outline of a grade that was held. Distinct from `empty` (solid
  // grey, never earned) and from `gap` (dashed ghost, nothing to earn) — three
  // different facts, three different marks.
  segSlipped: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  segGap: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textGhost,
  },
  note: {
    ...typo.label,
    flexShrink: 0,
  },
  chev: {
    ...typo.label,
    fontSize: 17,
    flexShrink: 0,
    color: colors.textGhost,
  },
});
