import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------------ */
/* Card + row scaffolding                                              */
/* ------------------------------------------------------------------ */

export function Card({
  title,
  description,
  children,
  className,
  actions,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            {title && (
              <h2 className="font-display text-[15px] font-semibold tracking-tight text-fg">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-[12.5px] text-fg3">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Row({
  label,
  hint,
  children,
  stacked = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-4 py-3 first:pt-0 last:pb-0",
        stacked ? "flex-col" : "items-center justify-between",
      )}
    >
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-fg">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] leading-relaxed text-fg3">{hint}</div>}
      </div>
      <div className={cn("shrink-0", stacked && "w-full")}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle                                                              */
/* ------------------------------------------------------------------ */

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[24px] w-[42px] shrink-0 rounded-full border transition-colors duration-200",
        checked ? "border-transparent bg-primary" : "border-border2 bg-elevated",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 700, damping: 32 }}
        className={cn(
          "absolute top-1/2 block h-[17px] w-[17px] -translate-y-1/2 rounded-full shadow",
          checked ? "right-[3.5px] bg-onprimary" : "left-[3.5px] bg-ink3",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Slider                                                              */
/* ------------------------------------------------------------------ */

export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={cn("py-2.5 first:pt-0 last:pb-0", disabled && "opacity-40")}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-fg2">{label}</span>
        <span className="rounded-md border border-border bg-elevated px-1.5 py-0.5 font-mono text-[12px] font-semibold text-primary2 tabular">
          {value}
          {unit ? <span className="ml-0.5 text-[10px] font-medium text-fg3">{unit}</span> : null}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--track": `linear-gradient(to right, var(--c-primary) ${pct}%, color-mix(in srgb, var(--c-text-primary) 12%, transparent) ${pct}%)`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  small = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  const id = useId();
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-bg p-0.5">
      {options.map((opt) => {
        const activeOpt = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative rounded-[10px] font-medium transition-colors",
              small ? "px-2.5 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]",
              activeOpt ? "text-fg" : "text-fg3 hover:text-fg2",
            )}
          >
            {activeOpt && (
              <motion.span
                layoutId={id}
                transition={{ type: "spring", stiffness: 600, damping: 38 }}
                className="absolute inset-0 rounded-[10px] border border-border2 bg-elevated shadow-sm"
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small fields                                                        */
/* ------------------------------------------------------------------ */

export function NumberField({
  value,
  onChange,
  min,
  max,
  suffix,
  width = "w-24",
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix?: string;
  width?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", width)}>
      <input
        type="number"
        className="field font-mono tabular"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(Math.max(n, min), max));
        }}
      />
      {suffix && <span className="shrink-0 text-[12px] text-fg3">{suffix}</span>}
    </div>
  );
}

export function Chip({
  color,
  children,
  className,
}: {
  color?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-1 text-[11.5px] font-medium text-fg2",
        className,
      )}
    >
      {color && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
      )}
      {children}
    </span>
  );
}

export function Divider() {
  return <div className="my-4 h-px bg-border" />;
}
