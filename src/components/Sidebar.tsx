import { motion } from "framer-motion";
import {
  CalendarClock,
  Info,
  Keyboard,
  Layers,
  LayoutDashboard,
  Settings2,
} from "lucide-react";
import { LogoLockup } from "./Logo";
import { TrayMenu } from "./TrayMenu";
import { isMac } from "../platform/detect";
import { APP_VERSION, useStore } from "../store/useStore";
import { cn } from "../utils/cn";

export type PageId = "dashboard" | "profiles" | "settings" | "shortcuts" | "scheduler" | "about";

const NAV: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "profiles", label: "Profiles", icon: Layers },
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "scheduler", label: "Scheduler", icon: CalendarClock },
  { id: "about", label: "About", icon: Info },
];

export function Sidebar({
  page,
  onNavigate,
}: {
  page: PageId;
  onNavigate: (p: PageId) => void;
}) {
  const status = useStore((s) => s.runtime.status);
  const isMacOS = isMac();

  return (
    <aside className="flex h-full w-[204px] shrink-0 flex-col border-r border-border bg-surface xl:w-[236px]">
      {/* macOS traffic light clearance & window drag region */}
      <div
        className={cn("px-4 pb-5", isMacOS ? "pt-[52px]" : "pt-5")}
        style={{ WebkitAppRegion: isMacOS ? "drag" : undefined } as React.CSSProperties}
      >
        <div
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          onClick={() => onNavigate("dashboard")}
          className="cursor-pointer transition-opacity hover:opacity-90"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onNavigate("dashboard");
          }}
          aria-label="G1Wiggle Dashboard"
        >
          <LogoLockup />
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
        {NAV.map((item) => {
          const active = item.id === page;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                active ? "text-fg" : "text-fg3 hover:text-fg2",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={{ type: "spring", stiffness: 560, damping: 40 }}
                  className="absolute inset-0 rounded-lg border border-border bg-elevated shadow-sm"
                />
              )}
              <Icon
                size={16}
                className={cn("relative z-10 shrink-0", active && "text-primary2")}
              />
              <span className="relative z-10">{item.label}</span>
              {item.id === "dashboard" && status !== "idle" && (
                <span
                  className={cn(
                    "relative z-10 ml-auto h-1.5 w-1.5 rounded-full",
                    status === "active" ? "breathe bg-primary" : "bg-warning",
                  )}
                />
              )}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2 px-3 pb-3 pt-2">
        <TrayMenu onNavigate={onNavigate} />
        <p className="px-1 pb-1 text-center text-[10px] leading-relaxed text-fg3">
          v{APP_VERSION} · free &amp; open source
          <br />
          no ads · no accounts · no telemetry
        </p>
      </div>
    </aside>
  );
}
