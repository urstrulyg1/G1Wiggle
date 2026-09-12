/**
 * G1Wiggle — global shortcut handling.
 *
 * Combos are stored in a canonical "Ctrl+Alt+G" form. In the packaged
 * desktop build these are registered with the OS; in the web build they are
 * honoured while the app window has focus.
 */

export interface ComboParts {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

export function comboFromEvent(e: KeyboardEvent): string | null {
  const key = e.key;
  if (["Control", "Alt", "Shift", "Meta"].includes(key)) return null;
  if (key === "Escape") return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  let label = key.length === 1 ? key.toUpperCase() : key;
  if (label === " ") label = "Space";
  parts.push(label);
  if (parts.length < 2) return null; // require at least one modifier
  return parts.join("+");
}

export function comboMatches(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.split("+");
  const key = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1));
  if (e.ctrlKey !== mods.has("Ctrl")) return false;
  if (e.altKey !== mods.has("Alt")) return false;
  if (e.shiftKey !== mods.has("Shift")) return false;
  if (e.metaKey !== mods.has("Meta")) return false;
  const pressed = e.key.length === 1 ? e.key.toUpperCase() : e.key === " " ? "Space" : e.key;
  return pressed === key;
}

/** Combos browsers typically reserve — we warn, not block. */
const RESERVED: Record<string, string> = {
  "Ctrl+W": "closes the browser tab",
  "Ctrl+N": "opens a new browser window",
  "Ctrl+T": "opens a new tab",
  "Ctrl+Shift+W": "closes the browser window",
  "Ctrl+Q": "quits the browser on some platforms",
  "Alt+F4": "closes the window",
};

export function reservedWarning(combo: string): string | null {
  return RESERVED[combo] ? `${combo} usually ${RESERVED[combo]} in browsers.` : null;
}

export function comboLabel(combo: string): string[] {
  return combo.split("+");
}
