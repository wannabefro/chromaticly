// The app shell (design 2a): a persistent tab bar over Learn · Practice · Exams ·
// Profile. Before this, the level map WAS the app — Practice had a route nothing
// linked to, and the exam could only be reached by scrolling to the bottom of the map.
//
// Tab state is local rather than four expo-router routes: routes in src/app are thin
// re-exports by convention, and the shell is one screen with four panes, not four
// destinations to deep-link. (The DEV seed link still lands on the root route, so it
// keeps working unchanged.)
//
// The tab bar hides itself while an exercise, a teach phase or an exam paper is
// running — those are immersive: an exam in particular must not offer a tab out of
// itself mid-paper.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TabBar, type TabKey } from '../ui/components/TabBar';
import ExamsScreen from './ExamsScreen';
import LevelMapScreen from './LevelMapScreen';
import PracticeScreen from './PracticeScreen';
import ProfileScreen from './ProfileScreen';

export default function AppShell() {
  const [tab, setTab] = useState<TabKey>('learn');
  const [immersive, setImmersive] = useState(false);

  return (
    <View style={styles.shell} testID="app-shell">
      <View style={styles.pane}>
        {tab === 'learn' && <LevelMapScreen onImmersive={setImmersive} />}
        {tab === 'practice' && <PracticeScreen />}
        {tab === 'exams' && <ExamsScreen onImmersive={setImmersive} />}
        {tab === 'profile' && <ProfileScreen onOpenExams={() => setTab('exams')} />}
      </View>
      {!immersive && <TabBar active={tab} onChange={setTab} />}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  pane: { flex: 1 },
});
