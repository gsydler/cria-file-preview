#!/bin/sh
# Renders assets/banner.html to preview.png (1600 x 800) with a headless Chromium browser.
# Set BROWSER to the browser's binary when it isn't found.
set -eu
cd "$(dirname "$0")/.."

for b in "${BROWSER:-}" \
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "$(command -v chromium || true)" "$(command -v google-chrome || true)"; do
  [ -n "$b" ] && [ -x "$b" ] && break
done
[ -n "$b" ] && [ -x "$b" ] || { echo "No Chromium browser found: set BROWSER" >&2; exit 1; }

# A profile of its own, so the person's browser is never touched. It is kept between runs:
# the first run of a new profile can hang, so a render gets 30 seconds and one retry.
profile="${XDG_CACHE_HOME:-$HOME/.cache}/cria-file-preview/banner-browser"
mkdir -p "$profile"
out="$PWD/preview.png"

render() {
  "$b" --headless --disable-gpu --allow-file-access-from-files --hide-scrollbars --no-first-run \
    --user-data-dir="$profile" --force-device-scale-factor=1.25 --window-size=1280,640 \
    --virtual-time-budget=5000 --screenshot="$out" "file://$PWD/assets/banner.html" >/dev/null 2>&1 &
  pid=$!
  ( sleep 30; kill "$pid" 2>/dev/null ) &
  watchdog=$!
  wait "$pid" 2>/dev/null && ok=0 || ok=1
  kill "$watchdog" 2>/dev/null || true
  wait "$watchdog" 2>/dev/null || true
  return $ok
}

rm -f "$out"
# Before the retry, give the killed browser's helpers time to quit and release the profile.
render || [ -s "$out" ] || { sleep 3; render; } || { echo "The browser didn't render the banner" >&2; exit 1; }
[ -s "$out" ] || { echo "The browser exited without writing preview.png" >&2; exit 1; }
echo "preview.png: $(wc -c < "$out" | tr -d ' ') bytes"
