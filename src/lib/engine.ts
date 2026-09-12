/**
 * G1Wiggle — movement engine (pure, deterministic-with-seeded-rng, unit-testable).
 *
 * The engine never moves the OS cursor directly. It produces *excursions*:
 * small offsets relative to a session origin. The desktop shell applies them
 * to the real pointer; the web build renders them on the virtual preview.
 */

import type { Profile, SessionStatus } from "./types";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Bounds {
  width: number;
  height: number;
}

/** Parameters the engine actually needs from a profile. */
export type MovementParams = Pick<
  Profile,
  | "mode"
  | "intervalSec"
  | "minIntervalSec"
  | "maxIntervalSec"
  | "distancePx"
  | "minDistancePx"
  | "maxDistancePx"
  | "randomizePct"
  | "multiDirection"
  | "custom"
>;

/** Deterministic PRNG so tests (and "natural" drift) are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Multiply a base value by `1 ± pct` using rng. pct is 0–100. */
export function applyJitter(base: number, pct: number, rng: () => number): number {
  if (pct <= 0) return base;
  const f = 1 + (rng() * 2 - 1) * (Math.min(pct, 100) / 100);
  return base * f;
}

const MIN_INTERVAL_MS = 500;
const MAX_INTERVAL_MS = 60 * 60 * 1000;

/** Compute the delay before the next movement, honouring mode + randomisation. */
export function computeIntervalMs(p: MovementParams, rng: () => number): number {
  let sec: number;
  if (p.mode === "natural" || p.mode === "custom") {
    const lo = Math.min(p.minIntervalSec, p.maxIntervalSec);
    const hi = Math.max(p.minIntervalSec, p.maxIntervalSec);
    sec = lo + rng() * (hi - lo);
  } else {
    sec = applyJitter(p.intervalSec, p.randomizePct, rng);
  }
  return Math.round(Math.min(Math.max(sec * 1000, MIN_INTERVAL_MS), MAX_INTERVAL_MS));
}

/** Random distance inside the configured range, with jitter applied. */
export function computeDistance(p: MovementParams, rng: () => number): number {
  const lo = Math.min(p.minDistancePx, p.maxDistancePx);
  const hi = Math.max(p.minDistancePx, p.maxDistancePx);
  const base = lo + rng() * (hi - lo);
  const jittered = applyJitter(base, p.randomizePct * 0.5, rng);
  return Math.max(1, Math.min(jittered, Math.max(hi, p.distancePx)));
}

export interface OffsetResult {
  /** offset from the session origin for this step */
  offset: Vec2;
  /** smoothed cursor state used by the natural mode — feed back next call */
  smooth: Vec2;
}

/**
 * Compute the excursion offset (relative to the session origin) for a step.
 * All offsets are bounded so the cursor can never drift away over time.
 */
