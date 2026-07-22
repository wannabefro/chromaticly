// Tap-to-place stave input (U8/R13, design 2d — "the hardest component").
//
// SUBSTRATE DECISION (pre-decided, not a spike — see the U8 dispatch): a
// self-contained RN input stave with discrete ghost slots, NOT a coordinate
// overlay on the abcjs WebView and NOT a tap-region hack inside MusicSurface.
// The given-note stimulus still renders through the existing NotationCard/
// MusicSurface (ExerciseLoop already does this whenever `stimulus.music` is
// set); THIS component is the separate input stave with its own known slot
// geometry, so tap -> pitch/duration is a pure, jest-testable function rather
// than something that reads abcjs's rendered SVG inside a WebView (which RN
// cannot reliably introspect). No `react-native-svg` dependency exists in this
// app (checked package.json) — the stave, ghost slots, and notehead are plain
// RN Views/Text (lines as thin Views, noteheads as rotated oval Views, the
// clef/accidental glyphs as Noto Music Text, matching StrandChip's glyph
// convention), never a raw hex (theme tokens only).
//
// Slot model: one discrete slot per diatonic (natural-letter) pitch in the
// clef's G1 range (scope.ts's diatonicPitchesInRange) — `slotToPitch`/
// `slotCount` are pure and reused directly from scope.ts rather than
// reimplemented. An accidental only changes the glyph beside a note, never
// its vertical (line/space) position, so the accidental picker operates on
// the CURRENTLY PLACED note's letter — it does not move it to a different
// slot.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { diatonicPitchesInRange, scopeForGrade } from '../../engine/scope';
import type { Clef, Duration, KeySig, Music, Pitch } from '../../music/types';
import { useSettingsContext } from '../../learn/SettingsContext';
import { colors, fonts, shape, strandDef, type as typo } from '../theme';
import {
  CLEF_GLYPH,
  DURATION_GLYPH,
  keySigGlyphs,
  LINE_GAP,
  LINE_TOP,
  ledgerLineYs,
  noteY,
  PAPER_INSET,
  STAVE_LINES,
  STEP,
} from './stave-geometry';
import type { InteractionComponentProps } from './types';

export interface StavePlacement {
  pitch: Pitch;
  dur: Duration;
}

export type StaveInputResponse = StavePlacement | null;
export type Accidental = 'sharp' | 'natural' | 'flat';

// --- Pure helpers (jest-testable without rendering) -----------------------

/** How many discrete ghost slots the clef's grade range has. */
export function slotCount(clef: Clef, grade = 1): number {
  return diatonicPitchesInRange(clef, grade).length;
}

/** The diatonic (natural-letter) pitch a stave slot represents, left-to-right
 *  low-to-high. Reuses scope.ts's per-grade range enumeration rather than a
 *  second pitch list. Throws on an out-of-range index (fail loud, mirrors
 *  slotToPitch's sibling helpers elsewhere in the engine). */
export function slotToPitch(clef: Clef, slotIndex: number, grade = 1): Pitch {
  const pitches = diatonicPitchesInRange(clef, grade);
  const pitch = pitches[slotIndex];
  if (pitch === undefined) {
    throw new Error(`slotToPitch: slot ${slotIndex} is out of range for ${clef} clef (0..${pitches.length - 1})`);
  }
  return pitch;
}

/** The slot index a (possibly accidented) pitch sits on — accidentals never
 *  move a notehead's line/space, only the letter+octave does. */
function slotIndexOfPitch(clef: Clef, pitch: Pitch, grade = 1): number {
  const natural = naturalOf(pitch);
  return diatonicPitchesInRange(clef, grade).findIndex((p) => p === natural);
}

