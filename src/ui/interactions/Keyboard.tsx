// keyboard_tap (design 5e, "Piano-key tap"): a 1.5-octave scrollable keyboard the
// learner taps to answer, with the correct key highlighted on feedback.
//
// 5e specifies it as an alternative note-naming INPUT. First steps lesson 3 uses
// the same component with the keyboard as the answer surface — the same contract
// read the other way round: there the stave asks and the keyboard answers, here
// the letter asks and the keyboard answers.
//
// The keys use the notation-paper tokens, not the dark surface ones. A keyboard is
// a physical object like a stave, and rule 1's reason for never inverting notation
// applies unchanged: a piano's white keys are white in a dark room.
//
// Why it scrolls, and why that is not optional: 11 white keys at the 44pt minimum
// tap target is 484pt, which does not fit the 360pt phone 5e sizes for. The
// constraint fixes the layout rather than the layout fixing the constraint.

import { ScrollView, StyleSheet, Pressable, View } from 'react-native';

import { colors, shape, strandDef, type Strand } from '../theme';
import type { InteractionComponentProps } from './types';

/** C4 to F5 — 1.5 octaves, and the span that shows the black-key pattern whole:
 *  two, then three, then two. That pattern is what lesson 3 exists to teach, so a
 *  narrower span would cut the lesson's subject in half. */
export const WHITE_KEYS = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'] as const;

/** Each black key by the white key it follows. E and B have no black key after
 *  them — that gap IS the pattern. */
export const BLACK_KEYS: readonly { pitch: string; after: number }[] = [
  { pitch: 'C#4', after: 0 },
  { pitch: 'D#4', after: 1 },
  { pitch: 'F#4', after: 3 },
  { pitch: 'G#4', after: 4 },
  { pitch: 'A#4', after: 5 },
  { pitch: 'C#5', after: 7 },
  { pitch: 'D#5', after: 8 },
];

/** 5e: "white keys >= 44px wide at 1.5 octaves on 360pt". The token IS the 44 —
 *  it is the platform tap minimum, and a key too small to hit reliably fails the
 *  lesson rather than merely looking cramped. */
export const WHITE_KEY_WIDTH = shape.tapMin;
export const BLACK_KEY_WIDTH = Math.round(WHITE_KEY_WIDTH * 0.6);
const KEY_HEIGHT = 132;
const BLACK_KEY_HEIGHT = Math.round(KEY_HEIGHT * 0.62);

export type KeyboardResponse = string | null;

interface KeyboardViewProps {
  selected: KeyboardResponse;
  strand: Strand;
  onSelect?: (pitch: string) => void;
  testID?: string;
}

/** The keyboard itself. Shared by the interaction and by the feedback sheet's
 *  correct-answer view, so the key the learner is shown is drawn by the same code
 *  as the key they tapped. */
export function KeyboardView({ selected, strand, onSelect, testID = 'keyboard' }: KeyboardViewProps) {
  const hue = strandDef(strand).hue;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID={`${testID}-scroll`}>
      <View style={styles.board} testID={testID}>
        {WHITE_KEYS.map((pitch) => (
          <Pressable
            key={pitch}
            testID={`key-${pitch}`}
            accessibilityLabel={pitch}
            disabled={onSelect === undefined}
            onPress={() => onSelect?.(pitch)}
            style={[styles.whiteKey, selected === pitch && { backgroundColor: hue }]}
          />
        ))}

        {BLACK_KEYS.map(({ pitch, after }) => (
          <Pressable
            key={pitch}
            testID={`key-${pitch}`}
            accessibilityLabel={pitch}
            disabled={onSelect === undefined}
            onPress={() => onSelect?.(pitch)}
            style={[
              styles.blackKey,
              { left: WHITE_KEY_WIDTH * (after + 1) - BLACK_KEY_WIDTH / 2 },
              selected === pitch && { backgroundColor: hue },
            ]}
          />
        ))}
      </View>
    </ScrollView>
  );
}

export function Keyboard({ response, strand, onResponseChange }: InteractionComponentProps<KeyboardResponse>) {
  return <KeyboardView selected={response} strand={strand} onSelect={onResponseChange} />;
}

const styles = StyleSheet.create({
  board: { flexDirection: 'row', height: KEY_HEIGHT, position: 'relative' },
  whiteKey: {
    width: WHITE_KEY_WIDTH,
    height: KEY_HEIGHT,
    backgroundColor: colors.paper,
    borderWidth: shape.borderW,
    borderColor: colors.paperSlot,
    borderBottomLeftRadius: shape.radiusSwatch,
    borderBottomRightRadius: shape.radiusSwatch,
  },
  blackKey: {
    position: 'absolute',
    top: 0,
    width: BLACK_KEY_WIDTH,
    height: BLACK_KEY_HEIGHT,
    backgroundColor: colors.paperInk,
    borderBottomLeftRadius: shape.radiusSwatch,
    borderBottomRightRadius: shape.radiusSwatch,
  },
});
