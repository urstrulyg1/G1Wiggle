import { useState } from "react";
import { Bell, MonitorCheck, RotateCcw, ShieldCheck } from "lucide-react";
import { Card, Row, Segmented, Toggle } from "../components/controls";
import { getAdapter } from "../platform/web";
import type { CapabilityState } from "../platform/types";
import { useStore } from "../store/useStore";
import type { ThemeMode } from "../lib/types";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------------ */

const STATE_META: Record<CapabilityState, { label: string; classes: string }> = {
  available: { label: "Native", classes: "border-success/40 bg-success/10 text-success" },
  emulated: { label: "In-app", classes: "border-info/40 bg-info/10 text-info" },
  "needs-permission": {
    label: "Needs permission",
    classes: "border-warning/40 bg-warning/10 text-warning",
  },
  unavailable: { label: "Unavailable", classes: "border-border bg-elevated text-fg3" },
};

function CapabilityRow({ label, cap }: { label: string; cap: { state: CapabilityState; detail: string } }) {
  const meta = STATE_META[cap.state];
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg">{label}</div>
        <div className="mt-0.5 text-[12px] leading-relaxed text-fg3">{cap.detail}</div>
      </div>
      <span
        className={cn(
          "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]",
          meta.classes,
        )}
      >
        {meta.label}
      </span>
    </div>
  );
}

const ARCH_LABEL = { x64: "x86-64", arm64: "ARM64", universal: "Universal", unknown: "Detected by desktop build" } as const;

