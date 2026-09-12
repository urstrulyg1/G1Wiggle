/**
 * G1Wiggle — browser platform adapter.
 *
 * Implements the platform interfaces with everything a web sandbox offers.
 * Capabilities are reported *honestly*: the mouse is virtual (it drives the
 * live preview), shortcuts are window-scoped, the tray is in-app, startup is
 * remembered rather than OS-registered. A native desktop adapter swaps these
 * implementations without the application code changing.
 */

import { comboMatches } from "../lib/shortcuts";
import { detectEnvironment } from "./detect";
import type {
  CapabilityStatus,
  EnvironmentInfo,
  NotificationBridge,
  NotifyPermission,
  PlatformAdapter,
  PlatformCapabilities,
  ShortcutBridge,
} from "./types";

class WebNotifications implements NotificationBridge {
  private supported(): boolean {
    return typeof Notification !== "undefined";
  }

  permission(): NotifyPermission {
    if (!this.supported()) return "unsupported";
    return Notification.permission;
  }

  async request(): Promise<NotifyPermission> {
    if (!this.supported()) return "unsupported";
    try {
      return await Notification.requestPermission();
    } catch {
      return "denied";
    }
  }

  notify(title: string, body?: string): boolean {
    if (!this.supported() || Notification.permission !== "granted") return false;
    try {
      new Notification(title, { body, icon: "/icon.svg" });
      return true;
    } catch {
      return false;
    }
  }
}

class WebShortcuts implements ShortcutBridge {
  scope = "window" as const;

  register(combo: string, handler: () => void): () => void {
    if (typeof window === "undefined") return () => undefined;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      )
        return;
      if (comboMatches(e, combo)) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }
}

function mediaQuery(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(query);
}

function createAdapter(): PlatformAdapter {
  const environment: EnvironmentInfo = detectEnvironment();
  const notifications = new WebNotifications();
  const shortcuts = new WebShortcuts();

  const notificationCapability = (): CapabilityStatus => {
    if (typeof Notification === "undefined")
      return {
        state: "unavailable",
        detail: "This browser offers no notification API — in-app toasts are used.",
      };
    if (Notification.permission === "granted")
      return { state: "available", detail: "System notifications are allowed." };
    if (Notification.permission === "default")
      return {
        state: "needs-permission",
        detail: "Browser permission required — enable in Settings → Notifications.",
      };
    return {
      state: "emulated",
      detail: "Blocked by the browser — in-app toasts are used instead.",
    };
  };

  return {
    environment,
    capabilities: (): PlatformCapabilities => ({
      mouseControl: {
        state: "emulated",
        detail:
          "The engine drives the on-screen preview cursor. Packaged desktop builds move the real pointer through the native MouseController.",
      },
      globalShortcuts: {
        state: "emulated",
        detail: "Shortcuts fire while this window is focused — the desktop build registers them with the OS.",
      },
      systemTray: {
        state: "emulated",
        detail: "Rendered in-app — the desktop build uses the Windows notification area / macOS menu bar / Linux StatusNotifierItem.",
      },
      startup: {
        state: "emulated",
        detail: "Your choice is persisted; the desktop build registers it with the OS (Run key / LaunchAgent / XDG autostart).",
      },
      notifications: notificationCapability(),
    }),

    mouse: {
      kind: "virtual",
      note: "Virtual controller — drives the live preview cursor.",
    },

    notifications,
    shortcuts,

    tray: {
      kind: "in-app",
      note: "In-app tray menu (identical items to the native tray).",
    },

    startup: {
      kind: "remembered",
      note: "Preference stored locally; native adapters register it with the OS.",
    },

    theme: {
      current() {
        return mediaQuery("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
      },
      watch(cb) {
        const mq = mediaQuery("(prefers-color-scheme: dark)");
        if (!mq) return () => undefined;
        const handler = () => cb(mq.matches ? "dark" : "light");
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
      },
    },
  };
}

let instance: PlatformAdapter | null = null;

export function getAdapter(): PlatformAdapter {
  if (!instance) instance = createAdapter();
  return instance;
}
