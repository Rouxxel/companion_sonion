/** Identity shared by every desktop build (Windows, macOS, Linux). */

/** Must match `build.appId` in each app's package.json (Windows: AppUserModelID; macOS: bundle id). */
export const APP_ID = "com.sonion.companion";

export const PRODUCT_NAME = "Sonion Companion";

/** Command-line flag passed when the OS starts the app at login (Windows Run key, Linux XDG autostart). */
export const AUTOSTART_ARG = "--autostart";

export function launchedAtLogin(argv: readonly string[] = process.argv): boolean {
  return argv.includes(AUTOSTART_ARG);
}
