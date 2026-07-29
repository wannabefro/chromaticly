// First-run router (U7). The new onboarding journey (design "First-run journey"):
// Welcome → grade select → your plan → coached warm-up → landed → the grade home
// (level map). No age gate on the primary path — it moves to account creation (6b),
// which isn't built (plan KTD1/KTD4; AgeGateScreen + age.ts are parked for it).
//
// The whole journey is local `step` state — no extra expo-router routes / deep
// links. While progress is loading it renders nothing (splash stays up) so a
// returning user never flashes Welcome (A7). Continue on Landing is the single
// transition that persists the profile (selected grade), flipping isOnboarded via
// real state so this falls through to the level map (KTD5).

import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';

import { lessonById } from '../content/lessons';
import { useProgressContext } from '../learn/ProgressContext';
import { CoachedWarmUp } from '../ui/CoachedWarmUp';
import type { Strand } from '../ui/theme';
import { GradeSelectScreen } from './onboarding/GradeSelectScreen';
import { LandedScreen } from './onboarding/LandedScreen';
import { PlanScreen } from './onboarding/PlanScreen';
import { WelcomeScreen } from './onboarding/WelcomeScreen';
import AppShell from './AppShell';

type Step = 'welcome' | 'grade' | 'plan' | 'warmup' | 'landed';

export default function RootRouter() {
  const { ready, isOnboarded, completeOnboarding, seedTo } = useProgressContext();
  const [step, setStep] = useState<Step>('welcome');
  const [grade, setGrade] = useState(1);

  // DEV/E2E only (302.5): a `--/?seed=<unitId>` deep link fast-forwards progress so
  // a Maestro flow can jump to a deep unit instead of grinding the chain. The seed
  // rides as a query param on the ROOT route (not a path) — expo-router owns path
  // routing and would send `/seed` to an Unmatched Route, never mounting this
  // screen. Never active in a release build. Hooks run before the early return.
  //
  // Since G6 U7 the Learn tab is seven lanes, so the seed also decides which lane
  // the shell opens on: the seeded unit's own strand. Without that, `?seed=rests-4`
  // would land on the lane LIST and every flow that taps `unit-row-rests-4` would
  // need a lane tap inserted — the whole Maestro fleet rests on this one hop.
  const url = Linking.useURL();
  const [seeded, setSeeded] = useState(false);
  const [seedLane, setSeedLane] = useState<Strand | null>(null);
  useEffect(() => {
    if (!__DEV__ || !ready || seeded || !url) return;
    const to = Linking.parse(url).queryParams?.seed;
    if (typeof to === 'string' && to) {
      setSeeded(true);
      // `?seed=exam` names no lesson, so it resolves to no lane and the shell opens
      // on the list — which is where an exam flow wants to be anyway.
      setSeedLane((lessonById(to)?.strand as Strand | undefined) ?? null);
      void seedTo(to);
    }
  }, [url, ready, seeded, seedTo]);

  if (!ready) return null; // A7: no flash before persisted state is known

  if (!isOnboarded) {
    switch (step) {
      case 'welcome':
        return <WelcomeScreen onStart={() => setStep('grade')} />;
      case 'grade':
        return (
          <GradeSelectScreen
            onSelectGrade={(g) => {
              setGrade(g);
              setStep('plan');
            }}
          />
        );
      case 'plan':
        return <PlanScreen grade={grade} onStartWarmUp={() => setStep('warmup')} />;
      case 'warmup':
        return <CoachedWarmUp onComplete={() => setStep('landed')} onClose={() => setStep('plan')} />;
      case 'landed': {
        // Both CTAs mark the guest onboarded; completeOnboarding persists the grade
        // and bumps context revision → isOnboarded flips → level map (grade home).
        const finish = () => completeOnboarding(grade, new Date().toISOString());
        return <LandedScreen onContinue={finish} onExplore={finish} />;
      }
    }
  }

  // Onboarded: the app proper — the tab shell (2a), whose Learn tab is the seven
  // lanes (7a). Keyed on the seed lane so a deep link that resolves AFTER the shell
  // has mounted still opens the right lane rather than being ignored.
  return <AppShell key={seedLane ?? 'root'} initialLane={seedLane ?? undefined} />;
}
