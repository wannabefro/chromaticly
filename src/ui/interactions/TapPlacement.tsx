// tap_placement — adding bar-lines (chromaticly-51o, design/README.md divergence
// approved 2026-08-08). The rhythm is rendered above on paper by the exercise
// loop; this is the gap strip the learner answers with.
//
// The tap lands in the score: `gapTapped` reports the space between two notes
// and the paper draws the placed lines. The strip below stays, as
// find_the_bar's does — a 44px WebView zone is not a target everyone hits.

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ExerciseInstance } from '../../engine/schema';
import type { BarlineMarks } from '../../music-surface/bridge';
import type { Music, MusicEvent } from '../../music/types';
import { colors, shape, strandDef, type as typo } from '../theme';
import type { InteractionComponentProps } from './types';

export type TapPlacementResponse = number[];

/** Fails loud, like `barCount`. A strip with no gaps is unanswerable, and
 *  nothing anywhere would say why. */
export function noteCount(instance: ExerciseInstance): number {
  const notes = instance.interaction.config?.notes;
  if (typeof notes !== 'number' || !Number.isInteger(notes) || notes < 2) {
    throw new Error(`tap_placement: interaction.config.notes must be an integer >= 2, got ${String(notes)}`);
  }
  return notes;
}

const GLYPH: Record<string, string> = {
  breve: '\u{1D15C}',
  semibreve: '\u{1D15D}',
  minim: '\u{1D15E}',
  crotchet: '\u{1D15F}',
  quaver: '\u{1D160}',
  semiquaver: '\u{1D161}',
  demisemiquaver: '\u{1D162}',
};

/** The drawn note values, so the strip shows the rhythm rather than dots. */
export function noteGlyphs(instance: ExerciseInstance): string[] {
  const music = instance.stimulus.music as Music | null;
  const events: MusicEvent[] = music?.voices[0]?.events ?? [];
  return events
    .filter((ev) => ev.type === 'note')
    .map((ev) => `${GLYPH[(ev as { dur: string }).dur] ?? '\u{1D15F}'}${(ev as { dots?: number }).dots ? '.' : ''}`);
}

export function toggleBarline(response: TapPlacementResponse, at: number): TapPlacementResponse {
  return response.includes(at) ? response.filter((p) => p !== at) : [...response, at].sort((a, b) => a - b);
}

export function TapPlacement({ instance, response, graded, strand, onResponseChange }: InteractionComponentProps<TapPlacementResponse>) {
  const hue = strandDef(strand).hue;
  const total = noteCount(instance);
  const glyphs = useMemo(() => noteGlyphs(instance), [instance]);
  const correct = (instance.answer.canonical as number[]) ?? [];
  const locked = graded !== null;

  return (
    <View style={styles.container} testID="tap-placement">
      <Text style={styles.hint}>
        {response.length === 0
          ? 'Tap between two notes to place a bar-line. Tap it again to remove it.'
          : `${response.length} bar-line${response.length === 1 ? '' : 's'} placed.`}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {glyphs.map((glyph, index) => {
          const at = index + 1;
          const placed = response.includes(at);
          const isLast = at === total;
          const wrong = locked && placed && !correct.includes(at);
          const missed = locked && !placed && correct.includes(at);
          return (
            <View key={index} style={styles.pair}>
              <Text style={styles.note}>{glyph}</Text>
              {!isLast && (
                <Pressable
                  testID={`gap-${at}`}
                  accessibilityLabel={`Bar-line after note ${at}`}
                  accessibilityState={{ selected: placed }}
                  disabled={locked}
                  onPress={() => onResponseChange(toggleBarline(response, at))}
                  style={styles.gap}
                >
                  <View
                    style={[
                      styles.rule,
                      placed && { backgroundColor: hue, width: 2.5 },
                      wrong && { backgroundColor: colors.incorrect, width: 2.5 },
                      missed && { backgroundColor: colors.correct, width: 2.5, opacity: 0.6 },
                      locked && placed && !wrong && { backgroundColor: colors.correct },
                    ]}
                  />
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: shape.spaceInline },
  hint: {
    ...typo.body,
    color: colors.textMuted,
    backgroundColor: colors.surfaceCardSunken,
    borderRadius: shape.radiusControl,
    paddingVertical: shape.spaceInline,
    paddingHorizontal: shape.spaceInline,
  },
  strip: { flexDirection: 'row', alignItems: 'center', paddingVertical: shape.spaceTight },
  pair: { flexDirection: 'row', alignItems: 'center' },
  note: { fontSize: 26, lineHeight: 34, color: colors.text },
  // Tall and narrow: the gaps tile with no dead space, so no gap can be missed.
  gap: { width: shape.tapMin, minHeight: shape.tapMin, alignItems: 'center', justifyContent: 'center' },
  rule: { width: 1.5, height: 30, borderRadius: 2, backgroundColor: colors.borderStrong },
});

function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);
}

export function barlineMarks(
  instance: ExerciseInstance,
  response: TapPlacementResponse,
  graded: boolean | null,
): { gaps: number[]; marks: BarlineMarks } {
  const correct = (instance.answer.canonical as number[]) ?? [];
  if (graded === null) return { gaps: response, marks: { wrong: [], missed: [], correct: [] } };
  return {
    gaps: response,
    marks: {
      wrong: response.filter((p) => !correct.includes(p)),
      missed: correct.filter((p) => !response.includes(p)),
      // The strip paints a right line green, so the score must agree.
      correct: response.filter((p) => correct.includes(p)),
    },
  };
}

export const tapPlacementSpec = {
  Component: TapPlacement,
  usesSurfaceGaps: true,
  onSurfaceGapTap: (gap: number, response: TapPlacementResponse) => toggleBarline(response, gap),
  surfaceBarlines: barlineMarks,
  emptyResponse: (): TapPlacementResponse => [],
  canCheck: (response: TapPlacementResponse) => response.length > 0,
  // Set equality, as the template spec requires: the tap order cannot matter.
  grade: (instance: ExerciseInstance, response: TapPlacementResponse) =>
    sameSet(response, (instance.answer.canonical as number[]) ?? []),
  submits: true,
  correctAnswerView: (instance: ExerciseInstance) => {
    const positions = (instance.answer.canonical as number[]) ?? [];
    return (
      <Text testID="answer-label" style={styles.hint}>
        {`Bar-lines go after notes ${positions.join(', ')}.`}
      </Text>
    );
  },
  checkLabel: (instance: ExerciseInstance, response: TapPlacementResponse) =>
    response.length === 0 ? 'Check' : `Check — ${response.length} placed`,
};
