import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SavedDisplay } from "./geometry";

export const CONFIG_VERSION = 1;

export type AssetType = "url" | "local" | "bundled";

export interface Companion {
  id: string;
  /** Relative horizontal position in the display work area (0 through 1). */
  x: number;
  /** Relative vertical position in the display work area (0 through 1). */
  y: number;
  size: number;
  assetPath: string;
  assetType: AssetType;
  locked: boolean;
  opacity: number;
  zIndex: number;
  /** Display the position is relative to; missing in older data → primary display. */
  display?: SavedDisplay;
}

export interface ShortcutSettings {
  enabled: boolean;
  /** Electron accelerator, e.g. "Control+Alt+Shift+A". */
  addCompanion: string;
  openSettings: string;
}

export interface CompanionSettings {
  alwaysOnTop: boolean;
  defaultSize: number;
  minSize: number;
  maxSize: number;
  hoverOpacity: number;
  /** A soft limit that callers can enforce before creating a window. */
  maxCompanions: number;
  /** System-wide shortcuts; defaults avoid common app shortcuts such as Ctrl+Shift+S (Save As). */
  shortcuts: ShortcutSettings;
  /** Mirrors Windows' login-item state for this app (Windows is the source of truth). */
  startWithWindows: boolean;
  /** Internal: the installed app already turned "Start with Windows" on once, so a later "off" is never overridden. */
  autostartInitialized: boolean;
  /** Companions doze while Windows reports no keyboard/mouse input for `minutes`. */
  idleSleep: IdleSleepSettings;
}

export interface IdleSleepSettings {
  enabled: boolean;
  minutes: number;
}

/** Preferences that belong to this PC, not to a layout or a world file: loading/importing never changes them. */
export const MACHINE_SETTINGS = ["shortcuts", "startWithWindows", "autostartInitialized", "idleSleep"] as const;

/** File format written by "Export world" and accepted by "Import world". */
export const WORLD_FORMAT = "sonion-companion-world";
export const WORLD_VERSION = 1;

export interface WorldFile {
  format: typeof WORLD_FORMAT;
  version: number;
  exportedAt: string;
  companions: Companion[];
  /** Layout-related settings only (see MACHINE_SETTINGS). */
  settings: Partial<CompanionSettings>;
  profiles: Record<string, CompanionProfile>;
}

export interface CompanionProfile {
  companions: Companion[];
  settings: CompanionSettings;
  updatedAt: string;
}

export interface CompanionConfig {
  version: number;
  companions: Companion[];
  settings: CompanionSettings;
  profiles: Record<string, CompanionProfile>;
}

export type CreateCompanionInput = Partial<Omit<Companion, "id" | "zIndex">>;
export type UpdateCompanionInput = Partial<Omit<Companion, "id">>;

const DEFAULT_ASSET_PATH = "assets/sonion.jpeg";

export const DEFAULT_SHORTCUTS: Readonly<ShortcutSettings> = Object.freeze({
  enabled: true,
  addCompanion: "Control+Alt+Shift+A",
  openSettings: "Control+Alt+Shift+S"
});

export const DEFAULT_SETTINGS: Readonly<CompanionSettings> = Object.freeze({
  alwaysOnTop: true, //Change to make it be another window or always in front by default
  defaultSize: 180,
  minSize: 40,
  maxSize: 500,
  hoverOpacity: 0.3,
  maxCompanions: 25,
  shortcuts: DEFAULT_SHORTCUTS,
  startWithWindows: true,
  autostartInitialized: false,
  idleSleep: Object.freeze({ enabled: true, minutes: 5 })
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function acceleratorOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 64 ? value.trim() : fallback;
}

function normalizeShortcuts(value: unknown, defaults: ShortcutSettings): ShortcutSettings {
  const source = isRecord(value) ? value : {};
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : defaults.enabled,
    addCompanion: acceleratorOr(source.addCompanion, defaults.addCompanion),
    openSettings: acceleratorOr(source.openSettings, defaults.openSettings)
  };
}

