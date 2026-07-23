// Chords recognition-only interaction (design/components/core/RomanNumeralBoxes,
// canvas 10a). A row of numeral chips (I / IV / V) each captioned with its
// root-letter name — colour is never the sole signal (design rule 3). Selected
// tints with the chords strand hue; after Check the correct chip reveals its
// spelled triad and each chip replays its own chord on tap. Recognition-only:
// the learner names the chord, they do not build it (a later slice).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Music, Pitch } from '../../music/types';
import { colors, fonts, shape, strandDef } from '../theme';
import type { InteractionComponentProps } from './types';

/** ~14% tint of the strand hue (design/README 12–16% band), built from the theme
 *  hue at runtime so it never trips the no-raw-hex guard. */
const TINT_ALPHA = '24';

type ChipState = 'default' | 'selected' | 'correct' | 'incorrect' | 'disabled';

interface ChordsConfig {
  numerals: string[];
  triads: Record<string, Pitch[]>;
}

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
}: InteractionComponentProps<string | null>) {
  const config = instance.interaction.config as unknown as ChordsConfig;
  const { numerals, triads } = config;
  const canonical = instance.answer.canonical as string;
  const hue = strandDef(strand).hue;
  const revealed = graded !== null;

  const chordMusicFor = (numeral: string): Music => ({
    clef: (instance.stimulus.music as Music).clef,
    key_sig: null,
    time_sig: null,
    voices: [{ events: [{ type: 'chord', pitches: triads[numeral], dur: 'semibreve' }] }],
  });

  const stateOf = (numeral: string): ChipState => {
    if (!revealed) return numeral === response ? 'selected' : 'default';
    if (numeral === canonical) return 'correct';
    if (numeral === response) return 'incorrect';
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
  chip: {
    flex: 1,
    minHeight: shape.tapMin,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderW,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 3,
  },
  numeral: {
    fontFamily: fonts.examBold,
    fontSize: 22,
    color: colors.text,
  },
  caption: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textFaint,
  },
});
