/** Windows-only identity values (shared ones live in @sonion/companion-core). */

/** Registry value name for "Start with Windows" (HKCU\Software\Microsoft\Windows\CurrentVersion\Run). Must match installer.nsh. */
export const AUTOSTART_NAME = "SonionCompanion";

/** The electron-builder portable target sets this to the path of the portable .exe. */
export function portableExecutablePath(): string | undefined {
  return process.env.PORTABLE_EXECUTABLE_FILE || undefined;
}

export function isPortable(): boolean {
  return portableExecutablePath() !== undefined;
}
