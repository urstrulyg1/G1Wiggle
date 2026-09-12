/**
 * G1Wiggle — configuration persistence.
 *
 * Everything is stored locally (storage key below), versioned, validated on
 * load and repaired with sane defaults when unreadable. Nothing ever leaves
 * the machine: no accounts, no telemetry, no network.
 */

import type {
  AppConfig,
  LifetimeStats,
  MovementMode,
  Profile,
  Schedule,
  ShortcutMap,
  ThemeMode,
} from "./types";
import { PROFILE_COLORS } from "./types";

export const CONFIG_VERSION = 1;
export const STORAGE_KEY = "g1wiggle.config.v1";

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ */
/* defaults & presets                                                  */
/* ------------------------------------------------------------------ */

export function defaultProfile(name: string, color: string, mode: MovementMode): Profile {
  return {
    id: uid("profile"),
    name,
    color,
    createdAt: Date.now(),
    mode,
    intervalSec: 30,
    minIntervalSec: 18,
    maxIntervalSec: 75,
    distancePx: 5,
    minDistancePx: 2,
    maxDistancePx: 9,
    randomizePct: 35,
    returnToOrigin: true,
    edgeAvoidance: true,
    multiDirection: false,
    custom: { pattern: "orbit", stepsPerCycle: 8, amplitude: 6, vertical: true },
    sessionMinutes: 0,
    startDelaySec: 0,
    autoRestartAfterPauseMin: 0,
    keyboard: { enabled: false, intervalSec: 240, randomize: true },
  };
}

function patchProfile(p: Profile, patch: Partial<Profile>): Profile {
  return { ...p, ...patch };
}

export function presetProfiles(): Profile[] {
  const p = (name: string, color: string, mode: MovementMode) =>
    defaultProfile(name, color, mode);
  return [
    patchProfile(p("Default", PROFILE_COLORS[0], "simple"), {
      intervalSec: 30,
      distancePx: 5,
    }),
    patchProfile(p("Work", PROFILE_COLORS[1], "natural"), {
      minIntervalSec: 25,
      maxIntervalSec: 90,
      maxDistancePx: 8,
      randomizePct: 45,
      sessionMinutes: 480,
    }),
    patchProfile(p("Presentation", PROFILE_COLORS[2], "circular"), {
      intervalSec: 20,
      distancePx: 4,
      minDistancePx: 3,
      maxDistancePx: 5,
      randomizePct: 15,
    }),
    patchProfile(p("Long Session", PROFILE_COLORS[3], "random"), {
      intervalSec: 45,
      randomizePct: 50,
      sessionMinutes: 0,
    }),
    patchProfile(p("Minimal Movement", PROFILE_COLORS[4], "zigzag"), {
      intervalSec: 60,
      distancePx: 3,
      minDistancePx: 2,
      maxDistancePx: 4,
      randomizePct: 20,
    }),
    patchProfile(p("Custom", PROFILE_COLORS[5], "custom"), {
      custom: { pattern: "pingpong", stepsPerCycle: 6, amplitude: 6, vertical: true },
      minIntervalSec: 15,
      maxIntervalSec: 45,
    }),
  ];
}

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  toggle: "Ctrl+Alt+G",
  pause: "Ctrl+Alt+P",
};

export function defaultConfig(): AppConfig {
  const profiles = presetProfiles();
  return {
    version: CONFIG_VERSION,
    profiles,
    activeProfileId: profiles[0].id,
    schedules: [],
    theme: "system",
    shortcuts: { ...DEFAULT_SHORTCUTS },
    settings: {
      minimizeToTrayOnClose: true,
      launchAtStartup: false,
      startActivityAfterLaunch: false,
      notificationsEnabled: false,
      repositoryUrl: "https://github.com/urstrulyg1/G1Wiggle",
      wakeLockEnabled: true,
      soundEnabled: true,
      soundVolume: 35,
      batterySaverEnabled: true,
    },
  };
}

/* ------------------------------------------------------------------ */
/* validation / repair                                                 */
/* ------------------------------------------------------------------ */

