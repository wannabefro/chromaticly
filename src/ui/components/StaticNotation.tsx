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
});
