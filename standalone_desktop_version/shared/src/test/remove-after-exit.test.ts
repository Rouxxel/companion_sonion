import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { removalCommand } from "../remove-after-exit";

describe("removalCommand", () => {
  test("Windows: waits for the process, quotes the path for PowerShell", () => {
    const { command, args } = removalCommand("C:\\Users\\O'Brien\\AppData\\Roaming\\Sonion Companion", 1234, "win32");
    assert.equal(command, "powershell.exe");
    const script = args[args.length - 1];
    assert.match(script, /Wait-Process -Id 1234 /);
    assert.match(script, /\$path = 'C:\\Users\\O''Brien\\AppData\\Roaming\\Sonion Companion'/);
  });

  test("POSIX: folder and pid are positional arguments, not part of the script", () => {
    const folder = "/Users/me/Library/Application Support/Sonion Companion\"; rm -rf ~ #";
    const { command, args } = removalCommand(folder, 42, "darwin");
    assert.equal(command, "/bin/sh");
    assert.equal(args[0], "-c");
    assert.ok(!args[1].includes(folder), "the path never appears inside the script");
    assert.deepEqual(args.slice(3), [folder, "42"]);
  });

  test("rejects invalid process ids", () => {
    assert.throws(() => removalCommand("/tmp/x", 0, "linux"), /Invalid process id/);
    assert.throws(() => removalCommand("/tmp/x", 1.5, "win32"), /Invalid process id/);
  });
});

describe("removing a folder after a process exits (real run on this OS)", () => {
  test("the folder survives while the process runs and is gone after it exits", { timeout: 30_000 }, async () => {
    const folder = mkdtempSync(path.join(tmpdir(), "sonion remove "));
    mkdirSync(path.join(folder, "session-data"));
    writeFileSync(path.join(folder, "companions.json"), "{}");
    // Stand-in for the app: a process that lives ~2 s
    const app = spawn(process.execPath, ["-e", "setTimeout(() => {}, 2000)"], { stdio: "ignore" });
    try {
      const { command, args } = removalCommand(folder, app.pid!, process.platform);
      const helper = spawn(command, args, { stdio: "ignore", windowsHide: true });
      await new Promise((resolve) => setTimeout(resolve, 800));
      assert.ok(existsSync(folder), "not removed while the process is still running");
      await new Promise((resolve) => helper.on("exit", resolve));
      assert.equal(existsSync(folder), false, "removed after the process exited");
    } finally {
      app.kill();
      if (existsSync(folder)) rmSync(folder, { recursive: true, force: true });
    }
  });
});
