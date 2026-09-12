import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MousePointerClick, Pause, Play, RotateCcw } from "lucide-react";
import { Card } from "../components/controls";
import { useStore } from "../store/useStore";
import { DEFAULT_SHORTCUTS } from "../lib/persistence";
import { comboFromEvent, comboLabel, reservedWarning } from "../lib/shortcuts";
import { cn } from "../utils/cn";

type Action = "toggle" | "pause";

const ACTIONS: {
  id: Action;
  title: string;
  hint: string;
  icon: typeof Play;
}[] = [
  {
    id: "toggle",
    title: "Start / Stop",
    hint: "Begin a session, or stop the running one.",
    icon: MousePointerClick,
  },
  {
    id: "pause",
    title: "Pause / Resume",
    hint: "Temporarily hold the current session.",
    icon: Pause,
  },
];

function KeyCombo({ combo }: { combo: string }) {
  return (
    <span className="flex items-center gap-1">
      {comboLabel(combo).map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-[11px] text-fg3">+</span>}
          <kbd className="kbd">{part}</kbd>
        </span>
      ))}
    </span>
  );
}

export function ShortcutsPage() {
  const shortcuts = useStore((s) => s.config.shortcuts);
  const setShortcuts = useStore((s) => s.setShortcuts);
  const toast = useStore((s) => s.toast);
  const [recording, setRecording] = useState<Action | null>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(null);
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return;
      const next = { ...useStore.getState().config.shortcuts, [recording]: combo };
      const conflict = Object.entries(next).find(([k, v]) => k !== recording && v === combo);
      if (conflict) {
        toast(
          "Shortcut conflict",
          `“${combo}” is already used by ${conflict[0] === "toggle" ? "Start / Stop" : "Pause / Resume"}.`,
          "error",
        );
        setRecording(null);
        return;
      }
      const warning = reservedWarning(combo);
      if (warning) toast("Heads up", warning, "info");
      setShortcuts(next);
      toast("Shortcut updated", `${combo} is now bound.`, "success");
      setRecording(null);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [recording, setShortcuts, toast]);

  return (
    <div className="mx-auto w-full max-w-[820px]">
      <header className="mb-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">Shortcuts</h1>
        <p className="mt-1 text-[13.5px] text-fg3">
          Global hotkeys, configurable. The packaged desktop build registers them with the OS;
          the web build honours them while this window is focused.
        </p>
      </header>

      <div className="space-y-4">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          const isRecording = recording === a.id;
          return (
            <Card key={a.id}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-elevated text-primary2">
                    <Icon size={17} />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-fg">{a.title}</div>
                    <div className="mt-0.5 text-[12px] text-fg3">{a.hint}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <KeyCombo combo={shortcuts[a.id]} />
                  <button
                    onClick={() => setRecording(isRecording ? null : a.id)}
                    className={cn(
                      "rounded-xl border px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
                      isRecording
                        ? "border-primary bg-primary/10 text-primary2"
                        : "border-border bg-elevated text-fg2 hover:border-border2 hover:text-fg",
                    )}
                  >
                    {isRecording ? "Listening…" : "Record"}
                  </button>
                </div>
              </div>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-center text-[13px] font-medium text-fg2">
                    Press a key combination — <span className="text-fg3">Esc to cancel</span>
                  </div>
                </motion.div>
              )}
            </Card>
          );
        })}

        <Card title="Defaults">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-fg3">
              Defaults are <KeyCombo combo={DEFAULT_SHORTCUTS.toggle} /> for Start / Stop and{" "}
              <KeyCombo combo={DEFAULT_SHORTCUTS.pause} /> for Pause / Resume.
            </p>
            <button
              onClick={() => {
                setShortcuts({ ...DEFAULT_SHORTCUTS });
                toast("Shortcuts reset", "Defaults restored.", "success");
              }}
              className="flex items-center gap-2 rounded-xl border border-border bg-elevated px-3.5 py-2 text-[12.5px] font-semibold text-fg2 transition-colors hover:border-border2 hover:text-fg"
            >
              <RotateCcw size={13} />
              Reset to defaults
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
