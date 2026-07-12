// U2: one level entry on the vertical level path (design 3a). Unlocked levels
// (Level 1) render expanded — a header plus their unit rows/exam-gate as
// children; locked levels (2-5) render a collapsed row naming the prerequisite
// (R1/R4) and take no unit content.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Level } from '../../content/levels';
import { colors, shape, type as typo } from '../theme';

export interface LevelNodeProps {
  level: Level;
  expanded: boolean;
  /** Header subtitle for an expanded level: how many of its units are done. */
  summary?: { doneCount: number; total: number };
  /** The single screen accent (rule 3) — the active/started unit's strand hue. */
  accentHue?: string;
  children?: ReactNode;
  testID?: string;
}

export function LevelNode({ level, expanded, summary, accentHue, children, testID }: LevelNodeProps) {
  if (!expanded) {
    return (
      <View style={styles.collapsed} testID={testID}>
        <View style={styles.collapsedIcon}>
          <Text style={styles.collapsedIconText}>{level.grade}</Text>
        </View>
        <View style={styles.collapsedBody}>
          <Text style={styles.collapsedTitle}>{level.title}</Text>
          <Text style={styles.collapsedSubtitle} testID={testID ? `${testID}-prerequisite` : undefined}>
            {level.prerequisite}
          </Text>
        </View>
        <Text style={styles.lock}>🔒</Text>
      </View>
    );
  }

  const hue = accentHue ?? colors.text;
  const statusLabel = summary && summary.total > 0 && summary.doneCount === summary.total ? 'complete' : 'in progress';

  return (
    <View style={styles.expanded} testID={testID}>
      <View
        testID={testID ? `${testID}-header` : undefined}
        style={[styles.header, { backgroundColor: `${hue}1a`, borderColor: `${hue}55` }]}
      >
        <View
          testID={testID ? `${testID}-accent` : undefined}
          style={[styles.headerIcon, { backgroundColor: hue }]}
        >
          <Text style={styles.headerIconText}>{level.grade}</Text>
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle}>{level.title}</Text>
          {summary ? (
            <Text style={styles.headerSubtitle}>
              {summary.doneCount} of {summary.total} units · {statusLabel}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.units}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    padding: shape.spaceCard,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCardSunken,
    opacity: 0.55,
  },
  collapsedIcon: {
    width: 34,
    height: 34,
    borderRadius: shape.radiusControl,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedIconText: {
    ...typo.cardTitle,
    color: colors.textFaint,
  },
  collapsedBody: {
    flex: 1,
    gap: 2,
  },
  collapsedTitle: {
    ...typo.cardTitle,
    fontSize: 14,
    color: colors.textMuted,
  },
  collapsedSubtitle: {
    ...typo.label,
    color: colors.textFaint,
  },
  lock: {
    fontSize: 14,
    color: colors.textFaint,
  },
  expanded: {
    borderRadius: shape.radiusCardLg,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    padding: shape.spaceCard,
    borderBottomWidth: shape.borderW,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: shape.radiusControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    ...typo.cardTitle,
    color: 'rgba(0,0,0,0.82)',
  },
  headerBody: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...typo.cardTitle,
    color: colors.text,
  },
  headerSubtitle: {
    ...typo.label,
    color: colors.textMuted,
  },
  units: {
    paddingHorizontal: shape.spaceInline,
    paddingVertical: 6,
    gap: 2,
  },
});
