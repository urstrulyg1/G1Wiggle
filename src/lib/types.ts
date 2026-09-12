/**
 * G1Wiggle — domain model.
 * Everything in this file is pure data: serialisable, versioned and
 * safe to persist to local storage.
 */

export type MovementMode =
  | "simple"
  | "random"
  | "circular"
  | "zigzag"
  | "natural"
  | "custom";

export type CustomPattern = "orbit" | "pingpong" | "scatter";

export type SessionStatus = "idle" | "active" | "paused";

export interface CustomMovement {
  pattern: CustomPattern;
  /** how many steps make a full cycle */
  stepsPerCycle: number;
  /** base amplitude in px */
  amplitude: number;
  /** include the vertical axis */
  vertical: boolean;
}

export interface KeyboardActivity {
  enabled: boolean;
  intervalSec: number;
  randomize: boolean;
}

export interface Profile {
  id: string;
  name: string;
  /** accent hue used for chips / quick switch */
  color: string;
  createdAt: number;

  mode: MovementMode;

  /** base interval for fixed-interval modes */
  intervalSec: number;
  /** interval range used by natural / custom */
  minIntervalSec: number;
  maxIntervalSec: number;

  /** excursion size */
  distancePx: number;
  minDistancePx: number;
  maxDistancePx: number;

  /** 0–100, applied to both interval and distance */
  randomizePct: number;

  returnToOrigin: boolean;
  edgeAvoidance: boolean;
  multiDirection: boolean;

  custom: CustomMovement;

  /** 0 = unlimited */
  sessionMinutes: number;
  startDelaySec: number;
  /** 0 = off, otherwise auto-resume N minutes after pausing */
  autoRestartAfterPauseMin: number;

  keyboard: KeyboardActivity;
}

export type ScheduleType = "once" | "daily" | "weekdays" | "custom";

export interface Schedule {
  id: string;
  name: string;
  enabled: boolean;
  profileId: string;
  type: ScheduleType;
  /** yyyy-mm-dd, only for "once" */
  date: string;
  /** 0 (Sun) – 6 (Sat), only for "custom" */
  days: number[];
  /** "HH:MM" 24h */
  startTime: string;
  endTime: string;
}

export type ThemeMode = "system" | "light" | "dark";

export interface ShortcutMap {
  toggle: string;
  pause: string;
}

export interface AppSettings {
  minimizeToTrayOnClose: boolean;
  launchAtStartup: boolean;
  startActivityAfterLaunch: boolean;
  notificationsEnabled: boolean;
  /** repository link shown on the About page — empty = not configured */
  repositoryUrl: string;
}

export interface AppConfig {
  version: number;
  profiles: Profile[];
  activeProfileId: string;
  schedules: Schedule[];
  theme: ThemeMode;
  shortcuts: ShortcutMap;
  settings: AppSettings;
}

export interface LogEntry {
  id: string;
  at: number;
  kind: "info" | "start" | "stop" | "pause" | "resume" | "schedule" | "error";
  message: string;
}

export interface Toast {
  id: string;
  kind: "success" | "error" | "info";
  title: string;
  body?: string;
}

export const MODE_META: Record<
  MovementMode,
  { label: string; blurb: string }
> = {
  simple: {
    label: "Simple",
    blurb: "Small left / right movements at a steady interval.",
  },
  random: {
    label: "Random",
    blurb: "Random direction and distance on every step.",
  },
  circular: {
    label: "Circular",
    blurb: "The cursor traces a small circle and returns.",
  },
  zigzag: {
    label: "Zigzag",
    blurb: "Subtle alternating diagonal movement.",
  },
  natural: {
    label: "Natural",
    blurb: "Human-like drift with variable intervals and distances.",
  },
  custom: {
    label: "Custom",
    blurb: "Your own pattern, amplitude and rhythm.",
  },
};

export const PROFILE_COLORS = [
  "#a3e635",
  "#22d3ee",
  "#f59e0b",
  "#fb7185",
  "#a78bfa",
  "#34d399",
];
