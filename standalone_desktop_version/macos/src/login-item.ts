import { app } from "electron";
import type { AutostartAdapter, CompanionManager } from "@sonion/companion-core";
import { loginItemState } from "./login-item-state";

/**
 * "Open at Login" via app.setLoginItemSettings (SMAppService on macOS 13+).
 * - Available only for the packaged app in /Applications (a login item pointing into a DMG or
 *   Downloads breaks when that copy goes away).
 * - First launch from /Applications turns it on once; afterwards macOS is the source of truth, so
 *   turning it off here or in System Settings → General → Login Items sticks.
 */

function available(): boolean {
  return app.isPackaged && app.isInApplicationsFolder();
}

function state() {
  const settings = app.getLoginItemSettings();
  return loginItemState({ openAtLogin: settings.openAtLogin, status: settings.status });
}

function isEnabled(): boolean {
  return available() && state().enabled;
}

function setEnabled(enabled: boolean): boolean {
  if (!available()) throw new Error("Open at Login needs the app in the Applications folder.");
  app.setLoginItemSettings({ openAtLogin: enabled });
  return isEnabled();
}

export const loginItem: AutostartAdapter = {
  label: "Open at Login",
  available,
  isEnabled,
  setEnabled,
  note: () => {
    if (!app.isPackaged) return "Only available in the installed app (not when running from source).";
    if (!app.isInApplicationsFolder()) return "Move Sonion Companion to the Applications folder to use this.";
    return state().note;
  },
  initialize(manager: CompanionManager) {
    if (!available()) {
      manager.updateSettings({ startWithWindows: false });
      return;
    }
    if (!manager.snapshot().settings.autostartInitialized) {
      setEnabled(true);
      manager.updateSettings({ autostartInitialized: true });
    }
    manager.updateSettings({ startWithWindows: isEnabled() });
  }
};
