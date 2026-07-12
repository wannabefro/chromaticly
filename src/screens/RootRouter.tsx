// First-run router (U10, KTD5/A7): the app's entry. While progress is loading it
// renders nothing (splash stays up) so a returning user never flashes the Welcome
// screen. A guest without a profile goes through Welcome → Age gate; once onboarded
// (profile persisted, context re-renders) it falls through to the Dashboard. The
// onboarding sub-flow is local state here — no extra expo-router routes / deep links.

import { useState } from 'react';

import { useProgressContext } from '../learn/ProgressContext';
import { AgeGateScreen } from './onboarding/AgeGateScreen';
import { WelcomeScreen } from './onboarding/WelcomeScreen';
import DashboardScreen from './DashboardScreen';

export default function RootRouter() {
  const { ready, isOnboarded } = useProgressContext();
  const [step, setStep] = useState<'welcome' | 'agegate'>('welcome');

  if (!ready) return null; // A7: no flash before persisted state is known

  if (!isOnboarded) {
    if (step === 'welcome') return <WelcomeScreen onStart={() => setStep('agegate')} />;
    // completeOnboarding persists + bumps context revision → this re-renders with
    // isOnboarded true and falls through to the Dashboard; onOnboarded is a no-op.
    return <AgeGateScreen onOnboarded={() => {}} />;
  }

  return <DashboardScreen />;
}
