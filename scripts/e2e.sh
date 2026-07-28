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
DEV_URL="${DEV_URL:-exp://127.0.0.1:8090}"

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
  echo "e2e: ${#FLOWS[@]} tracked flows"
  exec maestro --device "$UDID" test -e "DEV_URL=$DEV_URL" "${FLOWS[@]}"
fi

exec maestro --device "$UDID" test -e "DEV_URL=$DEV_URL" "$@"
