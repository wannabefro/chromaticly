// Free practice (U12; eligibility + lane filter reworked in G6 U3): an endless
// SRS-driven exercise stream. Each step asks practice-plan for the weakest-due
// ATTEMPTED atom (falling back to a rotation over attempted material once nothing
// is due) and generates fresh from it.
//
// Cross-lane is the default and stays that way: mixing strands IS the retention
// benefit. The filter (R9) is for the learner who knows which skill they want to
// shore up, not a mode the app pushes them into.

import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Strand } from '../content/lessons';
import { generate } from '../engine/generators';
import { generateByEar } from '../engine/generators/by-ear-cards';
import { useProgressContext } from '../learn/ProgressContext';
import { nextPracticeTemplate } from '../learn/practice-plan';
import { colors, shape, strandDef, type as typo } from './theme';
import { ExerciseLoop } from './ExerciseLoop';
import type { AttemptResult } from './grading';

const LANES: Strand[] = ['rhythm', 'pitch', 'scales_keys', 'intervals', 'chords', 'terms_signs', 'context'];

export function Practice() {
  const { store, recordAtom, clock } = useProgressContext();
  const [step, setStep] = useState(0);
  const [strand, setStrand] = useState<Strand | null>(null);

  const pick = useMemo(
    () => (store ? nextPracticeTemplate(store.atomEntries(), clock.now(), step, strand ?? undefined) : null),
    [store, step, clock, strand],
  );

  const instance = useMemo(
    () => {
      if (!pick) return null;
      const opts = { grade: pick.grade, seed: step, atoms: pick.atoms, source: pick.source };
      // `source` is set only for a by-ear atom, which is the one card that can
      // fail to build on an unlucky seed.
      return pick.source ? generateByEar(pick.template, opts) : generate(pick.template, opts);
    },
    [pick, step],
  );

  // Continue on the FeedbackSheet fires onResult; record and advance the stream here.
  const handleResult = useCallback(
    async (result: AttemptResult) => {
      if (!instance) return;
      const atom = instance.srs_tags[0];
      await recordAtom(atom, result, clock.now());
      setStep((s) => s + 1);
    },
    [instance, recordAtom, clock],
  );

  if (!instance) {
    return (
      <View style={styles.empty} testID="practice-empty">
        <Text style={styles.emptyText}>
          {strand === null
            ? 'Nothing to review yet — practice is for keeping what you have learned. Start a skill in Learn and it will show up here.'
            : `Nothing to review in ${strandDef(strand).label} yet.`}
        </Text>
        {strand !== null ? (
          <Pressable onPress={() => setStrand(null)} testID="practice-filter-clear">
            <Text style={styles.clear}>Review every skill</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // flex:1, not padded: ExerciseLoop's own root is flex:1 and it supplies its body
  // padding. A non-flex wrapper collapses the loop's ScrollView to zero height on
  // device (only the notation card peeks) while jest's layout-free renderer stays
  // green — the same trap SetRunner avoids by hosting ExerciseLoop in a flex Screen.
  return (
    <View style={styles.active} testID="practice-active">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowInner}>
        <Pressable onPress={() => setStrand(null)} testID="practice-filter-all">
          <View style={[styles.chip, strand === null && styles.chipOn]}>
            <Text style={[styles.chipLabel, strand === null && styles.chipLabelOn]}>All skills</Text>
          </View>
        </Pressable>
        {LANES.map((lane) => {
          const def = strandDef(lane);
          const on = strand === lane;
          return (
            <Pressable key={lane} onPress={() => setStrand(on ? null : lane)} testID={`practice-filter-${lane}`}>
              {/* Rule 3: strand colour is never the only signal — the glyph and the
                  name ride along with the hue. */}
              <View style={[styles.chip, on && { borderColor: def.hue, backgroundColor: `${def.hue}1f` }]}>
                <Text style={[styles.chipGlyph, { color: def.hue }]}>{def.glyph}</Text>
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{def.short}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* flex:1, not padded: ExerciseLoop's own root is flex:1 and it supplies its
          body padding. A non-flex wrapper collapses the loop's ScrollView to zero
          height on device (only the notation card peeks) while jest's layout-free
          renderer stays green. */}
      <View style={styles.loop}>
        <ExerciseLoop instance={instance} onResult={handleResult} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  active: { flex: 1 },
  loop: { flex: 1 },
  filterRow: { flexGrow: 0, flexShrink: 0 },
  filterRowInner: { gap: shape.spaceSnug, paddingHorizontal: shape.spaceScreenX, paddingVertical: shape.spaceInline },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceSnug,
    paddingHorizontal: shape.spaceInline,
    paddingVertical: shape.spaceSnug,
    borderRadius: shape.radiusChip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.text, backgroundColor: colors.surfaceCard },
  chipGlyph: { fontSize: 13 },
  chipLabel: { ...typo.label, color: colors.textMuted },
  chipLabelOn: { color: colors.text },
  empty: { gap: shape.spaceInline, padding: shape.spaceScreenX },
  emptyText: { ...typo.body, color: colors.textMuted },
  clear: { ...typo.label, color: colors.text },
});
