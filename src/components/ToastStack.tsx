import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useStore } from "../store/useStore";
import type { Toast } from "../lib/types";
import { cn } from "../utils/cn";

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const TINT = {
  success: "text-primary2",
  error: "text-error",
  info: "text-fg2",
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useStore((s) => s.dismissToast);
  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), 5200);
    return () => clearTimeout(t);
  }, [toast.id, dismiss]);
  const Icon = ICONS[toast.kind];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 480, damping: 34 }}
      className="pointer-events-auto flex w-[320px] items-start gap-3 rounded-xl border border-border bg-elevated p-3.5 shadow-[var(--shadow-pop)]"
    >
      <Icon size={17} className={cn("mt-0.5 shrink-0", TINT[toast.kind])} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-fg">{toast.title}</div>
        {toast.body && (
          <div className="mt-0.5 text-[12px] leading-relaxed text-fg3">{toast.body}</div>
        )}
      </div>
      <button
        onClick={() => dismiss(toast.id)}
        className="rounded-md p-1 text-fg3 transition-colors hover:bg-surface hover:text-fg"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}

export function ToastStack() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-2.5"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
