import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, Radio } from "lucide-react";
import { STAGE, useStore } from "../store/useStore";
import { MODE_META } from "../lib/types";

const pct = (v: number, max: number) => `${((v / max) * 100).toFixed(3)}%`;

/**
 * The virtual desktop: a live, honest preview of what G1Wiggle's engine is
 * doing. Every excursion the engine computes is rendered here — the same
 * offsets a desktop shell would apply to the real pointer.
 */
export function CursorStage() {
  const cursor = useStore((s) => s.runtime.cursor);
  const trail = useStore((s) => s.runtime.trail);
  const status = useStore((s) => s.runtime.status);
  const pulseAt = useStore((s) => s.runtime.pulseAt);
  const lastKeyboardAt = useStore((s) => s.runtime.lastKeyboardAt);
  const profile = useStore((s) => {
    const id = s.runtime.currentProfileId ?? s.config.activeProfileId;
    return s.config.profiles.find((p) => p.id === id) ?? s.config.profiles[0];
  });

  const points = useMemo(() => trail.slice(-26), [trail]);
  const segments = useMemo(
    () =>
      points.slice(1).map((p, i) => ({
        a: points[i],
        b: p,
        opacity: ((i + 1) / Math.max(1, points.length)) * 0.4,
      })),
    [points],
  );

  // deterministic pseudo-random spot for the keyboard ripple
  const keyPos = useMemo(() => {
    const t = lastKeyboardAt ?? 0;
    const x = 12 + (((t * 2654435761) % 1000) / 1000) * 68;
    const y = 30 + (((t * 40503) % 1000) / 1000) * 45;
    return { x, y };
  }, [lastKeyboardAt]);

  return (
    <div className="relative aspect-[16/9] w-full select-none overflow-hidden rounded-xl border border-border2 bg-[#0c0e11]">
      {/* wallpaper */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 18% 12%, rgba(163,230,53,0.07), transparent 60%), radial-gradient(55% 60% at 85% 88%, rgba(34,211,238,0.08), transparent 60%), radial-gradient(45% 45% at 62% 38%, rgba(129,140,248,0.07), transparent 65%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />

      {/* menu bar */}
      <div className="absolute inset-x-0 top-0 flex h-6 items-center border-b border-white/5 bg-white/[0.035] px-3 backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-[#ff5f57]/70" />
        <span className="ml-1 h-2 w-2 rounded-full bg-[#febc2e]/70" />
        <span className="ml-1 h-2 w-2 rounded-full bg-[#28c840]/70" />
        <span className="flex-1 text-center font-display text-[9px] font-semibold tracking-[0.18em] text-white/25">
          G1WIGGLE VIRTUAL DESKTOP
        </span>
        <span className="h-2 w-2 rounded-full bg-white/10" />
      </div>

      {/* ambient windows */}
      <div className="absolute left-[6%] top-[17%] h-[50%] w-[37%] rounded-lg border border-white/[0.07] bg-white/[0.03] shadow-2xl">
        <div className="h-4.5 rounded-t-lg border-b border-white/[0.06] bg-white/[0.04] px-2 pt-1.5">
          <div className="h-1 w-14 rounded-full bg-white/15" />
        </div>
        <div className="space-y-2 p-3">
          <div className="h-1.5 w-4/5 rounded-full bg-white/[0.08]" />
          <div className="h-1.5 w-3/5 rounded-full bg-white/[0.06]" />
          <div className="h-1.5 w-2/3 rounded-full bg-white/[0.05]" />
          <div className="mt-3 h-8 w-full rounded-md bg-white/[0.04]" />
        </div>
      </div>
      <div className="absolute right-[7%] top-[34%] h-[40%] w-[29%] rounded-lg border border-white/[0.07] bg-white/[0.025] shadow-2xl">
        <div className="h-4.5 rounded-t-lg border-b border-white/[0.06] bg-white/[0.04]" />
        <div className="space-y-2 p-3">
          <div className="h-1.5 w-2/3 rounded-full bg-white/[0.08]" />
          <div className="h-1.5 w-1/2 rounded-full bg-white/[0.06]" />
        </div>
      </div>

      {/* trail */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
        preserveAspectRatio="none"
      >
        {segments.map((s, i) => (
          <line
            key={i}
            x1={s.a.x}
            y1={s.a.y}
            x2={s.b.x}
            y2={s.b.y}
            stroke="#A3E635"
            strokeWidth={1.6}
            strokeOpacity={s.opacity}
            strokeLinecap="round"
          />
        ))}
        {points.map((p, i) => (
          <circle
            key={`${p.t}-${i}`}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 3.4 : 2.2}
            fill="#A3E635"
            fillOpacity={((i + 1) / points.length) * 0.75}
          />
        ))}
      </svg>

      {/* movement pulse */}
      <AnimatePresence>
        {pulseAt !== null && status === "active" && Date.now() - pulseAt < 1500 && (
          <motion.span
            key={pulseAt}
            className="pointer-events-none absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary"
            style={{ left: pct(cursor.x, STAGE.width), top: pct(cursor.y, STAGE.height) }}
            initial={{ scale: 0.25, opacity: 0.65 }}
            animate={{ scale: 1.9, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* keyboard ripple */}
      <AnimatePresence>
        {profile.keyboard.enabled && lastKeyboardAt !== null && status === "active" && Date.now() - lastKeyboardAt < 2000 && (
          <motion.div
            key={lastKeyboardAt}
            className="pointer-events-none absolute flex -translate-x-1/2 items-center gap-1 rounded-md border border-white/15 bg-black/45 px-1.5 py-1 backdrop-blur-sm"
            style={{ left: `${keyPos.x}%`, top: `${keyPos.y}%` }}
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -8], scale: 1 }}
            transition={{ duration: 1.6, times: [0, 0.18, 0.72, 1], ease: "easeOut" }}
          >
            <Keyboard size={11} className="text-white/80" />
            <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-white/60">
              key
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the cursor */}
      <motion.div
        className="pointer-events-none absolute z-10"
        animate={{ left: pct(cursor.x, STAGE.width), top: pct(cursor.y, STAGE.height) }}
        transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.7 }}
        style={{ opacity: status === "idle" ? 0.4 : 1 }}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 14 16"
          className="-translate-x-[1px] -translate-y-[1px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
        >
          <path
            d="M1 1 L1 12.6 L4.3 9.6 L6.6 14 L8.8 12.9 L6.5 8.6 L11.2 8.6 Z"
            fill="#ffffff"
            stroke="#101010"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
        {status === "paused" && (
          <span className="absolute left-3 top-3 h-2 w-2 rounded-full bg-warning ring-2 ring-black/50" />
        )}
      </motion.div>

      {/* overlays */}
      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 backdrop-blur-sm">
        <span className="relative flex h-1.5 w-1.5">
          {status === "active" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
          )}
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
              status === "active" ? "bg-primary" : status === "paused" ? "bg-warning" : "bg-white/30"
            }`}
          />
        </span>
        <span className="flex items-center gap-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
          <Radio size={10} />
          Live preview
        </span>
        <span className="h-2.5 w-px bg-white/15" />
        <span className="max-w-[140px] truncate text-[9.5px] font-medium tracking-wide text-white/45">
          {profile.name} · {MODE_META[profile.mode].label}
        </span>
      </div>
      {profile.keyboard.enabled && (
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 py-1 backdrop-blur-sm">
          <Keyboard size={10} className="text-amber-200/90" />
          <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-amber-100/80">
            Keyboard sim on
          </span>
        </div>
      )}

      {/* glare */}
      <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.05] via-transparent to-transparent" />
    </div>
  );
}
