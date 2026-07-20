# E2E tests (Maestro)

End-to-end UI flows for the Grade 1 slice, driven by [Maestro](https://maestro.dev).
They exercise the real app on a simulator/device — the layer the Jest tests mock
(WebView notation, navigation, persistence).

## Flows

| Flow | What it proves |
|---|---|
| `onboarding-first-set.yaml` | The first-run journey end to end: a fresh guest goes Welcome → **grade select** (Grade 1) → your plan → a **3-question coached warm-up** (deterministic correct-option indices 0,1,1) → the "You're in. 3 for 3." landing → **level map (3a)**, then taps the first unit (`treble-notes`) to prove the set launches. There is **no age gate** on this path (it moved to account creation), so no under-13 pass. Starts with `clearState` so onboarding fires fresh. |
| `key-signatures-mcq.yaml` | **AE3** — the notation-answer MCQ. Its options are rendered staves rather than text, so this proves a notation option is tappable and gradeable on a real device (Jest mocks the WebView and cannot). |
| `note-values-truefalse.yaml` | **AE4** — the per-bar true/false (`bar_validity`) and `add_time_signature`. The lesson attaches three templates and SetRunner cycles them by item index, so the flow walks items 1–3 to reach the true/false input, and answers every bar (Check stays disabled until all bars have a verdict — no partial credit). |
| `terms-flashcard.yaml` | **2g/2h** — the SRS flashcard. Self-graded: asserts **no** Check button and no FeedbackSheet ever render, that tapping the card reveals the meaning, and that a grade (Good) advances the set on its own. |
| `exam-paper.yaml` | **The practice exam under exam conditions** (3b/3c/3d). Seeded with `?seed=exam` (masters every unit so the Level 1 gate opens). Proves the exam apparatus on device — running clock, answered-marks counter, section navigator, and flag → review-before-submit — and asserts the never-violate rule 4 negatives: no hint, no streak, no feedback sheet anywhere in a paper. |
| `intervals-stave-input.yaml` | **AE5 + the mandatory touch dogfood.** Tap-to-place: a finger lands a note on a real stave slot (halo appears), Undo takes it back off, and re-placing then grades. This is the one interaction whose whole point is touch — Jest can assert the reducer but not that a tap lands on the right line. |
| `account-nudge.yaml` | **6c + 6b (302.9/302.13).** Seeds to `key-signatures` (units 1–4 done), then finishes that set — the completion *transition* that fires the one-time save-progress nudge over the dimmed complete screen. Drives the primary path: Name my account → type a name → the **Profile reflects it**. That last step is the real device gate: `createAccount` writes through real React state, so a name showing here proves the reactivity the React Compiler would otherwise leave stale (Jest can't catch it). The nudge shows only real stats (no XP) and no sync/save overpromise. |
| `grade2-key-signatures.yaml` | **Grade 2 end-to-end (chromaticly-elb).** Seeds `?seed=key-signatures-2`, which fast-forwards via the real unlock path (Grade 1 mastered, Level 1 exam recorded cleared). Scrolls past Level 1's eight units to prove **Level 2 is unlocked and expanded**, enters `key-signatures-2`, and answers a **Grade-2 key-signature MCQ** (A/B♭/E♭ major — the flat keys the flat-tonic fix made reachable). A locked Level 2 would render collapsed with no unit row, so reaching the set is itself the unlock proof. |
| `grade2-minor-keys.yaml` | **Grade 2 minor-keys, relative-key MCQ (chromaticly-elb.6).** Seeds `?seed=minor-keys-2`, walking the grade-2 chain (`key-signatures-2 → minor-keys-2`). Reaches the new `minor-keys-2` unit and answers a **relative major/minor MCQ** (`mode_swap`). Reaching `unit-row-minor-keys-2` is the unlock proof. |
| `grade2-minor-scales.yaml` | **Grade 2 harmonic-minor scale construction (chromaticly-elb.6).** Seeds `?seed=minor-scales-2` (walks the full chain to the third grade-2 unit). Its point is the **notation stimulus**: an 8-note harmonic-minor scale rendered in the WebView, answered via the `scale_construction` spot-the-wrong-note MCQ. Reaching a visible `option-0` (not a collapsed zero-height surface) is the flex-integrity proof jest can't give; the feedback screenshot captures U5's rendered correct scale. |
| `grade3-minor-keys.yaml` | **Grade 3 new minor keys, relative-key MCQ (chromaticly-1v5.1).** Seeds `?seed=minor-keys-3`, which masters Grades 1–2 and records **both** the Level 1 and Level 2 exams cleared (`seed.ts`), unlocking Level 3 via the real gate. Scrolls past Levels 1–2 to `unit-row-minor-keys-3` and answers a `mode_swap` MCQ over the six new minor keys. A locked Level 3 renders collapsed with no unit row, so reaching the set is itself the unlock proof. |
| `grade3-minor-scales.yaml` | **Grade 3 harmonic minor in the new keys (chromaticly-1v5.1).** Seeds `?seed=minor-scales-3`. Its point is the **sharp-key notation**: `scale_construction` over the six new keys including the sharp tonics F♯/C♯, whose raised 7ths spell the enharmonic-of-natural accidentals E♯/B♯ — abcjs behaviour no Jest test can verify (plan Risk 3). Reaching a visible rendered stimulus is the render proof. |
| `grade3-melodic-minor.yaml` | **Grade 3 melodic minor, directional scale_construction (chromaticly-1v5.1).** Seeds `?seed=melodic-minor-3` (all nine minors). Proves the **directional** render: the prompt names the direction, the stimulus renders accordingly, and a wrong answer's FeedbackSheet shows the correct scale in the **same** direction (rule 5). On-device this also confirmed the sharp-tonic E♯ raised 7th of F♯ melodic minor drawn on the stave (Risk 3). |
| `grade3-compound-time.yaml` | **Grade 3 compound time, metre_classification MCQ (chromaticly-1v5.2).** Seeds `?seed=compound-time-3`. Its point is the **printed-signature notation** (plan D8): a compound signature (6/8/9/8/12/8) drawn on the light paper card with 3+3 dotted-crotchet beam grouping, classified via the generic mcq into `{Simple,Compound}×{duple,triple,quadruple}` labels — abcjs behaviour no Jest test can verify. Reaching `unit-row-compound-time-3` proves Level 3 unlocked AND the two new rhythm lessons are live. |
| `grade3-compound-bars.yaml` | **Grade 3 compound metres, add_time_signature hidden-signature (chromaticly-1v5.2).** Seeds `?seed=compound-bars-3`. Its point is the **hidden-signature stimulus** (plan D5/D6): the bar renders with NO printed time signature yet still beams in dotted-crotchet threes (the `time_sig_hidden` field), and the options are exactly the three compound signatures (the equal-total 3/4 never offered). On-device this confirmed the abcjs `M:none`+compound-beaming path (Risk 5) and the rule-5 FeedbackSheet naming the miscounted-beats misconception with the rendered correct answer. |

Every lesson now opens on the **teach phase** (302.3), so each flow taps
`teach-start` before the set begins.

> **Expo Go dev menu.** On a cold launch (`clearState`) Expo Go shows its dev-menu
> sheet over the app, which hides the whole RN view tree from Maestro — every
> assertion fails until it's gone. The flows dismiss it by tapping `Continue`
> (the intro page) and then the sheet's **X** by point. If a flow fails at the very
> first assertion, check for that sheet, and check Metro is actually up: a dead
> Metro shows "Could not connect to the server", not a test failure.

## Prerequisites

1. Maestro installed (`maestro --version`; install: https://maestro.dev/getting-started).
2. A booted iOS simulator (or Android emulator) with **Expo Go** installed.
3. **Metro running** for this project, and Chromaticly opened once in Expo Go so
   it is the active project:
   ```bash
   npm start                 # or: npx expo start --port 8090
   # press i, or open exp://127.0.0.1:<port> in the simulator
   ```

These flows target **Expo Go** (the app runs inside the Expo container in dev), so
they use `openLink` with the Metro dev URL rather than `launchApp`. For a CI-grade,
self-contained launch, build a standalone/dev build and switch the flows to
`launchApp` with the app's bundle id.

## Running

The npm scripts go through `scripts/e2e.sh`, which **resolves this app's simulator by
name and passes `--device`**. This is not optional cleanliness: `maestro test` targets
whichever sim is *booted*, so with another app's sim up it silently runs our flow
against theirs and fails with a confusing simctl error that looks like our bug. The
wrapper resolves `Chromaticly Dogfood` by name (UDID is never hardcoded — it changes
when the sim is recreated), boots it if needed, and never touches another app's sim.

```bash
npm run e2e                                          # whole suite, on our sim, port 8090
npm run e2e:interactions                             # the 4 interaction flows
npm run e2e:exam / :context / :shell / :stave-input  # one flow each
DEV_URL=exp://127.0.0.1:8091 npm run e2e             # override the Metro port
CHROMATICLY_SIM="Other Sim Name" npm run e2e         # override the target sim
```

Invoking Maestro directly works too, but then **you** own picking the sim — always
pass `--device <udid>`, or a booted sibling app's sim will be used:
```bash
maestro --device <udid> test -e DEV_URL=exp://127.0.0.1:8090 .maestro/<flow>.yaml
```

> This repo's dev server uses **port 8090** (8081 collides with another local
> Expo project). Adjust `DEV_URL` to your Metro port.

## DEV seeding seam (302.5)

Interactions deep in the unlock chain are impractical to reach from a fresh
install (you'd grind every prior unit). A `__DEV__`-only deep link fast-forwards
progress instead:

```bash
openLink: exp://127.0.0.1:8090/--/?seed=<unitId>   # e.g. ?seed=intervals
```

`<unitId>` may also be `exam` — that masters every unit (3★) so the Level 1 exam
gate unlocks, letting a flow reach the practice exam. It onboards (Grade 1) and
unlocks `<unitId>` (marking predecessors complete but NOT the target), landing
straight on the level map — no Welcome/onboarding. The
seed rides as a **query param on the root route**, not a path (`/--/seed` would
hit expo-router's Unmatched Route). Unit ids: `treble-notes`, `bass-notes`,
`accidentals`, `note-values`, `key-signatures`, `intervals`, `terms-and-signs`.
Never active in a release build. Logic: `src/learn/seed.ts`, wired in
`src/screens/RootRouter.tsx`.

## Notes

- `onboarding-first-set.yaml` **must** reset persisted state so first-run
  onboarding fires, so it uses `clearState` before each pass. `clearState`
  reopens Expo Go to its last project, so run with only this project's Metro up
  (or a dev build) so the subsequent `openLink` re-routes to the right project.
  These `clearState` cold reloads dominate the flow's wall-time; keep the suite
  to this single flow rather than adding more `clearState` passes.
- The flow taps warm-up answers by **option index** (`option-<i>`), not by
  label: every option is a plain-language note-value phrase, and single-letter
  fragments collide with the A/B position badges on each row. The correct indices
  (0,1,1) are derived from the `note_value_compare` generator + `assembleOptions`
  shuffle for seeds 0-2. If the generator or the shuffle change, regenerate them
  (see the header comment in the flow). Retry-until-correct means a wrong tap
  loops the item rather than failing the run.