const MODES: MovementMode[] = [
  "simple",
  "random",
  "circular",
  "zigzag",
  "natural",
  "custom",
];
const THEMES: ThemeMode[] = ["system", "light", "dark"];

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(Math.max(n, min), max);
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function sanitizeProfile(raw: unknown): Profile {
  const base = defaultProfile("Profile", PROFILE_COLORS[0], "simple");
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const custom = (r.custom ?? {}) as Record<string, unknown>;
  const keyboard = (r.keyboard ?? {}) as Record<string, unknown>;
  const mode = MODES.includes(r.mode as MovementMode) ? (r.mode as MovementMode) : "simple";
  return {
    ...base,
    id: typeof r.id === "string" && r.id ? r.id : uid("profile"),
    name: typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 40) : "Profile",
    color: typeof r.color === "string" ? r.color : PROFILE_COLORS[0],
    createdAt: num(r.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
    mode,
    intervalSec: num(r.intervalSec, 30, 1, 3600),
    minIntervalSec: num(r.minIntervalSec, 18, 1, 3600),
    maxIntervalSec: num(r.maxIntervalSec, 75, 1, 3600),
    distancePx: num(r.distancePx, 5, 1, 200),
    minDistancePx: num(r.minDistancePx, 2, 1, 200),
    maxDistancePx: num(r.maxDistancePx, 9, 1, 200),
    randomizePct: num(r.randomizePct, 35, 0, 100),
    returnToOrigin: bool(r.returnToOrigin, true),
    edgeAvoidance: bool(r.edgeAvoidance, true),
    multiDirection: bool(r.multiDirection, false),
    custom: {
      pattern:
        custom.pattern === "orbit" || custom.pattern === "pingpong" || custom.pattern === "scatter"
          ? custom.pattern
          : "orbit",
      stepsPerCycle: num(custom.stepsPerCycle, 8, 2, 64),
      amplitude: num(custom.amplitude, 6, 1, 200),
      vertical: bool(custom.vertical, true),
    },
    sessionMinutes: num(r.sessionMinutes, 0, 0, 24 * 60 * 14),
    startDelaySec: num(r.startDelaySec, 0, 0, 3600),
    autoRestartAfterPauseMin: num(r.autoRestartAfterPauseMin, 0, 0, 720),
    keyboard: {
      enabled: bool(keyboard.enabled, false),
      intervalSec: num(keyboard.intervalSec, 240, 5, 3600),
      randomize: bool(keyboard.randomize, true),
    },
  };
}

const SCHEDULE_TYPES = ["once", "daily", "weekdays", "custom"] as const;

export function sanitizeSchedule(raw: unknown): Schedule | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    id: typeof r.id === "string" && r.id ? r.id : uid("schedule"),
    name: typeof r.name === "string" ? r.name.trim().slice(0, 48) : "",
    enabled: bool(r.enabled, true),
    profileId: typeof r.profileId === "string" ? r.profileId : "",
    type: SCHEDULE_TYPES.includes(r.type as Schedule["type"])
      ? (r.type as Schedule["type"])
      : "daily",
    date: typeof r.date === "string" ? r.date : "",
    days: Array.isArray(r.days)
      ? r.days.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6)
      : [],
    startTime: typeof r.startTime === "string" ? r.startTime : "09:00",
    endTime: typeof r.endTime === "string" ? r.endTime : "18:00",
  };
}

/** Parse + repair a stored config. Never throws. */
export function parseConfig(raw: string | null): { config: AppConfig; repaired: boolean } {
  const fresh = defaultConfig();
  if (!raw) return { config: fresh, repaired: false };
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object") throw new Error("not an object");

    const profiles = Array.isArray(data.profiles)
      ? data.profiles.map(sanitizeProfile)
      : fresh.profiles;
    const finalProfiles = profiles.length ? profiles : fresh.profiles;

    const activeProfileId = finalProfiles.some((p) => p.id === data.activeProfileId)
      ? (data.activeProfileId as string)
      : finalProfiles[0].id;

    const schedules = (Array.isArray(data.schedules) ? data.schedules : [])
      .map(sanitizeSchedule)
      .filter((s): s is Schedule => s !== null)
      .map((s) => ({
        ...s,
        profileId: finalProfiles.some((p) => p.id === s.profileId)
          ? s.profileId
          : finalProfiles[0].id,
      }));

    const settingsRaw = (data.settings ?? {}) as Record<string, unknown>;
    const shortcutsRaw = (data.shortcuts ?? {}) as Record<string, unknown>;

    const config: AppConfig = {
      version: CONFIG_VERSION,
      profiles: finalProfiles,
      activeProfileId,
      schedules,
      theme: THEMES.includes(data.theme as ThemeMode) ? (data.theme as ThemeMode) : "system",
      shortcuts: {
        toggle:
          typeof shortcutsRaw.toggle === "string" && shortcutsRaw.toggle
            ? shortcutsRaw.toggle
            : DEFAULT_SHORTCUTS.toggle,
        pause:
          typeof shortcutsRaw.pause === "string" && shortcutsRaw.pause
            ? shortcutsRaw.pause
            : DEFAULT_SHORTCUTS.pause,
      },
      settings: {
        minimizeToTrayOnClose: bool(settingsRaw.minimizeToTrayOnClose, true),
        launchAtStartup: bool(settingsRaw.launchAtStartup, false),
        startActivityAfterLaunch: bool(settingsRaw.startActivityAfterLaunch, false),
        notificationsEnabled: bool(settingsRaw.notificationsEnabled, false),
        repositoryUrl:
          typeof settingsRaw.repositoryUrl === "string" && settingsRaw.repositoryUrl
            ? settingsRaw.repositoryUrl
            : "https://github.com/urstrulyg1/G1Wiggle",
        wakeLockEnabled: bool(settingsRaw.wakeLockEnabled, true),
        soundEnabled: bool(settingsRaw.soundEnabled, true),
        soundVolume: num(settingsRaw.soundVolume, 35, 0, 100),
        batterySaverEnabled: bool(settingsRaw.batterySaverEnabled, true),
      },
    };
    return { config, repaired: false };
  } catch {
    return { config: fresh, repaired: true };
  }
}

