/**
 * Platform abstraction layer tests.
 */
import { describe, expect, it } from "vitest";
import { detectEnvironment } from "../src/platform/detect";
import { needsPermissionGate } from "../src/platform/types";
import { getAdapter } from "../src/platform/web";

describe("environment detection", () => {
  it("returns a valid shape even outside a browser", () => {
    const env = detectEnvironment();
    expect(["windows", "macos", "linux", "unknown"]).toContain(env.os);
    expect(typeof env.osLabel).toBe("string");
    expect(["x11", "wayland", "native", "unknown"]).toContain(env.session);
    expect(typeof env.runtime).toBe("string");
  });
});

describe("platform adapter", () => {
  it("exposes every capability with an honest state", () => {
    const caps = getAdapter().capabilities();
    const states = Object.values(caps).map((c) => c.state);
    for (const s of states)
      expect(["available", "emulated", "needs-permission", "unavailable"]).toContain(s);
  });

  it("never pretends sandboxed features are native", () => {
    const adapter = getAdapter();
    expect(adapter.mouse.kind).toBe("virtual");
    expect(adapter.tray.kind).toBe("in-app");
    expect(adapter.startup.kind).toBe("remembered");
    expect(["window", "global"]).toContain(adapter.shortcuts.scope);
    // web sandbox must label the key capabilities as emulated
    const caps = adapter.capabilities();
    expect(caps.mouseControl.state).toBe("emulated");
    expect(caps.systemTray.state).toBe("emulated");
    expect(adapter.capabilities()).toEqual(caps); // stable shape
  });

  it("shortcut bridge returns a working unsubscribe", () => {
    const off = getAdapter().shortcuts.register("Ctrl+Alt+Z", () => undefined);
    expect(typeof off).toBe("function");
    expect(() => off()).not.toThrow();
  });
});

describe("permission gate predicate", () => {
  it("only gates on needs-permission", () => {
    expect(needsPermissionGate({ state: "needs-permission", detail: "" })).toBe(true);
    expect(needsPermissionGate({ state: "available", detail: "" })).toBe(false);
    expect(needsPermissionGate({ state: "emulated", detail: "" })).toBe(false);
    expect(needsPermissionGate({ state: "unavailable", detail: "" })).toBe(false);
  });
});