function normalizeSettings(value: unknown, defaults: CompanionSettings = DEFAULT_SETTINGS): CompanionSettings {
  const source = isRecord(value) ? value : {};
  const minSize = numberInRange(source.minSize, defaults.minSize, 16, 2000);
  const maxSize = numberInRange(source.maxSize, defaults.maxSize, minSize, 2000);
  return {
    alwaysOnTop: typeof source.alwaysOnTop === "boolean" ? source.alwaysOnTop : defaults.alwaysOnTop,
    defaultSize: numberInRange(source.defaultSize, defaults.defaultSize, minSize, maxSize),
    minSize,
    maxSize,
    hoverOpacity: numberInRange(source.hoverOpacity, defaults.hoverOpacity, 0.05, 1),
    maxCompanions: Math.round(numberInRange(source.maxCompanions, defaults.maxCompanions, 1, 100)),
    shortcuts: normalizeShortcuts(source.shortcuts, defaults.shortcuts),
    startWithWindows: typeof source.startWithWindows === "boolean" ? source.startWithWindows : defaults.startWithWindows,
    autostartInitialized: source.autostartInitialized === true,
    idleSleep: normalizeIdleSleep(source.idleSleep, defaults.idleSleep)
  };
}

function normalizeIdleSleep(value: unknown, defaults: IdleSleepSettings): IdleSleepSettings {
  const source = isRecord(value) ? value : {};
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : defaults.enabled,
    minutes: Math.round(numberInRange(source.minutes, defaults.minutes, 1, 120))
  };
}

/** Keeps this PC's machine-level preferences from `current`, everything else from `incoming`. */
function withMachineSettings(incoming: CompanionSettings, current: CompanionSettings): CompanionSettings {
  const merged: CompanionSettings = { ...incoming };
  for (const key of MACHINE_SETTINGS) (merged as unknown as Record<string, unknown>)[key] = clone(current[key]);
  return merged;
}

function layoutSettings(settings: CompanionSettings): Partial<CompanionSettings> {
  const copy: Partial<CompanionSettings> = clone(settings);
  for (const key of MACHINE_SETTINGS) delete copy[key];
  return copy;
}

function normalizeCompanion(value: unknown, settings: CompanionSettings, fallbackZIndex: number): Companion | undefined {
  if (!isRecord(value)) return undefined;
  const assetType: AssetType = value.assetType === "url" || value.assetType === "local" || value.assetType === "bundled"
    ? value.assetType
    : "bundled";
  const companion: Companion = {
    id: stringOr(value.id, randomUUID()),
    x: numberInRange(value.x, 0.5, 0, 1),
    y: numberInRange(value.y, 0.5, 0, 1),
    size: Math.round(numberInRange(value.size, settings.defaultSize, settings.minSize, settings.maxSize)),
    assetPath: stringOr(value.assetPath, DEFAULT_ASSET_PATH),
    assetType,
    locked: typeof value.locked === "boolean" ? value.locked : false,
    opacity: numberInRange(value.opacity, 1, 0.05, 1),
    zIndex: Math.round(numberInRange(value.zIndex, fallbackZIndex, 0, Number.MAX_SAFE_INTEGER))
  };
  const display = normalizeDisplay(value.display);
  if (display) companion.display = display;
  return companion;
}

function normalizeDisplay(value: unknown): SavedDisplay | undefined {
  if (!isRecord(value)) return undefined;
  const { id, x, y, width, height } = value;
  const finite = [id, x, y, width, height].every((n) => typeof n === "number" && Number.isFinite(n));
  return finite && (width as number) > 0 && (height as number) > 0
    ? { id: id as number, x: x as number, y: y as number, width: width as number, height: height as number }
    : undefined;
}

function normalizeCompanions(value: unknown, settings: CompanionSettings): Companion[] {
  const seen = new Set<string>();
  if (!Array.isArray(value)) return [];
  return value.reduce<Companion[]>((companions, item) => {
    const companion = normalizeCompanion(item, settings, companions.length + 1);
    if (!companion || seen.has(companion.id) || companions.length >= settings.maxCompanions) return companions;
    seen.add(companion.id);
    companions.push(companion);
    return companions;
  }, []);
}

function normalizeProfile(value: unknown, defaults: CompanionSettings): CompanionProfile | undefined {
  if (!isRecord(value)) return undefined;
  const settings = normalizeSettings(value.settings, defaults);
  return {
    settings,
    companions: normalizeCompanions(value.companions, settings),
    updatedAt: stringOr(value.updatedAt, new Date(0).toISOString())
  };
}

