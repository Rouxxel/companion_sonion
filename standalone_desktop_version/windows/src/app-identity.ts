/** Identity shared by the app, its installer shortcuts and the autostart entry. */

/** Must match `build.appId` in package.json (installer shortcuts use it as their AppUserModelID). */
export const APP_ID = "com.sonion.companion";

export const PRODUCT_NAME = "Sonion Companion";

/** Registry value name for "Start with Windows" (HKCU\Software\Microsoft\Windows\CurrentVersion\Run). */
export const AUTOSTART_NAME = "SonionCompanion";

/** Command-line flag passed when Windows starts the app at login. */
export const AUTOSTART_ARG = "--autostart";

/** The electron-builder portable target sets this to the path of the portable .exe. */
export function portableExecutablePath(): string | undefined {
  return process.env.PORTABLE_EXECUTABLE_FILE || undefined;
}

export function isPortable(): boolean {
  return portableExecutablePath() !== undefined;
}

export function launchedAtLogin(argv: readonly string[] = process.argv): boolean {
  return argv.includes(AUTOSTART_ARG);
}
