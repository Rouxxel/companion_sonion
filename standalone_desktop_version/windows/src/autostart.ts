import { app } from "electron";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { AUTOSTART_ARG, CompanionManager } from "@sonion/companion-core";
import { AUTOSTART_NAME, isPortable, portableExecutablePath } from "./windows-identity";
import { parseRegQueryValue, programFromCommandLine, startupApprovedEnabled } from "./startup-entry";

/**
 * "Start with Windows" via the per-user Run registry key
 * (HKCU\Software\Microsoft\Windows\CurrentVersion\Run\SonionCompanion).
 *
 * - Installed app: turned on once on its first launch; afterwards Windows is the source of truth,
 *   so turning it off here, in the tray or in Task Manager → Startup apps sticks.
 * - Portable app: opt-in only (the .exe may be moved; the registered path is the portable .exe).
 * - Dev runs (`npm start`): unavailable, it would register electron.exe.
 *
 * Writing uses app.setLoginItemSettings. Reading uses reg.exe because Electron's
 * getLoginItemSettings only finds entries named after the AppUserModelID and does not
 * report entries disabled in Task Manager reliably.
 */

const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const STARTUP_APPROVED_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run";

export function autostartAvailable(): boolean {
  return app.isPackaged && process.platform === "win32";
}

function executable(): string {
  return portableExecutablePath() ?? process.execPath;
}

/** Returns the data of a registry value, or undefined if it doesn't exist. */
function readRegistryValue(key: string, name: string): string | undefined {
  try {
    const output = execFileSync("reg", ["query", key, "/v", name], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    return parseRegQueryValue(output, name);
  } catch {
    return undefined; // reg.exe exits with 1 when the value is missing
  }
}

export function isStartWithWindowsEnabled(): boolean {
  if (!autostartAvailable()) return false;
  const commandLine = readRegistryValue(RUN_KEY, AUTOSTART_NAME);
  if (!commandLine) return false;
  const registered = path.resolve(programFromCommandLine(commandLine)).toLowerCase();
  if (registered !== path.resolve(executable()).toLowerCase()) return false;
  return startupApprovedEnabled(readRegistryValue(STARTUP_APPROVED_KEY, AUTOSTART_NAME));
}

export function setStartWithWindows(enabled: boolean): boolean {
  if (!autostartAvailable()) throw new Error("Start with Windows is only available in the installed app.");
  app.setLoginItemSettings({ openAtLogin: enabled, name: AUTOSTART_NAME, path: executable(), args: [AUTOSTART_ARG] });
  if (enabled) {
    // Turning it on here must also undo an earlier "Disabled" from Task Manager, or Windows would still skip it.
    try {
      execFileSync("reg", ["delete", STARTUP_APPROVED_KEY, "/v", AUTOSTART_NAME, "/f"], { windowsHide: true, stdio: "ignore" });
    } catch {
      // No Task Manager entry: nothing to undo.
    }
  }
  return isStartWithWindowsEnabled();
}

/** Applies the first-run default and syncs the saved setting with Windows' current state. */
export function initializeAutostart(manager: CompanionManager): void {
  if (!autostartAvailable()) {
    manager.updateSettings({ startWithWindows: false });
    return;
  }
  const settings = manager.snapshot().settings;
  if (!settings.autostartInitialized && !isPortable()) {
    setStartWithWindows(true);
    manager.updateSettings({ autostartInitialized: true });
  }
  manager.updateSettings({ startWithWindows: isStartWithWindowsEnabled() });
}
