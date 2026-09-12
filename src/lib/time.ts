/** Small time helpers shared across G1Wiggle. */

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** 02:34:18 — hours can exceed 24 for long sessions. */
export function formatHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/** Compact countdown: "8s" under 60s, otherwise "1:24". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${pad2(s)}`;
}

/** Friendly duration: "45 min", "2 h 30 min", "Unlimited". */
export function formatMinutes(min: number): string {
  if (!min || min <= 0) return "Unlimited";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "14:02" for a timestamp, local time. */
export function formatClock(ts: number | Date): string {
  const d = typeof ts === "number" ? new Date(ts) : ts;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "Mon, 12 May · 14:00" style. */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today.getTime() + 86400000);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const dayPart = isToday
    ? "Today"
    : isTomorrow
      ? "Tomorrow"
      : `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
  return `${dayPart} · ${formatClock(d)}`;
}

/** "14:00 – 18:00 in 3 h 12 min" */
export function relativeUntil(ts: number, now = Date.now()): string {
  let ms = ts - now;
  if (ms <= 0) return "now";
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return "in under a minute";
  if (totalMin < 60) return `in ${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return m === 0 ? `in ${h} h` : `in ${h} h ${m} min`;
  const d = Math.floor(h / 24);
  return `in ${d} day${d > 1 ? "s" : ""}`;
}

/** "09:30" -> minutes since midnight. Returns null on malformed input. */
export function parseHHMM(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
