// First-run router (U11). The journey is now MEASURED, not asked:
// Welcome → fork → placement (A1/A2) → result (7c) → your plan → coached warm-up
// → landed → the Learn tab. The fork's other door is 5a's ladder, a claim.
//
// No age gate on the primary path — it moves to account creation (6b), which
// isn't built (plan KTD1/KTD4; AgeGateScreen + age.ts are parked for it).
//
// The whole journey is local `step` state — no extra expo-router routes / deep
// links. While progress is loading it renders nothing (splash stays up) so a
// returning user never flashes Welcome (A7).
//
// ONE PERSISTENCE POINT, and it is Landed (KTD6). Every route stages and none
// writes early — including skip, which would otherwise be a second commit site.
// A learner who kills the app mid-journey restarts it. That is the honest
// consequence of a single write, and it is cheaper than a half-placed store.

import * as Linking from 'expo-linking';
import { useCallback, useEffect, useRef, useState } from 'react';

import { lessonById } from '../content/lessons';
import { useProgressContext } from '../learn/ProgressContext';
import { seedVectorForGrade } from '../learn/placement';
import type { SeededDepth } from '../learn/store';
import { type GemState } from '../ui/components/MasteryGems';
import { CoachedWarmUp } from '../ui/CoachedWarmUp';
import type { Strand } from '../ui/theme';
import { GradeSelectScreen } from './onboarding/GradeSelectScreen';
import { LandedScreen } from './onboarding/LandedScreen';
import { PlacementResultScreen } from './onboarding/PlacementResultScreen';
import { PlacementScreen } from './onboarding/PlacementScreen';
import { PlanScreen } from './onboarding/PlanScreen';
import { WelcomeScreen } from './onboarding/WelcomeScreen';
import AppShell from './AppShell';

type Step = 'welcome' | 'placement' | 'result' | 'skip' | 'plan' | 'warmup' | 'landed';

/** How the learner arrived at Plan, and therefore what gets committed. A boolean
 *  cannot carry it: skipping has two outcomes and they write different grades. */
type Destination = { kind: 'placed' } | { kind: 'skipped'; grade: 0 | 1 };

export default function RootRouter() {
  const { ready, isOnboarded, commitOnboarding, commitSkip, seedTo, stampDepth } = useProgressContext();
  const [step, setStep] = useState<Step>('welcome');
  const [staged, setStaged] = useState<Record<string, SeededDepth>>({});
  const [asked, setAsked] = useState(0);
  const [destination, setDestination] = useState<Destination>({ kind: 'placed' });
  const [retest, setRetest] = useState<Strand | null>(null);
  const [chosenGrade, setChosenGrade] = useState<number | null>(null);
  const [gems, setGems] = useState<GemState[]>([]);

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
    const params = Linking.parse(url).queryParams;
    const to = params?.seed;
    if (typeof to === 'string' && to) {
      setSeeded(true);
      // `?seed=exam` names no lesson, so it resolves to no lane and the shell opens
      // on the list — which is where an exam flow wants to be anyway.
      setSeedLane((lessonById(to)?.strand as Strand | undefined) ?? null);
      // `&stale=<days>` back-dates the seeded reviews, the only route to a decayed
      // lane on device (R5). Non-numeric or negative reads as 0 — a typo must not
      // silently change what the flow is looking at.
      const stale = Number(params?.stale);
      void seedTo(to, Number.isFinite(stale) && stale > 0 ? stale : 0);
    }
  }, [url, ready, seeded, seedTo]);

  // Both Landed CTAs commit, and the write is async, so a second tap can land
  // before `isOnboarded` flips and unmounts the screen. A ref, not state: it must
  // be true on the very next call, not on the next render.
  const committing = useRef(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const finish = useCallback(() => {
    if (committing.current) return;
    committing.current = true;
    setSaveFailed(false);
    const at = new Date().toISOString();
    const write = destination.kind === 'skipped' ? commitSkip(destination.grade, at) : commitOnboarding(staged, at);
    // A rejected write left the latch set, so both CTAs stayed dead for good.
    void write.catch(() => {
      committing.current = false;
      setSaveFailed(true);
    });
  }, [destination, staged, commitOnboarding, commitSkip]);

  if (!ready) return null; // A7: no flash before persisted state is known

  if (!isOnboarded) {
    switch (step) {
      case 'welcome':
        return <WelcomeScreen onStart={() => setStep('placement')} />;
      case 'placement':
        return (
          <PlacementScreen
            // Remounting on a re-test restarts the runner on that strand's ladder.
            key={retest ?? 'mixed'}
            retestStrand={retest ?? undefined}
            seedBase={retest ? asked : 0}
            onDone={(measured, count) => {
              setStaged((prev) => ({ ...prev, ...measured }));
              setAsked((prev) => prev + count);
              setRetest(null);
              setStep('result');
            }}
            onSkip={retest ? undefined : () => setStep('skip')}
          />
        );
      case 'result':
        return (
          <PlacementResultScreen
            staged={staged}
            asked={asked}
            chosenGrade={chosenGrade}
            onRetest={(strand) => {
              setChosenGrade(null);
              setRetest(strand);
              setStep('placement');
            }}
            onAccept={() => {
              setDestination({ kind: 'placed' });
              setStep('plan');
            }}
          />
        );
      case 'skip':
        return (
          <GradeSelectScreen
            onSelectGrade={(grade) => {
              // A rung claims all seven strands; First steps claims none.
              if (grade === 0) {
                setDestination({ kind: 'skipped', grade });
                setStep('plan');
                return;
              }
              const vector = seedVectorForGrade(grade);
              setStaged(
                Object.fromEntries(Object.entries(vector).map(([strand, depth]) => [strand, stampDepth(depth ?? 0)])),
              );
              setChosenGrade(grade);
              setDestination({ kind: 'placed' });
              setStep('result');
            }}
            onBack={() => setStep('placement')}
          />
        );
      case 'plan':
        return <PlanScreen firstSteps={isFirstSteps(destination)} onStartWarmUp={() => setStep('warmup')} />;
      case 'warmup':
        return (
          <CoachedWarmUp
            grade={isFirstSteps(destination) ? 0 : null}
            onComplete={(earned) => {
              setGems(earned);
              setStep('landed');
            }}
            onClose={() => setStep('plan')}
          />
        );
      case 'landed':
        return (
          <LandedScreen
            onContinue={finish}
            onExplore={finish}
            gems={gems}
            grade={isFirstSteps(destination) ? 0 : null}
            staged={destination.kind === 'placed' ? staged : {}}
            saveFailed={saveFailed}
          />
        );
    }
  }

  // Onboarded: the app proper — the tab shell (2a), whose Learn tab is the seven
  // lanes (7a). Keyed on the seed lane so a deep link that resolves AFTER the shell
  // has mounted still opens the right lane rather than being ignored.
  return <AppShell key={seedLane ?? 'root'} initialLane={seedLane ?? undefined} />;
}

function isFirstSteps(destination: Destination): boolean {
  return destination.kind === 'skipped' && destination.grade === 0;
}
