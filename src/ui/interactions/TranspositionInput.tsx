// Multi-slot answer stave for octave transposition (U6, design 9a/9b, D1/D4/D7).
// Sibling of StaveInput, not an extension: StaveInput's slots are x = pitch (one
// slot per diatonic pitch); this component's slots are x = note order, and the
// tap targets are pitch ROWS spanning the card — vertical = pitch, horizontal
// position is fixed by the sequential active slot. Rhythm is copied from
// `answer.per_item` automatically (the learner never chooses a duration); the
// stave, key signature, and slot geometry all render in `config.answerClef` —
// the OPPOSITE of the given melody's clef (D1) — never the stimulus clef.
//
// Grading/summary/fix logic lives in grading.ts (ui/grading.ts's charter) —
// this component only renders and dispatches taps.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Clef, Dots, Duration, KeySig, Music, MusicEvent } from '../../music/types';
import {
  gradeTransposition,
  transpositionBeginFix,
  transpositionCheckLabel,
  transpositionSummary,
  transpositionVerdicts,
  type TranspositionResponse,
} from '../grading';
import { spellInKeySig } from '../../engine/generators/key-spelling';
import { diatonicPitchesInRange } from '../../engine/scope';
import { colors, fonts, shape, strandDef, type as typo } from '../theme';
import {
  CLEF_GLYPH,
  keySigGlyphs,
  LINE_GAP,
  LINE_TOP,
  ledgerLineYs,
  noteY,
  PAPER_INSET,
  STAVE_LINES,
  STEP,
} from './stave-geometry';
import type { InteractionComponentProps, InteractionSpec } from './types';
import type { ExerciseInstance } from '../../engine/schema';
import { NotationCard } from '../components/NotationCard';

export type TranspositionInputResponse = TranspositionResponse;

interface Target {
  pitch: string;
  dur: Duration;
  dots?: Dots;
}

// --- Pure helpers (jest-testable without rendering) -----------------------

function targets(instance: ExerciseInstance): Target[] {
  const perItem = instance.answer.per_item;
  if (!Array.isArray(perItem)) throw new Error('TranspositionInput: instance has no per_item target');
  return perItem as Target[];
}

function answerClefOf(instance: ExerciseInstance): Clef {
  return (instance.interaction.config?.answerClef as Clef | undefined) ?? 'treble';
}

/** First slot with no placement yet — locked (fix-mode-correct) slots always
 *  carry a placement, so they're skipped by construction, never targeted. */
function activeSlotIndex(response: TranspositionResponse): number {
  return response.placements.findIndex((p) => p === null);
}

const SLOT_MARGIN_LEFT = 60;
const SLOT_MARGIN_RIGHT = 22;
const SLOT_WIDTH = 40;

// --- Registry-facing pure functions ----------------------------------------

export function transpositionEmptyResponse(instance: ExerciseInstance): TranspositionResponse {
  const n = targets(instance).length;
  return { placements: Array.from({ length: n }, () => null), locked: [] };
}

export function transpositionCanCheck(response: TranspositionResponse): boolean {
  return response.placements.length > 0 && response.placements.every((p) => p !== null);
}

/** The FeedbackSheet's correct-answer render (U6): the full melody, rewritten
 *  in the answer clef, built by mapping stimulus barlines/rhythm onto
 *  per_item's target pitches — never the stimulus clef (D1/CRITICAL semantics:
 *  per_item is already spelled for the answer clef, and rendering it in the
 *  stimulus clef would silently mismatch the target's own spelling). */
export function transpositionCorrectAnswerView(instance: ExerciseInstance) {
  const stimulusMusic = instance.stimulus.music as Music | null;
  const answerClef = answerClefOf(instance);
  const items = targets(instance);
  let i = 0;
  const events: MusicEvent[] = (stimulusMusic?.voices[0]?.events ?? []).map((ev) => {
    if (ev.type !== 'note') return ev;
    const item = items[i++];
    return item.dots ? { type: 'note', pitch: item.pitch, dur: item.dur, dots: item.dots } : { type: 'note', pitch: item.pitch, dur: item.dur };
  });
  const targetMusic: Music = {
    clef: answerClef,
    key_sig: stimulusMusic?.key_sig ?? null,
    time_sig: stimulusMusic?.time_sig ?? null,
    voices: [{ events }],
  };
  return <NotationCard music={targetMusic} caption="One octave away, same rhythm" testID="answer-notation" />;
}

// --- Component --------------------------------------------------------