function normalizeConfig(value: unknown, defaults: CompanionSettings = DEFAULT_SETTINGS): CompanionConfig {
  const source = isRecord(value) ? value : {};
  const settings = normalizeSettings(source.settings, defaults);
  const profiles: Record<string, CompanionProfile> = {};
  if (isRecord(source.profiles)) {
    for (const [name, profile] of Object.entries(source.profiles)) {
      const normalized = normalizeProfile(profile, defaults);
      if (normalized && name.trim()) profiles[name.trim()] = normalized;
    }
  }
  return {
    version: CONFIG_VERSION,
    settings,
    companions: normalizeCompanions(source.companions, settings),
    profiles
  };
}

export interface CompanionManagerOptions {
  fileName?: string;
  /** Platform defaults (e.g. ⌘-based shortcuts on macOS), used for missing or invalid values. */
  defaults?: Partial<Pick<CompanionSettings, "shortcuts" | "idleSleep">>;
}

/** Main-process state and durable JSON configuration for desktop companions. */
export class CompanionManager {
  private config: CompanionConfig;
  private readonly configPath: string;
  private readonly defaults: CompanionSettings;

  public constructor(userDataPath: string, options: CompanionManagerOptions = {}) {
    this.configPath = path.join(userDataPath, options.fileName ?? "companions.json");
    this.defaults = { ...DEFAULT_SETTINGS, ...clone(options.defaults ?? {}) };
    this.config = this.readConfig();
  }

  public getConfigPath(): string { return this.configPath; }
  /** Set when companions.json couldn't be read at startup and was moved aside to this path. */
  public recoveredConfigPath: string | undefined;
  public snapshot(): CompanionConfig { return clone(this.config); }
  public list(): Companion[] { return clone(this.config.companions); }
  public get(id: string): Companion | undefined {
    const companion = this.config.companions.find((item) => item.id === id);
    return companion ? clone(companion) : undefined;
  }

  public create(input: CreateCompanionInput = {}): Companion {
    if (this.config.companions.length >= this.config.settings.maxCompanions) {
      throw new Error(`Companion limit (${this.config.settings.maxCompanions}) reached.`);
    }
    const nextZIndex = Math.max(0, ...this.config.companions.map((item) => item.zIndex)) + 1;
    const companion = normalizeCompanion({ ...input, id: randomUUID(), zIndex: nextZIndex }, this.config.settings, nextZIndex)!;
    this.config.companions.push(companion);
    this.save();
    return clone(companion);
  }

  public update(id: string, changes: UpdateCompanionInput): Companion {
    const index = this.config.companions.findIndex((item) => item.id === id);
    if (index < 0) throw new Error(`Unknown companion: ${id}`);
    const current = this.config.companions[index];
    const updated = normalizeCompanion({ ...current, ...changes, id }, this.config.settings, current.zIndex)!;
    this.config.companions[index] = updated;
    this.save();
    return clone(updated);
  }

  public remove(id: string): boolean {
    const before = this.config.companions.length;
    this.config.companions = this.config.companions.filter((item) => item.id !== id);
    if (this.config.companions.length === before) return false;
    this.save();
    return true;
  }

  public bringToFront(id: string): Companion {
    const nextZIndex = Math.max(0, ...this.config.companions.map((item) => item.zIndex)) + 1;
    return this.update(id, { zIndex: nextZIndex });
  }

  public updateSettings(changes: Partial<CompanionSettings>): CompanionSettings {
    this.config.settings = normalizeSettings({ ...this.config.settings, ...changes }, this.defaults);
    this.config.companions = normalizeCompanions(this.config.companions, this.config.settings);
    this.save();
    return clone(this.config.settings);
  }

  public listProfiles(): string[] { return Object.keys(this.config.profiles).sort((a, b) => a.localeCompare(b)); }
  public saveProfile(name: string): void {
    const profileName = this.assertProfileName(name);
    this.config.profiles[profileName] = {
      companions: clone(this.config.companions),
      settings: clone(this.config.settings),
      updatedAt: new Date().toISOString()
    };
    this.save();
  }

