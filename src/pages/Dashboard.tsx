import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  Info,
  Maximize2,
  Pause,
  Play,
  Plus,
  Shield,
  ShieldCheck,
  Square,
} from "lucide-react";
import { Card, Divider } from "../components/controls";
import { CursorStage } from "../components/CursorStage";
import type { PageId } from "../components/Sidebar";
import { getNextScheduled, useStore } from "../store/useStore";
import { describeSchedule } from "../lib/scheduler";
import { formatClock, formatCountdown, formatDateTime, formatHMS, formatMinutes, relativeUntil } from "../lib/time";
import { MODE_META, type LogEntry, type Profile } from "../lib/types";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------------ */

const STATUS = {
  idle: { word: "Stopped", dot: "bg-ink3/50", text: "text-fg3", ring: false },
  active: { word: "Active", dot: "bg-primary", text: "text-primary2", ring: true },
  paused: { word: "Paused", dot: "bg-warning", text: "text-warning", ring: false },
} as const;

function StatusPill() {
  const status = useStore((s) => s.runtime.status);
  const meta = STATUS[status];
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-3 py-1.5">
      <span className="relative flex h-2 w-2 items-center justify-center">
        {meta.ring && (
          <>
            <span className="ring-pulse absolute h-2 w-2 rounded-full bg-primary" />
            <span
              className="ring-pulse absolute h-2 w-2 rounded-full bg-primary"
              style={{ animationDelay: "0.95s" }}
            />
          </>
        )}
        <span className={cn("relative h-2 w-2 rounded-full", meta.dot, meta.ring && "breathe")} />
      </span>
      <span
        className={cn(
          "font-mono text-[11px] font-bold uppercase tracking-[0.18em]",
          meta.text,
        )}
      >
        {meta.word}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */

function CountdownRing({ size = 124 }: { size?: number }) {
  const status = useStore((s) => s.runtime.status);
  const nextInMs = useStore((s) => s.runtime.nextInMs);
  const intervalMs = useStore((s) => s.runtime.intervalCurrentMs);
  const delayRemainingMs = useStore((s) => s.runtime.delayRemainingMs);
  const r = 46;
  const c = 2 * Math.PI * r;
  const progress =
    status !== "idle" && nextInMs !== null && intervalMs
      ? 1 - nextInMs / intervalMs
      : 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 108 108" className="h-full w-full -rotate-90">
        <circle cx="54" cy="54" r={r} fill="none" stroke="var(--c-border)" strokeWidth="5" />
        <motion.circle
          cx="54"
          cy="54"
          r={r}
          fill="none"
          stroke={status === "paused" ? "var(--c-warning)" : "var(--c-primary)"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - Math.min(Math.max(progress, 0), 1)) }}
          transition={{ duration: 0.25, ease: "linear" }}
          style={{ filter: status === "active" ? "drop-shadow(0 0 6px var(--c-primary))" : undefined }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-mono text-[22px] font-bold tabular leading-none",
            status === "idle" ? "text-fg3" : status === "paused" ? "text-warning" : "text-fg",
          )}
        >
          {status === "idle"
            ? "--"
            : delayRemainingMs !== null
              ? formatCountdown(delayRemainingMs)
              : nextInMs === null
                ? "--"
                : formatCountdown(nextInMs)}
        </span>
        <span className="mt-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-fg3">
          {delayRemainingMs !== null && status === "active" ? "starting" : "next move"}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatTile({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-elevated px-3.5 py-3">
      <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-fg3">{label}</div>
      <div
        className={cn(
          "mt-1 truncate text-[14.5px] font-semibold text-fg",
          mono && "font-mono tabular",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function intervalLabel(p: Profile): string {
  if (p.mode === "natural" || p.mode === "custom")
    return `${Math.min(p.minIntervalSec, p.maxIntervalSec)}–${Math.max(p.minIntervalSec, p.maxIntervalSec)} s`;
  return `${p.intervalSec} s${p.randomizePct > 20 ? " ±" : ""}`;
}

function distanceLabel(p: Profile): string {
  return p.maxDistancePx > p.minDistancePx
    ? `${p.minDistancePx}–${p.maxDistancePx} px`
    : `${p.distancePx} px`;
}

/* ------------------------------------------------------------------ */

const LOG_ICONS: Record<LogEntry["kind"], { icon: typeof Play; tint: string }> = {
  start: { icon: Play, tint: "text-primary2" },
  stop: { icon: Square, tint: "text-fg3" },
  pause: { icon: Pause, tint: "text-warning" },
  resume: { icon: Play, tint: "text-primary2" },
  schedule: { icon: CalendarClock, tint: "text-primary2" },
  info: { icon: Info, tint: "text-fg3" },
  error: { icon: AlertTriangle, tint: "text-error" },
};

function ActivityLog() {
  const log = useStore((s) => s.log);
  return (
    <Card title="Activity" description="Session events, newest first.">
      {log.length === 0 ? (
        <p className="py-2 text-[12.5px] text-fg3">
          Quiet so far — starts, pauses and scheduled sessions will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {log.slice(0, 6).map((e) => {
            const { icon: Icon, tint } = LOG_ICONS[e.kind];
            return (
              <li key={e.id} className="flex items-center gap-2.5 py-2">
                <Icon size={13} className={cn("shrink-0", tint)} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg2">
                  {e.message}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-fg3 tabular">
                  {formatClock(e.at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function ScheduleBanner({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const config = useStore((s) => s.config);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);

  const next = getNextScheduled(config);
  const profile = next
    ? (config.profiles.find((p) => p.id === next.schedule.profileId) ?? config.profiles[0])
    : null;

  return (
    <Card
      title="Schedule"
      actions={
        <button
          onClick={() => onNavigate("scheduler")}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-[12px] font-medium text-fg2 transition-colors hover:border-border2 hover:text-fg"
        >
          <Plus size={13} />
          {config.schedules.length === 0 ? "Create" : "Manage"}
        </button>
      }
    >
      {!next || !profile ? (
        <div className="flex items-center gap-3 py-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-elevated text-fg3">
            <CalendarClock size={16} />
          </div>
          <p className="text-[12.5px] leading-relaxed text-fg3">
            Nothing scheduled. Set start &amp; stop times and G1Wiggle will run them automatically.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 py-1">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border",
              next.live
                ? "border-primary/50 bg-primary/10 text-primary2"
                : "border-border bg-elevated text-fg3",
            )}
          >
            <CalendarClock size={16} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-fg">
              {next.schedule.name || describeSchedule(next.schedule)}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-fg3 tabular">
              {next.live
                ? `Running now · ends at ${formatClock(next.window.end)}`
                : `${formatDateTime(next.window.start.getTime())} · ${relativeUntil(next.window.start.getTime(), now)} · ${profile.name}`}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function AnalyticsCard() {
  const stats = useStore((s) => s.stats);
  const timeoutsAvoided = Math.floor(stats.totalKeepAliveMs / (5 * 60 * 1000));

  return (
    <Card
      title="Keep-Alive Insights"
      description="All-time metrics stored privately on this device."
    >
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-elevated px-3.5 py-3">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-fg3">
            Today Active
          </div>
          <div className="mt-1 font-mono text-[16px] font-bold text-fg tabular">
            {formatHMS(stats.todayKeepAliveMs)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-elevated px-3.5 py-3">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-fg3">
            Lifetime Total
          </div>
          <div className="mt-1 font-mono text-[16px] font-bold text-fg tabular">
            {formatHMS(stats.totalKeepAliveMs)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-elevated px-3.5 py-3">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-fg3">
            Movements
          </div>
          <div className="mt-1 font-mono text-[16px] font-bold text-fg tabular">
            {stats.totalMovements.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-elevated px-3.5 py-3">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-fg3">
            Locks Prevented
          </div>
          <div className="mt-1 font-mono text-[16px] font-bold text-primary2 tabular">
            ~{timeoutsAvoided.toLocaleString()}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function ProfileQuickSwitch() {
  const profiles = useStore((s) => s.config.profiles);
  const activeId = useStore((s) => s.config.activeProfileId);
  const setActiveProfile = useStore((s) => s.setActiveProfile);
  const status = useStore((s) => s.runtime.status);
  const toast = useStore((s) => s.toast);
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {profiles.map((p) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            onClick={() => {
              setActiveProfile(p.id);
              if (status !== "idle")
                toast("Profile switched", `“${p.name}” applies from the next movement.`, "info");
            }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all",
              active
                ? "border-primary/60 bg-primary/10 text-fg shadow-[0_0_0_1px_var(--c-primary)]"
                : "border-border bg-elevated text-fg3 hover:border-border2 hover:text-fg2",
            )}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }}
            />
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Dashboard({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const status = useStore((s) => s.runtime.status);
  const elapsedMs = useStore((s) => s.runtime.elapsedMs);
  const movements = useStore((s) => s.runtime.movements);
  const sessionRemainingMs = useStore((s) => s.runtime.sessionRemainingMs);
  const delayRemainingMs = useStore((s) => s.runtime.delayRemainingMs);
  const profile = useStore((s) => {
    const id = s.runtime.currentProfileId ?? s.config.activeProfileId;
    return s.config.profiles.find((p) => p.id === id) ?? s.config.profiles[0];
  });
  const wakeLockActive = useStore((s) => s.wakeLockActive);
  const setAmbientOpen = useStore((s) => s.setAmbientOpen);
  const toggle = useStore((s) => s.toggle);
  const togglePause = useStore((s) => s.togglePause);
  const pauseCombo = useStore((s) => s.config.shortcuts.pause);

  const subtitle =
    status === "active"
      ? delayRemainingMs !== null
        ? `Starting in ${formatCountdown(delayRemainingMs)}…`
        : sessionRemainingMs !== null
          ? `Session ends in ${formatHMS(sessionRemainingMs)}`
          : "Unlimited session — runs until you stop it."
      : status === "paused"
        ? "Paused — resume whenever you're ready."
        : "Ready when you are.";

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">Dashboard</h1>
          <p className="mt-1 text-[13.5px] text-fg3">
            Your activity session at a glance — everything runs locally and offline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAmbientOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-border bg-elevated px-3 py-2 text-[12.5px] font-medium text-fg2 transition-colors hover:border-border2 hover:text-fg"
            title="Open Fullscreen Ambient View (Press F)"
          >
            <Maximize2 size={14} className="text-primary" />
            <span>Ambient View</span>
            <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-fg3">
              F
            </kbd>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-12">
        {/* session card */}
        <div className="min-w-0 2xl:col-span-7">
          <Card className="h-full">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <StatusPill />
                {wakeLockActive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[10.5px] font-semibold text-primary2">
                    <ShieldCheck size={12} className="text-primary" />
                    Wake Lock Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-1 font-mono text-[10.5px] text-fg3">
                    <Shield size={12} />
                    Standby Guard
                  </span>
                )}
              </div>
              <span className="hidden font-mono text-[11px] text-fg3 sm:block">
                {MODE_META[profile.mode].label} mode · {profile.name}
              </span>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-6">
              <div className="min-w-0">
                <div
                  className={cn(
                    "font-mono text-[44px] font-bold leading-none tracking-tight tabular sm:text-[58px]",
                    status === "paused" ? "text-warning" : status === "idle" ? "text-fg3" : "text-fg",
                  )}
                >
                  {formatHMS(elapsedMs)}
                </div>
                <div className="mt-2.5 flex items-center gap-2 text-[12.5px] font-medium text-fg3">
                  <span
                    className={cn(
                      "h-1 w-1 rounded-full",
                      status === "active" ? "breathe bg-primary" : "bg-ink3/50",
                    )}
                  />
                  {subtitle}
                </div>
              </div>
              <CountdownRing />
            </div>

            <div className="mt-7 flex gap-2.5">
              <motion.button
                whileTap={{ scale: 0.975 }}
                onClick={toggle}
                className={cn(
                  "flex h-12 flex-1 items-center justify-center gap-2.5 rounded-xl font-display text-[15px] font-semibold tracking-tight transition-all",
                  status === "idle"
                    ? "bg-primary text-onprimary shadow-[0_10px_30px_-8px_var(--c-primary)] hover:brightness-105"
                    : "border border-border2 bg-elevated text-error hover:border-error/50 hover:bg-error/5",
                )}
              >
                {status === "idle" ? <Play size={17} /> : <Square size={15} />}
                {status === "idle" ? "Start wiggling" : "Stop wiggling"}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={togglePause}
                disabled={status === "idle"}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-elevated text-fg2 transition-colors hover:border-border2 hover:text-fg",
                  status === "idle" && "cursor-not-allowed opacity-35",
                )}
                aria-label={status === "paused" ? "Resume" : "Pause"}
                data-tip={status === "paused" ? `Resume — ${pauseCombo}` : `Pause — ${pauseCombo}`}
              >
                {status === "paused" ? <Play size={16} /> : <Pause size={16} />}
              </motion.button>
            </div>

            <Divider />

            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-fg3">
              Profile
            </div>
            <ProfileQuickSwitch />

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatTile label="Mode" value={MODE_META[profile.mode].label} mono={false} />
              <StatTile label="Interval" value={intervalLabel(profile)} />
              <StatTile label="Distance" value={distanceLabel(profile)} />
              <StatTile label="Movements" value={String(movements)} />
              <StatTile label="Session" value={formatMinutes(profile.sessionMinutes)} mono={false} />
              <StatTile
                label="Keyboard"
                value={profile.keyboard.enabled ? `${profile.keyboard.intervalSec} s` : "Off"}
              />
            </div>
          </Card>
        </div>

        {/* right column — pairs up on medium widths, stacks on wide */}
        <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 2xl:col-span-5 2xl:grid-cols-1">
          <div className="min-w-0 md:col-span-2 2xl:col-span-1">
            <Card title="Live preview" description="Simulated cursor, real engine behaviour.">
              <CursorStage />
            </Card>
          </div>
          <div className="min-w-0">
            <ScheduleBanner onNavigate={onNavigate} />
          </div>
          <div className="min-w-0">
            <ActivityLog />
          </div>
        </div>

        {/* insights span */}
        <div className="min-w-0 2xl:col-span-12">
          <AnalyticsCard />
        </div>
      </div>
    </div>
  );
}
