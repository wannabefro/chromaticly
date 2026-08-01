#!/usr/bin/env bash
# Screenshot one lesson's teach and exercise screens.
#   PORT=48090 scripts/capture-lesson.sh <lesson-id> <out-dir>
set -uo pipefail
LESSON="$1"; OUT="$2"; PORT="${PORT:-48090}"; FLOW="${FLOW:-.maestro/_capture-open.yaml}"
# Most ids end in their grade; GRADE overrides for the grade-1 ones that do not.
GRADE="${GRADE:-${LESSON##*-}}"
UDID=$(xcrun simctl list devices | grep -i "Chromaticly Dogfood" | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/' | head -1)
[ -n "$UDID" ] || { echo "no Chromaticly Dogfood simulator"; exit 1; }
curl -fsS "http://127.0.0.1:${PORT}/status" -o /dev/null || { echo "metro not serving on ${PORT}"; exit 1; }
xcrun simctl terminate "$UDID" host.exp.Exponent 2>/dev/null
sleep 1
xcrun simctl openurl "$UDID" "exp://127.0.0.1:${PORT}/--/?seed=${LESSON}" >/dev/null
sleep 12

# Maestro hangs forever at startup when flutter is on PATH; see scripts/e2e.sh.
if command -v flutter >/dev/null 2>&1; then
  STUB_DIR="${TMPDIR:-/tmp}/chromaticly-maestro-stub"
  mkdir -p "$STUB_DIR"
  printf '#!/bin/sh\nexit 0\n' > "$STUB_DIR/flutter"
  chmod +x "$STUB_DIR/flutter"
  export PATH="$STUB_DIR:$PATH"
fi

maestro --device "$UDID" test -e "LESSON=${LESSON}" -e "GRADE=${GRADE}" -e "OUT=${OUT}" -e "ANSWER=${ANSWER:-option-0}" -e "ANSWER_B=${ANSWER_B:-__none__}" -e "ANSWER_C=${ANSWER_C:-__none__}" "$FLOW"