  public loadProfile(name: string): CompanionConfig {
    const profileName = this.assertProfileName(name);
    const profile = this.config.profiles[profileName];
    if (!profile) throw new Error(`Unknown profile: ${profileName}`);
    // Layouts restore companions and display settings, not machine-level preferences.
    this.config.settings = withMachineSettings(clone(profile.settings), this.config.settings);
    this.config.companions = clone(profile.companions);
    this.save();
    return this.snapshot();
  }

  public deleteProfile(name: string): boolean {
    const profileName = this.assertProfileName(name);
    if (!(profileName in this.config.profiles)) return false;
    delete this.config.profiles[profileName];
    this.save();
    return true;
  }

  /** Companions, layout settings and layouts as a portable file (machine-level preferences excluded). */
  public exportWorld(): WorldFile {
    return {
      format: WORLD_FORMAT,
      version: WORLD_VERSION,
      exportedAt: new Date().toISOString(),
      companions: clone(this.config.companions),
      settings: layoutSettings(this.config.settings),
      profiles: clone(this.config.profiles)
    };
  }

  /**
   * Replaces companions and layout settings with those from a world file and adds its layouts
   * (same name = replaced). This PC's shortcuts, Start with Windows and idle sleep are kept.
   */
  public importWorld(raw: unknown): { companions: number; skipped: number; profiles: number } {
    if (!isRecord(raw) || raw.format !== WORLD_FORMAT) throw new Error("This isn't a Sonion Companion world file.");
    if (typeof raw.version === "number" && raw.version > WORLD_VERSION) throw new Error("This world file was made by a newer version of Sonion Companion.");
    const settings = withMachineSettings(normalizeSettings({ ...layoutSettings(this.defaults), ...(isRecord(raw.settings) ? raw.settings : {}) }, this.defaults), this.config.settings);
    const companions = normalizeCompanions(raw.companions, settings);
    const imported = normalizeConfig({ profiles: raw.profiles }, this.defaults).profiles;

    this.config.settings = settings;
    this.config.companions = companions;
    this.config.profiles = { ...this.config.profiles, ...imported };
    this.save();
    const offered = Array.isArray(raw.companions) ? raw.companions.length : 0;
    return { companions: companions.length, skipped: Math.max(0, offered - companions.length), profiles: Object.keys(imported).length };
  }

  private persistenceDisabled = false;

  /** Stops all writes (used right before "Delete all data…" quits the app, so nothing recreates the file). */
  public disablePersistence(): void {
    this.persistenceDisabled = true;
  }

  /** Writes the complete state through a sibling temporary file before replacing the config. */
  public save(): void {
    if (this.persistenceDisabled) return;
    const directory = path.dirname(this.configPath);
    mkdirSync(directory, { recursive: true });
    const temporaryPath = `${this.configPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryPath, `${JSON.stringify(this.config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      renameSync(temporaryPath, this.configPath);
    } finally {
      if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true });
    }
  }

  private readConfig(): CompanionConfig {
    if (!existsSync(this.configPath)) return normalizeConfig({}, this.defaults);
    try {
      // Strip a UTF-8 byte-order mark: some editors add one when the file is edited by hand.
      return normalizeConfig(JSON.parse(readFileSync(this.configPath, "utf8").replace(/^\uFEFF/, "")) as unknown, this.defaults);
    } catch {
      // Keep a corrupt file available for recovery and start from safe defaults. The next save
      // would overwrite companions.json, so move the unreadable file aside first.
      this.recoveredConfigPath = this.preserveUnreadableConfig();
      return normalizeConfig({}, this.defaults);
    }
  }

  /** Renames an unreadable companions.json to companions.corrupt-<timestamp>.json; returns the new path. */
  private preserveUnreadableConfig(): string | undefined {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const target = path.join(path.dirname(this.configPath), `${path.parse(this.configPath).name}.corrupt-${stamp}.json`);
    try {
      renameSync(this.configPath, target);
      return target;
    } catch {
      return undefined;
    }
  }

  private assertProfileName(name: string): string {
    const normalized = name.trim();
    if (!normalized || normalized.length > 80 || /[\\/:*?"<>|]/.test(normalized)) {
      throw new Error("Profile names must be 1-80 characters and cannot contain file-system reserved characters.");
    }
    return normalized;
  }
}
