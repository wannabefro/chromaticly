#!/usr/bin/env bash
# Run Maestro against THIS app's simulator, resolved by name.
#
# Why this exists: `maestro test` targets whichever iOS simulator is booted. When
# another app's sim is up (several are worked on in parallel), Maestro silently runs
# our flow against IT and fails with a confusing simctl error that looks like our bug.
# So we resolve our own sim by name and pass --device explicitly. The UDID is never
# hardcoded — it changes whenever the sim is recreated (rules/ios-simulators.md).
set -euo pipefail

SIM_NAME="${CHROMATICLY_SIM:-Chromaticly Dogfood}"
DEV_URL="${DEV_URL:-exp://127.0.0.1:48090}"
# Per-flow wall-clock cap. A wedged Maestro never exits on its own (see below),
# so without this one bad flow blocks the whole sweep indefinitely.
FLOW_TIMEOUT="${FLOW_TIMEOUT:-600}"

UDID=$(xcrun simctl list devices -j | jq -r \
  --arg n "$SIM_NAME" '.devices[][] | select(.name==$n) | .udid' | head -1)

if [ -z "$UDID" ]; then
  echo "e2e: simulator \"$SIM_NAME\" not found. Create it or set CHROMATICLY_SIM." >&2
  exit 1
fi

# Booting an already-booted sim is a harmless no-op; never shut down or reset it, and
# never touch another app's sim (rules/ios-simulators.md).
xcrun simctl boot "$UDID" 2>/dev/null || true

# Maestro hangs FOREVER at startup on any machine with Flutter installed: building its
# analytics payload calls EnvUtils.getFlutterVersionAndChannel, which shells out to
# `flutter --version` and blocks reading its pipe. It happens before the CLI parses
# argv, so even `maestro --version` produces nothing — no output, no error, no timeout.
# It reads as a broken simulator or a wedged E2E setup; it is neither, and the analytics
# opt-out env vars do not help (the probe runs before they are read). Verified by jstack
# on the stuck JVM (maestro 2.6.1). Shadow flutter with a no-op just for this run — the
# stub dir is stable rather than mktemp'd because `exec` below discards any EXIT trap.
if command -v flutter >/dev/null 2>&1; then
  STUB_DIR="${TMPDIR:-/tmp}/chromaticly-maestro-stub"
  mkdir -p "$STUB_DIR"
  printf '#!/bin/sh\nexit 0\n' > "$STUB_DIR/flutter"
  chmod +x "$STUB_DIR/flutter"
  export PATH="$STUB_DIR:$PATH"
fi

# Expand a bare `.maestro` argument to the TRACKED flows only (G6 U1). `maestro
# test .maestro` runs whatever the directory happens to contain, and a working
# tree can hold untracked `_capture-*.yaml` capture harnesses that require -e
# variables the suite never sets. Those are scratch tooling, not tests: leaving
# them in the sweep makes "the full E2E gate is green" a statement that depends on
# who last ran a screenshot capture. Explicit paths are passed through untouched.
if [ "$#" -eq 1 ] && [ -d "$1" ]; then
  DIR="${1%/}"
  # shellcheck disable=SC2207  # flow paths never contain whitespace
  FLOWS=($(git ls-files "$DIR/*.yaml" | grep -v "/_"))
  if [ "${#FLOWS[@]}" -eq 0 ]; then
    echo "e2e: no tracked flows under $DIR" >&2
    exit 1
  fi
else
  FLOWS=("$@")
fi

# ONE FLOW PER INVOCATION, deliberately — and for explicit paths too, since
# `npm run e2e:interactions` passes four of them.
#
# `maestro test a.yaml b.yaml` runs them CONCURRENTLY against the one simulator,
# and every flow starts with `clearState`, so they wipe each other's state mid-run
# and fail together at roughly the same elapsed time. That identical timing is
# what made this read as a Maestro bug rather than as our own batching
# (chromaticly-q6b). Measured 2026-08-06: grade1-rests fails at 1m52s inside the
# batch and passes alone.
# BOUND EVERY FLOW. Maestro can lose the app mid-flow — kill the Metro server, or
# let the simulator drop the process, and XCUITest starts returning
# `kAXErrorInvalidUIElement`. Maestro's MAIN thread then throws, but a non-daemon
# thread keeps the JVM alive, so the process never exits and never reports.
# Measured 2026-08-06: that wedged one sweep for nine hours on flow 16 of 51.
# `timeout` is GNU coreutils; fall back to running unbounded rather than refusing
# to run at all, but say so, because an unbounded sweep can hang.
if command -v timeout >/dev/null 2>&1; then
  BOUND=(timeout --kill-after=30 "$FLOW_TIMEOUT")
elif command -v gtimeout >/dev/null 2>&1; then
  BOUND=(gtimeout --kill-after=30 "$FLOW_TIMEOUT")
else
  BOUND=()
  echo "e2e: no timeout(1) — flows run UNBOUNDED and a wedged one will hang the sweep" >&2
fi

run_flow() {
  "${BOUND[@]}" maestro --device "$UDID" test -e "DEV_URL=$DEV_URL" "$1"
}

if [ "${#FLOWS[@]}" -eq 1 ]; then
  # `|| rc=$?` throughout: `set -e` would otherwise abort the sweep on the first
  # failing flow, before the tally that names which ones failed.
  rc=0
  run_flow "${FLOWS[0]}" || rc=$?
  exit "$rc"
fi

echo "e2e: ${#FLOWS[@]} flows, one at a time, ${FLOW_TIMEOUT}s each"
failed=()
for flow in "${FLOWS[@]}"; do
  echo "e2e: --- $flow"
  rc=0
  run_flow "$flow" || rc=$?
  # 124 is timeout(1)'s own code: the flow did not finish, which is not the same
  # as failing an assertion and is worth saying differently.
  if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
    echo "e2e: TIMED OUT after ${FLOW_TIMEOUT}s — $flow" >&2
    failed+=("$flow (timed out)")
  elif [ "$rc" -ne 0 ]; then
    failed+=("$flow")
  fi
done

if [ "${#failed[@]}" -gt 0 ]; then
  echo "e2e: ${#failed[@]} of ${#FLOWS[@]} flows FAILED:" >&2
  printf '  %s\n' "${failed[@]}" >&2
  exit 1
fi
echo "e2e: ${#FLOWS[@]} of ${#FLOWS[@]} flows passed"
