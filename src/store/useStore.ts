/**
 * G1Wiggle — application store + engine runtime.
 *
 * The store holds (a) persisted configuration and (b) ephemeral runtime
 * state. The Engine class below drives all timers. It is deliberately
 * efficient: when idle there are zero timers and zero polling loops.
 */

import { create } from "zustand";
import {
  clampOffset,
  computeIntervalMs,
  computeOffset,
  mulberry32,
  nextStatus,
  resolveSessionMs,
  safeOrigin,
  type Bounds,
  type Vec2,
} from "../lib/engine";
import {
  defaultConfig,
  defaultStats,
  exportFullBackup,
  exportProfiles,
  importFullBackup,
  importProfiles,
  parseConfig,
  parseStats,
  sanitizeProfile,
  sanitizeSchedule,
  serializeConfig,
  serializeStats,
  uid,
  uniqueName,
  CONFIG_VERSION,
  STORAGE_KEY,
  STATS_KEY,
} from "../lib/persistence";
import { activeWindow, nextScheduledWindow, describeSchedule } from "../lib/scheduler";
import { sound } from "../lib/sound";
import { formatHMS } from "../lib/time";
import { createHeartbeatTimer, type HeartbeatTimer } from "../lib/workerTimer";
import { getAdapter } from "../platform/web";
import type {
  AppConfig,
  LifetimeStats,
  LogEntry,
  Profile,
  Schedule,
  SessionStatus,
  ShortcutMap,
  ThemeMode,
  Toast,
} from "../lib/types";

/* Virtual stage the cursor lives in (scaled by the preview component). */
export const STAGE: Bounds = { width: 960, height: 540 };
const EDGE_MARGIN = 46;
const TRAIL_CAP = 60;

export const APP_VERSION = "1.0.0";
export const BUILD_CHANNEL = "web-preview";

/* ------------------------------------------------------------------ */
/* runtime state                                                       */
/* ------------------------------------------------------------------ */

export interface RuntimeState {
  status: SessionStatus;
  elapsedMs: number;
  movements: number;
  keyboardFires: number;
  lastKeyboardAt: number | null;
  nextInMs: number | null;
  intervalCurrentMs: number | null;
  sessionTotalMs: number | null;
  sessionRemainingMs: number | null;
  delayRemainingMs: number | null;
  cursor: Vec2;
  trail: { x: number; y: number; t: number }[];
  pulseAt: number | null;
  byScheduleId: string | null;
  currentProfileId: string | null;
}

const idleRuntime = (): RuntimeState => ({
  status: "idle",
  elapsedMs: 0,
  movements: 0,
  keyboardFires: 0,
  lastKeyboardAt: null,
  nextInMs: null,
  intervalCurrentMs: null,
  sessionTotalMs: null,
  sessionRemainingMs: null,
  delayRemainingMs: null,
  cursor: safeOrigin(STAGE, EDGE_MARGIN),
  trail: [],
  pulseAt: null,
  byScheduleId: null,
  currentProfileId: null,
});

/* ------------------------------------------------------------------ */
/* store                                                               */
/* ------------------------------------------------------------------ */

interface Store {
  config: AppConfig;
  runtime: RuntimeState;
  log: LogEntry[];
  toasts: Toast[];
  configuredFromBackup: boolean;

