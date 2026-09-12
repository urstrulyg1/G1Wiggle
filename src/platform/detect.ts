/**
 * G1Wiggle — environment detection (node-safe).
 *
 * The web build can only see what the browser exposes. Native desktop
 * adapters replace these values with exact OS/arch/session information —
 * including real X11 vs Wayland detection on Linux.
 */

import type { EnvironmentInfo } from "./types";

const FALLBACK: EnvironmentInfo = {
  os: "unknown",
  osLabel: "Unknown OS",
  arch: "unknown",
  session: "unknown",
  sessionLabel: "Unknown session",
  runtime: "Web preview",
};

export function detectEnvironment(): EnvironmentInfo {
  if (typeof navigator === "undefined") return { ...FALLBACK };
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";

  let env: EnvironmentInfo = { ...FALLBACK };

  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    env = {
      ...env,
      os: "windows",
      osLabel: "Windows 10 / 11",
      session: "native",
      sessionLabel: "Windows desktop",
    };
  } else if (/Mac/i.test(platform) || /Mac OS X/i.test(ua)) {
    env = {
      ...env,
      os: "macos",
      osLabel: "macOS (Intel & Apple Silicon)",
      session: "native",
      sessionLabel: "macOS Aqua",
    };
  } else if (/Linux/i.test(platform + ua)) {
    env = {
      ...env,
      os: "linux",
      osLabel: "Linux",
      session: "unknown",
      sessionLabel: "X11 / Wayland — resolved at runtime by the desktop build",
    };
  }

  if (/arm64|aarch64/i.test(ua)) env.arch = "arm64";
  else if (env.os !== "unknown") env.arch = "x64";

  return env;
}
