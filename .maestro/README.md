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

The dev URL is passed via `-e DEV_URL=…` (a flow-level `env:` default would
override `-e`, so the flows intentionally omit one). The npm scripts default to
this repo's port 8090 and honor a `DEV_URL` shell override:

```bash
npm run e2e                                          # uses exp://127.0.0.1:8090
DEV_URL=exp://127.0.0.1:8091 npm run e2e             # override the Metro port
npm run e2e:onboarding                               # the single flow directly
```

Or invoke Maestro directly:
```bash
maestro test -e DEV_URL=exp://127.0.0.1:8090 .maestro/onboarding-first-set.yaml
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
