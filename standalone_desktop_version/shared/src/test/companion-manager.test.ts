import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { CompanionManager, DEFAULT_SETTINGS, DEFAULT_SHORTCUTS, MACHINE_SETTINGS, WORLD_FORMAT, WORLD_VERSION } from "../companion-manager";

let dir: string;
const configPath = () => path.join(dir, "companions.json");
const writeConfig = (value: unknown) => writeFileSync(configPath(), typeof value === "string" ? value : JSON.stringify(value));
const readConfig = () => JSON.parse(readFileSync(configPath(), "utf8"));

beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), "sonion-manager-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

// companions.json as written by 0.1.0 (no shortcuts, startWithWindows, autostartInitialized or display)
const V010_CONFIG = {
  version: 1,
  companions: [
    { id: "a", x: 0.25, y: 0.75, size: 200, assetPath: "assets/sonion.jpeg", assetType: "bundled", locked: false, opacity: 1, zIndex: 1 },
    { id: "b", x: 0.9, y: 0.1, size: 120, assetPath: "https://example.com/cat.gif", assetType: "url", locked: true, opacity: 0.8, zIndex: 2 }
  ],
  settings: { alwaysOnTop: false, defaultSize: 180, minSize: 40, maxSize: 500, hoverOpacity: 0.5, maxCompanions: 25 },
  profiles: {
    work: { companions: [{ id: "w", x: 0, y: 0, size: 100, assetPath: "assets/sonion.jpeg", assetType: "bundled", locked: false, opacity: 1, zIndex: 1 }], settings: { alwaysOnTop: true, defaultSize: 150, minSize: 40, maxSize: 500, hoverOpacity: 0.3, maxCompanions: 10 }, updatedAt: "2026-01-01T00:00:00.000Z" }
  }
};

describe("CompanionManager — loading", () => {
  test("no file → defaults, nothing written until a change", () => {
    const manager = new CompanionManager(dir);
    assert.deepEqual(manager.list(), []);
    assert.deepEqual(manager.snapshot().settings, DEFAULT_SETTINGS);
    assert.equal(existsSync(configPath()), false);
  });

  test("0.1.0 config loads unchanged, new settings get defaults", () => {
    writeConfig(V010_CONFIG);
    const manager = new CompanionManager(dir);
    assert.deepEqual(manager.list(), V010_CONFIG.companions);
    const settings = manager.snapshot().settings;
    assert.equal(settings.alwaysOnTop, false);
    assert.equal(settings.hoverOpacity, 0.5);
    assert.deepEqual(settings.shortcuts, DEFAULT_SHORTCUTS);
    assert.equal(settings.startWithWindows, true);
    assert.equal(settings.autostartInitialized, false);
    assert.deepEqual(manager.listProfiles(), ["work"]);
  });

  test("a file saved with a UTF-8 byte-order mark (hand-edited) still loads", () => {
    writeConfig(`\uFEFF${JSON.stringify(V010_CONFIG)}`);
    assert.equal(new CompanionManager(dir).list().length, 2);
  });

  test("corrupt JSON → safe defaults, and the corrupt file survives the next save", () => {
    writeConfig("{ not json");
    const manager = new CompanionManager(dir);
    assert.deepEqual(manager.list(), []);
    assert.ok(manager.recoveredConfigPath, "the unreadable file was moved aside");
    manager.create(); // the app saves right after startup
    assert.equal(readFileSync(manager.recoveredConfigPath!, "utf8"), "{ not json");
    assert.match(path.basename(manager.recoveredConfigPath!), /^companions\.corrupt-.+\.json$/);
    assert.equal(readConfig().companions.length, 1);
  });

  test("out-of-range and invalid values are normalized", () => {
    writeConfig({
      companions: [
        { id: "x", x: -3, y: 9, size: 99999, assetType: "exe", locked: "yes", opacity: 0, zIndex: -5 },
        { id: "x", x: 0.5, y: 0.5, size: 100 },
        "not an object"
      ],
      settings: { minSize: 5, maxSize: 1, hoverOpacity: 7, maxCompanions: 1000, shortcuts: { enabled: "no", addCompanion: "", openSettings: "X".repeat(65) } }
    });
    const manager = new CompanionManager(dir);
    const [companion] = manager.list();
    assert.equal(manager.list().length, 1, "duplicate ids and non-objects are dropped");
    assert.deepEqual(
      { x: companion.x, y: companion.y, assetType: companion.assetType, assetPath: companion.assetPath, locked: companion.locked, opacity: companion.opacity, zIndex: companion.zIndex },
      { x: 0, y: 1, assetType: "bundled", assetPath: "assets/sonion.jpeg", locked: false, opacity: 0.05, zIndex: 0 }
    );
    const settings = manager.snapshot().settings;
    assert.equal(settings.minSize, 16);
    assert.equal(settings.maxSize, 16, "maxSize is never below minSize");
    assert.equal(companion.size, settings.maxSize, "size is clamped to the limits");
    assert.equal(settings.hoverOpacity, 1);
    assert.equal(settings.maxCompanions, 100);
    assert.deepEqual(settings.shortcuts, DEFAULT_SHORTCUTS);
  });

  test("a saved display is kept when valid and dropped when malformed", () => {
    writeConfig({ companions: [
      { id: "ok", x: 0.5, y: 0.5, size: 100, display: { id: 2, x: 1920, y: 0, width: 2560, height: 1440 } },
      { id: "bad", x: 0.5, y: 0.5, size: 100, display: { id: 2, x: 1920, y: 0, width: 0, height: "tall" } }
    ] });
    const manager = new CompanionManager(dir);
    assert.deepEqual(manager.get("ok")?.display, { id: 2, x: 1920, y: 0, width: 2560, height: 1440 });
    assert.equal(manager.get("bad")?.display, undefined);
  });
});

