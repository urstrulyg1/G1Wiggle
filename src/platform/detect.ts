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
  runtime: "Web runtime",
};

export function detectEnvironment(): EnvironmentInfo {
  if (typeof navigator === "undefined") return { ...FALLBACK };
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";

  const isStandalone =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;

  const isElectron =
    typeof navigator !== "undefined" &&
    (/Electron/i.test(ua) ||
      (typeof window !== "undefined" && Boolean((window as unknown as { electronAPI?: unknown }).electronAPI)));

  let env: EnvironmentInfo = {
    ...FALLBACK,
    runtime: isElectron
      ? "Desktop Native (Electron)"
      : isStandalone
        ? "Standalone PWA"
        : "Web browser runtime",
  };

  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    env = {
      ...env,
      os: "windows",
      osLabel: "Windows 10 / 11",
      session: "native",
      sessionLabel: "Windows Desktop",
    };
  } else if (/Mac/i.test(platform) || /Mac OS X/i.test(ua)) {
    env = {
      ...env,
      os: "macos",
      osLabel: "macOS",
      session: "native",
      sessionLabel: "macOS Aqua",
    };
  } else if (/Linux/i.test(platform + ua)) {
    env = {
      ...env,
      os: "linux",
      osLabel: "Linux",
      session: "unknown",
      sessionLabel: "X11 / Wayland",
    };
  }

  if (/arm64|aarch64/i.test(ua)) {
    env.arch = "arm64";
  } else if (env.os === "macos") {
    try {
      if (typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl");
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        const renderer = ext ? gl?.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "";
        if (/Apple/i.test(renderer)) {
          env.arch = "arm64";
        } else {
          env.arch = "universal";
        }
      } else {
        env.arch = "universal";
      }
    } catch {
      env.arch = "universal";
    }
  } else if (env.os !== "unknown") {
    env.arch = "x64";
  }

  return env;
}