  toast: (title: string, body?: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;

  start: (profileId?: string, byScheduleId?: string | null) => void;
  pause: (auto?: boolean) => void;
  resume: () => void;
  stop: (reason?: "user" | "completed" | "schedule") => void;
  toggle: () => void;
  togglePause: () => void;

  setActiveProfile: (id: string) => void;
  updateProfile: (id: string, patch: Partial<Profile>) => void;
  addProfile: (p?: Partial<Profile>) => void;
  duplicateProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
  importProfilesJson: (json: string) => void;
  exportProfilesJson: (ids?: string[]) => string;

  addSchedule: (s: Schedule) => void;
  updateSchedule: (id: string, patch: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;

  stats: LifetimeStats;
  wakeLockActive: boolean;
  ambientOpen: boolean;
  battery: { level: number; charging: boolean } | null;

  setAmbientOpen: (open: boolean) => void;
  resetStats: () => void;
  exportFullBackupJson: () => string;
  importFullBackupJson: (json: string) => boolean;

  setTheme: (t: ThemeMode) => void;
  setShortcuts: (s: ShortcutMap) => boolean;
  updateSettings: (patch: Partial<AppConfig["settings"]>) => void;
  resetAll: () => void;
}

function storageGet(key: string): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

const initial = parseConfig(storageGet(STORAGE_KEY));

function pushLog(log: LogEntry[], kind: LogEntry["kind"], message: string): LogEntry[] {
  const entry: LogEntry = { id: uid("log"), at: Date.now(), kind, message };
  return [entry, ...log].slice(0, 30);
}

export function notify(title: string, body?: string): void {
  const { config } = useStore.getState();
  if (!config.settings.notificationsEnabled) return;
  getAdapter().notifications.notify(title, body);
}

/* ------------------------------------------------------------------ */
/* engine                                                              */
/* ------------------------------------------------------------------ */

type Timer = ReturnType<typeof setTimeout>;

class Engine {
  private moveTimer: Timer | null = null;
  private returnTimer: Timer | null = null;
  private tickTimer: Timer | null = null;
  private keyboardTimer: Timer | null = null;
  private autoResumeTimer: Timer | null = null;
  private delayTimer: Timer | null = null;

  private rng = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
  private stepIndex = 0;
  private smooth: Vec2 = { x: 0, y: 0 };
  private origin: Vec2 = safeOrigin(STAGE, EDGE_MARGIN);
  private nextAt = 0;
  private resumedAt = 0;
  private baseElapsed = 0;
  private endsAt: number | null = null;
  private remainToNext = 1000;
  private remainSession: number | null = null;
  private scheduleKey: string | null = null;
  private delayEndAt = 0;

  private heartbeat: HeartbeatTimer = createHeartbeatTimer();

  constructor(private set: typeof useStore.setState, private get: typeof useStore.getState) {}

  private profile(): Profile {
    const { config, runtime } = this.get();
    const id = runtime.currentProfileId ?? config.activeProfileId;
    return config.profiles.find((p) => p.id === id) ?? config.profiles[0];
  }

  private patchRuntime(patch: Partial<RuntimeState>) {
    this.set((s) => ({ runtime: { ...s.runtime, ...patch } }));
  }

  private syncWakeLock(shouldAcquire: boolean) {
    const { config } = this.get();
    const adapter = getAdapter();
    if (shouldAcquire && config.settings.wakeLockEnabled) {
      adapter.wakeLock.acquire().catch(() => {});
    } else {
      adapter.wakeLock.release().catch(() => {});
    }
  }

  private clearTimers() {
    this.heartbeat.stop();
    for (const key of [
      "moveTimer",
      "returnTimer",
      "tickTimer",
      "keyboardTimer",
      "autoResumeTimer",
      "delayTimer",
    ] as const) {
      if (this[key]) {
        clearTimeout(this[key]);
        clearInterval(this[key]);
        this[key] = null;
      }
    }
  }

  start(profileId?: string, byScheduleId: string | null = null) {
    const { runtime, config, toast } = this.get();
    if (nextStatus(runtime.status, "start") === null) return;
    const profile =
      config.profiles.find((p) => p.id === (profileId ?? config.activeProfileId)) ??
      config.profiles[0];

    this.clearTimers();
    this.rng = mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    this.stepIndex = 0;
    this.smooth = { x: 0, y: 0 };
    this.origin = safeOrigin(STAGE, EDGE_MARGIN);
    this.baseElapsed = 0;
    this.resumedAt = Date.now();
    const total = resolveSessionMs(profile.sessionMinutes);
    this.endsAt = total === null ? null : Date.now() + total + profile.startDelaySec * 1000;
    this.scheduleKey = null;

    this.set((s) => ({
      runtime: { ...idleRuntime(), status: "active", cursor: this.origin },
      log: pushLog(s.log, "start", `Session started with “${profile.name}”.`),
    }));
    this.patchRuntime({
      sessionTotalMs: total,
      sessionRemainingMs: total,
      currentProfileId: profile.id,
      byScheduleId,
    });

    if (byScheduleId) {
      const s = config.schedules.find((x) => x.id === byScheduleId);
      if (s) this.scheduleKey = scheduleWindowKey(s);
      toast("Scheduled session started", s ? describeSchedule(s) : undefined, "success");
    }
    notify("G1Wiggle — session started", `Profile: ${profile.name}`);
    toast("Wiggling started", `Profile “${profile.name}” is now active.`, "success");

    this.syncWakeLock(true);
    if (config.settings.soundEnabled) sound.playStart(config.settings.soundVolume);

    this.set((s) => {
      const stats: LifetimeStats = {
        ...s.stats,
        totalSessionsStarted: s.stats.totalSessionsStarted + 1,
      };
      storageSet(STATS_KEY, serializeStats(stats));
      return { stats };
    });

    const delayMs = Math.max(0, profile.startDelaySec * 1000);
    if (delayMs > 0) {
      this.delayEndAt = Date.now() + delayMs;
      this.patchRuntime({ delayRemainingMs: delayMs });
      this.delayTimer = setTimeout(() => {
        this.delayTimer = null;
        this.patchRuntime({ delayRemainingMs: null });
        this.beginLoop();
      }, delayMs);
    } else {
      this.beginLoop();
    }
    this.startTick();
  }

  private beginLoop() {
    const interval = computeIntervalMs(this.profile(), this.rng);
    this.nextAt = Date.now() + interval;
    this.patchRuntime({ intervalCurrentMs: interval });
    this.moveTimer = setTimeout(() => this.doMove(), interval);
    this.scheduleKeyboard();
  }

  private doMove() {
    const { runtime } = this.get();
    if (runtime.status !== "active") return;
    const profile = this.profile();
    this.stepIndex += 1;

    const { offset, smooth } = computeOffset(profile, this.stepIndex, this.rng, this.smooth);
    this.smooth = smooth;
    const clamped = clampOffset(
      this.origin,
      offset,
      STAGE,
      EDGE_MARGIN,
      profile.edgeAvoidance,
    );
    const target: Vec2 = { x: this.origin.x + clamped.x, y: this.origin.y + clamped.y };
    const now = Date.now();

    const { config } = this.get();
    if (config.settings.soundEnabled) sound.playStep(config.settings.soundVolume);

    this.set((s) => ({
      runtime: {
        ...s.runtime,
        cursor: target,
        movements: s.runtime.movements + 1,
        pulseAt: now,
        trail: [...s.runtime.trail, { x: target.x, y: target.y, t: now }].slice(-TRAIL_CAP),
      },
    }));

    if (profile.returnToOrigin) {
      this.returnTimer = setTimeout(() => {
        this.returnTimer = null;
        this.set((s) => ({
          runtime: {
            ...s.runtime,
            cursor: this.origin,
            trail: [
              ...s.runtime.trail,
              { x: this.origin.x, y: this.origin.y, t: Date.now() },
            ].slice(-TRAIL_CAP),
          },
        }));
      }, 620);
    }

    const interval = computeIntervalMs(profile, this.rng);
    this.nextAt = Date.now() + interval;
    this.patchRuntime({ intervalCurrentMs: interval });
    this.moveTimer = setTimeout(() => this.doMove(), interval);
  }

  private scheduleKeyboard() {
    const profile = this.profile();
    if (!profile.keyboard.enabled) return;
    const base = Math.max(5, profile.keyboard.intervalSec) * 1000;
    const wait = profile.keyboard.randomize
      ? base * (0.6 + this.rng() * 0.8)
      : base;
    this.keyboardTimer = setTimeout(() => {
      this.keyboardTimer = null;
      if (this.get().runtime.status === "active") {
        this.set((s) => ({
          runtime: {
            ...s.runtime,
            keyboardFires: s.runtime.keyboardFires + 1,
            lastKeyboardAt: Date.now(),
          },
        }));
        this.scheduleKeyboard();
      }
    }, wait);
  }

  private startTick() {
    const handleTick = () => {
      const { runtime } = this.get();
      if (runtime.status !== "active") return;
      const now = Date.now();
      const elapsed = this.baseElapsed + (now - this.resumedAt);
      const remaining = this.endsAt === null ? null : Math.max(0, this.endsAt - now);
      this.patchRuntime({
        elapsedMs: elapsed,
        nextInMs: this.moveTimer === null ? null : Math.max(0, this.nextAt - now),
        sessionRemainingMs: remaining,
        delayRemainingMs:
          this.delayTimer === null ? null : Math.max(0, this.delayEndAt - now),
      });
      if (this.endsAt !== null && now >= this.endsAt) {
        this.stop("completed");
      }
    };

    this.heartbeat.start(100, handleTick);
    this.tickTimer = setInterval(handleTick, 100);
  }

  pause(auto = false) {
    const { runtime } = this.get();
    if (nextStatus(runtime.status, "pause") === null) return;
    this.syncWakeLock(false);
    this.heartbeat.stop();
    const { config } = this.get();
    if (config.settings.soundEnabled) sound.playPause(config.settings.soundVolume);

    const now = Date.now();
    this.baseElapsed += now - this.resumedAt;
    this.remainToNext = this.moveTimer ? Math.max(250, this.nextAt - now) : 1000;
    this.remainSession = this.endsAt === null ? null : Math.max(0, this.endsAt - now);
    if (this.moveTimer) clearTimeout(this.moveTimer);
    if (this.returnTimer) clearTimeout(this.returnTimer);
    if (this.keyboardTimer) clearTimeout(this.keyboardTimer);
    if (this.delayTimer) clearTimeout(this.delayTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.moveTimer = this.returnTimer = this.keyboardTimer = this.delayTimer = this.tickTimer = null;

    this.set((s) => ({
      runtime: {
        ...s.runtime,
        status: "paused",
        elapsedMs: this.baseElapsed,
        delayRemainingMs: null,
      },
      log: pushLog(s.log, "pause", auto ? "Auto-paused." : "Session paused."),
    }));

    const { autoRestartAfterPauseMin } = this.profile();
    if (autoRestartAfterPauseMin > 0) {
      this.autoResumeTimer = setTimeout(() => {
        this.autoResumeTimer = null;
        this.get().toast("Auto-resumed", "G1Wiggle resumed after the configured pause.", "info");
        this.resume();
      }, autoRestartAfterPauseMin * 60 * 1000);
    }
  }

  resume() {
    const { runtime } = this.get();
    if (nextStatus(runtime.status, "resume") === null) return;
    this.syncWakeLock(true);
    const { config } = this.get();
    if (config.settings.soundEnabled) sound.playResume(config.settings.soundVolume);

    const now = Date.now();
    this.resumedAt = now;
    this.endsAt = this.remainSession === null ? null : now + this.remainSession;
    this.nextAt = now + this.remainToNext;
    this.patchRuntime({ intervalCurrentMs: this.remainToNext });
    this.moveTimer = setTimeout(() => this.doMove(), this.remainToNext);
    this.scheduleKeyboard();
    this.startTick();
    this.set((s) => ({
      runtime: { ...s.runtime, status: "active" },
      log: pushLog(s.log, "resume", "Session resumed."),
    }));
  }

  stop(reason: "user" | "completed" | "schedule" = "user") {
    const { runtime } = this.get();
    if (nextStatus(runtime.status, "stop") === null) return;
    this.syncWakeLock(false);
    this.heartbeat.stop();
    const { config } = this.get();
    if (config.settings.soundEnabled) sound.playStop(config.settings.soundVolume);

    this.clearTimers();
    const elapsed = this.baseElapsed + (this.resumedAt ? Date.now() - this.resumedAt : 0);
    const moves = runtime.movements;
    const summary = `${formatHMS(runtime.status === "paused" ? this.baseElapsed : elapsed)} · ${moves} movement${moves === 1 ? "" : "s"}`;

    if (reason === "user" && this.scheduleKey) suppressedWindows.add(this.scheduleKey);
    this.scheduleKey = null;

    const todayDate = new Date();
    const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;

    this.set((s) => {
      const isToday = s.stats.lastActiveDate === todayStr;
      const stats: LifetimeStats = {
        totalKeepAliveMs: s.stats.totalKeepAliveMs + elapsed,
        totalMovements: s.stats.totalMovements + moves,
        totalSessionsStarted: s.stats.totalSessionsStarted,
        totalSessionsCompleted:
          reason === "completed"
            ? s.stats.totalSessionsCompleted + 1
            : s.stats.totalSessionsCompleted,
        todayKeepAliveMs: (isToday ? s.stats.todayKeepAliveMs : 0) + elapsed,
        lastActiveDate: todayStr,
      };
      storageSet(STATS_KEY, serializeStats(stats));

      return {
        runtime: idleRuntime(),
        stats,
        log: pushLog(
          s.log,
          "stop",
          reason === "completed"
            ? `Session completed — ${summary}.`
            : reason === "schedule"
              ? `Scheduled session ended — ${summary}.`
              : `Session stopped — ${summary}.`,
        ),
      };
    });

    if (reason === "completed") {
      notify("G1Wiggle — session completed", summary);
      this.get().toast("Session completed", summary, "success");
    } else if (reason === "schedule") {
      notify("G1Wiggle — scheduled session ended", summary);
      this.get().toast("Scheduled session ended", summary, "info");
    } else {
      notify("G1Wiggle — session stopped", summary);
    }
  }
}

/* ------------------------------------------------------------------ */
/* scheduler supervisor (lightweight, 5 s cadence)                     */
/* ------------------------------------------------------------------ */

const suppressedWindows = new Set<string>();
let lastNow = 0;

function scheduleWindowKey(s: Schedule, at: Date = new Date()): string {
  const w = activeWindow(s, at);
  return w ? `${s.id}:${w.start.getTime()}` : `${s.id}:none`;
}

export function schedulerTick(store: Pick<Store, "config" | "runtime" | "start" | "stop">) {
  const now = new Date();
  if (now.getTime() - lastNow < 4000) return;
  lastNow = now.getTime();
  const { config, runtime } = store;

  // stop sessions whose scheduled window has ended
  if (runtime.status !== "idle" && runtime.byScheduleId) {
    const s = config.schedules.find((x) => x.id === runtime.byScheduleId);
    if (!s || !s.enabled || !activeWindow(s, now)) {
      store.stop("schedule");
      return;
    }
  }

  // start sessions whose window began
  if (runtime.status === "idle") {
    for (const s of config.schedules) {
      if (!s.enabled) continue;
      const w = activeWindow(s, now);
      if (!w) continue;
      const key = `${s.id}:${w.start.getTime()}`;
      if (suppressedWindows.has(key)) continue;
      store.start(s.profileId, s.id);
      break;
    }
  }
}

export function getNextScheduled(config: AppConfig) {
  const now = new Date();
  const running = config.schedules.find((s) => s.enabled && activeWindow(s, now));
  if (running) {
    const w = activeWindow(running, now);
    if (w) return { schedule: running, window: w, live: true as const };
  }
  const next = nextScheduledWindow(config.schedules, now);
  return next ? { ...next, live: false as const } : null;
}

/* ------------------------------------------------------------------ */
/* store creation                                                      */
/* ------------------------------------------------------------------ */

export const useStore = create<Store>()((set, get) => ({
  config: initial.config,
  runtime: idleRuntime(),
  log: [],
  toasts: [],
  configuredFromBackup: initial.repaired,
  stats: parseStats(storageGet(STATS_KEY)),
  wakeLockActive: false,
  ambientOpen: false,
  battery: null,

  setAmbientOpen: (ambientOpen) => set({ ambientOpen }),
  resetStats: () => {
    const stats = defaultStats();
    storageSet(STATS_KEY, serializeStats(stats));
    set({ stats });
  },
  exportFullBackupJson: () => {
    const { config, stats } = get();
    return exportFullBackup(config, stats);
  },
  importFullBackupJson: (json: string) => {
    try {
      const { config, stats } = importFullBackup(json);
      persist(config);
      if (stats) {
        storageSet(STATS_KEY, serializeStats(stats));
        set({ config, stats });
      } else {
        set({ config });
      }
      get().toast("Backup restored", "Configuration and statistics have been restored.", "success");
      return true;
    } catch (err) {
      get().toast("Restore failed", err instanceof Error ? err.message : "Invalid backup file.", "error");
      return false;
    }
  },

  toast: (title, body, kind = "info") =>
    set((s) => ({
      toasts: [...s.toasts, { id: uid("toast"), kind, title, body }].slice(-4),
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  start: (profileId, byScheduleId = null) => engine.start(profileId, byScheduleId),
  pause: (auto) => engine.pause(auto),
  resume: () => engine.resume(),
  stop: (reason) => engine.stop(reason),
  toggle: () => {
    const { runtime, start, stop } = get();
    if (runtime.status === "idle") start();
    else stop("user");
  },
  togglePause: () => {
    const { runtime, pause, resume } = get();
    if (runtime.status === "active") pause();
    else if (runtime.status === "paused") resume();
  },

  setActiveProfile: (id) =>
    set((s) => {
      if (!s.config.profiles.some((p) => p.id === id)) return s;
      const config = { ...s.config, activeProfileId: id };
      persist(config);
      return {
        config,
        runtime: {
          ...s.runtime,
          currentProfileId: s.runtime.status === "idle" ? s.runtime.currentProfileId : id,
        },
      };
    }),

  updateProfile: (id, patch) =>
    set((s) => {
      const profiles = s.config.profiles.map((p) => {
        if (p.id !== id) return p;
        return sanitizeProfile({
          ...p,
          ...patch,
          custom: { ...p.custom, ...(patch.custom ?? {}) },
          keyboard: { ...p.keyboard, ...(patch.keyboard ?? {}) },
        });
      });
      const config = { ...s.config, profiles };
      persist(config);
      return { config };
    }),

  addProfile: (patch) =>
    set((s) => {
      const base = sanitizeProfile({
        ...(patch ?? {}),
        id: uid("profile"),
        name: uniqueName(patch?.name?.trim() || "New Profile", s.config.profiles.map((p) => p.name)),
        createdAt: Date.now(),
      });
      const config = {
        ...s.config,
        profiles: [...s.config.profiles, base],
        activeProfileId: base.id,
      };
      persist(config);
      return { config };
    }),

  duplicateProfile: (id) =>
    set((s) => {
      const src = s.config.profiles.find((p) => p.id === id);
      if (!src) return s;
      const copy: Profile = {
        ...src,
        id: uid("profile"),
        name: uniqueName(`${src.name} Copy`, s.config.profiles.map((p) => p.name)),
        createdAt: Date.now(),
      };
      const config = { ...s.config, profiles: [...s.config.profiles, copy] };
      persist(config);
      return { config };
    }),

  renameProfile: (id, name) =>
    set((s) => {
      const clean = name.trim().slice(0, 40);
      if (!clean) return s;
      const profiles = s.config.profiles.map((p) => (p.id === id ? { ...p, name: clean } : p));
      const config = { ...s.config, profiles };
      persist(config);
      return { config };
    }),

  deleteProfile: (id) =>
    set((s) => {
      if (s.config.profiles.length <= 1) return s;
      const profiles = s.config.profiles.filter((p) => p.id !== id);
      const schedules = s.config.schedules.map((sc) =>
        sc.profileId === id ? { ...sc, profileId: profiles[0].id } : sc,
      );
      const config = {
        ...s.config,
        profiles,
        schedules,
        activeProfileId:
          s.config.activeProfileId === id ? profiles[0].id : s.config.activeProfileId,
      };
      persist(config);
      return { config };
    }),

  importProfilesJson: (json) => {
    try {
      const profiles = importProfiles(json);
      set((s) => {
        const named = profiles.map((p, i) => ({
          ...p,
          name: uniqueName(p.name, [
            ...s.config.profiles.map((x) => x.name),
            ...profiles.slice(0, i).map((x) => x.name),
          ]),
        }));
        const config = {
          ...s.config,
          profiles: [...s.config.profiles, ...named],
          activeProfileId: named[0].id,
        };
        persist(config);
        return { config };
      });
      get().toast(
        "Profiles imported",
        `${profiles.length} profile${profiles.length === 1 ? "" : "s"} added.`,
        "success",
      );
    } catch (err) {
      get().toast("Import failed", err instanceof Error ? err.message : "Invalid file.", "error");
    }
  },

  exportProfilesJson: (ids) => {
    const { config } = get();
    const profiles = config.profiles.filter((p) => !ids || ids.includes(p.id));
    return exportProfiles(profiles);
  },

  addSchedule: (s) =>
    set((x) => {
      const clean = sanitizeSchedule({ ...s, id: s.id || uid("schedule") });
      if (!clean) return x;
      const config = { ...x.config, schedules: [...x.config.schedules, clean] };
      persist(config);
      return { config };
    }),

  updateSchedule: (id, patch) =>
    set((s) => {
      const schedules = s.config.schedules.map((sc) => {
        if (sc.id !== id) return sc;
        const clean = sanitizeSchedule({ ...sc, ...patch });
        return clean ?? sc;
      });
      const config = { ...s.config, schedules };
      persist(config);
      return { config };
    }),

  deleteSchedule: (id) =>
    set((s) => {
      const config = {
        ...s.config,
        schedules: s.config.schedules.filter((sc) => sc.id !== id),
      };
      persist(config);
      return { config };
    }),

  setTheme: (theme) =>
    set((s) => {
      const config = { ...s.config, theme };
      persist(config);
      return { config };
    }),

  setShortcuts: (shortcuts) => {
    if (shortcuts.toggle && shortcuts.toggle === shortcuts.pause) {
      get().toast(
        "Shortcut conflict",
        "Start/Stop and Pause/Resume cannot use the same keys.",
        "error",
      );
      return false;
    }
    set((s) => {
      const config = { ...s.config, shortcuts };
      persist(config);
      return { config };
    });
    return true;
  },

  updateSettings: (patch) =>
    set((s) => {
      const config = { ...s.config, settings: { ...s.config.settings, ...patch } };
      persist(config);
      return { config };
    }),

  resetAll: () => {
    const { runtime, stop, toast } = get();
    if (runtime.status !== "idle") stop("user");
    const config = defaultConfig();
    config.version = CONFIG_VERSION;
    persist(config);
    set({ config, log: [] });
    toast("Settings reset", "G1Wiggle was restored to factory defaults.", "success");
  },
}));

function persist(config: AppConfig) {
  storageSet(STORAGE_KEY, serializeConfig(config));
}

const engine = new Engine(useStore.setState, useStore.getState);

if (typeof window !== "undefined") {
  const adapter = getAdapter();
  adapter.wakeLock.watch((active) => {
    useStore.setState({ wakeLockActive: active });
  });
  adapter.battery.getInfo().then((b) => {
    if (b) useStore.setState({ battery: b });
  });
  adapter.battery.watch((b) => {
    useStore.setState({ battery: b });
    const { config, toast } = useStore.getState();
    if (config.settings.batterySaverEnabled && !b.charging && b.level <= 0.2) {
      toast(
        "Battery low",
        "Battery is under 20% — consider plugging in to prevent workstation sleep.",
        "info",
      );
    }
  });
}
