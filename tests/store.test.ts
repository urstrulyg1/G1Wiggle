/**
 * Store, persistence and profile-management tests.
 * Run in node — the store guards browser APIs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultConfig,
  importProfiles,
  parseConfig,
  serializeConfig,
  uniqueName,
} from "../src/lib/persistence";
import { useStore } from "../src/store/useStore";

describe("persistence", () => {
  it("round-trips a config", () => {
    const original = defaultConfig();
    original.theme = "dark";
    const { config, repaired } = parseConfig(serializeConfig(original));
    expect(repaired).toBe(false);
    expect(config.theme).toBe("dark");
    expect(config.profiles).toHaveLength(original.profiles.length);
    expect(config.activeProfileId).toBe(original.activeProfileId);
  });

  it("recovers from corrupted data", () => {
    const { config, repaired } = parseConfig("{not json!!");
    expect(repaired).toBe(true);
    expect(config.profiles.length).toBeGreaterThan(0);
  });

  it("repairs invalid fields with clamps", () => {
    const raw = JSON.stringify({
      profiles: [{ id: "x", name: "Bad", mode: "nonsense", intervalSec: -50 }],
      activeProfileId: "missing",
    });
    const { config } = parseConfig(raw);
    expect(config.profiles[0].mode).toBe("simple");
    expect(config.profiles[0].intervalSec).toBeGreaterThan(0);
    expect(config.activeProfileId).toBe(config.profiles[0].id);
  });

  it("generates unique names", () => {
    expect(uniqueName("Work", ["Home"])).toBe("Work");
    expect(uniqueName("Work", ["Work", "work 2"])).toBe("Work 3");
  });

  it("imports and re-identifies profiles", () => {
    const cfg = defaultConfig();
    const json = serializeConfig(cfg) && JSON.stringify({ app: "G1Wiggle", kind: "profiles", version: 1, exportedAt: "", profiles: [cfg.profiles[0]] });
    const imported = importProfiles(json);
    expect(imported).toHaveLength(1);
    expect(imported[0].id).not.toBe(cfg.profiles[0].id);
    expect(() => importProfiles("[]")).toThrow();
    expect(() => importProfiles("{bad")).toThrow();
  });
});

describe("store state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const st = useStore.getState();
    if (st.runtime.status !== "idle") st.stop("user");
  });

  it("start → pause → resume → stop", () => {
    const st = () => useStore.getState();
    expect(st().runtime.status).toBe("idle");

    st().start();
    expect(st().runtime.status).toBe("active");
    expect(st().runtime.sessionTotalMs).toBeNull(); // Default preset is unlimited

    st().start(); // illegal while active — silently ignored
    expect(st().runtime.status).toBe("active");

    st().pause();
    expect(st().runtime.status).toBe("paused");
    const frozen = st().runtime.elapsedMs;

    st().resume();
    expect(st().runtime.status).toBe("active");

    st().stop("user");
    expect(st().runtime.status).toBe("idle");
    expect(st().runtime.movements).toBe(0);
    expect(frozen).toBeGreaterThanOrEqual(0);
    vi.clearAllTimers();
  });

  it("counts movements as timers fire", () => {
    const st = () => useStore.getState();
    st().start();
    vi.advanceTimersByTime(40000); // Default profile: 30 s interval
    expect(st().runtime.movements).toBeGreaterThanOrEqual(1);
    st().stop("user");
    vi.clearAllTimers();
  });
});

describe("profile management", () => {
  it("duplicates with unique names and reassigns on delete", () => {
    const st = () => useStore.getState();
    const before = st().config.profiles.length;
    const target = st().config.activeProfileId;
    st().duplicateProfile(target);
    expect(st().config.profiles.length).toBe(before + 1);
    const names = st().config.profiles.map((p) => p.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);

    const victim = st().config.profiles[st().config.profiles.length - 1];
    st().setActiveProfile(victim.id);
    st().deleteProfile(victim.id);
    expect(st().config.profiles.some((p) => p.id === victim.id)).toBe(false);
    expect(st().config.activeProfileId).not.toBe(victim.id);
    expect(st().config.profiles.some((p) => p.id === st().config.activeProfileId)).toBe(true);
  });

  it("blocks conflicting shortcuts", () => {
    const st = () => useStore.getState();
    const ok = st().setShortcuts({ toggle: "Ctrl+Alt+G", pause: "Ctrl+Alt+G" });
    expect(ok).toBe(false);
    const ok2 = st().setShortcuts({ toggle: "Ctrl+Alt+G", pause: "Ctrl+Alt+P" });
    expect(ok2).toBe(true);
  });
});
