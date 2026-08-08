// 7-strand mastery radar (design 6d). A heptagonal spider chart: faint gridline
// rings + axes, a filled data polygon in the screen's single accent (rule 3: one
// accent per screen — the app's context violet), and a vertex dot per strand in the
// strand's own hue. Colour is always paired with a text label in the legend beside it
// (rule 3, colour-vision safety). Empty (nothing mastered) draws a dashed promise.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Circle, Line, Polygon, Svg } from 'react-native-svg';

import type { StrandMastery } from '../../learn/mastery-rollup';
import { ACCENT, colors, shape, STRAND_DEFS, STRAND_ORDER, type as typo, type Strand } from '../theme';

const CENTER = 100;
const RADIUS = 70;
const N = STRAND_ORDER.length;

/** Vertex position for strand slot `i` at fractional radius `r` (0..1). Rhythm sits at
 *  the top (−90°) and the strands run clockwise, matching design 6d. */
function vertex(i: number, r: number): { x: number; y: number } {
  const angle = ((-90 + (i * 360) / N) * Math.PI) / 180;
  return { x: CENTER + RADIUS * r * Math.cos(angle), y: CENTER + RADIUS * r * Math.sin(angle) };
}

function ring(r: number): string {
  return STRAND_ORDER.map((_, i) => {
    const { x, y } = vertex(i, r);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export interface StrandRadarProps {
  /** Per-strand mastery, keyed by strand string (from `strandMastery`). */
  mastery: Record<string, StrandMastery>;
  /** Tap a vertex or the weakest pill to drill into that strand. */
  onDrill?: (strand: Strand) => void;
}

export function StrandRadar({ mastery, onDrill }: StrandRadarProps) {
  const rows = STRAND_ORDER.map((strand, i) => ({
    strand,
    i,
    def: STRAND_DEFS[strand],
    value: mastery[strand]?.value ?? 0,
    // A strand with no lessons in the current grade is not "0% mastered" — it is not
    // taught yet (Grade 1 has no chords). Those axes stay empty rather than spiking the
    // shape to centre and reading as failure.
    hasContent: (mastery[strand]?.total ?? 0) > 0,
  }));

  // The shape spans only strands that have content, so a not-yet-taught strand leaves
  // its axis unfilled instead of dragging the polygon inward.
  const plotted = rows.filter((r) => r.hasContent);
  const empty = plotted.every((r) => r.value === 0);
  const dataPolygon = plotted.map((r) => vertex(r.i, r.value)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // The weakest strand the learner has actually started — the drill target. Fully
  // mastered and untouched strands are not "holding you back".
  const weakest = rows
    .filter((r) => r.value > 0 && r.value < 1)
    .sort((a, b) => a.value - b.value)[0];

  return (
    <View style={styles.card} testID="strand-radar">
      <View style={styles.header}>
        <Text style={styles.title}>Strand mastery</Text>
        {!empty && <Text style={styles.hint}>tap a point to drill</Text>}
      </View>

      <View style={styles.chartRow}>
        <Svg width={150} height={150} viewBox="0 0 200 200">
          {/* gridline rings + axes */}
          <Polygon
            points={ring(1)}
            fill="none"
            stroke={colors.border}
            strokeWidth={1.4}
            strokeDasharray={empty ? '4 4' : undefined}
          />
          <Polygon points={ring(0.5)} fill="none" stroke={colors.surfaceCardSunken} strokeWidth={1.2} />
          {STRAND_ORDER.map((_, i) => {
            const { x, y } = vertex(i, 1);
            return <Line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke={colors.surfaceCardSunken} strokeWidth={1.2} />;
          })}

          {!empty && (
            <>
              <Polygon points={dataPolygon} fill={ACCENT} fillOpacity={0.18} stroke={ACCENT} strokeWidth={2} />
              {plotted.map((r) => {
                const p = vertex(r.i, r.value);
                return r.value > 0 ? <Circle key={r.strand} cx={p.x} cy={p.y} r={4.5} fill={r.def.hue} /> : null;
              })}
              {/* Larger transparent hit targets — the visible dots are too small to tap. */}
              {plotted.map((r) => {
                const p = vertex(r.i, r.value);
                return (
                  <Circle key={`hit-${r.strand}`} cx={p.x} cy={p.y} r={16} fill="transparent" onPress={() => onDrill?.(r.strand)} />
                );
              })}
            </>
          )}
        </Svg>

        <View style={styles.legend}>
          {rows.map((r) => (
            <View key={r.strand} style={[styles.legendRow, !r.hasContent && styles.legendRowIdle]} testID={`radar-legend-${r.strand}`}>
              <View style={[styles.swatch, { backgroundColor: r.def.hue }]} />
              <Text style={styles.legendLabel}>{r.def.short}</Text>
              <Text style={styles.legendPct}>{r.hasContent ? `${Math.round(r.value * 100)}%` : '—'}</Text>
            </View>
          ))}
        </View>
      </View>

      {empty ? (
        <View style={styles.promise} testID="strand-radar-empty">
          <Text style={styles.promiseText}>Master lessons to draw your mastery across the seven strands.</Text>
        </View>
      ) : weakest ? (
        <TouchableOpacity style={styles.weakest} testID="radar-weakest" onPress={() => onDrill?.(weakest.strand)}>
          <View style={[styles.swatch, { backgroundColor: weakest.def.hue }]} />
          <Text style={styles.weakestText}>
            Weakest: <Text style={styles.weakestName}>{weakest.def.label}</Text> — jump to next lesson
          </Text>
          <Text style={styles.weakestChevron}>›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    padding: shape.spaceCard,
    gap: shape.spaceInline,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typo.cardTitle, color: colors.text },
  hint: { ...typo.label, color: colors.textFaint },

  chartRow: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceInline },
  legend: { flex: 1, gap: shape.spaceSnug },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceSnug },
  legendRowIdle: { opacity: 0.4 },
  swatch: { width: 9, height: 9, borderRadius: 3 },
  legendLabel: { ...typo.body, color: colors.text },
  legendPct: { ...typo.label, color: colors.textMuted, marginLeft: 'auto' },

  promise: {
    backgroundColor: colors.surfaceCardSunken,
    borderRadius: shape.radiusControl,
    padding: shape.spaceInline,
  },
  promiseText: { ...typo.body, color: colors.textMuted },

  weakest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    backgroundColor: colors.surfaceCardSunken,
    borderRadius: shape.radiusControl,
    padding: shape.spaceInline,
  },
  weakestText: { ...typo.body, color: colors.textMuted, flex: 1 },
  weakestName: { color: colors.text },
  weakestChevron: { ...typo.cardTitle, color: ACCENT },
});
