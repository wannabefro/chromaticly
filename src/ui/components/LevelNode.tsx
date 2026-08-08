// U2: one level entry on the vertical level path (design 3a). Reachable levels
// (Level 1-3, fyu.2) render expanded — a header plus their unit rows/exam-gate as
// children; content-less levels (4-5, until their epics) render a collapsed row
// with a readiness chip in place of a lock (fyu.3: nothing on this map is locked).

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Level } from '../../content/levels';
import { colors, shape, type as typo } from '../theme';

export interface LevelNodeProps {
  level: Level;
  expanded: boolean;
  /** Header subtitle for an expanded level: how many of its units are done. */
  summary?: { doneCount: number; total: number };
  /** The single screen accent (rule 3) — the active/started unit's strand hue. */
  accentHue?: string;
  /** Collapsed (content-less) levels only: a short readiness hint ("builds on
   *  L3") replacing the old lock — design 3a's "nothing is locked" rule. */
  readinessNote?: string;
  /** Design 3a: "tapping [a level] starts it, which is also how you switch
   *  grades" — a level-wide start affordance on the header, in addition to each
   *  unit row's own tap. Present only when there is something to start. */
  onStart?: () => void;
  startTestID?: string;
  children?: ReactNode;
  testID?: string;
}

export function LevelNode({
  level,
  expanded,
  summary,
  accentHue,
  readinessNote,
  onStart,
  startTestID,
  children,
  testID,
}: LevelNodeProps) {
  if (!expanded) {
    return (
      <View style={styles.collapsed} testID={testID}>
        <View style={styles.collapsedIcon}>
          <Text style={styles.collapsedIconText}>{level.grade}</Text>
        </View>
        <View style={styles.collapsedBody}>
          <Text style={styles.collapsedTitle}>{level.title}</Text>
        </View>
        {readinessNote ? (
          <View style={styles.readinessChip} testID={testID ? `${testID}-readiness` : undefined}>
            <Text style={styles.readinessChipText}>{readinessNote}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  const hue = accentHue ?? colors.text;
  const statusLabel = summary && summary.total > 0 && summary.doneCount === summary.total ? 'complete' : 'in progress';
  const HeaderComponent = onStart ? Pressable : View;
  const headerTestID = onStart ? (startTestID ?? (testID ? `${testID}-header` : undefined)) : testID ? `${testID}-header` : undefined;

  return (
    <View style={styles.expanded} testID={testID}>
      <HeaderComponent
        testID={headerTestID}
        onPress={onStart}
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
      </HeaderComponent>
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
    opacity: 0.8,
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
    gap: shape.spaceHairline,
  },
  collapsedTitle: {
    ...typo.cardTitle,
    fontSize: typo.body.fontSize,
    color: colors.textMuted,
  },
  readinessChip: {
    flexShrink: 0,
    borderRadius: shape.radiusChip,
    borderWidth: shape.borderW,
    borderColor: colors.readinessBorder,
    backgroundColor: colors.readinessSurface,
    paddingHorizontal: shape.spaceSnug,
    paddingVertical: shape.spaceTight,
  },
  readinessChipText: {
    ...typo.label,
    color: colors.readinessText,
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
    gap: shape.spaceHairline,
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
    paddingVertical: shape.spaceSnug,
    gap: shape.spaceHairline,
  },
});
