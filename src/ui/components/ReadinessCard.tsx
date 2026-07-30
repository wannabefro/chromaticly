// Exam readiness read off the whole depth vector (design 7d, G6 U8).
//
// It replaced a percentage ring, and the two say different things. A fraction of
// stars answered "how far through the grade are you" — one number that moved when
// a strand the paper never asks about moved, and that could not say what being
// short would cost. This answers the question a learner about to sit a paper
// actually has: which skills is this paper going to ask me about, where am I short,
// and how many marks is that worth.
//
// Three rules it must not break:
//
//  • It NEVER blocks (R6). "Sit the paper anyway" is a visible peer action at every
//    depth, not a disabled control that unlocks later.
//  • A strand the paper has no section for reads "not examined at this grade" —
//    stated, not hidden. Hiding it would let a five-section paper read as a
//    seven-strand assessment (KTD8).
//  • A shortfall names the strand AND the marks, because "you're short on rhythm"
//    without "that section is 4 marks" is a worry, not information.
//
// Colour is paired with a glyph and the strand's full name throughout
// (never-violate rule 3), and the card keeps `--text` as its own accent: seven
// strands are on screen at once, so none of them is "the current strand".

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ExamReadiness, ReadinessRow } from '../../learn/mastery-rollup';
import { colors, fonts, shape, strandDef, type as typo, type Strand } from '../theme';

export interface ReadinessCardProps {
  readiness: ExamReadiness;
  /** Tapping a short strand crosses to that lane's detail — the repair is one tap
   *  from the diagnosis, or naming it is just a complaint. */
  onOpenLane?: (strand: Strand) => void;
  /** The always-available peer action. Absent only where the paper does not exist. */
  onSit?: () => void;
  testID?: string;
}

export function ReadinessCard({ readiness, onOpenLane, onSit, testID = 'readiness-card' }: ReadinessCardProps) {
  const { grade, shortfalls, marksAtRisk, totalMarks, ready } = readiness;
  const notExamined = readiness.rows.filter((r) => !r.examined);

  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.title}>Grade {grade} paper</Text>

      <Text style={styles.headline} testID={`${testID}-headline`}>
        {ready
          ? `Every skill this paper asks about is at grade ${grade}.`
          : `${shortfalls.length === 1 ? 'One skill is' : `${shortfalls.length} skills are`} below grade ${grade} — ${marksAtRisk} of ${totalMarks} marks.`}
      </Text>

      {shortfalls.map((row) => (
        <ShortfallRow key={row.strand} row={row} grade={grade} onPress={onOpenLane} testID={testID} />
      ))}

      {notExamined.length > 0 && (
        <Text style={styles.notExamined} testID={`${testID}-not-examined`}>
          Not examined at this grade: {notExamined.map((r) => strandDef(r.strand as Strand).label).join(', ')}.
        </Text>
      )}

      {onSit && (
        <Pressable style={styles.sit} onPress={onSit} testID={`${testID}-sit`}>
          <Text style={styles.sitLabel}>{ready ? 'Sit the paper' : 'Sit the paper anyway'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function ShortfallRow({
  row,
  grade,
  onPress,
  testID,
}: {
  row: ReadinessRow;
  grade: number;
  onPress?: (strand: Strand) => void;
  testID: string;
}) {
  const def = strandDef(row.strand as Strand);
  return (
    <Pressable
      style={styles.row}
      onPress={onPress ? () => onPress(row.strand as Strand) : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${def.label}, ${depthPhrase(row.depth)}, ${row.marks} marks`}
      testID={`${testID}-short-${row.strand}`}
    >
      <Text style={[styles.glyph, { color: def.hue }]}>{def.glyph}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{row.sectionTitle}</Text>
        <Text style={styles.rowNote}>
          {depthPhrase(row.depth)} · this paper asks at grade {grade}
        </Text>
      </View>
      <Text style={styles.marks}>{row.marks} marks</Text>
      {onPress && <Text style={styles.chev}>›</Text>}
    </Pressable>
  );
}

/** Depth 0 is a real value (R7) and needs words, not "grade 0". */
function depthPhrase(depth: number): string {
  return depth === 0 ? 'not started' : `at grade ${depth}`;
}

const styles = StyleSheet.create({
  card: {
    gap: shape.spaceInline,
    padding: shape.spaceCard,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
  },
  title: { ...typo.label, fontFamily: fonts.mono, color: colors.textMuted },
  headline: { ...typo.cardTitle, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    minHeight: shape.tapMin,
    paddingVertical: 6,
  },
  // Fixed width, not intrinsic: the seven music glyphs differ in advance width
  // (the interval arrow is roughly twice the sharp), so an intrinsic column left every
  // row's text starting at a different x.
  glyph: { fontFamily: fonts.music, fontSize: 17, width: 22, flexShrink: 0, textAlign: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { ...typo.body, color: colors.text },
  rowNote: { ...typo.label, color: colors.textMuted },
  marks: { ...typo.label, fontFamily: fonts.mono, color: colors.textMuted, flexShrink: 0 },
  chev: { ...typo.label, fontSize: 17, color: colors.textGhost, flexShrink: 0 },
  notExamined: { ...typo.label, color: colors.textGhost },
  sit: {
    minHeight: shape.tapMin,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: colors.borderStrong,
  },
  sitLabel: { ...typo.body, color: colors.text },
});
