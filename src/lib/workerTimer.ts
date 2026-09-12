/**
 * G1Wiggle — background worker timer.
 *
 * Browsers aggressively throttle setInterval / setTimeout in inactive or
 * minimized tabs (often clamping to 1000 ms or suspending entirely).
 * A dedicated Web Worker thread is exempt from tab visibility throttling,
 * guaranteeing deterministic ticks for keep-alive intervals and countdowns.
 */

export interface HeartbeatTimer {
  start(intervalMs: number, onTick: () => void): void;
  stop(): void;
}

const WORKER_CODE = `
let timerId = null;
self.onmessage = function(e) {
  const data = e.data || {};
  if (data.action === "start") {
    if (timerId !== null) clearInterval(timerId);
    timerId = setInterval(() => {
      self.postMessage("tick");
    }, Math.max(20, data.interval || 100));
  } else if (data.action === "stop") {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }
};
`;

export function createHeartbeatTimer(): HeartbeatTimer {
  let worker: Worker | null = null;
  let fallbackId: ReturnType<typeof setInterval> | null = null;
  let tickHandler: (() => void) | null = null;

  const tryInitWorker = (): Worker | null => {
    if (typeof window === "undefined" || typeof Worker === "undefined" || typeof Blob === "undefined") {
      return null;
    }
    try {
      const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      const w = new Worker(url);
      w.onmessage = () => {
        if (tickHandler) tickHandler();
      };
      URL.revokeObjectURL(url);
      return w;
    } catch {
      return null;
    }
  };

  return {
    start(intervalMs: number, onTick: () => void) {
      this.stop();
      tickHandler = onTick;

      if (!worker) {
        worker = tryInitWorker();
      }

      if (worker) {
        worker.postMessage({ action: "start", interval: intervalMs });
      } else {
        fallbackId = setInterval(() => {
          if (tickHandler) tickHandler();
        }, intervalMs);
      }
    },

    stop() {
      tickHandler = null;
      if (worker) {
        try {
          worker.postMessage({ action: "stop" });
        } catch {
          /* worker may already be terminated */
        }
      }
      if (fallbackId !== null) {
        clearInterval(fallbackId);
        fallbackId = null;
      }
    },
  };
}
