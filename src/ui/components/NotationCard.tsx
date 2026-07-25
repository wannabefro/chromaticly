// NotationCard (U4, KTD6): the stave is the hero. A light paper card that never
// inverts in dark mode (rule 1), holding the persistent MusicSurface renderer and
// a play affordance (rule 2). The stave renders large and centred and is never
// cropped (A9) — the card sizes to a generous height and the surface resizes into it.

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MusicSurface, type MusicSurfaceHandle } from '../../music-surface/MusicSurface';
import type { SurfaceEvent } from '../../music-surface/bridge';
import { useSettingsContext } from '../../learn/SettingsContext';
import { NOTATION_SCALES } from '../../learn/settings';
import type { Music } from '../../music/types';
import { colors, elevation, shape, type } from '../theme';
import { PlayButton } from './PlayButton';

export interface NotationCardProps {
  music: Music;
  /** Stave height. Sized to hug the (centred, full-width) stave so the paper reads
   *  as the hero without a tall empty margin below it. */
  height?: number;
  /** Show the play affordance (default true — every notation display sounds). */
  play?: boolean;
  /** Surface events (e.g. a `barTapped` when the learner taps a bar in the score). */
  onEvent?: (ev: SurfaceEvent) => void;
  caption?: string;
  testID?: string;
}

export type NotationCardHandle = MusicSurfaceHandle;

export const NotationCard = forwardRef<NotationCardHandle, NotationCardProps>(function NotationCard(
  { music, height = 150, play = true, onEvent, caption, testID = 'notation-card' },
  ref,
) {
  const surfaceRef = useRef<MusicSurfaceHandle>(null);
  const { settings } = useSettingsContext();
  useImperativeHandle(ref, () => ({
    play: () => surfaceRef.current?.play(),
    stop: () => surfaceRef.current?.stop(),
    highlightBar: (bar: number | null, color?: string) => surfaceRef.current?.highlightBar(bar, color),
    highlightNote: (locator, color) => surfaceRef.current?.highlightNote(locator, color),
    playAbc: (abc: string) => surfaceRef.current?.playAbc(abc),
    playMusic: (music: Music) => surfaceRef.current?.playMusic(music),
  }));

  return (
    <View style={styles.card} testID={testID}>
      <MusicSurface ref={surfaceRef} music={music} height={height} onEvent={onEvent} scale={NOTATION_SCALES[settings.notationScale]} />
      {caption != null && <Text style={styles.caption}>{caption}</Text>}
      {play && (
        <View style={styles.play}>
          <PlayButton onPaper onPress={() => surfaceRef.current?.play()} testID={`${testID}-play`} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: shape.radiusPaper,
    padding: shape.spaceCard,
    ...elevation.paper,
  },
  caption: {
    ...type.label,
    color: colors.paperMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  play: {
    position: 'absolute',
    right: shape.spaceCard,
    bottom: shape.spaceCard,
  },
});