describe("CompanionManager — changes", () => {
  test("create / update / remove persist and reload", () => {
    const manager = new CompanionManager(dir);
    const created = manager.create({ size: 220 });
    manager.update(created.id, { locked: true, x: 0.1 });
    const second = manager.create();
    assert.ok(second.zIndex > created.zIndex, "new companions go on top");

    const reloaded = new CompanionManager(dir);
    assert.equal(reloaded.list().length, 2);
    assert.equal(reloaded.get(created.id)?.locked, true);
    assert.equal(reloaded.get(created.id)?.size, 220);

    assert.equal(reloaded.remove(second.id), true);
    assert.equal(reloaded.remove("missing"), false);
    assert.equal(new CompanionManager(dir).list().length, 1);
  });

  test("the companion limit throws a clear error", () => {
    const manager = new CompanionManager(dir);
    manager.updateSettings({ maxCompanions: 2 });
    manager.create(); manager.create();
    assert.throws(() => manager.create(), /Companion limit \(2\) reached/);
  });

  test("updating an unknown companion throws", () => {
    assert.throws(() => new CompanionManager(dir).update("nope", { x: 0 }), /Unknown companion/);
  });

  test("bringToFront gives the highest zIndex", () => {
    const manager = new CompanionManager(dir);
    const first = manager.create(); manager.create();
    assert.ok(manager.bringToFront(first.id).zIndex > Math.max(...manager.list().filter((c) => c.id !== first.id).map((c) => c.zIndex)));
  });

  test("after disablePersistence nothing is written (Delete all data)", () => {
    const manager = new CompanionManager(dir);
    manager.create();
    rmSync(configPath());
    manager.disablePersistence();
    manager.create();
    manager.updateSettings({ hoverOpacity: 0.5 });
    assert.equal(existsSync(configPath()), false);
  });

  test("saving is atomic: no temporary files are left behind", () => {
    const manager = new CompanionManager(dir);
    for (let i = 0; i < 5; i++) manager.create();
    assert.deepEqual(readdirSync(dir), ["companions.json"]);
    assert.equal(manager.recoveredConfigPath, undefined);
    assert.equal(readConfig().companions.length, 5);
  });
});

describe("CompanionManager — platform defaults", () => {
  const macShortcuts = { enabled: true, addCompanion: "Command+Alt+Shift+A", openSettings: "Command+Alt+Shift+S" };

  test("missing or invalid shortcuts fall back to the platform's defaults", () => {
    writeConfig({ settings: { shortcuts: { addCompanion: "" } } });
    const manager = new CompanionManager(dir, { defaults: { shortcuts: macShortcuts } });
    assert.deepEqual(manager.snapshot().settings.shortcuts, macShortcuts);
    assert.deepEqual(manager.updateSettings({ shortcuts: { enabled: true, addCompanion: "", openSettings: "x".repeat(65) } }).shortcuts, macShortcuts);
  });

  test("saved shortcuts win over platform defaults", () => {
    writeConfig({ settings: { shortcuts: { enabled: false, addCompanion: "Control+Alt+Shift+A", openSettings: "Control+Alt+Shift+S" } } });
    const manager = new CompanionManager(dir, { defaults: { shortcuts: macShortcuts } });
    assert.equal(manager.snapshot().settings.shortcuts.addCompanion, "Control+Alt+Shift+A");
    assert.equal(manager.snapshot().settings.shortcuts.enabled, false);
  });
});

describe("CompanionManager — idle sleep settings", () => {
  test("defaults on after 5 minutes; values are normalized", () => {
    const manager = new CompanionManager(dir);
    assert.deepEqual(manager.snapshot().settings.idleSleep, { enabled: true, minutes: 5 });
    assert.deepEqual(manager.updateSettings({ idleSleep: { enabled: false, minutes: 0.2 } }).idleSleep, { enabled: false, minutes: 1 });
    assert.deepEqual(manager.updateSettings({ idleSleep: { enabled: true, minutes: 999 } }).idleSleep, { enabled: true, minutes: 120 });
  });
});

