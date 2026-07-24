// A play-less notation stave painted as a static SVG (chromaticly-9lb). MCQ option
// staves need no audio, bar-tap, or highlight, so instead of each option booting its own
// abcjs WebView they share the offscreen SvgRenderProvider and paint the returned SVG
// with react-native-svg. Visually matches NotationCard's light paper (rule 1: notation
// never inverts). Falls back to a live NotationCard when no shared renderer is mounted.

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useSettingsContext } from '../../learn/SettingsContext';
import { NOTATION_SCALES } from '../../learn/settings';
import { musicToAbc } from '../../music/abc-emitter';
import { useSvgRenderer, type SvgRender } from '../../music-surface/SvgRenderService';
import type { Music } from '../../music/types';
import { colors, elevation, shape } from '../theme';
import { NotationCard } from './NotationCard';

export interface StaticNotationProps {
  music: Music;
  /** Stave height (matches NotationCard's option sizing). */
  height?: number;
  testID?: string;
}

export function StaticNotation({ music, height = 100, testID = 'static-notation' }: StaticNotationProps) {
  const renderToSvg = useSvgRenderer();
  const { settings } = useSettingsContext();
  const scale = NOTATION_SCALES[settings.notationScale];
  const abc = musicToAbc(music);
  const [render, setRender] = useState<SvgRender | null>(null);

  useEffect(() => {
    if (!renderToSvg) return;
    let live = true;
    setRender(null);
    renderToSvg(abc, scale).then((r) => {
      if (live && r.svg) setRender(r);
    });
    return () => {
      live = false;
    };
  }, [renderToSvg, abc, scale]);

  // No shared renderer in the tree (e.g. a jest host without the provider) — render the
  // live surface so the stave still shows.
  if (!renderToSvg) {
    return <NotationCard music={music} play={false} height={height} testID={testID} />;
  }

  return (
    <View style={styles.card} testID={testID}>
      {render ? (
        // width 100% + fixed height: SvgXml fits the trimmed stave (its viewBox is the
        // content box) into the card, centred, preserving aspect ratio. currentColor in
        // the abcjs markup resolves to the paper ink via `color`.
        <SvgXml xml={render.svg} width="100%" height={height} color={colors.paperInk} testID={`${testID}-svg`} />
      ) : (
        <View style={{ height }} testID={`${testID}-pending`} />
      )}
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
