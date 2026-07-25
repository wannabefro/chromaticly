// Ornament card (design 10b, canvas "enlarged symbol"): a split light-paper card
// for the six Grade-4 ornament signs. abcjs renders the ornament (the Unicode
// Musical Symbols block has no clean trill/mordent/grace glyphs — only "turn" —
// so the sign is drawn by our notation engine, which renders all six correctly).
// Top: the ornamented note enlarged (the hero). A dashed rule. Bottom: the same
// note small, framed "in context", with the play affordance. Play sounds the
// plain note then the ornament realised (design Ruling 3) as a two-note tune in a
// single call — if abcjs's synth doesn't realise a decoration, the second note
// simply repeats the first (a graceful, never-silent fallback).

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MusicSurface, type MusicSurfaceHandle } from '../../music-surface/MusicSurface';
import type { SurfaceEvent } from '../../music-surface/bridge';
import { useSettingsContext } from '../../learn/SettingsContext';
import { NOTATION_SCALES } from '../../learn/settings';
import type { Music, NoteEvent } from '../../music/types';
import { colors, elevation, shape, type } from '../theme';
import type { NotationCardHandle } from './NotationCard';
import { PlayButton } from './PlayButton';

export interface OrnamentCardProps {
  music: Music;
  onEvent?: (ev: SurfaceEvent) => void;
  testID?: string;
}

/** The playback tune: the ornamented note preceded by a plain copy of itself, so
 *  one play() sounds "plain, then realised" (design Ruling 3). Falls back to the
 *  displayed music unchanged if no ornamented note is found. */
function plainThenRealised(music: Music): Music {
  const events = music.voices[0]?.events ?? [];
  const ornamented = events.find((e): e is NoteEvent => e.type === 'note' && e.ornament != null);
  if (!ornamented) return music;
  const plain: NoteEvent = { type: 'note', pitch: ornamented.pitch, dur: ornamented.dur, dots: ornamented.dots };
  return { ...music, voices: [{ events: [plain, ornamented] }] };
}

export const OrnamentCard = forwardRef<NotationCardHandle, OrnamentCardProps>(function OrnamentCard(
  { music, onEvent, testID = 'ornament-card' },
  ref,
) {
  const heroRef = useRef<MusicSurfaceHandle>(null);
  const { settings } = useSettingsContext();
  const baseScale = NOTATION_SCALES[settings.notationScale];

  const playRealised = () => heroRef.current?.playMusic(plainThenRealised(music));

  useImperativeHandle(ref, () => ({
    play: playRealised,
    stop: () => heroRef.current?.stop(),
    highlightBar: (bar: number | null, color?: string) => heroRef.current?.highlightBar(bar, color),
    highlightNote: (locator, color) => heroRef.current?.highlightNote(locator, color),
    playAbc: (abc: string) => heroRef.current?.playAbc(abc),
    playMusic: (m: Music) => heroRef.current?.playMusic(m),
  }));

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.hero}>
        <MusicSurface ref={heroRef} music={music} height={120} scale={baseScale * 2.1} onEvent={onEvent} />
      </View>
      <View style={styles.rule} />
      <View style={styles.inset}>
        <View style={styles.insetStave}>
          <MusicSurface music={music} height={56} scale={baseScale * 0.85} />
        </View>
        <Text style={styles.insetLabel}>in context · bar 1</Text>
        <PlayButton onPaper onPress={playRealised} testID={`${testID}-play`} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: shape.radiusPaper,
    overflow: 'hidden',
    ...elevation.paper,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 22,
    paddingBottom: 12,
  },
  rule: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.paperSlot,
  },
  inset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  insetStave: {
    flexShrink: 1,
  },
  insetLabel: {
    ...type.label,
    flex: 1,
    color: colors.paperMuted,
  },
});
