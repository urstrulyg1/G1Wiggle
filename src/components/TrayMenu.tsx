import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AppWindow,
  Check,
  ChevronUp,
  Pause,
  Play,
  Power,
  Settings2,
  Square,
} from "lucide-react";
import { APP_VERSION, useStore } from "../store/useStore";
import { LogoMark } from "./Logo";
import type { PageId } from "./Sidebar";
import { cn } from "../utils/cn";

/**
 * The tray — in the packaged desktop app this lives in the OS menu bar /
 * notification area. The web build renders the identical menu in-app.
 */
export function TrayMenu({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const status = useStore((s) => s.runtime.status);
  const profiles = useStore((s) => s.config.profiles);
  const activeProfileId = useStore((s) => s.config.activeProfileId);
  const setActiveProfile = useStore((s) => s.setActiveProfile);
  const start = useStore((s) => s.start);
  const pause = useStore((s) => s.pause);
  const resume = useStore((s) => s.resume);
  const stop = useStore((s) => s.stop);
  const toast = useStore((s) => s.toast);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const statusDot =
    status === "active" ? "bg-primary" : status === "paused" ? "bg-warning" : "bg-ink3/60";
  const statusText =
    status === "active" ? "Active" : status === "paused" ? "Paused" : "Stopped";

  const Item = ({
    icon: Icon,
    label,
    onClick,
    disabled,
  }: {
    icon: typeof Play;
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button
      disabled={disabled}
      onClick={() => {
        onClick();
        setOpen(false);
      }}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[12.5px] font-medium transition-colors",
        disabled ? "cursor-default text-fg3/50" : "text-fg2 hover:bg-surface hover:text-fg",
      )}
    >
      <Icon size={14} className="shrink-0" />
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
            className="absolute bottom-full left-0 z-[70] mb-2 w-[228px] overflow-hidden rounded-xl border border-border bg-elevated py-1.5 shadow-[var(--shadow-pop)]"
          >
            <div className="flex items-center gap-2 px-3 pb-1.5 pt-1">
              <LogoMark size={15} />
              <span className="font-display text-[12px] font-bold text-fg">G1Wiggle</span>
              <span className="ml-auto font-mono text-[10px] text-fg3">v{APP_VERSION}</span>
            </div>
            <div className="flex items-center gap-2 px-3 pb-1.5 pt-0.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
              <span className="text-[11.5px] font-medium text-fg3">{statusText}</span>
            </div>
            <div className="mx-2 my-1 h-px bg-border" />
            <Item icon={Play} label="Start" onClick={() => start()} disabled={status !== "idle"} />
            <Item
              icon={status === "paused" ? Play : Pause}
              label={status === "paused" ? "Resume" : "Pause"}
              onClick={() => (status === "paused" ? resume() : pause())}
              disabled={status !== "idle"}
            />
            <Item icon={Square} label="Stop" onClick={() => stop("user")} disabled={status === "idle"} />
            <div className="mx-2 my-1 h-px bg-border" />
            <div className="px-3 pb-1 pt-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-fg3">
              Current profile
            </div>
            <div className="max-h-[132px] overflow-y-auto">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveProfile(p.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-[6px] text-left text-[12.5px] font-medium text-fg2 transition-colors hover:bg-surface hover:text-fg"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: p.color, boxShadow: `0 0 6px ${p.color}66` }}
                  />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.id === activeProfileId && <Check size={13} className="text-primary2" />}
                </button>
              ))}
            </div>
            <div className="mx-2 my-1 h-px bg-border" />
            <Item icon={AppWindow} label="Open G1Wiggle" onClick={() => onNavigate("dashboard")} />
            <Item icon={Settings2} label="Settings" onClick={() => onNavigate("settings")} />
            <div className="mx-2 my-1 h-px bg-border" />
            <Item
              icon={Power}
              label="Quit"
              onClick={() =>
                toast(
                  "The desktop build quits here",
                  "In the web preview, G1Wiggle simply stays open.",
                  "info",
                )
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-elevated px-3 py-2.5 text-left transition-colors hover:border-border2"
        aria-label="Open tray menu"
      >
        <span className="relative">
          <LogoMark size={20} />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-elevated",
              statusDot,
            )}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold leading-tight text-fg">G1Wiggle</span>
          <span className="block text-[10.5px] leading-tight text-fg3">{statusText}</span>
        </span>
        <ChevronUp
          size={14}
          className={cn("text-fg3 transition-transform", !open && "rotate-180")}
        />
      </button>
    </div>
  );
}