export function computeOffset(
  p: MovementParams,
  stepIndex: number,
  rng: () => number,
  prevSmooth: Vec2 = { x: 0, y: 0 },
): OffsetResult {
  switch (p.mode) {
    case "simple": {
      const d = computeDistance(p, rng);
      const cycle = p.multiDirection ? stepIndex % 4 : stepIndex % 2;
      const offset: Vec2 =
        cycle === 0
          ? { x: d, y: 0 }
          : cycle === 1
            ? { x: -d, y: 0 }
            : cycle === 2
              ? { x: 0, y: d }
              : { x: 0, y: -d };
      return { offset, smooth: prevSmooth };
    }

    case "random": {
      const theta = rng() * Math.PI * 2;
      const r = computeDistance(p, rng);
      return {
        offset: { x: Math.cos(theta) * r, y: Math.sin(theta) * r },
        smooth: prevSmooth,
      };
    }

    case "circular": {
      const steps = 8;
      const theta = (stepIndex % steps) * ((Math.PI * 2) / steps);
      const r = computeDistance(p, rng);
      return {
        offset: { x: Math.cos(theta) * r, y: Math.sin(theta) * r },
        smooth: prevSmooth,
      };
    }

    case "zigzag": {
      const d = computeDistance(p, rng);
      const h = d / 2;
      const cycle = [
        { x: d, y: -h },
        { x: -d, y: h },
        { x: d, y: h },
        { x: -d, y: -h },
      ];
      return { offset: cycle[stepIndex % 4], smooth: prevSmooth };
    }

    case "natural": {
      const maxR = Math.max(p.maxDistancePx, p.distancePx, 2);
      const pull = 0.55; // pull back toward origin — keeps the wander subtle
      const smooth: Vec2 = {
        x: prevSmooth.x * pull + (rng() * 2 - 1) * maxR * 0.8,
        y: prevSmooth.y * pull + (rng() * 2 - 1) * maxR * 0.8,
      };
      const r = Math.hypot(smooth.x, smooth.y);
      if (r > maxR) {
        smooth.x = (smooth.x / r) * maxR;
        smooth.y = (smooth.y / r) * maxR;
      }
      return { offset: { ...smooth }, smooth };
    }

    case "custom": {
      const { pattern, stepsPerCycle, amplitude, vertical } = p.custom;
      const n = Math.max(2, Math.round(stepsPerCycle));
      const a = Math.max(1, amplitude);
      if (pattern === "orbit") {
        const t = (stepIndex % n) * ((Math.PI * 2) / n);
        return {
          offset: { x: Math.cos(t) * a, y: Math.sin(t) * (vertical ? a : a * 0.35) },
          smooth: prevSmooth,
        };
      }
      if (pattern === "pingpong") {
        // triangle wave on X, gentle sine on Y
        const phase = (stepIndex % (2 * n)) / (2 * n);
        const tri = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
        return {
          offset: {
            x: tri * a,
            y: vertical ? Math.sin(phase * Math.PI * 2) * a * 0.4 : 0,
          },
          smooth: prevSmooth,
        };
      }
      // scatter
      return {
        offset: {
          x: (rng() * 2 - 1) * a,
          y: (rng() * 2 - 1) * (vertical ? a : a * 0.35),
        },
        smooth: prevSmooth,
      };
    }
  }
}

/** Clamp a point inside bounds with a margin. */
export function clampToBounds(p: Vec2, b: Bounds, margin: number): Vec2 {
  return {
    x: Math.min(Math.max(p.x, margin), Math.max(margin, b.width - margin)),
    y: Math.min(Math.max(p.y, margin), Math.max(margin, b.height - margin)),
  };
}

/**
 * Adjust an offset so origin + offset stays inside bounds when edge
 * avoidance is on (hard-clamped to the bounds either way).
 */
export function clampOffset(
  origin: Vec2,
  offset: Vec2,
  b: Bounds,
  margin: number,
  edgeAvoidance: boolean,
): Vec2 {
  const m = edgeAvoidance ? margin : 4;
  const clamped = clampToBounds({ x: origin.x + offset.x, y: origin.y + offset.y }, b, m);
  return { x: clamped.x - origin.x, y: clamped.y - origin.y };
}

/** Keep an origin a safe distance from the edges. */
export function safeOrigin(b: Bounds, margin: number): Vec2 {
  return clampToBounds({ x: b.width / 2, y: b.height / 2 }, b, margin);
}

export function resolveSessionMs(sessionMinutes: number): number | null {
  if (!sessionMinutes || sessionMinutes <= 0) return null;
  return Math.round(sessionMinutes * 60 * 1000);
}

/* ---------------- state machine ---------------- */

export type EngineAction = "start" | "pause" | "resume" | "stop";

const TRANSITIONS: Record<SessionStatus, Partial<Record<EngineAction, SessionStatus>>> = {
  idle: { start: "active" },
  active: { pause: "paused", stop: "idle" },
  paused: { resume: "active", stop: "idle" },
};

/** Returns the next status, or null when the action is illegal. */
export function nextStatus(current: SessionStatus, action: EngineAction): SessionStatus | null {
  return TRANSITIONS[current][action] ?? null;
}

export function canDo(current: SessionStatus, action: EngineAction): boolean {
  return nextStatus(current, action) !== null;
}
