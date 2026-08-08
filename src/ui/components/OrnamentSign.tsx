// G5-5 (chromaticly-cke) hand-drawn ornament signs for the written-out->sign
// answer options. Noto Music has no ornament glyphs and abcjs decorations attach
// to a note (the design wants the bare sign on a chip), so each sign is a small
// react-native-svg drawing — trill as "tr", turn/mordents as their squiggles,
// grace kinds as a small slashed/plain quaver. Exact chip fidelity vs design
// G5-5 is confirmed on-device in the U6 Maestro pass.

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Line, Path } from 'react-native-svg';

import type { OrnamentKind } from '../../music/types';
import { colors, fonts, glyph } from '../theme';

export interface OrnamentSignProps {
  kind: OrnamentKind;
  color?: string;
  testID?: string;
}

const SIZE = 40;
const INK = colors.text;

export function OrnamentSign({ kind, color = INK, testID }: OrnamentSignProps) {
  if (kind === 'trill') {
    return (
      <View style={styles.box} testID={testID}>
        <Text style={[styles.tr, { color }]}>tr</Text>
      </View>
    );
  }

  return (
    <View style={styles.box} testID={testID}>
      <Svg width={SIZE} height={SIZE} viewBox="0 0 40 40">
        {kind === 'turn' && (
          // Two lobes: up over the note, down under — the turn glyph.
          <Path d="M4,20 C4,11 15,11 20,20 C25,29 36,29 36,20" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        )}
        {(kind === 'upper_mordent' || kind === 'lower_mordent') && (
          // A short angular zigzag (two peaks) — the mordent squiggle.
          <Path d="M6,22 L13,13 L20,22 L27,13 L34,22" stroke={color} strokeWidth={2.4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {kind === 'lower_mordent' && (
          // The vertical stroke through the squiggle marks the LOWER mordent.
          <Line x1={20} y1={9} x2={20} y2={31} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        )}
        {(kind === 'acciaccatura' || kind === 'appoggiatura') && (
          <>
            <Ellipse cx={13} cy={27} rx={5.5} ry={4} fill={color} transform="rotate(-20 13 27)" />
            <Line x1={18} y1={26} x2={18} y2={8} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <Path d="M18,8 C24,11 24,16 21,19" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
            {kind === 'acciaccatura' && (
              // The slash through the stem is what distinguishes acciaccatura.
              <Line x1={8} y1={26} x2={24} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
            )}
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  tr: { fontFamily: fonts.examSemibold, fontSize: glyph.lg, fontStyle: 'italic' },
});