export function serializeConfig(config: AppConfig): string {
  return JSON.stringify(config);
}

/* ------------------------------------------------------------------ */
/* lifetime statistics persistence                                     */
/* ------------------------------------------------------------------ */

export const STATS_KEY = "g1wiggle.stats.v1";

export function defaultStats(): LifetimeStats {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return {
    totalKeepAliveMs: 0,
    totalMovements: 0,
    totalSessionsCompleted: 0,
    totalSessionsStarted: 0,
    todayKeepAliveMs: 0,
    lastActiveDate: `${yyyy}-${mm}-${dd}`,
  };
}

export function parseStats(raw: string | null): LifetimeStats {
  const base = defaultStats();
  if (!raw) return base;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object") return base;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const lastActiveDate = typeof data.lastActiveDate === "string" ? data.lastActiveDate : today;
    const isToday = lastActiveDate === today;

    return {
      totalKeepAliveMs: num(data.totalKeepAliveMs, 0, 0, Number.MAX_SAFE_INTEGER),
      totalMovements: num(data.totalMovements, 0, 0, Number.MAX_SAFE_INTEGER),
      totalSessionsCompleted: num(data.totalSessionsCompleted, 0, 0, Number.MAX_SAFE_INTEGER),
      totalSessionsStarted: num(data.totalSessionsStarted, 0, 0, Number.MAX_SAFE_INTEGER),
      todayKeepAliveMs: isToday ? num(data.todayKeepAliveMs, 0, 0, Number.MAX_SAFE_INTEGER) : 0,
      lastActiveDate: today,
    };
  } catch {
    return base;
  }
}

export function serializeStats(stats: LifetimeStats): string {
  return JSON.stringify(stats);
}

/* ------------------------------------------------------------------ */
/* profile import / export                                             */
/* ------------------------------------------------------------------ */

export interface ProfileExport {
  app: "G1Wiggle";
  kind: "profiles";
  version: number;
  exportedAt: string;
  profiles: unknown[];
}

export function exportProfiles(profiles: Profile[]): string {
  const payload: ProfileExport = {
    app: "G1Wiggle",
    kind: "profiles",
    version: CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    profiles,
  };
  return JSON.stringify(payload, null, 2);
}

/** Parse imported JSON; returns sanitised, re-identified profiles or throws. */
export function importProfiles(json: string): Profile[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  let list: unknown[] | null = null;
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === "object" && Array.isArray((data as ProfileExport).profiles))
    list = (data as ProfileExport).profiles;
  if (!list || list.length === 0) throw new Error("No profiles were found in that file.");
  if (list.length > 50) throw new Error("That file contains too many profiles.");
  const profiles = list.map((raw) => {
    const p = sanitizeProfile(raw);
    return { ...p, id: uid("profile"), createdAt: Date.now() };
  });
  return profiles;
}

/* ------------------------------------------------------------------ */
/* full application backup & restore                                   */
/* ------------------------------------------------------------------ */

export interface FullBackupExport {
  app: "G1Wiggle";
  kind: "full_backup";
  version: number;
  exportedAt: string;
  config: AppConfig;
  stats?: LifetimeStats;
}

export function exportFullBackup(config: AppConfig, stats?: LifetimeStats): string {
  const payload: FullBackupExport = {
    app: "G1Wiggle",
    kind: "full_backup",
    version: CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    config,
    stats,
  };
  return JSON.stringify(payload, null, 2);
}

export function importFullBackup(json: string): { config: AppConfig; stats?: LifetimeStats } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("The backup file is not valid JSON.");
  }
  if (!data || typeof data !== "object") throw new Error("Invalid backup structure.");
  const record = data as Record<string, unknown>;
  const rawConfig = record.config ? JSON.stringify(record.config) : json;
  const { config } = parseConfig(rawConfig);
  let stats: LifetimeStats | undefined;
  if (record.stats && typeof record.stats === "object") {
    stats = parseStats(JSON.stringify(record.stats));
  }
  return { config, stats };
}

/** Ensure a profile name is unique by appending " 2", " 3", … */
export function uniqueName(base: string, existing: string[]): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} ${i}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${Date.now()}`;
}
