// Guard for `npm run package:signed`: a release build must be Developer ID–signed and notarized.
// Fails early with a clear message instead of producing an unsigned or un-notarized .dmg.
// Never prints secret values.
const env = process.env;
const has = (name) => typeof env[name] === "string" && env[name].trim() !== "";
const problems = [];

if (process.platform !== "darwin") problems.push("Signed macOS builds must run on macOS (use the GitHub Actions workflow).");

// Signing: a .p12 via CSC_LINK (+ CSC_KEY_PASSWORD), or a Developer ID identity already in the keychain (CSC_NAME optional).
if (has("CSC_LINK") && !has("CSC_KEY_PASSWORD")) problems.push("CSC_LINK is set but CSC_KEY_PASSWORD is missing.");
if (!has("CSC_LINK")) console.log("check-signing-env: CSC_LINK not set, using a Developer ID Application identity from the keychain.");

// Notarization: one complete credential set (same rules as electron-builder).
const apiKey = ["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"];
const appleId = ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"];
const complete = (names) => names.every(has);
const partial = (names) => names.some(has) && !complete(names);
if (partial(apiKey)) problems.push(`Incomplete App Store Connect API key: set all of ${apiKey.join(", ")}.`);
if (partial(appleId)) problems.push(`Incomplete Apple ID credentials: set all of ${appleId.join(", ")}.`);
if (!complete(apiKey) && !complete(appleId) && !has("APPLE_KEYCHAIN_PROFILE")) {
  problems.push(`No notarization credentials: set ${apiKey.join(", ")} (recommended; APPLE_API_KEY is the path to the .p8 file), or ${appleId.join(", ")}, or APPLE_KEYCHAIN_PROFILE.`);
}

if (problems.length) {
  console.error("Signed macOS build not possible:\n- " + problems.join("\n- "));
  console.error("For an unsigned development build use `npm run package` instead.");
  process.exit(1);
}
console.log("check-signing-env: signing and notarization credentials present.");
