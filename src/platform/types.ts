/**
 * G1Wiggle — platform abstraction layer.
 *
 * Every operating-system capability lives behind one of these interfaces.
 * The application never talks to the OS directly; it talks to an adapter.
 * The desktop builds ship native adapters (Windows / macOS / Linux), this
 * web build ships a browser adapter — same interfaces, honest capabilities.
 */

export type OSKind = "windows" | "macos" | "linux" | "unknown";
export type DisplaySession = "x11" | "wayland" | "native" | "unknown";
export type CpuArch = "x64" | "arm64" | "universal" | "unknown";

export type CapabilityState =
  | "available" // real, native, working
  | "emulated" // works, but inside the app sandbox (preview scope)
  | "needs-permission" // OS permission required before it can work
  | "unavailable"; // cannot work in this environment

export interface CapabilityStatus {
  state: CapabilityState;
  detail: string;
}

export interface PlatformCapabilities {
  mouseControl: CapabilityStatus;
  globalShortcuts: CapabilityStatus;
  systemTray: CapabilityStatus;
  startup: CapabilityStatus;
  notifications: CapabilityStatus;
}

export interface EnvironmentInfo {
  os: OSKind;
  osLabel: string;
  arch: CpuArch;
  session: DisplaySession;
  sessionLabel: string;
  runtime: string;
}

export type NotifyPermission = "granted" | "denied" | "default" | "unsupported";

/** MouseController — pointer position + permission handling. */
export interface MouseBridge {
  kind: "native" | "virtual";
  note: string;
  /** macOS: opens System Settings → Privacy & Security → Accessibility. */
  openPermissionSettings?: () => void;
  /** Re-query the OS permission state. */
  recheckPermission?: () => CapabilityStatus;
}

/** NotificationManager */
export interface NotificationBridge {
  permission(): NotifyPermission;
  request(): Promise<NotifyPermission>;
  /** Returns true when a system notification was actually shown. */
  notify(title: string, body?: string): boolean;
}

/** GlobalShortcutManager */
export interface ShortcutBridge {
  scope: "global" | "window";
  register(combo: string, handler: () => void): () => void;
}

/** SystemTray */
export interface TrayBridge {
  kind: "native" | "in-app";
  note: string;
}

/** StartupManager */
export interface StartupBridge {
  kind: "native" | "remembered";
  note: string;
}

export interface ThemeBridge {
  current(): "light" | "dark";
  watch(cb: (scheme: "light" | "dark") => void): () => void;
}

export interface PlatformAdapter {
  environment: EnvironmentInfo;
  capabilities(): PlatformCapabilities;
  mouse: MouseBridge;
  notifications: NotificationBridge;
  shortcuts: ShortcutBridge;
  tray: TrayBridge;
  startup: StartupBridge;
  theme: ThemeBridge;
}

/** Should the UI block with a permission gate for this capability? */
export function needsPermissionGate(c: CapabilityStatus): boolean {
  return c.state === "needs-permission";
}
