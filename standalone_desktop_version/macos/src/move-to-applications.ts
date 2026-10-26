import { app, dialog } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PRODUCT_NAME } from "@sonion/companion-core";
import { shouldOfferMove } from "./login-item-state";

/** macOS-only preference, kept out of companions.json: the user chose "Don't Ask Again". */
const preferencesFile = () => path.join(app.getPath("userData"), "macos-preferences.json");

function declined(): boolean {
  try {
    return existsSync(preferencesFile()) && JSON.parse(readFileSync(preferencesFile(), "utf8")).moveToApplicationsDeclined === true;
  } catch {
    return false;
  }
}

function rememberDeclined(): void {
  writeFileSync(preferencesFile(), `${JSON.stringify({ moveToApplicationsDeclined: true }, null, 2)}\n`, "utf8");
}

/**
 * Offers to move the app into /Applications when it runs from somewhere else (the DMG, Downloads).
 * Open at Login and updates only work from /Applications. On success Electron relaunches the moved app.
 */
export async function offerMoveToApplications(): Promise<void> {
  if (!shouldOfferMove({ packaged: app.isPackaged, inApplications: app.isInApplicationsFolder(), declined: declined() })) return;
  app.focus({ steal: true });
  const { response } = await dialog.showMessageBox({
    type: "question", title: PRODUCT_NAME, noLink: true,
    buttons: ["Move to Applications", "Not Now", "Don't Ask Again"], defaultId: 0, cancelId: 1,
    message: `Move ${PRODUCT_NAME} to the Applications folder?`,
    detail: "It needs to be in Applications to open at login and to update itself. Your companions are kept."
  });
  if (response === 2) return rememberDeclined();
  if (response !== 0) return;
  try {
    // "exists": an older copy is in /Applications → replace it. "existsAndRunning" can't happen while this
    // copy runs (single instance), but never replace a running app.
    app.moveToApplicationsFolder({ conflictHandler: (conflict) => conflict === "exists" });
  } catch (error) {
    await dialog.showMessageBox({
      type: "warning", title: PRODUCT_NAME, noLink: true,
      message: "Couldn't move the app to Applications.",
      detail: `${error instanceof Error ? error.message : String(error)}\n\nDrag Sonion Companion into the Applications folder in Finder instead.`
    });
  }
}
