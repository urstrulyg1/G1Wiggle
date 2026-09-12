/**
 * Movement engine tests — deterministic via seeded RNG.
 */
import { describe, expect, it } from "vitest";
import {
  applyJitter,
  canDo,
  clampOffset,
  clampToBounds,
  computeIntervalMs,
  computeOffset,
  mulberry32,
  nextStatus,
  resolveSessionMs,
  type MovementParams,
} from "../src/lib/engine";

const base: MovementParams = {
  mode: "simple",
  intervalSec: 30,
  minIntervalSec: 18,
  maxIntervalSec: 75,
  distancePx: 5,
  minDistancePx: 2,
  maxDistancePx: 9,
  randomizePct: 0,
  multiDirection: false,
  custom: { pattern: "orbit", stepsPerCycle: 8, amplitude: 6, vertical: true },
};

describe("rng + jitter", () => {
  it("mulberry32 is deterministic and inside [0,1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 200; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("applyJitter stays within the ±pct band", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = applyJitter(100, 25, rng);
      expect(v).toBeGreaterThanOrEqual(75);
      expect(v).toBeLessThanOrEqual(125);
    }
    expect(applyJitter(100, 0, rng)).toBe(100);
  });
});

describe("interval generation", () => {
  it("fixed modes use the base interval when randomisation is off", () => {
    const rng = mulberry32(1);
    expect(computeIntervalMs(base, rng)).toBe(30000);
  });

  it("natural mode picks intervals inside [min,max]", () => {
    const rng = mulberry32(99);
    const p = { ...base, mode: "natural" as const };
    for (let i = 0; i < 500; i++) {
      const ms = computeIntervalMs(p, rng);
      expect(ms).toBeGreaterThanOrEqual(18000);
      expect(ms).toBeLessThanOrEqual(75000);
    }
  });

  it("clamps absurd values to safe bounds", () => {
    const rng = mulberry32(3);
    expect(computeIntervalMs({ ...base, intervalSec: 0 }, rng)).toBeGreaterThanOrEqual(500);
    expect(computeIntervalMs({ ...base, intervalSec: 99999 }, rng)).toBeLessThanOrEqual(
      3600000,
    );
  });
});

describe("offset generation", () => {
  it("circular mode stays on a bounded circle", () => {
    const rng = mulberry32(5);
    const p = { ...base, mode: "circular" as const };
    for (let i = 0; i < 32; i++) {
      const { offset } = computeOffset(p, i, rng);
      const r = Math.hypot(offset.x, offset.y);
      expect(r).toBeLessThanOrEqual(Math.max(p.maxDistancePx, p.distancePx) * 1.001);
      expect(r).toBeGreaterThan(0);
    }
  });

  it("zigzag alternates diagonals", () => {
    const rng = mulberry32(5);
    const p = { ...base, mode: "zigzag" as const, randomizePct: 0 };
    const s0 = computeOffset(p, 0, rng);
    const s1 = computeOffset(p, 1, mulberry32(5));
    expect(Math.sign(s0.offset.x)).not.toBe(Math.sign(s1.offset.x));
    expect(Math.sign(s0.offset.y)).not.toBe(Math.sign(s1.offset.y));
  });

  it("random mode never exceeds the max radius", () => {
    const rng = mulberry32(11);
    const p = { ...base, mode: "random" as const, randomizePct: 20 };
    for (let i = 0; i < 500; i++) {
      const { offset } = computeOffset(p, i, rng);
      expect(Math.hypot(offset.x, offset.y)).toBeLessThanOrEqual(
        Math.max(p.maxDistancePx, p.distancePx) + 1e-6,
      );
    }
  });

  it("natural mode cannot drift away over long sessions", () => {
    const rng = mulberry32(77);
    const p = { ...base, mode: "natural" as const };
    let smooth = { x: 0, y: 0 };
    for (let i = 0; i < 2000; i++) {
      const r = computeOffset(p, i, rng, smooth);
      smooth = r.smooth;
      expect(Math.hypot(r.offset.x, r.offset.y)).toBeLessThanOrEqual(
        Math.max(p.maxDistancePx, p.distancePx) + 1e-6,
      );
    }
  });

  it("simple mode alternates and honours multi-direction", () => {
    const rng = mulberry32(2);
    const one = computeOffset({ ...base }, 0, rng).offset;
    const two = computeOffset({ ...base }, 1, rng).offset;
    expect(one.x).toBeGreaterThan(0);
    expect(two.x).toBeLessThan(0);
    const m1 = computeOffset({ ...base, multiDirection: true }, 2, rng).offset;
    expect(m1.y).toBeGreaterThan(0);
  });
});

describe("bounds", () => {
  const b = { width: 960, height: 540 };
  it("clamps points inside bounds", () => {
    expect(clampToBounds({ x: -50, y: 900 }, b, 46)).toEqual({ x: 46, y: 494 });
  });

  it("edge avoidance keeps the target away from edges", () => {
    const origin = { x: 950, y: 60 };
    const offset = clampOffset(origin, { x: 40, y: 0 }, b, 46, true);
    expect(origin.x + offset.x).toBeLessThanOrEqual(960 - 46);
  });

  it("without avoidance we still stay on screen", () => {
    const origin = { x: 950, y: 60 };
    const offset = clampOffset(origin, { x: 400, y: 0 }, b, 46, false);
    expect(origin.x + offset.x).toBeLessThanOrEqual(956);
  });
});

describe("sessions + state machine", () => {
  it("resolves session durations", () => {
    expect(resolveSessionMs(0)).toBeNull();
    expect(resolveSessionMs(90)).toBe(90 * 60 * 1000);
  });

  it("enforces legal transitions only", () => {
    expect(nextStatus("idle", "start")).toBe("active");
    expect(nextStatus("active", "pause")).toBe("paused");
    expect(nextStatus("paused", "resume")).toBe("active");
    expect(nextStatus("paused", "stop")).toBe("idle");
    expect(nextStatus("active", "stop")).toBe("idle");
    expect(nextStatus("idle", "pause")).toBeNull();
    expect(nextStatus("idle", "resume")).toBeNull();
    expect(nextStatus("paused", "start")).toBeNull();
    expect(canDo("active", "pause")).toBe(true);
    expect(canDo("idle", "stop")).toBe(false);
  });
});
