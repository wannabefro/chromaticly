// Theory-in-sound by-ear card (302.3.5, design 8c): play a short rhythm and tap
// each strong beat you hear. Teach-phase only — it draws no mastery and records
// no SRS; it exists to connect the written metre to the sound of it.
//
// 8c draws the four states: resting (dashed uniform cells, disabled until the
// learner has actually listened), in progress (a found beat grows into the tall
// waveform bar 4b shows), wrong tap (an amber pulse that settles back — never red,
// it isn't a failure), and complete (naming the concept). 4b's waveform is the END
// state, which is why nothing is revealed up front.
//
// The stave is NOT shown: the card is by ear, so the notation surface stays mounted
// (it synthesises the audio) but is clipped to zero height.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { beatGrid, rhythmToMusic, type TeachRhythm } from '../content/teach-rhythm';
import { MusicSurface, type MusicSurfaceHandle } from '../music-surface/MusicSurface';
import { PlayButton } from './components/PlayButton';
import { colors, glyph, shape, strandDef, type as typo, type Strand } from './theme';

/** How long a wrong tap stays amber before settling back (8c). */
const WRONG_PULSE_MS = 1200;

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
  const [played, setPlayed] = useState(false);
  const [found, setFound] = useState<readonly number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const pulse = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => (pulse.current ? clearTimeout(pulse.current) : undefined), []);

  const strongTotal = cells.filter((cell) => cell.strong).length;
  const allFound = found.length === strongTotal;

  const tap = (i: number) => {
    if (cells[i].strong) {
      setFound((prev) => (prev.includes(i) ? prev : [...prev, i]));
      return;
    }
    // A wrong tap is a nudge, not a failure: it pulses amber and settles back, so the
    // learner can simply listen again rather than being left with a red mark they
    // cannot undo.
    setWrong(i);
    if (pulse.current) clearTimeout(pulse.current);
    pulse.current = setTimeout(() => setWrong(null), WRONG_PULSE_MS);
  };

  const message = wrong != null
    ? 'Listen again — that one’s off the beat.'
    : allFound
      ? 'That’s it — the strong beat is the first beat of every bar.'
      : played
        ? `${found.length} of ${strongTotal} found`
        : null;

  return (
    <View style={styles.card} testID="theory-in-sound">
      <View style={styles.head}>
        <Text style={styles.icon}>🎧</Text>
        <Text style={styles.title}>Theory in sound</Text>
      </View>

      <Text style={styles.prompt}>{prompt}</Text>

      <View style={styles.row}>
        <PlayButton
          strand={strand}
          onPress={() => {
            setPlayed(true);
            surfaceRef.current?.play();
          }}
          testID="theory-play"
        />
        <View style={styles.beats}>
          {cells.map((cell, i) => {
            const revealed = found.includes(i);
            const pulsing = wrong === i;
            return (
              <Pressable
                key={i}
                testID={`theory-beat-${i}`}
                accessibilityLabel={`Bar ${cell.bar}, beat ${cell.beat}`}
                // Disabled until they have actually listened — this is a by-ear card,
                // so tapping before playing would be guessing, not hearing.
                disabled={!played}
                onPress={() => tap(i)}
                style={styles.beatHit}
              >
                <View
                  testID={revealed ? `theory-beat-${i}-strong` : undefined}
                  style={[
                    styles.beat,
                    !played && styles.beatResting,
                    revealed && { height: '100%', backgroundColor: hue },
                    pulsing && styles.beatPulse,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      {message && (
        <Text
          testID="theory-feedback"
          style={[styles.feedback, allFound && wrong == null && { color: colors.correct }]}
        >
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
  head: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceSnug },
  icon: { fontSize: glyph.md },
  title: { ...typo.cardTitle, color: colors.text },
  prompt: { ...typo.body, color: colors.textMuted },

  row: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceInline },
  beats: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: shape.spaceTight, height: 36 },
  beatHit: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  beat: {
    width: '100%',
    height: '40%',
    borderRadius: shape.radiusSwatch,
    backgroundColor: colors.borderStrong,
  },
  // Resting: dashed and uniform — nothing about the answer is revealed yet.
  beatResting: { borderWidth: shape.borderW, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: 'transparent' },
  // Wrong: amber, never red (8c) — a nudge to listen again, not a failure.
  beatPulse: { backgroundColor: colors.hintSurface, borderWidth: shape.borderW, borderColor: colors.hint },

  feedback: { ...typo.body, color: colors.hint },

  surface: { height: 0, overflow: 'hidden' },
});
