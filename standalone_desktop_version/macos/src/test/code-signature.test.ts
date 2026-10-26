import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { appBundlePath, isDeveloperIdSigned } from "../code-signature";

describe("isDeveloperIdSigned", () => {
  test("Developer ID release build", () => {
    const output = [
      "Executable=/Applications/Sonion Companion.app/Contents/MacOS/Sonion Companion",
      "Identifier=com.sonion.companion",
      "Authority=Developer ID Application: Rouxxel (ABCDE12345)",
      "Authority=Developer ID Certification Authority",
      "Authority=Apple Root CA",
      "TeamIdentifier=ABCDE12345",
      "Runtime Version=14.0.0"
    ].join("\n");
    assert.equal(isDeveloperIdSigned(output), true);
  });

  test("ad-hoc development build", () => {
    assert.equal(isDeveloperIdSigned("Identifier=com.sonion.companion\nSignature=adhoc\nTeamIdentifier=not set"), false);
  });

  test("Apple Development certificate isn't enough", () => {
    assert.equal(isDeveloperIdSigned("Authority=Apple Development: someone (XYZ)"), false);
  });
});

describe("appBundlePath", () => {
  test("finds the .app from the executable path", () => {
    assert.equal(appBundlePath("/Applications/Sonion Companion.app/Contents/MacOS/Sonion Companion"), "/Applications/Sonion Companion.app");
  });

  test("source runs (electron binary inside node_modules) still resolve to Electron.app; others to undefined", () => {
    assert.equal(appBundlePath("/repo/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"), "/repo/node_modules/electron/dist/Electron.app");
    assert.equal(appBundlePath("/usr/local/bin/node"), undefined);
  });
});
