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
import { naturalPitchAtOrdinal, scientificPitchOrdinal } from '../../engine/generators/pitch-math';
import { diatonicPitchesInRange } from '../../engine/scope';
import { colors, fonts, shape, strandDef, type as typo } from '../theme';
import {
  CLEF_GLYPH,
  keySigGlyphs,
  LINE_GAP,
  LINE_TOP,
  ledgerLineYs,
  MIDDLE_LINE_PITCH,
  noteY,
  PAPER_INSET,
  STAVE_LINES,
  STEP,
} from './stave-geometry';
import type { InteractionComponentProps, InteractionSpec } from './types';
import type { ExerciseInstance } from '../../engine/schema';
import { NotationCard } from '../components/NotationCard';
import { PlayButton } from '../components/PlayButton';

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

/** The key signature the ANSWER stave is drawn and spelled in. For octave
 *  transposition the written line shares the concert key, so this falls back to
 *  the stimulus key_sig (byte-identical to the original behaviour). For a
 *  transposing instrument (G5-4) the written line is notated in the transposed
 *  key, which the generator supplies as `config.answerKeySig` — the answer stave
 *  must render and spell tapped notes in THAT key, not the concert key. */
function answerKeySigOf(instance: ExerciseInstance): KeySig {
  const override = instance.interaction.config?.answerKeySig as KeySig | undefined;
  if (override !== undefined) return override;
  return (instance.stimulus.music as Music | null)?.key_sig ?? null;
}

interface InstrumentBanner {
  instrument: string;
  sounds: string;
  write: string;
  interval: string;
}

function bannerOf(instance: ExerciseInstance): InstrumentBanner | null {
  return (instance.interaction.config?.banner as InstrumentBanner | undefined) ?? null;
}

/** First slot with no placement yet — locked (fix-mode-correct) slots always
 *  carry a placement, so they're skipped by construction, never targeted. */
function activeSlotIndex(response: TranspositionResponse): number {
  return response.placements.findIndex((p) => p === null);
}

/** Inverse of `noteY`: which diatonic pitch does a tap at vertical `staveY`
 *  (card-relative, PAPER_INSET already removed) land on? The design's tap
 *  model is "tap the stave, a note drops at that height" — a single snap-to-
 *  nearest surface, NOT one button per pitch (real staves are ~7px per step,
 *  so per-pitch tap rects would overlap and be un-hittable). The tapped letter
 *  is snapped to the nearest in-range diatonic position, then spelled in the
 *  key (the accidental is implied by the key sig, exactly like the given
 *  melody's own notation — never a per-note choice). Exported for unit tests. */
export function pitchAtStaveY(clef: Clef, grade: number, keySig: KeySig, staveY: number): string {
  const middleLineY = LINE_TOP + STEP * (STAVE_LINES - 1);
  const refOrd = scientificPitchOrdinal(MIDDLE_LINE_PITCH[clef]);
  const rawOrd = refOrd + Math.round((middleLineY - staveY) / STEP);
  const ords = diatonicPitchesInRange(clef, grade).map(scientificPitchOrdinal);
  const clamped = Math.max(Math.min(...ords), Math.min(Math.max(...ords), rawOrd));
  const natural = naturalPitchAtOrdinal(clamped);
  return keySig ? spellInKeySig(natural, keySig) : natural;
}

/** D9 "hear yours": the answer card's own PlayButton plays the LEARNER's
 *  response — placed pitches with copied durs (dots included) — never the
 *  stimulus melody. MVP unplaced handling: placement is strictly sequential
 *  (the active slot is always the first null), so a gap can only sit at the
 *  tail — stopping at the first null naturally plays "as far as placed so
 *  far" pre-check, and the full melody once every slot is filled post-check
 *  (canCheck already guarantees no gaps by then). `null` when nothing is
 *  placed yet — nothing to play. */
function answerSoFarMusic(instance: ExerciseInstance, response: TranspositionResponse): Music | null {
  const clef = answerClefOf(instance);
  const stimulusMusic = instance.stimulus.music as Music | null;
  const items = targets(instance);
  const events: MusicEvent[] = [];
  for (let i = 0; i < response.placements.length; i++) {
    const placed = response.placements[i];
    if (placed == null) break;
    const item = items[i];
    events.push(item.dots ? { type: 'note', pitch: placed, dur: item.dur, dots: item.dots } : { type: 'note', pitch: placed, dur: item.dur });
  }
  if (events.length === 0) return null;
  return { clef, key_sig: answerKeySigOf(instance), time_sig: stimulusMusic?.time_sig ?? null, voices: [{ events }] };
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
    key_sig: answerKeySigOf(instance),
    time_sig: stimulusMusic?.time_sig ?? null,
    voices: [{ events }],
  };
  const caption = (instance.interaction.config?.answerCaption as string | undefined) ?? 'One octave away, same rhythm';
  return <NotationCard music={targetMusic} caption={caption} testID="answer-notation" />;
}

// --- Component --------------------------------------------------------

