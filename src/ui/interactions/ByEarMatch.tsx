// by_ear_match's answer input (theory-by-ear U3). Two steps in one card: a
// Listen affordance that plays the ALTERED music against the persistent surface,
// a same/different verdict, then — only after "different" — a row of note cells
// asking where. The item is not gradeable until both steps are answered (AE3).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Music } from '../../music/types';
import { PlayButton } from '../components/PlayButton';
import { colors, shape, strandDef, type as typo, type Strand } from '../theme';
import type { InteractionComponentProps } from './types';

export type Verdict = 'same' | 'different';

export interface ByEarMatchResponse {
  verdict: Verdict | null;
  position: number | null;
}

interface ByEarMatchConfig {
  played_music: Music;
  positions: number[];
}

export const emptyByEarMatchResponse: ByEarMatchResponse = { verdict: null, position: null };

function verdictStyle(active: boolean, graded: boolean | null, hue: string) {
  if (graded !== null) return { borderColor: colors.border, backgroundColor: colors.surfaceCardSunken };
  return active
    ? { borderColor: hue, backgroundColor: colors.surfaceCardSunken }
    : { borderColor: colors.border, backgroundColor: colors.surfaceCardSunken };
}

export function ByEarMatch({
  instance,
  response,
  graded,
  strand,
  onResponseChange,
  onPlayMusic,
}: InteractionComponentProps<ByEarMatchResponse>) {
  const hue = strandDef(strand).hue;
  const config = instance.interaction.config as unknown as ByEarMatchConfig;
  const positions = config.positions ?? [];
  const locked = graded !== null;

  // Switching back to "same" clears any chosen position, so a stale index can
  // never be graded.
  const pickVerdict = (verdict: Verdict) => {
    if (locked) return;
    onResponseChange(verdict === 'same' ? { verdict, position: null } : { ...response, verdict });
  };

  const pickPosition = (position: number) => {
    if (locked) return;
    onResponseChange({ verdict: 'different', position });
  };

  return (
    <View style={styles.container} testID="by-ear-match">
      <View style={styles.listenRow}>
        <PlayButton
          strand={strand}
          onPress={() => onPlayMusic?.(config.played_music)}
          testID="by-ear-listen"
        />
        <Text style={styles.listenLabel}>Listen, then compare it with the notation above.</Text>
      </View>

      <View style={styles.verdictRow}>
        {(['same', 'different'] as const).map((verdict) => (
          <Pressable
            key={verdict}
            testID={`by-ear-verdict-${verdict}`}
            onPress={() => pickVerdict(verdict)}
            style={[styles.verdict, verdictStyle(response.verdict === verdict, graded, hue)]}
          >
            <Text
              style={[
                styles.verdictLabel,
                response.verdict === verdict && !locked && { color: hue, fontFamily: typo.cardTitle.fontFamily },
              ]}
            >
              {verdict === 'same' ? 'Same' : 'Different'}
            </Text>
          </Pressable>
        ))}
      </View>

      {response.verdict === 'different' && (
        <View style={styles.whereBlock} testID="by-ear-where">
          <Text style={styles.whereLabel}>Tap where it differs.</Text>
          <View style={styles.cells}>
            {positions.map((position, i) => (
              <Pressable
                key={position}
                testID={`by-ear-position-${position}`}
                onPress={() => pickPosition(position)}
                style={[
                  styles.cell,
                  response.position === position && { borderColor: hue, backgroundColor: colors.surfaceCardSunken },
                ]}
              >
                <Text
                  style={[styles.cellLabel, response.position === position && !locked && { color: hue }]}
                >
                  {i + 1}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: shape.spaceStack },
  listenRow: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceInline },
  listenLabel: { ...typo.body, color: colors.textMuted, flex: 1 },

  verdictRow: { flexDirection: 'row', gap: 9 },
  verdict: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    alignItems: 'center',
  },
  verdictLabel: { ...typo.body, color: colors.text },

  whereBlock: { gap: shape.spaceInline },
  whereLabel: { ...typo.body, color: colors.textMuted },
  cells: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCardSunken,
    alignItems: 'center',
  },
  cellLabel: { ...typo.body, color: colors.textMuted },
});
