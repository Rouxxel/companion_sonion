import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

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
}

export interface CompanionSettings {
  alwaysOnTop: boolean;
  defaultSize: number;
  minSize: number;
  maxSize: number;
  hoverOpacity: number;
  /** A soft limit that callers can enforce before creating a window. */
  maxCompanions: number;
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

export const DEFAULT_SETTINGS: Readonly<CompanionSettings> = Object.freeze({
  alwaysOnTop: false,
  defaultSize: 180,
  minSize: 40,
  maxSize: 500,
  hoverOpacity: 0.3,
  maxCompanions: 25
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

function normalizeSettings(value: unknown): CompanionSettings {
  const source = isRecord(value) ? value : {};
  const minSize = numberInRange(source.minSize, DEFAULT_SETTINGS.minSize, 16, 2000);
  const maxSize = numberInRange(source.maxSize, DEFAULT_SETTINGS.maxSize, minSize, 2000);
  return {
    alwaysOnTop: typeof source.alwaysOnTop === "boolean" ? source.alwaysOnTop : DEFAULT_SETTINGS.alwaysOnTop,
    defaultSize: numberInRange(source.defaultSize, DEFAULT_SETTINGS.defaultSize, minSize, maxSize),
    minSize,
    maxSize,
    hoverOpacity: numberInRange(source.hoverOpacity, DEFAULT_SETTINGS.hoverOpacity, 0.05, 1),
    maxCompanions: Math.round(numberInRange(source.maxCompanions, DEFAULT_SETTINGS.maxCompanions, 1, 100))
  };
}

function normalizeCompanion(value: unknown, settings: CompanionSettings, fallbackZIndex: number): Companion | undefined {
  if (!isRecord(value)) return undefined;
  const assetType: AssetType = value.assetType === "url" || value.assetType === "local" || value.assetType === "bundled"
    ? value.assetType
    : "bundled";
  return {
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

function normalizeProfile(value: unknown): CompanionProfile | undefined {
  if (!isRecord(value)) return undefined;
  const settings = normalizeSettings(value.settings);
  return {
    settings,
    companions: normalizeCompanions(value.companions, settings),
    updatedAt: stringOr(value.updatedAt, new Date(0).toISOString())
  };
}

function normalizeConfig(value: unknown): CompanionConfig {
  const source = isRecord(value) ? value : {};
  const settings = normalizeSettings(source.settings);
  const profiles: Record<string, CompanionProfile> = {};
  if (isRecord(source.profiles)) {
    for (const [name, profile] of Object.entries(source.profiles)) {
      const normalized = normalizeProfile(profile);
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

/** Main-process state and durable JSON configuration for desktop companions. */
export class CompanionManager {
  private config: CompanionConfig;
  private readonly configPath: string;

  public constructor(userDataPath: string, fileName = "companions.json") {
    this.configPath = path.join(userDataPath, fileName);
    this.config = this.readConfig();
  }

  public getConfigPath(): string { return this.configPath; }
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
    this.config.settings = normalizeSettings({ ...this.config.settings, ...changes });
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
    this.config.settings = clone(profile.settings);
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

  /** Writes the complete state through a sibling temporary file before replacing the config. */
  public save(): void {
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
    if (!existsSync(this.configPath)) return normalizeConfig({});
    try {
      return normalizeConfig(JSON.parse(readFileSync(this.configPath, "utf8")) as unknown);
    } catch {
      // Keep a corrupt file available for recovery and start from safe defaults.
      return normalizeConfig({});
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
