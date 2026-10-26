#!/bin/sh
# Verifies a built macOS app: universal binary, signature, Gatekeeper assessment and (for release
# builds) the stapled notarization ticket.
# Usage: scripts/verify-signature.sh "release/mac-universal/Sonion Companion.app" [--release]
set -eu
APP="$1"
MODE="${2:-}"
BINARY="$APP/Contents/MacOS/Sonion Companion"

echo "== architectures"
ARCHS="$(lipo -archs "$BINARY")"
echo "$ARCHS"
case "$ARCHS" in *arm64*) ;; *) echo "Missing arm64 slice"; exit 1 ;; esac
case "$ARCHS" in *x86_64*) ;; *) echo "Missing x86_64 slice"; exit 1 ;; esac

echo "== codesign"
codesign --verify --deep --strict --verbose=2 "$APP"
codesign --display --verbose=2 "$APP" 2>&1 | grep -E "^(Authority|TeamIdentifier|Signature|Runtime Version|Identifier)=" || true
if /usr/libexec/PlistBuddy -c "Print :LSUIElement" "$APP/Contents/Info.plist" >/dev/null 2>&1; then
  echo "LSUIElement is set, but the app should show a Dock icon"; exit 1
fi
echo "Dock icon: shown (no LSUIElement)"

if [ "$MODE" = "--release" ]; then
  echo "== Gatekeeper"
  spctl --assess --type execute --verbose=4 "$APP"
  echo "== notarization ticket"
  xcrun stapler validate "$APP"
  codesign --display --verbose=2 "$APP" 2>&1 | grep -q "Authority=Developer ID Application" || { echo "Not signed with a Developer ID Application certificate"; exit 1; }
  echo "Release checks passed."
else
  echo "(development build: ad-hoc signed; Gatekeeper and notarization checks skipped)"
fi