function DesktopIntegration() {
  const adapter = getAdapter();
  const env = adapter.environment;
  const caps = adapter.capabilities();
  return (
    <Card
      title="Desktop integration"
      description="Every OS capability runs through G1Wiggle's platform layer. This is what it reports right now."
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Platform", env.osLabel],
          ["Architecture", ARCH_LABEL[env.arch]],
          ["Session", env.sessionLabel],
          ["Runtime", env.runtime],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-elevated px-3 py-2.5">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-fg3">{k}</div>
            <div className="mt-1 text-[11.5px] font-semibold leading-snug text-fg">{v}</div>
          </div>
        ))}
      </div>

      <div className="divide-y divide-border">
        <CapabilityRow label="Mouse control" cap={caps.mouseControl} />
        <CapabilityRow label="Global shortcuts" cap={caps.globalShortcuts} />
        <CapabilityRow label="System tray" cap={caps.systemTray} />
        <CapabilityRow label="Launch at startup" cap={caps.startup} />
        <CapabilityRow label="Notifications" cap={caps.notifications} />
      </div>

      <p className="mt-4 rounded-xl border border-border bg-elevated px-3.5 py-2.5 text-[12px] leading-relaxed text-fg3">
        Packaged desktop builds replace the in-app bridges with native implementations of the
        same interfaces. On macOS, pointer control requests Accessibility permission with a
        guided first-run flow. On Linux, X11 is fully supported and Wayland uses compositor
        portals where available — any limitation is shown here rather than failing silently.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function NotificationRow() {
  const enabled = useStore((s) => s.config.settings.notificationsEnabled);
  const updateSettings = useStore((s) => s.updateSettings);
  const toast = useStore((s) => s.toast);
  const adapter = getAdapter();
  const permission = adapter.notifications.permission();

  return (
    <>
      <Row
        label="Desktop notifications"
        hint="Session started / stopped / completed, schedule activity and errors."
      >
        <Toggle
          checked={enabled}
          onChange={(v) => {
            updateSettings({ notificationsEnabled: v });
            if (v && permission === "default") {
              adapter.notifications.request().then((p) => {
                if (p !== "granted")
                  toast(
                    "Notifications blocked",
                    "Permission was declined — G1Wiggle will use in-app toasts instead.",
                    "info",
                  );
              });
            }
          }}
          label="Desktop notifications"
        />
      </Row>
      {enabled && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-elevated px-3 py-2 text-[12px] text-fg3">
          <Bell size={13} className={permission === "granted" ? "text-primary2" : "text-warning"} />
          {permission === "unsupported"
            ? "This environment does not support system notifications — in-app toasts are used."
            : permission === "granted"
              ? "System notifications are allowed. Everything happens on-device."
              : permission === "denied"
                ? "System notifications are blocked — in-app toasts are used."
                : "Waiting for notification permission…"}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

export function Settings() {
  const theme = useStore((s) => s.config.theme);
  const setTheme = useStore((s) => s.setTheme);
  const settings = useStore((s) => s.config.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const resetAll = useStore((s) => s.resetAll);
  const [armReset, setArmReset] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <header className="mb-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">Settings</h1>
        <p className="mt-1 text-[13.5px] text-fg3">
          Application preferences — saved locally, never uploaded.
        </p>
      </header>

      <div className="space-y-5">
        <Card title="Appearance" description="Choose how G1Wiggle looks on this device.">
          <Row label="Theme" hint="System follows your OS appearance automatically.">
            <Segmented<ThemeMode>
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              value={theme}
              onChange={setTheme}
            />
          </Row>
        </Card>

        <DesktopIntegration />

        <Card title="Startup" description="What happens when your computer starts G1Wiggle.">
          <Row
            label="Launch G1Wiggle at system startup"
            hint="Registered with your OS by the packaged desktop build."
          >
            <Toggle
              checked={settings.launchAtStartup}
              onChange={(v) =>
                updateSettings({
                  launchAtStartup: v,
                  startActivityAfterLaunch: v ? settings.startActivityAfterLaunch : false,
                })
              }
              label="Launch at startup"
            />
          </Row>
          <Row
            label="Start activity automatically after launch"
            hint="Off by default — G1Wiggle never wiggles unless you asked it to."
          >
            <Toggle
              checked={settings.startActivityAfterLaunch}
              onChange={(v) => updateSettings({ startActivityAfterLaunch: v })}
              disabled={!settings.launchAtStartup}
              label="Start activity after launch"
            />
          </Row>
          {settings.launchAtStartup && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-[12px] text-fg3">
              <MonitorCheck size={13} className="shrink-0 text-primary2" />
              Startup integration is applied by the packaged desktop build; this preview
              remembers your choice and honours auto-start on load.
            </div>
          )}
        </Card>

        <Card title="Window & tray" description="How the main window behaves.">
          <Row
            label="Minimize to tray when closing the window"
            hint="G1Wiggle keeps running quietly; use Quit in the tray menu to exit."
          >
            <Toggle
              checked={settings.minimizeToTrayOnClose}
              onChange={(v) => updateSettings({ minimizeToTrayOnClose: v })}
              label="Minimize to tray on close"
            />
          </Row>
        </Card>

        <Card title="Notifications">
          <NotificationRow />
        </Card>

        <Card title="Data & privacy" description="G1Wiggle is offline-first by design.">
          <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary2" />
            <p className="text-[13px] leading-relaxed text-fg2">
              G1Wiggle is a free, offline-first utility. Your activity stays on your computer —
              configuration is stored locally, nothing is transmitted, and there are no
              accounts, ads or analytics.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <div className="text-[13.5px] font-medium text-fg">Reset everything</div>
              <div className="mt-0.5 text-[12px] text-fg3">
                Restore factory defaults, presets and shortcuts.
              </div>
            </div>
            <button
              onClick={() => {
                if (armReset) {
                  resetAll();
                  setArmReset(false);
                } else {
                  setArmReset(true);
                  setTimeout(() => setArmReset(false), 4000);
                }
              }}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
                armReset
                  ? "border-error bg-error text-white"
                  : "border-border bg-elevated text-error hover:border-error/50",
              )}
            >
              <RotateCcw size={13} />
              {armReset ? "Click again to confirm" : "Reset all"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
