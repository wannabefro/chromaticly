// Settings block (design 5c). Only the settings with real, wired effects are shown:
// notation size (re-scales the rendered score) and left-hand stave input (mirrors the
// stave-input controls). The design's other three — UK/US terminology, colour-vision
// palette, feedback audio — are not built yet (each needs a large refactor, new design
// tokens, or an audio dependency), so they are omitted rather than shown as toggles
// that change nothing. Filed as follow-ups; see ProfileScreen's header note.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettingsContext } from '../../learn/SettingsContext';
import type { Handedness, NotationScale } from '../../learn/settings';
import { colors, shape, type as typo } from '../theme';

const SIZE_OPTIONS: { value: NotationScale; label: string }[] = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large', label: 'L' },
];

const HAND_OPTIONS: { value: Handedness; label: string }[] = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
];

export function SettingsBlock() {
  const { settings, setNotationScale, setHandedness } = useSettingsContext();

  return (
    <View style={styles.card} testID="settings-block">
      <Text style={styles.cardTitle}>Settings</Text>

      <View style={styles.row}>
        <View style={styles.labelCol}>
          <Text style={styles.label}>Notation size</Text>
          <Text style={styles.hint}>How large the stave renders.</Text>
        </View>
        <View style={styles.segmented}>
          {SIZE_OPTIONS.map((opt) => {
            const active = settings.notationScale === opt.value;
            return (
              <Pressable
                key={opt.value}
                testID={`setting-notation-${opt.value}`}
                accessibilityLabel={`notation size ${opt.value}`}
                onPress={() => setNotationScale(opt.value)}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.rowLast}>
        <View style={styles.labelCol}>
          <Text style={styles.label}>Left-hand stave input</Text>
          <Text style={styles.hint}>Puts the input controls under a left thumb.</Text>
        </View>
        <View style={styles.segmented}>
          {HAND_OPTIONS.map((opt) => {
            const active = settings.handedness === opt.value;
            return (
              <Pressable
                key={opt.value}
                testID={`setting-hand-${opt.value}`}
                accessibilityLabel={`${opt.value}-handed input`}
                onPress={() => setHandedness(opt.value)}
                style={[styles.segment, styles.segmentWide, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    padding: shape.spaceCard,
    gap: shape.spaceInline,
  },
  cardTitle: { ...typo.cardTitle, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: shape.spaceInline,
    borderBottomWidth: shape.borderW,
    borderBottomColor: colors.border,
    paddingBottom: shape.spaceInline,
  },
  rowLast: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: shape.spaceInline },
  labelCol: { flex: 1, gap: shape.spaceHairline },
  label: { ...typo.body, color: colors.text },
  hint: { ...typo.label, color: colors.textFaint },
  segmented: {
    flexDirection: 'row',
    gap: shape.spaceTight,
    padding: shape.spaceTight,
    borderRadius: shape.radiusControl,
    backgroundColor: colors.surfaceCardSunken,
    borderWidth: shape.borderW,
    borderColor: colors.border,
  },
  segment: {
    minWidth: 34,
    minHeight: 30,
    paddingHorizontal: shape.spaceSnug,
    borderRadius: shape.radiusControl - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentWide: { minWidth: 52 },
  segmentActive: { backgroundColor: colors.correctSurface },
  segmentLabel: { ...typo.label, color: colors.textMuted },
  segmentLabelActive: { color: colors.correct },
});
