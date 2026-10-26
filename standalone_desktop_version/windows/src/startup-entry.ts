/** Pure helpers for the Windows "Start with Windows" registry entries (no Electron import, unit-tested). */

/** Program path of a Run command line: `"C:\path\app.exe" --arg` or `C:\path\app.exe --arg`. */
export function programFromCommandLine(commandLine: string): string {
  const trimmed = commandLine.trim();
  if (trimmed.startsWith("\"")) {
    const end = trimmed.indexOf("\"", 1);
    return end > 0 ? trimmed.slice(1, end) : trimmed.slice(1);
  }
  const exeEnd = trimmed.toLowerCase().indexOf(".exe");
  return exeEnd >= 0 ? trimmed.slice(0, exeEnd + 4) : trimmed.split(" ")[0];
}

/**
 * Task Manager → Startup apps stores enabled/disabled as REG_BINARY in StartupApproved\Run:
 * the first byte is even (02, 06) when enabled and odd (03, 07) when disabled. No value = enabled.
 */
export function startupApprovedEnabled(binaryHex: string | undefined): boolean {
  if (!binaryHex) return true;
  const firstByte = Number.parseInt(binaryHex.slice(0, 2), 16);
  return Number.isNaN(firstByte) || firstByte % 2 === 0;
}

/** Data of `name` from `reg.exe query <key> /v <name>` output, or undefined if it isn't there. */
export function parseRegQueryValue(output: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = output.match(new RegExp(`^\\s*${escaped}\\s+REG_\\w+\\s*(.*)$`, "m"));
  return match ? match[1].trim() : undefined;
}
