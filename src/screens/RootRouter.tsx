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

import { useState } from 'react';

import { useProgressContext } from '../learn/ProgressContext';
import { CoachedWarmUp } from '../ui/CoachedWarmUp';
import { GradeSelectScreen } from './onboarding/GradeSelectScreen';
import { LandedScreen } from './onboarding/LandedScreen';
import { PlanScreen } from './onboarding/PlanScreen';
import { WelcomeScreen } from './onboarding/WelcomeScreen';
import LevelMapScreen from './LevelMapScreen';

type Step = 'welcome' | 'grade' | 'plan' | 'warmup' | 'landed';

export default function RootRouter() {
  const { ready, isOnboarded, completeOnboarding } = useProgressContext();
  const [step, setStep] = useState<Step>('welcome');
  const [grade, setGrade] = useState(1);

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

  return <LevelMapScreen />;
}
