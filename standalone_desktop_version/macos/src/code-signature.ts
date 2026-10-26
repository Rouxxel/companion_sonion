import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Whether the running app bundle is signed with a Developer ID certificate. Squirrel.Mac (used by
 * electron-updater on macOS) only installs updates into a Developer ID–signed app, so ad-hoc
 * development builds keep "Check for Updates…" disabled instead of failing halfway.
 */

/** Parses `codesign --display --verbose=2` output (written to stderr). */
export function isDeveloperIdSigned(codesignOutput: string): boolean {
  return /^Authority=Developer ID Application:/m.test(codesignOutput);
}

/** `/Applications/Sonion Companion.app` from `…/Sonion Companion.app/Contents/MacOS/Sonion Companion`. */
export function appBundlePath(execPath: string): string | undefined {
  const marker = ".app/Contents/MacOS/";
  const index = execPath.indexOf(marker);
  return index < 0 ? undefined : execPath.slice(0, index + ".app".length);
}

let cached: boolean | undefined;

export function runningAppIsDeveloperIdSigned(execPath = process.execPath): boolean {
  if (cached !== undefined) return cached;
  const bundle = appBundlePath(execPath);
  if (!bundle) return (cached = false);
  // codesign prints the details to stderr (even on success); read both streams.
  const result = spawnSync("/usr/bin/codesign", ["--display", "--verbose=2", path.resolve(bundle)], { encoding: "utf8" });
  cached = result.status === 0 && isDeveloperIdSigned(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  return cached;
}
