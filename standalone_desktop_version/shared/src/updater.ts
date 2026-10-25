import { app, dialog } from "electron";
import { autoUpdater, UpdateInfo } from "electron-updater";
import { PRODUCT_NAME } from "./app-identity";

/**
 * Manual updates ("Check for updates…" in the tray and Settings). Nothing runs in the background:
 * the app only contacts the update server when the user asks.
 *
 * The feed is configured in package.json → build.publish (generic provider), i.e. the assets of the
 * GitHub release tagged `desktop-latest`: the platform's channel file (latest.yml / latest-mac.yml /
 * latest-linux.yml) plus the installer files it lists. A fixed tag is used because the repository
 * also publishes VS Code extension releases. Whether this build can update itself is decided by the
 * platform adapter (e.g. installed app only, not portable or source runs).
 */

let busy = false;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = console;

async function ask(message: string, detail: string, buttons: string[]): Promise<number> {
  const { response } = await dialog.showMessageBox({ type: "info", title: PRODUCT_NAME, message, detail, buttons, defaultId: 0, cancelId: buttons.length - 1, noLink: true });
  return response;
}

function friendlyError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/\b404\b|Cannot find latest\.yml|HttpError: 404/i.test(text)) return "No update has been published yet.";
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|net::ERR_/i.test(text)) return "Couldn't reach the update server. Check your internet connection and try again.";
  return text.split("\n")[0];
}

/** Checks for an update; offers to download it, then to restart now or install when the app quits. */
export async function checkForUpdates(available: boolean): Promise<void> {
  if (!available) {
    await ask("Updates are only available in the installed app.", "Install Sonion Companion with its installer, or download the newest version manually.", ["OK"]);
    return;
  }
  if (busy) return;
  busy = true;
  try {
    const result = await autoUpdater.checkForUpdates();
    const info: UpdateInfo | undefined = result?.updateInfo;
    if (!result?.isUpdateAvailable || !info) {
      await ask("You're up to date.", `Sonion Companion ${app.getVersion()} is the newest version.`, ["OK"]);
      return;
    }
    const download = await ask(`Version ${info.version} is available.`, `You have ${app.getVersion()}. Download it now? (about ${Math.round((info.files[0]?.size ?? 0) / 1_048_576) || "?"} MB)`, ["Download", "Not now"]);
    if (download !== 0) return;

    await autoUpdater.downloadUpdate();
    const restart = await ask(`Version ${info.version} is ready to install.`, "Restart now to update, or it installs automatically the next time you quit Sonion Companion. Your companions and settings are kept.", ["Restart now", "Later"]);
    // isSilent: no installer pages; isForceRunAfter: start the updated app again.
    if (restart === 0) setImmediate(() => autoUpdater.quitAndInstall(true, true));
  } catch (error) {
    await dialog.showMessageBox({ type: "warning", title: PRODUCT_NAME, message: "Couldn't check for updates.", detail: friendlyError(error), noLink: true });
  } finally {
    busy = false;
  }
}
