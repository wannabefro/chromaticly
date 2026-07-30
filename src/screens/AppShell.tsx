// The app shell (design 2a): a persistent tab bar over Learn · Practice · Exams ·
// Profile. Before this, the level map WAS the app — Practice had a route nothing
// linked to, and the exam could only be reached by scrolling to the bottom of the map.
//
// Tab state is local rather than four expo-router routes: routes in src/app are thin
// re-exports by convention, and the shell is one screen with four panes, not four
// destinations to deep-link. (The DEV seed link still lands on the root route, so it
// keeps working unchanged.)
//
// Since G6 U7 the Learn pane is the seven-lane model (R1): the lane list (7a), and
// one lane's detail (7b) when a lane is open. The level map it replaced still exists
// but is no longer routed to; U12 deletes it.
//
// THREE RESPONSIBILITIES MOVED HERE FROM THE LEVEL MAP, and they are the part of the
// swap most easily lost:
//
//  • Running a lesson. The shell owns `SetRunner`, so the Learn pane is a navigator
//    and nothing else — and a lesson entered from a lane behaves exactly like one
//    entered from anywhere else (R8: the exercise loop is untouched).
//  • The account-creation flow (design 6b/6c, KTD6/KTD7). It is triggered from inside
//    a running set, so it must live on the surface that outlives every pane. It marks
//    the nudge seen only on success — a cancel leaves it unseen so it can re-fire.
//  • Immersive mode. The tab bar gets out of the way while a set, a teach phase or an
//    exam paper is running — an exam in particular must not offer a tab out of itself
//    mid-paper.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Lesson } from '../content/lessons';
import { useProgressContext } from '../learn/ProgressContext';
import { TabBar, type TabKey } from '../ui/components/TabBar';
import { SetRunner } from '../ui/SetRunner';
import type { Strand } from '../ui/theme';
import { AccountCreateScreen } from './AccountCreateScreen';
import ExamsScreen from './ExamsScreen';
import LanesScreen from './LanesScreen';
import LaneScreen from './LaneScreen';
import PracticeScreen from './PracticeScreen';
import ProfileScreen from './ProfileScreen';

export interface AppShellProps {
  /** DEV/E2E only: the lane to open on mount, resolved from the `?seed=` deep link
   *  so a Maestro flow lands where the seeded unit actually lives. */
  initialLane?: Strand;
}

export default function AppShell({ initialLane }: AppShellProps = {}) {
  const { markNudgeSeen, setGrade } = useProgressContext();
  const [tab, setTab] = useState<TabKey>('learn');
  /** The Learn pane: null is the lane list, a strand is that lane's detail. */
  const [lane, setLane] = useState<Strand | null>(initialLane ?? null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [accountFlow, setAccountFlow] = useState(false);
  const [examImmersive, setExamImmersive] = useState(false);

  // The working grade still follows the unit being entered, as it did on the level
  // map (fyu.3). Nothing RENDERS `profile.grade` any more — U8 took Profile's last
  // three grade surfaces out — but onboarding still seeds it and U12 owns the field
  // itself, so the write stays until then.
  const openLesson = async (next: Lesson) => {
    await setGrade(next.grade);
    setLesson(next);
  };

  /** The one seam every cross-tab drill uses: Profile's radar, Profile's readiness
   *  card, and the Exams tab's shortfall rows. Both halves matter — setting `lane`
   *  without `tab` leaves the learner staring at the screen they tapped from, and
   *  setting `tab` without `lane` drops them on the lane LIST, one tap short of the
   *  strand they asked about. */
  const openLane = (strand: Strand) => {
    setLane(strand);
    setTab('learn');
  };

  // Name-your-account (design 6b), reached from the nudge inside a running set.
  if (accountFlow) {
    return (
      <AccountCreateScreen
        onCreated={async () => {
          await markNudgeSeen();
          setAccountFlow(false);
          setLesson(null);
        }}
        onCancel={() => {
          setAccountFlow(false);
          setLesson(null);
        }}
      />
    );
  }

  if (lesson) {
    return (
      <View style={styles.shell} testID="app-shell">
        <View style={styles.pane}>
          <SetRunner lesson={lesson} onDone={() => setLesson(null)} onCreateAccount={() => setAccountFlow(true)} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shell} testID="app-shell">
      <View style={styles.pane}>
        {tab === 'learn' &&
          (lane === null ? (
            <LanesScreen onOpenLane={setLane} />
          ) : (
            <LaneScreen strand={lane} onBack={() => setLane(null)} onOpenLane={setLane} onOpenLesson={openLesson} />
          ))}
        {tab === 'practice' && <PracticeScreen />}
        {tab === 'exams' && <ExamsScreen onImmersive={setExamImmersive} onOpenLane={openLane} />}
        {tab === 'profile' && <ProfileScreen onOpenExams={() => setTab('exams')} onDrillStrand={openLane} />}
      </View>
      {!examImmersive && <TabBar active={tab} onChange={setTab} />}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  pane: { flex: 1 },
});
