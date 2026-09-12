/**
 * G1Wiggle — schedule logic (pure and unit-testable).
 *
 * A schedule describes a recurring (or one-time) time window during which
 * G1Wiggle should keep the machine active with a given profile.
 */

import type { Schedule } from "./types";
import { DAY_NAMES, parseHHMM } from "./time";

export interface Window {
  start: Date;
  end: Date;
}

function combineDateTime(day: Date, hhmm: string): Date | null {
  const mins = parseHHMM(hhmm);
  if (mins === null) return null;
  const d = new Date(day);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

function matchesDay(s: Schedule, d: Date): boolean {
  if (s.type === "daily") return true;
  if (s.type === "weekdays") {
    const g = d.getDay();
    return g >= 1 && g <= 5;
  }
  if (s.type === "custom") return s.days.includes(d.getDay());
  return false;
}

/** The activity window of a schedule that *starts* on the given calendar day. */
export function windowForDay(s: Schedule, day: Date): Window | null {
  if (s.type === "once") {
    const [y, m, dd] = s.date.split("-").map(Number);
    if (!y || !m || !dd) return null;
    const same =
      day.getFullYear() === y && day.getMonth() === m - 1 && day.getDate() === dd;
    if (!same) return null;
  } else if (!matchesDay(s, day)) {
    return null;
  }
  const start = combineDateTime(day, s.startTime);
  let end = combineDateTime(day, s.endTime);
  if (!start || !end) return null;
  // Overnight windows (e.g. 22:00 → 06:00) spill into the next day.
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

/** All windows overlapping [from-1day, from+370days], earliest first. */
function candidateWindows(s: Schedule, from: Date): Window[] {
  const out: Window[] = [];
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);
  // "once" needs yesterday (overnight spill) + today; recurring checks a year ahead.
  const limit = s.type === "once" ? 0 : 370;
  for (let i = -1; i <= limit; i++) {
    const day = new Date(base.getTime() + i * 24 * 60 * 60 * 1000);
    const w = windowForDay(s, day);
    if (w) out.push(w);
  }
  return out;
}

/** Is `at` inside an active window of this schedule? */
export function isWithinWindow(s: Schedule, at: Date): boolean {
  if (!s.enabled) return false;
  return candidateWindows(s, at).some((w) => at >= w.start && at < w.end);
}

/** The window containing `at`, if any. */
export function activeWindow(s: Schedule, at: Date): Window | null {
  if (!s.enabled) return null;
  for (const w of candidateWindows(s, at)) {
    if (at >= w.start && at < w.end) return w;
  }
  return null;
}

/** The next future window, or null. */
export function nextWindow(s: Schedule, from: Date): Window | null {
  if (!s.enabled) return null;
  for (const w of candidateWindows(s, from)) {
    if (w.end.getTime() > from.getTime()) return w;
  }
  return null;
}

/** Earliest next window across many schedules. */
export function nextScheduledWindow(
  schedules: Schedule[],
  from: Date,
): { schedule: Schedule; window: Window } | null {
  let best: { schedule: Schedule; window: Window } | null = null;
  for (const s of schedules) {
    const w = nextWindow(s, from);
    if (!w) continue;
    if (!best || w.start < best.window.start) best = { schedule: s, window: w };
  }
  return best;
}

/** Human description: "Mon–Fri · 09:00 – 18:00". */
export function describeSchedule(s: Schedule): string {
  const range = `${s.startTime} – ${s.endTime}`;
  let days: string;
  switch (s.type) {
    case "once":
      days = s.date ? `Once · ${s.date}` : "Once";
      break;
    case "daily":
      days = "Every day";
      break;
    case "weekdays":
      days = "Mon–Fri";
      break;
    case "custom": {
      const names = [...s.days].sort((a, b) => a - b).map((d) => DAY_NAMES[d]);
      days = names.length ? names.join(" ") : "No days";
      break;
    }
  }
  return `${days} · ${range}`;
}

/** Validate a schedule; returns a list of human problems (empty = ok). */
export function validateSchedule(s: Schedule): string[] {
  const problems: string[] = [];
  if (parseHHMM(s.startTime) === null) problems.push("Start time is invalid.");
  if (parseHHMM(s.endTime) === null) problems.push("End time is invalid.");
  if (parseHHMM(s.startTime) !== null && s.startTime === s.endTime)
    problems.push("Start and end time cannot be identical.");
  if (s.type === "custom" && s.days.length === 0)
    problems.push("Pick at least one day for a custom schedule.");
  if (s.type === "once") {
    const [y, m, d] = s.date.split("-").map(Number);
    if (!y || !m || !d) problems.push("Pick a date for the one-time schedule.");
  }
  return problems;
}
