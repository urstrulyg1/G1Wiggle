/**
 * Scheduler tests — windows, recurrence, validation.
 */
import { describe, expect, it } from "vitest";
import {
  activeWindow,
  describeSchedule,
  isWithinWindow,
  nextScheduledWindow,
  nextWindow,
  validateSchedule,
} from "../src/lib/scheduler";
import type { Schedule } from "../src/lib/types";

const s = (patch: Partial<Schedule>): Schedule => ({
  id: "sched_1",
  name: "",
  enabled: true,
  profileId: "profile_x",
  type: "daily",
  date: "",
  days: [],
  startTime: "09:00",
  endTime: "18:00",
  ...patch,
});

// 2025-01-06 was a Monday.
const monday = (h: number, m = 0) => new Date(2025, 0, 6, h, m);
const sunday = (h: number, m = 0) => new Date(2025, 0, 5, h, m);

describe("windows", () => {
  it("weekday schedules only match Mon–Fri", () => {
    const w = s({ type: "weekdays" });
    expect(isWithinWindow(w, monday(10))).toBe(true);
    expect(isWithinWindow(w, monday(18))).toBe(false);
    expect(isWithinWindow(w, sunday(10))).toBe(false);
  });

  it("supports overnight windows", () => {
    const o = s({ startTime: "22:00", endTime: "06:00" });
    expect(isWithinWindow(o, monday(23))).toBe(true);
    expect(isWithinWindow(o, new Date(2025, 0, 7, 3))).toBe(true); // Tue 03:00
    expect(isWithinWindow(o, monday(12))).toBe(false);
  });

  it("custom schedules honour the selected days", () => {
    const c = s({ type: "custom", days: [1, 3] }); // Mon + Wed
    expect(isWithinWindow(c, monday(10))).toBe(true);
    expect(isWithinWindow(c, new Date(2025, 0, 7, 10))).toBe(false); // Tue
    expect(isWithinWindow(c, new Date(2025, 0, 8, 10))).toBe(true); // Wed
  });

  it("one-time schedules fire exactly once", () => {
    const once = s({ type: "once", date: "2025-01-06" });
    expect(isWithinWindow(once, monday(10))).toBe(true);
    expect(isWithinWindow(once, new Date(2025, 0, 7, 10))).toBe(false);
    expect(nextWindow(once, monday(19))).toBeNull();
  });
});

describe("next occurrence", () => {
  it("returns later today when possible, otherwise tomorrow", () => {
    const d = s({});
    const today = nextWindow(d, monday(8));
    expect(today?.start.getDate()).toBe(6);
    const tomorrow = nextWindow(d, monday(19));
    expect(tomorrow?.start.getDate()).toBe(7);
  });

  it("picks the earliest window across schedules", () => {
    const a = s({ id: "a", startTime: "14:00", endTime: "15:00" });
    const b = s({ id: "b", startTime: "10:00", endTime: "11:00" });
    const next = nextScheduledWindow([a, b], monday(8));
    expect(next?.schedule.id).toBe("b");
  });

  it("ignores disabled schedules", () => {
    const off = s({ enabled: false });
    expect(nextWindow(off, monday(8))).toBeNull();
    expect(activeWindow(off, monday(10))).toBeNull();
  });
});

describe("validation + description", () => {
  it("rejects identical start/end, bad days and missing dates", () => {
    expect(validateSchedule(s({ startTime: "09:00", endTime: "09:00" }))).not.toHaveLength(0);
    expect(validateSchedule(s({ type: "custom", days: [] }))).not.toHaveLength(0);
    expect(validateSchedule(s({ type: "once", date: "" }))).not.toHaveLength(0);
    expect(validateSchedule(s({ startTime: "99:99" }))).not.toHaveLength(0);
    expect(validateSchedule(s({}))).toHaveLength(0);
  });

  it("describes schedules for humans", () => {
    expect(describeSchedule(s({ type: "weekdays" }))).toBe("Mon–Fri · 09:00 – 18:00");
    expect(describeSchedule(s({ type: "custom", days: [1, 3] }))).toBe(
      "Mon Wed · 09:00 – 18:00",
    );
  });
});
