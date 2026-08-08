// Persistent tab bar (design 2a): Learn · Practice · Exams · Profile.
//
// Colour is never the only signal (never-violate rule 3): every tab carries a glyph
// AND a text label, and the active one is distinguished by weight and tint together.
//
// The mock tints the active tab with a strand hue, because on a screen showing one
// strand the accent IS that strand's hue ("one accent per screen"). The shell has no
// single strand — it spans all seven — so the active tab takes the app's own accent
// rather than borrowing a strand's. Surfaced as a deliberate divergence, not a
// silent one.

import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, shape, type as typo } from '../theme';

export type TabKey = 'learn' | 'practice' | 'exams' | 'profile';

interface Tab {
  key: TabKey;
  label: string;
  symbol: SFSymbol;
}

// Line icons that take a tint, as the design's do. Emoji cannot be tinted — they
// would ignore the active/inactive colour entirely and drag their own palette onto a
// screen that is meant to carry one accent.
const TABS: Tab[] = [
  { key: 'learn', label: 'Learn', symbol: 'music.note' },
  { key: 'practice', label: 'Practice', symbol: 'play.circle' },
  { key: 'exams', label: 'Exams', symbol: 'graduationcap' },
  { key: 'profile', label: 'Profile', symbol: 'person.crop.circle' },
];

export interface TabBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <View style={styles.bar} testID="tab-bar">
      {TABS.map((tab) => {
        const isActive = tab.key === active;

        return (
          <Pressable
            key={tab.key}
            testID={`tab-${tab.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(tab.key)}
            style={styles.tab}
          >
            <SymbolView
              name={tab.symbol}
              size={22}
              tintColor={isActive ? colors.text : colors.textFaint}
              resizeMode="scaleAspectFit"
              fallback={<Text style={[styles.glyph, isActive && styles.glyphActive]}>♪</Text>}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.tabbar,
    borderTopWidth: shape.borderW,
    borderTopColor: colors.border,
    paddingTop: shape.spaceInline,
    paddingBottom: shape.spaceScreenX,
    paddingHorizontal: shape.spaceSnug,
  },
  tab: { alignItems: 'center', gap: shape.spaceSnug, minWidth: 64, minHeight: shape.tapMin },
  glyph: { fontSize: 19, lineHeight: 24, color: colors.textFaint, textAlign: 'center' },
  glyphActive: { color: colors.text },
  label: { ...typo.label, color: colors.textFaint },
  labelActive: { color: colors.text, fontWeight: '700' },
});