describe("CompanionManager — export / import world", () => {
  test("export contains companions, layout settings and layouts, but no machine-level settings", () => {
    writeConfig(V010_CONFIG);
    const world = new CompanionManager(dir).exportWorld();
    assert.equal(world.format, WORLD_FORMAT);
    assert.equal(world.version, WORLD_VERSION);
    assert.equal(world.companions.length, 2);
    assert.deepEqual(Object.keys(world.profiles), ["work"]);
    assert.equal(world.settings.hoverOpacity, 0.5);
    for (const key of MACHINE_SETTINGS) assert.equal(key in world.settings, false, `${key} is not exported`);
  });

  test("import into another PC: replaces companions, merges layouts, keeps that PC's preferences", () => {
    writeConfig(V010_CONFIG);
    const world = JSON.parse(JSON.stringify(new CompanionManager(dir).exportWorld()));

    const otherDir = mkdtempSync(path.join(tmpdir(), "sonion-other-"));
    try {
      const other = new CompanionManager(otherDir);
      other.create();
      other.saveProfile("home");
      other.updateSettings({ startWithWindows: false, autostartInitialized: true, idleSleep: { enabled: false, minutes: 30 } });

      assert.deepEqual(other.importWorld(world), { companions: 2, skipped: 0, profiles: 1 });
      assert.deepEqual(other.list(), V010_CONFIG.companions);
      assert.deepEqual(other.listProfiles(), ["home", "work"]);
      const settings = other.snapshot().settings;
      assert.equal(settings.hoverOpacity, 0.5, "layout setting imported");
      assert.equal(settings.alwaysOnTop, false, "layout setting imported");
      assert.equal(settings.startWithWindows, false, "this PC's Start with Windows kept");
      assert.equal(settings.autostartInitialized, true);
      assert.deepEqual(settings.idleSleep, { enabled: false, minutes: 30 });
      assert.deepEqual(settings.shortcuts, DEFAULT_SHORTCUTS);
    } finally {
      rmSync(otherDir, { recursive: true, force: true });
    }
  });

  test("invalid companions in a world file are skipped and counted", () => {
    const manager = new CompanionManager(dir);
    const result = manager.importWorld({ format: WORLD_FORMAT, version: 1, companions: [V010_CONFIG.companions[0], "bad", V010_CONFIG.companions[0]], settings: {}, profiles: {} });
    assert.deepEqual(result, { companions: 1, skipped: 2, profiles: 0 });
  });

  test("other files are rejected without changing anything", () => {
    const manager = new CompanionManager(dir);
    const before = manager.create();
    assert.throws(() => manager.importWorld(V010_CONFIG), /isn't a Sonion Companion world file/);
    assert.throws(() => manager.importWorld([before]), /isn't a Sonion Companion world file/);
    assert.throws(() => manager.importWorld({ format: WORLD_FORMAT, version: 99, companions: [] }), /newer version/);
    assert.deepEqual(manager.list().map((c) => c.id), [before.id]);
  });
});

describe("CompanionManager — layouts (profiles)", () => {
  test("save, list, load and delete", () => {
    const manager = new CompanionManager(dir);
    const a = manager.create();
    manager.saveProfile("  Desk  ");
    manager.remove(a.id); manager.create(); manager.create();
    assert.deepEqual(manager.listProfiles(), ["Desk"]);

    manager.loadProfile("Desk");
    assert.deepEqual(manager.list().map((c) => c.id), [a.id]);
    assert.equal(manager.deleteProfile("Desk"), true);
    assert.equal(manager.deleteProfile("Desk"), false);
    assert.throws(() => manager.loadProfile("Desk"), /Unknown profile/);
  });

  test("invalid layout names are rejected", () => {
    const manager = new CompanionManager(dir);
    for (const name of ["", "   ", "a/b", "x".repeat(81), "con:"]) {
      assert.throws(() => manager.saveProfile(name), /Profile names/, `name ${JSON.stringify(name)}`);
    }
  });

  test("loading a layout restores display settings but keeps machine-level settings", () => {
    writeConfig(V010_CONFIG);
    const manager = new CompanionManager(dir);
    manager.updateSettings({ startWithWindows: false, autostartInitialized: true, shortcuts: { enabled: false, addCompanion: "Control+Alt+Shift+Q", openSettings: "Control+Alt+Shift+W" } });

    manager.loadProfile("work");
    const settings = manager.snapshot().settings;
    assert.equal(settings.alwaysOnTop, true, "layout setting applied");
    assert.equal(settings.maxCompanions, 10, "layout setting applied");
    assert.equal(settings.startWithWindows, false, "Start with Windows kept");
    assert.equal(settings.autostartInitialized, true, "first-run flag kept, so autostart is never re-enabled by a layout");
    assert.deepEqual(settings.shortcuts, { enabled: false, addCompanion: "Control+Alt+Shift+Q", openSettings: "Control+Alt+Shift+W" });
  });
});
