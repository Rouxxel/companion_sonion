#!/bin/sh
# Verifies a built macOS app: signature, Gatekeeper assessment and (for release builds) the stapled
# notarization ticket. Usage: scripts/verify-signature.sh "release/mac-arm64/Sonion Companion.app" [--release]
set -eu
APP="$1"
MODE="${2:-}"

echo "== codesign"
codesign --verify --deep --strict --verbose=2 "$APP"
codesign --display --verbose=2 "$APP" 2>&1 | grep -E "^(Authority|TeamIdentifier|Signature|Runtime Version|Identifier)=" || true
/usr/libexec/PlistBuddy -c "Print :LSUIElement" "$APP/Contents/Info.plist" | grep -q true && echo "LSUIElement: true"

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
