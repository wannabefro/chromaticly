// Chords recognition interaction (design/components/core/RomanNumeralBoxes,
// canvas 10a; Grade-5 inversions add canvas G5-3). Grade 4: a single row of
// numeral chips (I / IV / V), each captioned with its root-letter name — colour
// is never the sole signal (design rule 3). Grade 5 (chromaticly-ehp): a second
// selection axis — a position row (a / b / c) — plus a "reads as IVb" readout;
// the answer is the combined { numeral, position } pair. Selected chips tint with
// the chords strand hue; after Check the correct choice reveals. Recognition-only.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Music, Pitch } from '../../music/types';
import { colors, fonts, shape, strandDef } from '../theme';
import type { InteractionComponentProps } from './types';

/** ~14% tint of the strand hue (design/README 12–16% band), built from the theme
 *  hue at runtime so it never trips the no-raw-hex guard. */
const TINT_ALPHA = '24';

type ChipState = 'default' | 'selected' | 'correct' | 'incorrect' | 'disabled';

/** Grade-5 two-axis answer: a triad and its position, each selectable
 *  independently and graded together (deepEqual against the canonical pair). */
export interface ChordInversionResponse {
  numeral: string | null;
  position: string | null;
}

export type RnbResponse = string | ChordInversionResponse | null;

interface ChordsConfig {
  numerals: string[];
  triads: Record<string, Pitch[]>;
  positions?: string[];
}

const POSITION_CAPTION: Record<string, string> = { a: 'root', b: '3rd in bass', c: '5th in bass' };

