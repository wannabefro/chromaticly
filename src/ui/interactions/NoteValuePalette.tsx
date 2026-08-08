// G5-2 metre-rewrite answer input (chromaticly-4ak, design G5-2). The pitches
// are FIXED (a rewrite re-values rhythm, never re-pitches), shown from the
// start; the learner assigns a note VALUE to each slot from a palette. A sibling
// of TranspositionInput (multi-slot placer), but the placed quantity is a
// duration chosen from palette buttons, not a pitch tapped on the stave.
//
// Rhythm glyph fidelity (flags/beams) is intentionally light here — each placed
// note shows its value as a text label beneath the notehead so the rewrite reads
// unambiguously; the exact design-G5-2 treatment is confirmed on-device in U6.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Dots, Duration, Music, MusicEvent } from '../../music/types';
import {
  gradeNoteValuePalette,
  noteValueVerdicts,
  type NoteValueChoice,
  type NoteValueResponse,
  type NoteValueTarget,
} from '../grading';
import { colors, fonts, shape, strandDef, type as typo } from '../theme';
import { CLEF_GLYPH, LINE_GAP, LINE_TOP, ledgerLineYs, noteY, PAPER_INSET, STAVE_LINES, STEP } from './stave-geometry';
import type { InteractionComponentProps, InteractionSpec } from './types';
import type { ExerciseInstance } from '../../engine/schema';
import { NotationCard } from '../components/NotationCard';
import { PlayButton } from '../components/PlayButton';

export type NoteValuePaletteResponse = NoteValueResponse;

function targets(instance: ExerciseInstance): NoteValueTarget[] {
  const perItem = instance.answer.per_item;
  if (!Array.isArray(perItem)) throw new Error('NoteValuePalette: instance has no per_item target');
  return perItem as NoteValueTarget[];
}

function paletteOf(instance: ExerciseInstance): NoteValueChoice[] {
  return (instance.interaction.config?.palette as NoteValueChoice[] | undefined) ?? [];
}

function activeSlotIndex(response: NoteValueResponse): number {
  return response.placements.findIndex((p) => p === null);
}

function valueLabel(choice: NoteValueChoice): string {
  const dots = choice.dots ?? 0;
  if (dots === 1) return `dotted ${choice.dur}`;
  if (dots === 2) return `double-dotted ${choice.dur}`;
  return choice.dur;
}

// --- Registry-facing pure helpers -------------------------------------------

export function noteValueEmptyResponse(instance: ExerciseInstance): NoteValueResponse {
  return { placements: Array.from({ length: targets(instance).length }, () => null) };
}

export function noteValueCanCheck(response: NoteValueResponse): boolean {
  return response.placements.length > 0 && response.placements.every((p) => p !== null);
}

/** The FeedbackSheet's correct-answer render: the fully re-valued bar in the
 *  target metre, built from per_item on the same fixed pitches. */
export function noteValueCorrectAnswerView(instance: ExerciseInstance) {
  const items = targets(instance);
  const targetSig = (instance.interaction.config?.targetTimeSig as string | undefined) ?? null;
  const events: MusicEvent[] = items.map((it) =>
    it.dots ? { type: 'note', pitch: it.pitch, dur: it.dur, dots: it.dots } : { type: 'note', pitch: it.pitch, dur: it.dur },
  );
  const music: Music = { clef: 'treble', key_sig: null, time_sig: targetSig, voices: [{ events }] };
  return <NotationCard music={music} caption="The re-valued bar" testID="answer-notation" />;
}

// --- Component --------------------------------------------------------

