// aural_mcq (chromaticly-dhe): play the sound, choose the answer, see no notation.
//
// Its own type rather than plain mcq for the same reason by_ear_verify is
// (KTD6): mcqSpec renders options only, and `config.played_music` is read by the
// component, not the loop — so an item typed as mcq would offer the learner no
// way to hear the thing it asks about.
//
// Its own type rather than by_ear_verify for two reasons, both visible to the
// learner. That card's label reads "compare it with the notation above", which is
// false here, and its correct-answer view renders `stimulus.music`, which is null
// on a notation-free item — so a wrong answer would reveal nothing, breaking the
// design's rule that feedback always shows the correct answer.
//
// First steps lesson 1 teaches pulse before any symbol, so the stave must stay
// off the screen. `stimulus.music` is therefore null and the audio travels in
// `interaction.config.played_music`, played through the loop's onPlayMusic.

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Music } from '../../music/types';
import { PlayButton } from '../components/PlayButton';
import { assembleOptions } from '../grading';
import { colors, shape, type as typo } from '../theme';
import { Mcq } from './Mcq';
import type { InteractionComponentProps } from './types';

/** Used when a generator supplies no `listen_prompt` of its own. */
export const DEFAULT_LISTEN_PROMPT = 'Tap play, then choose what you heard.';

interface AuralConfig {
  played_music: Music;
  listen_prompt?: string;
}

export function AuralMcq({ instance, response, graded, strand, onResponseChange, onPlayMusic }: InteractionComponentProps<number | null>) {
  const options = useMemo(() => assembleOptions(instance), [instance]);
  const config = instance.interaction.config as unknown as AuralConfig;

  return (
    <View style={styles.card} testID="aural-mcq">
      <View style={styles.listenRow}>
        <PlayButton strand={strand} onPress={() => onPlayMusic?.(config.played_music)} testID="aural-mcq-listen" />
        <Text style={styles.listenLabel}>{config.listen_prompt ?? DEFAULT_LISTEN_PROMPT}</Text>
      </View>
      <Mcq options={options} selectedIndex={response} graded={graded} strand={strand} onSelectIndex={onResponseChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: shape.spaceStack },
  listenRow: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceInline },
  listenLabel: { ...typo.body, color: colors.textMuted, flex: 1 },
});
