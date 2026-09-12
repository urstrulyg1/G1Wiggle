import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Modal } from "./Modal";
import { getAdapter } from "../platform/web";
import { needsPermissionGate } from "../platform/types";
import { useStore } from "../store/useStore";

/**
 * First-run permission gate, driven by the platform adapter.
 *
 * On macOS the native MouseController requires Accessibility permission
 * before anything may move the pointer — the adapter then reports
 * `needs-permission` and this gate appears. It never fails silently and
 * re-checks whenever the app regains focus. (The web adapter controls a
 * virtual cursor and therefore never triggers this gate.)
 */
export function PermissionGate() {
  const toast = useStore((s) => s.toast);
  const [checkCount, setCheckCount] = useState(0);

  const recheck = useCallback(() => setCheckCount((n) => n + 1), []);

  useEffect(() => {
    window.addEventListener("focus", recheck);
    return () => window.removeEventListener("focus", recheck);
  }, [recheck]);

  const adapter = getAdapter();
  void checkCount; // re-read capabilities on every manual/window-focus check
  const status = adapter.capabilities().mouseControl;
  const open = needsPermissionGate(status);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={() => undefined}
      title="G1Wiggle needs Accessibility permission"
      subtitle="Required to control mouse movement."
    >
      <div className="flex items-start gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-warning/40 bg-warning/10 text-warning">
          <ShieldAlert size={19} />
        </div>
        <p className="text-[13px] leading-relaxed text-fg2">
          macOS requires explicit permission before any app may move the pointer. G1Wiggle only
          performs the small, visible movements you configure — it never clicks, types or moves
          your cursor silently.
        </p>
      </div>

      <ol className="mt-4 list-decimal space-y-1.5 rounded-xl border border-border bg-elevated px-4 py-3 pl-9 text-[12.5px] leading-relaxed text-fg3">
        <li>Open System Settings → Privacy &amp; Security → Accessibility.</li>
        <li>Enable <span className="font-semibold text-fg2">G1Wiggle</span>.</li>
        <li>Return here — the app checks automatically.</li>
      </ol>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={() => {
            adapter.mouse.openPermissionSettings?.();
          }}
          className="btn btn-primary px-4 py-2.5 text-[13px]"
        >
          Open System Settings
        </button>
        <button
          onClick={() => {
            recheck();
            const now = adapter.capabilities().mouseControl;
            if (!needsPermissionGate(now))
              toast("Permission granted", "Mouse control is ready.", "success");
            else toast("Still waiting", "G1Wiggle is not in the Accessibility list yet.", "info");
          }}
          className="rounded-xl border border-border bg-elevated px-4 py-2.5 text-[13px] font-medium text-fg2 transition-colors hover:border-border2 hover:text-fg"
        >
          Check again
        </button>
      </div>
    </Modal>
  );
}
