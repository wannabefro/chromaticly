// Theory-in-sound by-ear card (302.3.5, design 4b): play a short rhythm and tap
// each strong beat you hear. Teach-phase only — it draws no mastery and records
// no SRS; it exists to connect the written metre to the sound of it.
//
// Two deliberate calls:
//  - The stave is NOT shown. The card is by ear, so the notation surface is kept
//    mounted (it is what synthesises the audio) but clipped to zero height.
//  - The mockup's waveform draws the strong beats as taller bars. Rendering that
//    up front would hand over the answer, so the beats start uniform and grow
//    into that waveform as they're found.

import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { beatGrid, rhythmToMusic, type TeachRhythm } from '../content/teach-rhythm';
import { MusicSurface, type MusicSurfaceHandle } from '../music-surface/MusicSurface';
import { PlayButton } from './components/PlayButton';
import { colors, shape, strandDef, type as typo, type Strand } from './theme';

export interface TheoryInSoundProps {
  prompt: string;
  rhythm: TeachRhythm;
  strand: Strand;
}

export function TheoryInSound({ prompt, rhythm, strand }: TheoryInSoundProps) {
  const hue = strandDef(strand).hue;
  const music = useMemo(() => rhythmToMusic(rhythm), [rhythm]);
  const cells = useMemo(() => beatGrid(rhythm), [rhythm]);
  const surfaceRef = useRef<MusicSurfaceHandle>(null);
  const [tapped, setTapped] = useState<readonly number[]>([]);

  const isTapped = (i: number) => tapped.includes(i);
  const found = cells.filter((cell, i) => cell.strong && isTapped(i)).length;
  const strongTotal = cells.filter((cell) => cell.strong).length;
  const missed = cells.some((cell, i) => !cell.strong && isTapped(i));
  const allFound = found === strongTotal;

  // A wrong tap gates the message: taps can't be taken back, so a learner who hit a
  // weak beat and then found every strong one must not be told they got it right
  // while the wrong beat is still flagged red on screen.
  const message = missed
    ? 'Not quite — listen again for the accent at the start of each bar.'
    : allFound
      ? 'That’s it — the strong beat is the first beat of every bar.'
      : null;

  return (
    <View style={styles.card} testID="theory-in-sound">
      <View style={styles.head}>
        <Text style={styles.icon}>🎧</Text>
        <Text style={styles.title}>Theory in sound</Text>
      </View>

      <Text style={styles.prompt}>{prompt}</Text>

      <View style={styles.row}>
        <PlayButton strand={strand} onPress={() => surfaceRef.current?.play()} testID="theory-play" />
        <View style={styles.beats}>
          {cells.map((cell, i) => {
            const revealed = cell.strong && isTapped(i);
            const wrong = !cell.strong && isTapped(i);
            return (
              <Pressable
                key={i}
                testID={`theory-beat-${i}`}
                accessibilityLabel={`Bar ${cell.bar}, beat ${cell.beat}`}
                onPress={() => setTapped((prev) => (prev.includes(i) ? prev : [...prev, i]))}
                style={styles.beatHit}
              >
                <View
                  testID={revealed ? `theory-beat-${i}-strong` : undefined}
                  style={[
                    styles.beat,
                    revealed && { height: '100%', backgroundColor: hue },
                    wrong && styles.beatWrong,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      {message && (
        <Text testID="theory-feedback" style={[styles.feedback, allFound && { color: colors.correct }]}>
          {message}
        </Text>
      )}

      {/* Kept mounted to synthesise the audio; clipped because the card is by ear. */}
      <View style={styles.surface} pointerEvents="none">
        <MusicSurface ref={surfaceRef} music={music} height={120} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    borderRadius: shape.radiusCard,
    padding: shape.spaceCard,
    gap: shape.spaceInline,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  icon: { fontSize: 17 },
  title: { ...typo.cardTitle, color: colors.text },
  prompt: { ...typo.body, color: colors.textMuted },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  beats: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 36 },
  beatHit: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  beat: {
    width: '100%',
    height: '40%',
    borderRadius: shape.radiusSwatch,
    backgroundColor: colors.borderStrong,
  },
  beatWrong: { backgroundColor: colors.incorrectSurface, borderWidth: shape.borderW, borderColor: colors.incorrect },

  feedback: { ...typo.body, color: colors.hint },

  surface: { height: 0, overflow: 'hidden' },
});
