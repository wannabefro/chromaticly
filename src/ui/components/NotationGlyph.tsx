// A bare notation glyph — a stave/note painted as a static SVG through the shared
// offscreen renderer (chromaticly-9lb/f9k), with NO paper card of its own. StaticNotation
// wraps it in a card for MCQ options; the musical-sum worksheet lays several of these on
// one shared paper with +/= operators between them. Falls back to a card-less MusicSurface
// when no shared renderer is mounted (test hosts).

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useSettingsContext } from '../../learn/SettingsContext';
import { NOTATION_SCALES } from '../../learn/settings';
import { musicToAbc } from '../../music/abc-emitter';
import { MusicSurface } from '../../music-surface/MusicSurface';
import { useSvgRenderer, type SvgRender } from '../../music-surface/SvgRenderService';
import type { Music } from '../../music/types';
import { colors } from '../theme';

export interface NotationGlyphProps {
  music: Music;
  height?: number;
  /** SVG width; a fixed number keeps a glyph its natural size in a row, '100%' fills
   *  a card. Defaults to natural (the trimmed content box, scaled to `height`). */
  width?: number | string;
  testID?: string;
}

export function NotationGlyph({ music, height = 100, width, testID = 'notation-glyph' }: NotationGlyphProps) {
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

  if (!renderToSvg) {
    return <MusicSurface music={music} height={height} scale={scale} />;
  }

  if (!render) return <View style={{ height }} testID={`${testID}-pending`} />;

  // Natural width = the trimmed viewBox aspect ratio at `height`, so a glyph in a row
  // takes only the space its notes need instead of stretching.
  const naturalWidth = render.height > 0 ? (render.width / render.height) * height : height;
  return (
    <SvgXml
      xml={render.svg}
      width={width ?? naturalWidth}
      height={height}
      color={colors.paperInk}
      testID={`${testID}-svg`}
    />
  );
}
