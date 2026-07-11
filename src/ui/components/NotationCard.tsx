// NotationCard (U4, KTD6): the stave is the hero. A light paper card that never
// inverts in dark mode (rule 1), holding the persistent MusicSurface renderer and
// a play affordance (rule 2). The stave renders large and centred and is never
// cropped (A9) — the card sizes to a generous height and the surface resizes into it.

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MusicSurface, type MusicSurfaceHandle } from '../../music-surface/MusicSurface';
import type { Music } from '../../music/types';
import { colors, elevation, shape, type } from '../theme';
import { PlayButton } from './PlayButton';

export interface NotationCardProps {
  music: Music;
  /** Stave height; defaults tall so the stave reads as the hero, not a thumbnail. */
  height?: number;
  /** Show the play affordance (default true — every notation display sounds). */
  play?: boolean;
  caption?: string;
  testID?: string;
}

export type NotationCardHandle = MusicSurfaceHandle;

export const NotationCard = forwardRef<NotationCardHandle, NotationCardProps>(function NotationCard(
  { music, height = 200, play = true, caption, testID = 'notation-card' },
  ref,
) {
  const surfaceRef = useRef<MusicSurfaceHandle>(null);
  useImperativeHandle(ref, () => ({
    play: () => surfaceRef.current?.play(),
    stop: () => surfaceRef.current?.stop(),
  }));

  return (
    <View style={styles.card} testID={testID}>
      <MusicSurface ref={surfaceRef} music={music} height={height} />
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
