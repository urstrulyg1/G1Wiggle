import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minimize2, Pause, Play, Shield, ShieldCheck, Square, X } from "lucide-react";
import { formatClock, formatCountdown, formatHMS } from "../lib/time";
import { MODE_META } from "../lib/types";
import { useStore } from "../store/useStore";
import { cn } from "../utils/cn";
import { isMac } from "../platform/detect";

export function AmbientModal() {
  const open = useStore((s) => s.ambientOpen);
  const setOpen = useStore((s) => s.setAmbientOpen);
  const status = useStore((s) => s.runtime.status);
  const elapsedMs = useStore((s) => s.runtime.elapsedMs);
  const nextInMs = useStore((s) => s.runtime.nextInMs);
  const delayRemainingMs = useStore((s) => s.runtime.delayRemainingMs);
  const wakeLockActive = useStore((s) => s.wakeLockActive);
  const toggle = useStore((s) => s.toggle);
  const togglePause = useStore((s) => s.togglePause);

  const profile = useStore((s) => {
    const id = s.runtime.currentProfileId ?? s.config.activeProfileId;
    return s.config.profiles.find((p) => p.id === id) ?? s.config.profiles[0];
  });

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.key === "p" || e.key === "P") {
        togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen, toggle, togglePause]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 p-6 text-white backdrop-blur-xl md:p-12 select-none"
      >
        {/* top navigation bar */}
        <div className={cn("flex items-center justify-between", isMac() && "pl-16 pt-1")}>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-mono font-semibold tracking-wider uppercase",
                wakeLockActive
                  ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_12px_rgba(200,247,91,0.2)]"
                  : "border-white/10 bg-white/5 text-white/50",
              )}
            >
              {wakeLockActive ? <ShieldCheck size={13} className="text-primary" /> : <Shield size={13} />}
              {wakeLockActive ? "Wake Lock Active" : "Standby Guard"}
            </span>

            <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-white/60 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: profile.color }} />
              {profile.name} · {MODE_META[profile.mode].label}
            </span>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-[12px] font-medium text-white/70 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            <span>Exit Fullscreen</span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/60">
              ESC
            </kbd>
            <X size={14} className="ml-1" />
          </button>
        </div>

        {/* central ambient clock & keep-alive monitor */}
        <div className="my-auto flex flex-col items-center justify-center text-center">
          <div className="font-mono text-[72px] font-bold tracking-tight text-white/90 sm:text-[110px] md:text-[140px] leading-none tabular">
            {formatClock(currentTime)}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
                Session Time
              </span>
              <span className="mt-1 font-mono text-[24px] sm:text-[32px] font-bold tabular text-white">
                {formatHMS(elapsedMs)}
              </span>
            </div>

            <div className="h-8 w-px bg-white/10" />

            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
                {delayRemainingMs !== null ? "Starting in" : "Next Movement"}
              </span>
              <span
                className={cn(
                  "mt-1 font-mono text-[24px] sm:text-[32px] font-bold tabular",
                  status === "active" ? "text-primary" : "text-white/40",
                )}
              >
                {status === "idle"
                  ? "--"
                  : delayRemainingMs !== null
                    ? formatCountdown(delayRemainingMs)
                    : nextInMs !== null
                      ? formatCountdown(nextInMs)
                      : "--"}
              </span>
            </div>

            <div className="h-8 w-px bg-white/10" />

            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
                Status
              </span>
              <span
                className={cn(
                  "mt-1 font-mono text-[24px] sm:text-[32px] font-bold uppercase tracking-wider",
                  status === "active"
                    ? "text-primary"
                    : status === "paused"
                      ? "text-amber-400"
                      : "text-white/40",
                )}
              >
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* bottom control dock */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div className="text-[12px] text-white/40">
            Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/70">Space</kbd> to {status === "idle" ? "Start" : "Stop"} · <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/70">P</kbd> to Pause
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={togglePause}
              disabled={status === "idle"}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-all hover:bg-white/10 hover:text-white",
                status === "idle" && "opacity-30 cursor-not-allowed",
              )}
            >
              {status === "paused" ? <Play size={16} /> : <Pause size={16} />}
            </button>

            <button
              onClick={toggle}
              className={cn(
                "flex h-10 items-center gap-2 rounded-xl px-5 font-semibold text-[13px] transition-all",
                status === "idle"
                  ? "bg-primary text-black hover:brightness-110 shadow-[0_0_20px_rgba(200,247,91,0.3)]"
                  : "border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20",
              )}
            >
              {status === "idle" ? <Play size={15} /> : <Square size={15} />}
              {status === "idle" ? "Start Wiggling" : "Stop Wiggling"}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