export function NoteValuePalette({
  instance,
  response,
  graded,
  strand,
  onResponseChange,
  onPlayMusic,
}: InteractionComponentProps<NoteValuePaletteResponse>) {
  const items = targets(instance);
  const palette = paletteOf(instance);
  const n = items.length;
  const [cardWidth, setCardWidth] = useState(0);
  const hue = strandDef(strand).hue;
  const inputLocked = graded !== null;
  const clef: 'treble' = 'treble';

  const active = activeSlotIndex(response);
  const verdicts = graded !== null ? noteValueVerdicts(instance, response) : null;

  const usable = Math.max(0, cardWidth - PAPER_INSET * 2 - 56 - 22);
  const slotWidth = n > 0 && usable > 0 ? usable / n : 40;
  const staveHeight = LINE_TOP + STEP * 2 * (STAVE_LINES - 1) + LINE_TOP;
  const slotX = (i: number) => PAPER_INSET + 56 + i * slotWidth + slotWidth / 2;

  const placedCount = response.placements.filter((p) => p !== null).length;

  const placeValue = (choice: NoteValueChoice) => {
    if (inputLocked || active === -1) return;
    const placements = [...response.placements];
    placements[active] = choice;
    onResponseChange({ placements });
  };

  const handleUndo = () => {
    if (inputLocked) return;
    let lastIndex = -1;
    for (let i = response.placements.length - 1; i >= 0; i--) {
      if (response.placements[i] !== null) {
        lastIndex = i;
        break;
      }
    }
    if (lastIndex === -1) return;
    const placements = [...response.placements];
    placements[lastIndex] = null;
    onResponseChange({ placements });
  };

  const canUndo = !inputLocked && response.placements.some((p) => p !== null);

  const handlePlay = () => {
    const events: MusicEvent[] = [];
    for (let i = 0; i < response.placements.length; i++) {
      const placed = response.placements[i];
      if (placed == null) break;
      const it = items[i];
      events.push(placed.dots ? { type: 'note', pitch: it.pitch, dur: placed.dur, dots: placed.dots } : { type: 'note', pitch: it.pitch, dur: placed.dur });
    }
    if (events.length === 0) return;
    const targetSig = (instance.interaction.config?.targetTimeSig as string | undefined) ?? null;
    onPlayMusic?.({ clef, key_sig: null, time_sig: targetSig, voices: [{ events }] });
  };

  const isHollow = (dur: Duration) => dur === 'semibreve' || dur === 'minim';

  return (
    <View style={styles.container} testID="note-value-palette">
      <View
        style={[styles.staveCard, { height: staveHeight + PAPER_INSET * 2 }]}
        onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
        testID="note-value-stave"
      >
        {Array.from({ length: STAVE_LINES }, (_, i) => (
          <View key={i} pointerEvents="none" style={[styles.staveLine, { top: PAPER_INSET + LINE_TOP + i * LINE_GAP }]} />
        ))}
        <Text pointerEvents="none" style={[styles.clef, { top: PAPER_INSET + LINE_TOP - 8 }]}>
          {CLEF_GLYPH[clef]}
        </Text>

        {items.map((it, i) => {
          const placed = response.placements[i];
          const isActive = i === active && !inputLocked;
          const verdict = verdicts?.[i] ?? null;
          const y = PAPER_INSET + noteY(clef, it.pitch);
          const noteColor = verdict === false ? colors.paperIncorrect : verdict === true ? colors.paperCorrect : colors.paperInk;
          const hollow = placed ? isHollow(placed.dur) : false;

          return (
            <View key={i} pointerEvents="none" testID={`note-value-slot-${i}`} style={[styles.slot, { left: slotX(i) - slotWidth / 2, width: slotWidth }]}>
              {ledgerLineYs(noteY(clef, it.pitch)).map((ly) => (
                <View key={ly} style={[styles.ledgerLine, { top: PAPER_INSET + ly }]} />
              ))}
              {placed == null ? (
                <View
                  testID={`note-value-slot-${i}-ghost`}
                  style={[styles.ghost, { top: y - 5.5 }, isActive && { borderColor: hue, borderWidth: 2, backgroundColor: `${hue}40` }]}
                />
              ) : (
                <>
                  <View style={[styles.notehead, { top: y - 5.5, backgroundColor: hollow ? colors.paper : noteColor, borderColor: noteColor, borderWidth: hollow ? 2 : 0 }]} />
                  {placed.dur !== 'semibreve' && <View style={[styles.stem, { top: y - 27, backgroundColor: noteColor }]} />}
                  {placed.dots === 1 && <View style={[styles.dot, { top: y - 2, backgroundColor: noteColor }]} />}
                  <Text style={[styles.valueTag, { color: noteColor }]}>{valueLabel(placed)}</Text>
                </>
              )}
            </View>
          );
        })}

        <View style={styles.play}>
          <PlayButton onPaper strand={strand} disabled={placedCount === 0} onPress={handlePlay} testID="note-value-play" />
        </View>
      </View>

      <View style={styles.paletteRow} testID="note-value-palette-row">
        {palette.map((choice, i) => (
          <Pressable
            key={i}
            testID={`palette-${i}`}
            accessibilityLabel={valueLabel(choice)}
            disabled={inputLocked || active === -1}
            onPress={() => placeValue(choice)}
            style={[styles.chip, { borderColor: active !== -1 && !inputLocked ? hue : colors.border }]}
          >
            <Text style={styles.chipText}>{valueLabel(choice)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.caption} testID="note-value-caption">
          {placedCount < n ? `${placedCount} of ${n} placed · pick a value for note ${placedCount + 1}` : `${n} of ${n} placed`}
        </Text>
        <Pressable testID="note-value-undo" disabled={!canUndo} onPress={handleUndo} style={styles.undoButton}>
          <Text style={styles.undoGlyph}>↺</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const noteValuePaletteSpec: InteractionSpec<NoteValuePaletteResponse> = {
  Component: NoteValuePalette,
  emptyResponse: noteValueEmptyResponse,
  canCheck: noteValueCanCheck,
  grade: gradeNoteValuePalette,
  submits: true,
  correctAnswerView: noteValueCorrectAnswerView,
};

const styles = StyleSheet.create({
  container: { gap: shape.spaceStack },
  staveCard: { backgroundColor: colors.paper, borderRadius: shape.radiusPaper, alignSelf: 'stretch', overflow: 'hidden' },
  play: { position: 'absolute', right: shape.spaceCard, bottom: shape.spaceCard },
  staveLine: { position: 'absolute', left: PAPER_INSET, right: PAPER_INSET, height: 1.4, backgroundColor: colors.paperLine },
  clef: { position: 'absolute', left: PAPER_INSET, fontFamily: fonts.music, fontSize: 32, color: colors.paperInk },
  slot: { position: 'absolute', top: 0, bottom: 0 },
  ghost: { position: 'absolute', left: '50%', marginLeft: -5, width: 11, height: 11, borderRadius: 6, backgroundColor: colors.paperSlot },
  notehead: { position: 'absolute', left: '50%', marginLeft: -8, width: 15, height: 11, borderRadius: 7, transform: [{ rotate: '-20deg' }] },
  stem: { position: 'absolute', left: '50%', marginLeft: shape.spaceTight, width: 1.6, height: 22 },
  dot: { position: 'absolute', left: '50%', marginLeft: shape.spaceInline, width: 3, height: 3, borderRadius: 1.5 },
  ledgerLine: { position: 'absolute', left: '50%', marginLeft: -14, width: 28, height: 1.4, backgroundColor: colors.paperLine },
  valueTag: { position: 'absolute', top: '100%', left: '50%', width: 80, marginLeft: -40, textAlign: 'center', ...typo.label, fontSize: 9 },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: shape.spaceInline },
  chip: {
    minHeight: shape.tapMin,
    paddingHorizontal: shape.spaceCard,
    justifyContent: 'center',
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    backgroundColor: colors.surfaceCard,
  },
  chipText: { ...typo.option, fontSize: 13, color: colors.text },
  footer: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceInline },
  caption: { ...typo.label, color: colors.textFaint, flex: 1 },
  undoButton: {
    minWidth: 46,
    minHeight: shape.tapMin,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoGlyph: { ...typo.title, color: colors.textMuted },
});
