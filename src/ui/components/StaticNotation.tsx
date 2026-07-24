// A play-less notation stave on a light paper card (chromaticly-9lb). MCQ option staves
// need no audio, bar-tap, or highlight, so instead of each option booting its own abcjs
// WebView they share the offscreen SvgRenderProvider (via NotationGlyph) and paint the
// returned SVG statically. Matches NotationCard's paper (rule 1: notation never inverts).

import { StyleSheet, View } from 'react-native';

import type { Music } from '../../music/types';
import { colors, elevation, shape } from '../theme';
import { NotationGlyph } from './NotationGlyph';

export interface StaticNotationProps {
  music: Music;
  /** Stave height (matches NotationCard's option sizing). */
  height?: number;
  testID?: string;
}

export function StaticNotation({ music, height = 100, testID = 'static-notation' }: StaticNotationProps) {
  // A rhythm glyph (musical-sum option) renders at its natural note size, so centre it in
  // a fixed-height box — every option card stays the same height whether its value is a
  // small semibreve or a tall stemmed note (chromaticly-f9k). Other notation (key sigs)
  // fills the card width as before.
  if (music.rhythmStaff) {
    return (
      <View style={[styles.card, styles.rhythmBox]} testID={testID}>
        <NotationGlyph music={music} testID={`${testID}-glyph`} />
      </View>
    );
  }
  return (
    <View style={styles.card} testID={testID}>
      <NotationGlyph music={music} height={height} width="100%" testID={`${testID}-glyph`} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: shape.radiusPaper,
    padding: shape.spaceCard,
    ...elevation.paper,
  },
  rhythmBox: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