function naturalOf(pitch: Pitch): Pitch {
  return pitch.replace(/[#b]/g, '');
}

const ACCIDENTAL_SYMBOL: Record<Accidental, string> = { sharp: '#', natural: '', flat: 'b' };

/** Replace a scientific pitch's accidental (or lack of one), keeping the
 *  letter and octave: applyAccidental("F4", "sharp") -> "F#4". */
export function applyAccidental(pitch: Pitch, accidental: Accidental): Pitch {
  const match = /^([A-G])(?:#|b)?(-?\d+)$/.exec(pitch);
  if (!match) throw new Error(`applyAccidental: not a scientific pitch: ${pitch}`);
  const [, letter, octave] = match;
  return `${letter}${ACCIDENTAL_SYMBOL[accidental]}${octave}`;
}

function accidentalOf(pitch: Pitch): Accidental {
  if (pitch.includes('#')) return 'sharp';
  if (pitch.includes('b')) return 'flat';
  return 'natural';
}

// --- Stave geometry (no react-native-svg in this app — plain Views) -------
// Shared geometry (noteY, ledgerLineYs, keySigGlyphs, CLEF_GLYPH,
// DURATION_GLYPH, layout constants) lives in stave-geometry.ts — this
// component's own slot-width layout stays local since TranspositionInput's
// x-axis model (note order, not pitch) doesn't share it.

const SLOT_WIDTH = 32;
const SLOT_MARGIN_LEFT = 60; // room for the clef + key signature glyphs
const SLOT_MARGIN_RIGHT = 22; // room for the ledger lines the last slots overhang with

// --- Component --------------------------------------------------------

export function StaveInput({ instance, response, graded, strand, onResponseChange }: InteractionComponentProps<StaveInputResponse>) {
  const music = instance.stimulus.music as Music | null;
  const clef: Clef = music?.clef ?? 'treble';
  const keySig: KeySig = music?.key_sig ?? null;
  const [selectedDuration, setSelectedDuration] = useState<Duration>('crotchet');
  const [cardWidth, setCardWidth] = useState(0);
  const hue = strandDef(strand).hue;
  const locked = graded !== null;
  // Left-hand input (design 5c): the floating accidental picker mirrors to the left
  // edge so a left thumb reaching it doesn't occlude the stave it's editing.
  const { settings } = useSettingsContext();
  const leftHanded = settings.handedness === 'left';

  const placedSlot = response ? slotIndexOfPitch(clef, response.pitch, instance.grade) : -1;
  const slots = slotCount(clef, instance.grade);

  // The stave scales to the card rather than the card to the stave (design 2d's
  // stave is a viewBox that fits its paper). A fixed slot pitch made the stave
  // wider than the phone, which bled it edge to edge and pushed the accidental
  // picker off screen — a cropped stave, which the design forbids outright.
  // The right reserve is not symmetry for its own sake: the highest slots carry ledger
  // lines that overhang their slot, and they were spilling past the paper's edge.
  const usable = Math.max(0, cardWidth - PAPER_INSET * 2 - SLOT_MARGIN_LEFT - SLOT_MARGIN_RIGHT);
  const slotWidth = slots > 0 && usable > 0 ? usable / slots : SLOT_WIDTH;
  const staveHeight = LINE_TOP + STEP * 2 * (STAVE_LINES - 1) + LINE_TOP;
  const slotX = (i: number) => PAPER_INSET + SLOT_MARGIN_LEFT + i * slotWidth + slotWidth / 2;

  const noteColor = graded === false ? colors.incorrect : graded === true ? colors.correct : colors.paperInk;
  const haloColor = graded === false ? colors.incorrectSurface : graded === true ? colors.correctSurface : `${hue}33`;

  const handleSlotPress = (slotIndex: number) => {
    if (locked) return;
    const pitch = slotToPitch(clef, slotIndex, instance.grade);
    onResponseChange({ pitch, dur: response?.dur ?? selectedDuration });
  };

  const current = response?.dur ?? selectedDuration;

  const handleDuration = (dur: Duration) => {
    if (locked) return;
    setSelectedDuration(dur);
    if (response) onResponseChange({ pitch: response.pitch, dur });
  };

  const handleAccidental = (accidental: Accidental) => {
    if (locked || !response) return;
    onResponseChange({ pitch: applyAccidental(response.pitch, accidental), dur: response.dur });
  };

  const handleUndo = () => {
    if (locked) return;
    onResponseChange(null);
  };

  return (
    <View style={styles.container} testID="stave-input">
      <View
        style={[styles.staveCard, { height: staveHeight + PAPER_INSET * 2 }]}
        onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
        testID="stave-input-stave"
      >
        {Array.from({ length: STAVE_LINES }, (_, i) => (
          <View key={i} style={[styles.staveLine, { top: PAPER_INSET + LINE_TOP + i * LINE_GAP }]} />
        ))}
        <Text style={[styles.clef, { top: PAPER_INSET + LINE_TOP - 8 }]}>{CLEF_GLYPH[clef]}</Text>
        {keySig != null && (
          <Text style={[styles.keySig, { left: PAPER_INSET + SLOT_MARGIN_LEFT - 24, top: PAPER_INSET + LINE_TOP - 4 }]}>
            {keySigGlyphs(keySig)}
          </Text>
        )}

        {Array.from({ length: slots }, (_, slotIndex) => {
          const pitch = slotToPitch(clef, slotIndex, instance.grade);
          const staveY = noteY(clef, pitch); // in stave space, before the paper inset
          const y = PAPER_INSET + staveY;
          const isPlaced = slotIndex === placedSlot;

          return (
            <Pressable
              key={slotIndex}
              testID={`stave-slot-${slotIndex}`}
              accessibilityLabel={`place note on ${pitch}`}
              onPress={() => handleSlotPress(slotIndex)}
              disabled={locked}
              // The hit area is exactly one slot wide so neighbouring slots can never
              // overlap and swallow each other's taps; height stays a full tap target.
              style={[
                styles.slotTarget,
                { width: slotWidth, left: slotX(slotIndex) - slotWidth / 2, top: y - shape.tapMin / 2 },
              ]}
            >
              {ledgerLineYs(staveY).map((ly) => (
                <View key={ly} style={[styles.ledgerLine, { top: ly - staveY + shape.tapMin / 2 }]} />
              ))}
              {isPlaced ? (
                <>
                  <View testID="stave-input-halo" style={[styles.halo, { backgroundColor: haloColor }]} />
                  <View style={[styles.notehead, { backgroundColor: noteColor }]} />
                  <View style={[styles.stem, { backgroundColor: noteColor }]} />
                </>
              ) : (
                <View style={styles.ghostSlot} testID={`stave-slot-${slotIndex}-ghost`} />
              )}
            </Pressable>
          );
        })}

        {response && !locked && (
          <View
            style={[styles.accidentalPicker, leftHanded ? { left: PAPER_INSET } : { right: PAPER_INSET }]}
            testID="accidental-picker"
          >
            {(['sharp', 'natural', 'flat'] as Accidental[]).map((accidental) => (
              <Pressable
                key={accidental}
                testID={`accidental-${accidental}`}
                onPress={() => handleAccidental(accidental)}
                style={[styles.accidentalButton, accidentalOf(response.pitch) === accidental && { backgroundColor: `${hue}33` }]}
              >
                <Text
                  style={[
                    styles.accidentalGlyph,
                    accidentalOf(response.pitch) === accidental && { color: hue },
                  ]}
                >
                  {accidental === 'sharp' ? '♯' : accidental === 'flat' ? '♭' : '♮'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.paletteRow} testID="stave-input-palette">
        <Text style={styles.paletteCaption}>Duration · tap a stave slot to place</Text>
        <View style={styles.paletteButtons}>
          {scopeForGrade(instance.grade).noteValues.map((dur) => {
            const selected = current === dur;
            return (
              <Pressable
                key={dur}
                testID={`duration-${dur}`}
                accessibilityLabel={dur}
                disabled={locked}
                onPress={() => handleDuration(dur)}
                style={[styles.durationButton, selected && { borderColor: hue, backgroundColor: `${hue}1F` }]}
              >
                <Text style={[styles.durationGlyph, selected && { color: hue }]}>{DURATION_GLYPH[dur]}</Text>
              </Pressable>
            );
          })}
          <Pressable testID="stave-input-undo" disabled={locked || !response} onPress={handleUndo} style={styles.undoButton}>
            <Text style={styles.undoGlyph}>↺</Text>
          </Pressable>
        </View>
        {/* The tiles are glyph-only (Ruling A3) — a word per tile wrapped mid-word
            ("semibr eve") once Grade 1 needed a fourth. The name lives here instead,
            where it has a whole line and can never wrap. */}
        <Text style={styles.paletteEcho} testID="duration-selected">
          selected: {current}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: shape.spaceStack },
  staveCard: {
    backgroundColor: colors.paper,
    borderRadius: shape.radiusPaper,
    alignSelf: 'stretch',
    overflow: 'hidden', // nothing may spill past the paper's edge (design 2d)
  },
  staveLine: {
    position: 'absolute',
    left: PAPER_INSET,
    right: PAPER_INSET,
    height: 1.4,
    backgroundColor: colors.paperLine,
  },
  clef: { position: 'absolute', left: PAPER_INSET, fontFamily: fonts.music, fontSize: 32, color: colors.paperInk },
  keySig: { position: 'absolute', fontFamily: fonts.music, fontSize: 18, color: colors.paperInk },
  slotTarget: {
    position: 'absolute',
    height: shape.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostSlot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.paperSlot },
  halo: { position: 'absolute', width: 30, height: 30, borderRadius: 15 },
  notehead: {
    width: 15,
    height: 11,
    borderRadius: 7,
    transform: [{ rotate: '-20deg' }],
  },
  stem: { position: 'absolute', width: 1.6, height: 26, right: 4, top: -22 },
  ledgerLine: { position: 'absolute', left: -6, width: shape.tapMin + 12, height: 1.4, backgroundColor: colors.paperLine },
  accidentalPicker: {
    position: 'absolute',
    // left/right is set inline from the handedness setting (design 5c left-hand input).
    top: PAPER_INSET,
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surfaceCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    borderRadius: shape.radiusControl - 2,
    padding: 4,
  },
  accidentalButton: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  accidentalGlyph: { fontFamily: fonts.music, fontSize: 16, color: colors.text },
  paletteRow: { gap: 9 },
  paletteCaption: { ...typo.label, color: colors.textFaint },
  paletteButtons: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  durationButton: {
    flex: 1,
    minHeight: shape.tapMin,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  durationGlyph: { fontFamily: fonts.music, fontSize: 22, color: colors.text, textAlign: 'center' },
  paletteEcho: { ...typo.label, color: colors.textFaint },
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
