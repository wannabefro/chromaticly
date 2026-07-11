# E2E tests (Maestro)

End-to-end UI flows for the Grade 1 slice, driven by [Maestro](https://maestro.dev).
They exercise the real app on a simulator/device — the layer the Jest tests mock
(WebView notation, navigation, persistence).

## Flows

| Flow | What it proves |
|---|---|
| `smoke.yaml` | App launches; Home → Learn map (lock states) → Free practice. |
| `lesson-complete.yaml` | Completes the first lesson (answering the deterministic seed-based exercises B, C flat, B, A, A) and asserts the next lesson unlocks — the completion→unlock path a static screenshot can't verify. |

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
Expo's port 8081 and honor a `DEV_URL` shell override:

```bash
npm run e2e:smoke                              # uses exp://127.0.0.1:8081
DEV_URL=exp://127.0.0.1:8090 npm run e2e:smoke  # this repo's dev server runs on 8090
DEV_URL=exp://127.0.0.1:8090 npm run e2e:lesson
DEV_URL=exp://127.0.0.1:8090 npm run e2e        # whole suite
```

Or invoke Maestro directly:
```bash
maestro test -e DEV_URL=exp://127.0.0.1:8090 .maestro/smoke.yaml
```

> This repo's dev server uses **port 8090** (8081 collides with another local
> Expo project). Adjust `DEV_URL` to your Metro port.

## Notes

- Multiple running Expo projects make Expo Go's cold-launch deep-link routing
  ambiguous, so the flows avoid `stopApp`/`clearState` (which reopen Expo Go to
  its last project) and instead reload the active project via `openLink`. Keep
  only this project's Metro running while testing, or use a dev build.
- The correct answers in `lesson-complete.yaml` are derived from the pure
  generators (`note_naming` seeds 0-4). If the generator or lesson templates
  change, regenerate them.
