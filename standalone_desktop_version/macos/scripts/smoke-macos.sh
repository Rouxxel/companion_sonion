#!/bin/bash
# Installer round trip for Sonion Companion on macOS (meant for CI runners or a test Mac):
# mount the .dmg -> copy the app to /Applications -> verify the signature -> first launch
# (Open at Login turned on, no Dock icon) -> opening it again keeps one process -> quit ->
# uninstall (data kept).
#
# Usage: scripts/smoke-macos.sh <SonionCompanion-<version>-<arch>.dmg> [--release]
#   --release        also require Developer ID signature, Gatekeeper acceptance and a notarization ticket
#   FORCE=1          replace an existing /Applications/Sonion Companion.app (it is removed at the end)
#   SCREENSHOT_DIR   if set, screenshots are saved there
#
# Touches the real user account: /Applications, the login item and
# ~/Library/Application Support/Sonion Companion (moved aside first and restored at the end).
set -u

DMG="${1:?usage: smoke-macos.sh <dmg> [--release]}"
MODE="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Sonion Companion.app"
APP="/Applications/$APP_NAME"
DATA="$HOME/Library/Application Support/Sonion Companion"
BACKUP=""
MOUNT="$(mktemp -d /tmp/sonion-dmg.XXXXXX)"
FAILURES=0
INSTALLED=0

check() { # check "<description>" <command...>
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "PASS $name"; else echo "FAIL $name"; FAILURES=$((FAILURES + 1)); fi
}
main_processes() { pgrep -f "$APP_NAME/Contents/MacOS/Sonion Companion$" | wc -l | tr -d ' '; }
stop_app() { pkill -TERM -f "$APP_NAME/Contents/MacOS" 2>/dev/null; for _ in 1 2 3 4 5 6 7 8 9 10; do [ "$(main_processes)" = "0" ] && return; sleep 0.5; done; pkill -KILL -f "$APP_NAME/Contents/MacOS" 2>/dev/null; }
setting() { node -e "const s=require(process.argv[1]).settings; console.log(String(s[process.argv[2]]))" "$DATA/companions.json" "$1" 2>/dev/null; }
shot() { [ -n "${SCREENSHOT_DIR:-}" ] && mkdir -p "$SCREENSHOT_DIR" && screencapture -x "$SCREENSHOT_DIR/$1" 2>/dev/null; return 0; }

cleanup() {
  stop_app
  hdiutil detach "$MOUNT" -quiet 2>/dev/null; rmdir "$MOUNT" 2>/dev/null
  [ "$INSTALLED" = "1" ] && rm -rf "$APP"
  if [ -n "$BACKUP" ]; then rm -rf "$DATA"; mv "$BACKUP" "$DATA"; echo "Restored your data folder"; fi
}
trap cleanup EXIT

if [ -d "$APP" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "Sonion Companion is already installed in /Applications. Set FORCE=1 to replace it (it will be removed at the end)."
  exit 2
fi
if [ -d "$DATA" ]; then BACKUP="$DATA.smoke-backup.$$"; mv "$DATA" "$BACKUP"; echo "Moved your data folder aside: $BACKUP"; fi

echo "== Disk image ($DMG)"
check "disk image mounts" hdiutil attach "$DMG" -nobrowse -readonly -mountpoint "$MOUNT"
check "contains $APP_NAME" test -d "$MOUNT/$APP_NAME"
check "contains the Applications shortcut" test -L "$MOUNT/Applications"

echo "== Install"
stop_app
rm -rf "$APP"
INSTALLED=1
check "copied to /Applications" ditto "$MOUNT/$APP_NAME" "$APP"
hdiutil detach "$MOUNT" -quiet 2>/dev/null
check "signature valid${MODE:+ ($MODE)}" sh "$SCRIPT_DIR/verify-signature.sh" "$APP" $MODE
check "LSUIElement (no Dock icon) set" /usr/libexec/PlistBuddy -c "Print :LSUIElement" "$APP/Contents/Info.plist"

echo "== First launch"
"$APP/Contents/MacOS/Sonion Companion" >/tmp/sonion-smoke.log 2>&1 &
sleep 20
shot "1-first-launch.png"
check "app is running (one main process)" test "$(main_processes)" = "1"
check "data folder created" test -f "$DATA/companions.json"
check "Open at Login turned on at first launch (startWithWindows=$(setting startWithWindows))" test "$(setting startWithWindows)" = "true"
check "first-run flag recorded (autostartInitialized=$(setting autostartInitialized))" test "$(setting autostartInitialized)" = "true"
if command -v lsappinfo >/dev/null; then
  check "runs as a menu-bar app (UIElement)" sh -c "lsappinfo info -only ApplicationType 'Sonion Companion' | grep -q UIElement"
fi
if sudo -n true 2>/dev/null; then
  check "login item registered (sfltool)" sh -c "sudo -n sfltool dumpbtm 2>/dev/null | grep -q com.sonion.companion"
fi

echo "== Open it again"
open -n "$APP"
sleep 10
shot "2-opened-again.png"
check "still one main process" test "$(main_processes)" = "1"

echo "== Quit and uninstall"
stop_app
check "quit" test "$(main_processes)" = "0"
rm -rf "$APP"; INSTALLED=0
check "app removed" test ! -d "$APP"
check "user data kept after uninstall" test -f "$DATA/companions.json"

echo
if [ "$FAILURES" = "0" ]; then echo "All checks passed."; else echo "$FAILURES check(s) failed."; fi
exit "$FAILURES"