export function TranspositionInput({ instance, response, graded, strand, onResponseChange }: InteractionComponentProps<TranspositionInputResponse>) {
  const clef = answerClefOf(instance);
  const keySig: KeySig = (instance.stimulus.music as Music | null)?.key_sig ?? null;
  const items = targets(instance);
  const n = items.length;
  const [cardWidth, setCardWidth] = useState(0);
  const hue = strandDef(strand).hue;
  const inputLocked = graded !== null;

  const active = activeSlotIndex(response);
  const verdicts = graded !== null ? transpositionVerdicts(instance, response) : null;
  const inFix = response.locked.length > 0;

  const usable = Math.max(0, cardWidth - PAPER_INSET * 2 - SLOT_MARGIN_LEFT - SLOT_MARGIN_RIGHT);
  const slotWidth = n > 0 && usable > 0 ? usable / n : SLOT_WIDTH;
  const staveHeight = LINE_TOP + STEP * 2 * (STAVE_LINES - 1) + LINE_TOP;
  const slotX = (i: number) => PAPER_INSET + SLOT_MARGIN_LEFT + i * slotWidth + slotWidth / 2;
  const middleLineY = LINE_TOP + STEP * (STAVE_LINES - 1);

  const placedCount = response.placements.filter((p) => p !== null).length;
  const caption =
    placedCount < n
      ? `${placedCount} of ${n} placed · tap the stave to drop note ${placedCount + 1}`
      : `${n} of ${n} placed`;

  // The tapped row is the natural (letter-only) diatonic position — the
  // accidental is never a per-note choice here (unlike StaveInput's picker):
  // it's implied by the key signature, exactly like the given melody's own
  // notation, so the placed pitch is spelled in-key before it's stored (the
  // same spelling the generator used for per_item, key-spelling.ts).
  const handlePitchPress = (naturalPitch: string) => {
    if (inputLocked || active === -1 || (response.locked[active] ?? false)) return;
    const placements = [...response.placements];
    placements[active] = keySig ? spellInKeySig(naturalPitch, keySig) : naturalPitch;
    onResponseChange({ placements, locked: response.locked });
  };

  const handleUndo = () => {
    if (inputLocked) return;
    let lastIndex = -1;
    for (let i = response.placements.length - 1; i >= 0; i--) {
      if (response.placements[i] !== null && !(response.locked[i] ?? false)) {
        lastIndex = i;
        break;
      }
    }
    if (lastIndex === -1) return;
    const placements = [...response.placements];
    placements[lastIndex] = null;
    onResponseChange({ placements, locked: response.locked });
  };

  const canUndo = !inputLocked && response.placements.some((p, i) => p !== null && !(response.locked[i] ?? false));
  const pitchRows = diatonicPitchesInRange(clef, instance.grade);

  return (
    <View style={styles.container} testID="transposition-input">
      <View
        style={[styles.staveCard, { height: staveHeight + PAPER_INSET * 2 }]}
        onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
        testID="transposition-stave"
      >
        {Array.from({ length: STAVE_LINES }, (_, i) => (
          <View key={i} style={[styles.staveLine, { top: PAPER_INSET + LINE_TOP + i * LINE_GAP * 2 }]} />
        ))}
        <Text style={[styles.clef, { top: PAPER_INSET + LINE_TOP - 8 }]}>{CLEF_GLYPH[clef]}</Text>
        {keySig != null && (
          <Text style={[styles.keySig, { left: PAPER_INSET + SLOT_MARGIN_LEFT - 24, top: PAPER_INSET + LINE_TOP - 4 }]}>
            {keySigGlyphs(keySig)}
          </Text>
        )}

        {/* Pitch rows: one Pressable per diatonic pitch, spanning the whole card —
            tapping anywhere on a row places that pitch into the active slot (the
            design's "tap-vertical = pitch" model; x is never chosen by the tap). */}
        {!inputLocked &&
          active !== -1 &&
          pitchRows.map((pitch) => {
            const y = PAPER_INSET + noteY(clef, pitch);
            return (
              <Pressable
                key={pitch}
                testID={`transposition-pitch-${pitch}`}
                accessibilityLabel={`place note ${active + 1}`}
                onPress={() => handlePitchPress(pitch)}
                style={[styles.pitchRow, { top: y - shape.tapMin / 2 }]}
              />
            );
          })}

        {Array.from({ length: n }, (_, i) => {
          const item = items[i];
          const placed = response.placements[i];
          const locked = response.locked[i] ?? false;
          const isActive = i === active && !inputLocked;
          const verdict = verdicts?.[i] ?? null;
          const showGhostAtTarget = verdict === false || (inFix && !locked);

          const placedY = placed != null ? PAPER_INSET + noteY(clef, placed) : PAPER_INSET + middleLineY;
          const targetY = PAPER_INSET + noteY(clef, item.pitch);
          const noteColor = verdict === false ? colors.paperIncorrect : verdict === true ? colors.paperCorrect : colors.paperInk;
          const hollow = item.dur === 'semibreve' || item.dur === 'minim';

          return (
            <View key={i} testID={`transposition-slot-${i}`} style={[styles.slot, { left: slotX(i) - slotWidth / 2, width: slotWidth }]}>
              {placed != null &&
                ledgerLineYs(noteY(clef, placed)).map((ly) => (
                  <View key={ly} style={[styles.ledgerLine, { top: PAPER_INSET + ly }]} />
                ))}

              {placed == null ? (
                <View
                  testID={`transposition-slot-${i}-ghost`}
                  style={[
                    styles.ghostSlot,
                    { top: placedY - 5 },
                    isActive && { borderColor: hue, borderWidth: 2, backgroundColor: `${hue}40` },
                  ]}
                />
              ) : (
                <>
                  {locked && <View style={[styles.lockedHalo, { top: placedY - 15 }]} />}
                  <View
                    style={[
                      styles.notehead,
                      { top: placedY - 5.5, backgroundColor: hollow ? colors.paper : noteColor, borderColor: noteColor, borderWidth: hollow ? 2 : 0 },
                    ]}
                  />
                  {item.dur !== 'semibreve' && <View style={[styles.stem, { top: placedY - 27, backgroundColor: noteColor }]} />}
                  {item.dots === 1 && <View style={[styles.dot, { top: placedY - 2, backgroundColor: noteColor }]} />}
                </>
              )}

              {showGhostAtTarget && <View testID={`transposition-mark-${i}-ghost`} style={[styles.targetGhost, { top: targetY - 6 }]} />}

              {verdict != null && (
                <Text
                  testID={`transposition-mark-${i}`}
                  style={[styles.mark, { top: placedY - 26, color: verdict ? colors.paperCorrect : colors.paperIncorrect }]}
                >
                  {verdict ? '✓' : '✗'}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.footer} testID="transposition-footer">
        <Text style={styles.caption} testID="transposition-caption">
          {caption}
        </Text>
        <Pressable testID="transposition-undo" disabled={!canUndo} onPress={handleUndo} style={styles.undoButton}>
          <Text style={styles.undoGlyph}>↺</Text>
        </Pressable>
      </View>
    </View>
  );
}

// --- Registry spec (D5/D6) --------------------------------------------------

export const transpositionInputSpec: InteractionSpec<TranspositionInputResponse> = {
  Component: TranspositionInput,
  emptyResponse: transpositionEmptyResponse,
  canCheck: transpositionCanCheck,
  grade: gradeTransposition,
  submits: true,
  correctAnswerView: transpositionCorrectAnswerView,
  partialFeedback: transpositionSummary,
  checkLabel: transpositionCheckLabel,
  beginFix: transpositionBeginFix,
};

const styles = StyleSheet.create({
  container: { gap: shape.spaceStack },
  staveCard: {
    backgroundColor: colors.paper,
    borderRadius: shape.radiusPaper,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  staveLine: { position: 'absolute', left: PAPER_INSET, right: PAPER_INSET, height: 1.4, backgroundColor: colors.paperLine },
  clef: { position: 'absolute', left: PAPER_INSET, fontFamily: fonts.music, fontSize: 32, color: colors.paperInk },
  keySig: { position: 'absolute', fontFamily: fonts.music, fontSize: 18, color: colors.paperInk },
  pitchRow: { position: 'absolute', left: 0, right: 0, height: shape.tapMin },
  slot: { position: 'absolute', top: 0, bottom: 0 },
  ghostSlot: { position: 'absolute', left: '50%', marginLeft: -5, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.paperSlot },
  lockedHalo: { position: 'absolute', left: '50%', marginLeft: -15, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.correctSurface },
  notehead: { position: 'absolute', left: '50%', marginLeft: -8, width: 15, height: 11, borderRadius: 7, transform: [{ rotate: '-20deg' }] },
  stem: { position: 'absolute', left: '50%', marginLeft: 4, width: 1.6, height: 22 },
  dot: { position: 'absolute', left: '50%', marginLeft: 10, width: 3, height: 3, borderRadius: 1.5 },
  ledgerLine: { position: 'absolute', left: '50%', marginLeft: -14, width: 28, height: 1.4, backgroundColor: colors.paperLine },
  targetGhost: {
    position: 'absolute',
    left: '50%',
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.paperCorrect,
  },
  mark: { position: 'absolute', left: '50%', marginLeft: -6, ...typo.label, fontSize: 14 },
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
