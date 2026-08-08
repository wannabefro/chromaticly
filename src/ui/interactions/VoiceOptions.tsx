// satb_voice_recognition's answer input (design G5-1): four rows, each a circle
// badge (A/B/C/D) + the voice name (bold) + a mono stave/stem cue ("· treble,
// stem up") — the cue is what makes every option distinguishable by text, not
// colour alone (rule 3). Single-select; graded on the voice name string
// (`instance.answer.canonical`), mirroring RomanNumeralBoxes' token-driven
// selected/correct/incorrect states.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VoiceName } from '../../music/types';
import { colors, fonts, shape, strandDef, type as typo, type Strand } from '../theme';
import type { InteractionComponentProps } from './types';

const LETTERS = ['A', 'B', 'C', 'D'];

type OptionState = 'default' | 'selected' | 'correct' | 'incorrect';

interface VoiceOption {
  voice: VoiceName;
  label: string;
  cue: string;
}

interface VoiceOptionsConfig {
  options: VoiceOption[];
}

export type VoiceOptionsResponse = VoiceName | null;

function nameColor(state: OptionState, hue: string) {
  if (state === 'selected') return { color: hue };
  if (state === 'correct') return { color: colors.correct };
  if (state === 'incorrect') return { color: colors.incorrect };
  return { color: colors.text };
}

function cueColor(state: OptionState, hue: string) {
  if (state === 'selected') return { color: hue };
  if (state === 'correct') return { color: colors.correct };
  if (state === 'incorrect') return { color: colors.incorrect };
  return { color: colors.textFaint };
}

function badgeStyle(state: OptionState, hue: string) {
  switch (state) {
    case 'selected':
      return { borderColor: hue, borderWidth: shape.borderWActive };
    case 'correct':
      return { borderColor: colors.correct, backgroundColor: colors.correct };
    case 'incorrect':
      return { borderColor: colors.incorrect, backgroundColor: colors.incorrect };
    default:
      return {};
  }
}

function rowStyle(state: OptionState, hue: string) {
  switch (state) {
    case 'selected':
      // ~12% tint of the strand hue (design/README "selected: 12-16% tint fill"),
      // built from the theme hue at runtime — never a literal hex.
      return { borderColor: hue, borderWidth: shape.borderWActive, backgroundColor: `${hue}1F` };
    case 'correct':
      return { borderColor: colors.correct, backgroundColor: colors.correctSurface };
    case 'incorrect':
      return { borderColor: colors.incorrect, backgroundColor: colors.incorrectSurface };
    default:
      return {};
  }
}

export function VoiceOptions({
  instance,
  response,
  graded,
  strand,
  onResponseChange,
}: InteractionComponentProps<VoiceOptionsResponse>) {
  const config = instance.interaction.config as unknown as VoiceOptionsConfig;
  const canonical = instance.answer.canonical as VoiceName;
  const hue = strandDef(strand).hue;
  const revealed = graded !== null;

  return (
    <View style={styles.container} testID="voice-options">
      {config.options.map((option, index) => {
        let state: OptionState = 'default';
        if (revealed) {
          if (option.voice === canonical) state = 'correct';
          else if (option.voice === response) state = 'incorrect';
        } else if (option.voice === response) {
          state = 'selected';
        }
        const badgeContent = state === 'correct' ? '✓' : state === 'incorrect' ? '×' : LETTERS[index] ?? String(index + 1);

        return (
          <Pressable
            key={option.voice}
            testID={`voice-option-${option.voice}`}
            accessibilityLabel={`${option.label} — ${option.cue}`}
            onPress={revealed ? undefined : () => onResponseChange(option.voice)}
            style={[styles.row, rowStyle(state, hue)]}
          >
            <View style={[styles.badge, badgeStyle(state, hue)]}>
              <Text
                style={[styles.badgeText, nameColor(state, hue), (state === 'correct' || state === 'incorrect') && { color: colors.paper }]}
                testID={`voice-option-${option.voice}-badge`}
              >
                {badgeContent}
              </Text>
            </View>
            <View style={styles.body}>
              <Text style={[styles.name, nameColor(state, hue)]}>{option.label}</Text>
              <Text style={[styles.cue, cueColor(state, hue)]} testID={`voice-option-${option.voice}-cue`}>
                {`· ${option.cue}`}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: shape.spaceInline },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: shape.spaceCard,
    paddingVertical: shape.spaceInline,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: shape.borderW,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...typo.label,
    fontFamily: fonts.uiSemibold,
  },
  body: {
    flex: 1,
    gap: shape.spaceHairline,
  },
  name: {
    ...typo.cardTitle,
  },
  cue: {
    ...typo.label,
  },
});
