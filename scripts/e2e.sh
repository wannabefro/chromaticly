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

exec maestro --device "$UDID" test -e "DEV_URL=$DEV_URL" "$@"
