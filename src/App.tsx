import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PermissionGate } from "./components/PermissionGate";
import { Sidebar, type PageId } from "./components/Sidebar";
import { ToastStack } from "./components/ToastStack";
import { About } from "./pages/About";
import { Dashboard } from "./pages/Dashboard";
import { Profiles } from "./pages/Profiles";
import { SchedulerPage } from "./pages/SchedulerPage";
import { Settings } from "./pages/Settings";
import { ShortcutsPage } from "./pages/ShortcutsPage";
import { getAdapter } from "./platform/web";
import { schedulerTick, useStore } from "./store/useStore";

export default function App() {
  const [page, setPage] = useState<PageId>("dashboard");
  const theme = useStore((s) => s.config.theme);
  const shortcuts = useStore((s) => s.config.shortcuts);
  const mainRef = useRef<HTMLElement>(null);

  /* theme — resolved through the platform adapter, tracked live */
  useEffect(() => {
    const adapter = getAdapter();
    const apply = (scheme: "light" | "dark") => {
      const dark = theme === "dark" || (theme === "system" && scheme === "dark");
      document.documentElement.classList.toggle("dark", dark);
    };
    apply(adapter.theme.current());
    return adapter.theme.watch(apply);
  }, [theme]);

  /* shortcuts — registered through the platform adapter */
  useEffect(() => {
    const adapter = getAdapter();
    const offToggle = adapter.shortcuts.register(shortcuts.toggle, () =>
      useStore.getState().toggle(),
    );
    const offPause = adapter.shortcuts.register(shortcuts.pause, () =>
      useStore.getState().togglePause(),
    );
    return () => {
      offToggle();
      offPause();
    };
  }, [shortcuts]);

  /* scheduler supervisor — light 5 s cadence */
  useEffect(() => {
    schedulerTick(useStore.getState());
    const t = setInterval(() => schedulerTick(useStore.getState()), 5000);
    return () => clearInterval(t);
  }, []);

  /* mount-only notices + explicit auto-start preference */
  useEffect(() => {
    const s = useStore.getState();
    if (s.configuredFromBackup) {
      s.toast(
        "Settings were reset",
        "The saved configuration was unreadable, so defaults were restored.",
        "error",
      );
    }
    if (s.config.settings.startActivityAfterLaunch && s.runtime.status === "idle") {
      s.start();
      s.toast("Auto-started", "Your startup preferences began a session.", "info");
    }
  }, []);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [page]);

  const navigate = (p: PageId) => setPage(p);

  const content =
    page === "dashboard" ? (
      <Dashboard onNavigate={navigate} />
    ) : page === "profiles" ? (
      <Profiles />
    ) : page === "settings" ? (
      <Settings />
    ) : page === "shortcuts" ? (
      <ShortcutsPage />
    ) : page === "scheduler" ? (
      <SchedulerPage />
    ) : (
      <About />
    );

  return (
    <div className="relative flex h-full overflow-hidden bg-bg">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="drift-glow absolute -right-40 -top-40 h-[540px] w-[540px] rounded-full opacity-60"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in srgb, var(--c-primary) 6%, transparent), transparent)",
          }}
        />
        <div
          className="absolute -bottom-56 left-24 h-[480px] w-[480px] rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in srgb, var(--c-info) 5%, transparent), transparent)",
          }}
        />
      </div>

      <Sidebar page={page} onNavigate={navigate} />

      <main ref={mainRef} className="relative flex-1 overflow-y-auto px-5 py-6 lg:px-8 lg:py-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </main>

      <PermissionGate />
      <ToastStack />
    </div>
  );
}
