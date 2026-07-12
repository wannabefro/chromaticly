# E2E tests (Maestro)

End-to-end UI flows for the Grade 1 slice, driven by [Maestro](https://maestro.dev).
They exercise the real app on a simulator/device — the layer the Jest tests mock
(WebView notation, navigation, persistence).

## Flows

| Flow | What it proves |
|---|---|
| `onboarding-first-set.yaml` | The first-run journey end to end: a fresh guest goes Welcome → **grade select** (Grade 1) → your plan → a **3-question coached warm-up** (deterministic correct-option indices 0,1,1) → the "You're in. 3 for 3." landing → **level map (3a)**, then taps the first unit (`treble-notes`) to prove the set launches. There is **no age gate** on this path (it moved to account creation), so no under-13 pass. Starts with `clearState` so onboarding fires fresh. |

### New Grade 1 interactions — coverage note

The four new interaction types (notation-answer MCQ on key-signatures, true/false
bar-validity + add-time-signature on note-values, SRS flashcard on terms, tap-to-place
stave input on intervals) sit **deeper in the linear unlock chain** — reaching them from
a fresh state means completing the units ahead of them. Their grading/rendering logic is
covered by Jest; a full Maestro pass over each (AE3/AE4/AE5) plus the mandatory U8
touch dogfood needs a progress-seeding step (or grinding the chain) and a stable
simulator — see the open bd issue tracking that on-device pass.

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