export function TranspositionInput({
  instance,
  response,
  graded,
  strand,
  onResponseChange,
  onPlayMusic,
}: InteractionComponentProps<TranspositionInputResponse>) {
  const clef = answerClefOf(instance);
  const keySig: KeySig = answerKeySigOf(instance);
  const banner = bannerOf(instance);
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

  // Tapping the stave drops a note into the active slot at the tapped height
  // (design 9a: "tap the stave to drop note k"). The vertical tap position is
  // snapped to the nearest in-range diatonic pitch and spelled in-key by
  // pitchAtStaveY — the accidental is implied by the key sig, never a per-note
  // choice (like the given melody's own notation).
  const handleStaveTap = (localY: number) => {
    if (inputLocked || active === -1 || (response.locked[active] ?? false)) return;
    const placements = [...response.placements];
    placements[active] = pitchAtStaveY(clef, instance.grade, keySig, localY - PAPER_INSET);
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

  // Rule 2: the answer stave is a notation display, so it carries its own play
  // affordance too — "hear yours" plays the LEARNER's placed notes (D9), not
  // the given melody, and is disabled until there's anything to hear.
  const handlePlay = () => {
    const music = answerSoFarMusic(instance, response);
    if (music) onPlayMusic?.(music);
  };

  return (
    <View style={styles.container} testID="transposition-input">
      {banner && (
        <View style={[styles.banner, { borderColor: hue }]} testID="transposition-banner">
          <View style={styles.bannerHead}>
            <Text style={styles.bannerInstrument} testID="transposition-banner-instrument">
              {banner.instrument}
            </Text>
            <View style={[styles.bannerPill, { backgroundColor: `${hue}22`, borderColor: hue }]}>
              <Text style={[styles.bannerPillText, { color: hue }]} testID="transposition-banner-interval">
                {banner.interval}
              </Text>
            </View>
          </View>
          <Text style={styles.bannerSounds}>{banner.sounds}</Text>
          <Text style={[styles.bannerWrite, { color: hue }]}>{banner.write}</Text>
        </View>
      )}
      <View
        style={[styles.staveCard, { height: staveHeight + PAPER_INSET * 2 }]}
        onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
        testID="transposition-stave"
      >
        {Array.from({ length: STAVE_LINES }, (_, i) => (
          <View key={i} pointerEvents="none" style={[styles.staveLine, { top: PAPER_INSET + LINE_TOP + i * LINE_GAP }]} />
        ))}
        <Text pointerEvents="none" style={[styles.clef, { top: PAPER_INSET + LINE_TOP - 8 }]}>
          {CLEF_GLYPH[clef]}
        </Text>
        {keySig != null && (
          <Text
            pointerEvents="none"
            style={[styles.keySig, { left: PAPER_INSET + SLOT_MARGIN_LEFT - 24, top: PAPER_INSET + LINE_TOP - 4 }]}
          >
            {keySigGlyphs(keySig)}
          </Text>
        )}

        {/* A single tap surface over the stave — tapping anywhere drops a note
            into the active slot at the tapped height (design's "tap-vertical =
            pitch"). One large Pressable, not per-pitch rects: diatonic steps are
            ~7px apart, so per-pitch tap targets would overlap and be un-hittable
            on a real device (jest's layout-free renderer never sees that). The
            decorative Views below it are pointerEvents="none" so nothing
            intercepts the touch. */}
        {!inputLocked && active !== -1 && (
          <Pressable
            testID="transposition-tap-surface"
            accessibilityLabel={`place note ${active + 1}`}
            onPress={(e) => handleStaveTap(e.nativeEvent.locationY)}
            style={styles.tapSurface}
          />
        )}

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
            <View
              key={i}
              pointerEvents="none"
              testID={`transposition-slot-${i}`}
              style={[styles.slot, { left: slotX(i) - slotWidth / 2, width: slotWidth }]}
            >
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

        <View style={styles.play}>
          <PlayButton onPaper strand={strand} disabled={placedCount === 0} onPress={handlePlay} testID="transposition-play" />
        </View>
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
  banner: {
    borderWidth: shape.borderWActive,
    borderRadius: shape.radiusControl,
    backgroundColor: colors.surfaceCard,
    padding: shape.spaceCard,
    gap: shape.spaceInline,
  },
  bannerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerInstrument: { ...typo.cardTitle, color: colors.text },
  bannerPill: {
    borderWidth: shape.borderWActive,
    borderRadius: shape.radiusChip,
    paddingHorizontal: shape.spaceInline,
    paddingVertical: shape.spaceHairline,
  },
  bannerPillText: { ...typo.label },
  bannerSounds: { ...typo.body, color: colors.textMuted },
  bannerWrite: { ...typo.label },
  staveCard: {
    backgroundColor: colors.paper,
    borderRadius: shape.radiusPaper,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  play: { position: 'absolute', right: shape.spaceCard, bottom: shape.spaceCard },
  staveLine: { position: 'absolute', left: PAPER_INSET, right: PAPER_INSET, height: 1.4, backgroundColor: colors.paperLine },
  clef: { position: 'absolute', left: PAPER_INSET, fontFamily: fonts.music, fontSize: 32, color: colors.paperInk },
  keySig: { position: 'absolute', fontFamily: fonts.music, fontSize: 18, color: colors.paperInk },
  tapSurface: { position: 'absolute', left: PAPER_INSET + SLOT_MARGIN_LEFT - 10, right: PAPER_INSET, top: 0, bottom: 0 },
  slot: { position: 'absolute', top: 0, bottom: 0 },
  ghostSlot: { position: 'absolute', left: '50%', marginLeft: -5, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.paperSlot },
  lockedHalo: { position: 'absolute', left: '50%', marginLeft: -15, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.correctSurface },
  notehead: { position: 'absolute', left: '50%', marginLeft: -8, width: 15, height: 11, borderRadius: 7, transform: [{ rotate: '-20deg' }] },
  stem: { position: 'absolute', left: '50%', marginLeft: shape.spaceTight, width: 1.6, height: 22 },
  dot: { position: 'absolute', left: '50%', marginLeft: shape.spaceInline, width: 3, height: 3, borderRadius: 1.5 },
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