/** Strip the octave from a scientific pitch: "C4" -> "C", "F#5" -> "F#". */
function letterOf(pitch: Pitch): string {
  return /^([A-G][#b]{0,2})/.exec(pitch)?.[1] ?? pitch;
}

export function RomanNumeralBoxes({
  instance,
  response,
  graded,
  strand,
  onResponseChange,
  onPlayMusic,
}: InteractionComponentProps<RnbResponse>) {
  const config = instance.interaction.config as unknown as ChordsConfig;
  const hue = strandDef(strand).hue;
  const revealed = graded !== null;

  if (config.positions) {
    return (
      <ChordInversionBoxes
        config={config}
        response={(response as ChordInversionResponse | null) ?? { numeral: null, position: null }}
        canonical={instance.answer.canonical as { numeral: string; position: string }}
        hue={hue}
        revealed={revealed}
        onResponseChange={onResponseChange}
      />
    );
  }

  // --- Grade-4 root-position path (unchanged) ---
  const { numerals, triads } = config;
  const canonical = instance.answer.canonical as string;
  const singleResponse = response as string | null;

  const chordMusicFor = (numeral: string): Music => ({
    clef: (instance.stimulus.music as Music).clef,
    key_sig: null,
    time_sig: null,
    voices: [{ events: [{ type: 'chord', pitches: triads[numeral], dur: 'semibreve' }] }],
  });

  const stateOf = (numeral: string): ChipState => {
    if (!revealed) return numeral === singleResponse ? 'selected' : 'default';
    if (numeral === canonical) return 'correct';
    if (numeral === singleResponse) return 'incorrect';
    return 'disabled';
  };

  const captionOf = (numeral: string, state: ChipState): string => {
    if (state === 'correct') return `✓ ${triads[numeral].map(letterOf).join('–')}`;
    if (state === 'incorrect') return '× your pick';
    return letterOf(triads[numeral][0]);
  };

  return (
    <View style={styles.row} testID="roman-numeral-boxes">
      {numerals.map((numeral) => {
        const state = stateOf(numeral);
        return (
          <Pressable
            key={numeral}
            testID={`roman-numeral-${numeral}`}
            accessibilityLabel={`Chord ${numeral}`}
            onPress={() => (revealed ? onPlayMusic?.(chordMusicFor(numeral)) : onResponseChange(numeral))}
            style={[styles.chip, chipStyle(state, hue)]}
          >
            <Text style={[styles.numeral, numeralColor(state, hue)]}>{numeral}</Text>
            <Text style={[styles.caption, captionColor(state, hue)]}>{captionOf(numeral, state)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Grade-5 inversions: numeral row + position row + "reads as" readout (design G5-3). */
function ChordInversionBoxes({
  config,
  response,
  canonical,
  hue,
  revealed,
  onResponseChange,
}: {
  config: ChordsConfig;
  response: ChordInversionResponse;
  canonical: { numeral: string; position: string };
  hue: string;
  revealed: boolean;
  onResponseChange: (r: RnbResponse) => void;
}) {
  const { numerals, triads, positions = [] } = config;

  const axisState = (value: string, picked: string | null, correct: string): ChipState => {
    if (!revealed) return value === picked ? 'selected' : 'default';
    if (value === correct) return 'correct';
    if (value === picked) return 'incorrect';
    return 'disabled';
  };

  const readout =
    revealed
      ? `${canonical.numeral}${canonical.position}`
      : `${response.numeral ?? '–'}${response.position ?? ''}`;

  return (
    <View style={styles.inversion} testID="roman-numeral-boxes">
      <Text style={styles.axisLabel}>which triad</Text>
      <View style={styles.row}>
        {numerals.map((numeral) => {
          const state = axisState(numeral, response.numeral, canonical.numeral);
          return (
            <Pressable
              key={numeral}
              testID={`roman-numeral-${numeral}`}
              accessibilityLabel={`Chord ${numeral}`}
              onPress={() => (revealed ? undefined : onResponseChange({ ...response, numeral }))}
              style={[styles.chip, chipStyle(state, hue)]}
            >
              <Text style={[styles.numeral, numeralColor(state, hue)]}>{numeral}</Text>
              <Text style={[styles.caption, captionColor(state, hue)]}>{letterOf(triads[numeral][0])}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.axisLabel}>which position — the bass note decides it</Text>
      <View style={styles.row}>
        {positions.map((position) => {
          const state = axisState(position, response.position, canonical.position);
          return (
            <Pressable
              key={position}
              testID={`chord-position-${position}`}
              accessibilityLabel={`Position ${position}`}
              onPress={() => (revealed ? undefined : onResponseChange({ ...response, position }))}
              style={[styles.chip, chipStyle(state, hue)]}
            >
              <Text style={[styles.numeral, styles.positionGlyph, numeralColor(state, hue)]}>{position}</Text>
              <Text style={[styles.caption, captionColor(state, hue)]}>{POSITION_CAPTION[position] ?? ''}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.readout, { borderColor: revealed ? colors.correct : colors.border }]} testID="chord-readout">
        <Text style={styles.readoutLabel}>reads as</Text>
        <Text style={[styles.readoutValue, { color: revealed ? colors.correct : hue }]} testID="chord-readout-value">
          {readout}
        </Text>
      </View>
    </View>
  );
}

function chipStyle(state: ChipState, hue: string) {
  switch (state) {
    case 'selected':
      return { borderColor: hue, borderWidth: shape.borderWActive, backgroundColor: `${hue}${TINT_ALPHA}` };
    case 'correct':
      return { borderColor: colors.correct, backgroundColor: colors.correctSurface };
    case 'incorrect':
      return { borderColor: colors.incorrect, backgroundColor: colors.incorrectSurface };
    case 'disabled':
      return { backgroundColor: colors.surfaceCardSunken, opacity: 0.55 };
    default:
      return {};
  }
}

function numeralColor(state: ChipState, hue: string) {
  if (state === 'selected') return { color: hue };
  if (state === 'correct') return { color: colors.correct };
  if (state === 'incorrect') return { color: colors.incorrect };
  if (state === 'disabled') return { color: colors.textMuted };
  return { color: colors.text };
}

function captionColor(state: ChipState, hue: string) {
  if (state === 'selected') return { color: hue };
  if (state === 'correct') return { color: colors.correct };
  if (state === 'incorrect') return { color: colors.incorrect };
  if (state === 'disabled') return { color: colors.textGhost };
  return { color: colors.textFaint };
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: shape.spaceInline,
  },
  inversion: {
    gap: shape.spaceInline,
  },
  axisLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
  },
  chip: {
    flex: 1,
    minHeight: shape.tapMin,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderW,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: shape.spaceInline,
    gap: shape.spaceTight,
  },
  numeral: {
    fontFamily: fonts.examBold,
    fontSize: 22,
    color: colors.text,
  },
  positionGlyph: {
    fontSize: 18,
  },
  caption: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textFaint,
  },
  readout: {
    marginTop: shape.spaceTight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: shape.spaceInline,
    borderWidth: shape.borderW,
    borderRadius: shape.radiusControl,
    backgroundColor: colors.surfaceCardSunken,
    paddingVertical: shape.spaceSnug,
  },
  readoutLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
  },
  readoutValue: {
    fontFamily: fonts.examBold,
    fontSize: 20,
  },
});
