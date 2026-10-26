import { spawn } from "node:child_process";

/**
 * Deletes a folder once a process has exited. Used by "Delete all data…": the app's own data folder
 * can't be removed while it runs (Chromium keeps files in session-data open, especially on Windows),
 * so a detached helper waits for the app to quit and then removes it, retrying briefly while child
 * processes release their files. No Electron import, so it can be unit-tested.
 */

export interface RemovalCommand {
  command: string;
  args: string[];
}

/** PowerShell single-quoted string literal ('' escapes a quote). */
function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function removalCommand(folder: string, pid: number, platform: NodeJS.Platform): RemovalCommand {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error("Invalid process id.");
  if (platform === "win32") {
    const script = [
      `Wait-Process -Id ${pid} -ErrorAction SilentlyContinue`,
      `$path = ${psQuote(folder)}`,
      "for ($i = 0; $i -lt 20 -and (Test-Path -LiteralPath $path); $i++) {",
      "  Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue",
      "  if (Test-Path -LiteralPath $path) { Start-Sleep -Milliseconds 500 }",
      "}"
    ].join("\n");
    return { command: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", script] };
  }
  // POSIX: folder and pid are passed as positional parameters ($1, $2), never interpolated into the script.
  const script = [
    "while kill -0 \"$2\" 2>/dev/null; do sleep 0.2; done",
    "i=0",
    "while [ -e \"$1\" ] && [ $i -lt 20 ]; do rm -rf -- \"$1\"; [ -e \"$1\" ] && sleep 0.5; i=$((i+1)); done"
  ].join("\n");
  return { command: "/bin/sh", args: ["-c", script, "sonion-remove-data", folder, String(pid)] };
}

/** Starts the detached helper; it keeps running after this process exits. */
export function removeFolderAfterExit(folder: string, pid = process.pid, platform: NodeJS.Platform = process.platform): void {
  const { command, args } = removalCommand(folder, pid, platform);
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}
