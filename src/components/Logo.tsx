import { useId } from "react";

/**
 * G1Wiggle brand mark — an original design: a cursor gliding along a
 * gentle wiggle trail inside a soft-cornered tile. Officially drawn as
 * inline SVG so it stays crisp from 16 px favicon to hero size.
 */
export function LogoMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const primary = `g1w-primary-${uid}`;
  const tile = `g1w-tile-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="G1Wiggle logo"
    >
      <defs>
        <linearGradient id={primary} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C8F75B" />
          <stop offset="1" stopColor="#86D317" />
        </linearGradient>
        <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#171C12" />
          <stop offset="1" stopColor="#0B0E09" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill={`url(#${tile})`} />
      <rect
        x="2.75"
        y="2.75"
        width="58.5"
        height="58.5"
        rx="14.25"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.09"
        strokeWidth="1.5"
      />
      <path
        d="M9 42 C 14 34, 18 50, 23 42 S 31 34, 36 42"
        fill="none"
        stroke={`url(#${primary})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="9" cy="42" r="2.6" fill="#A3E635" opacity="0.9" />
      <path
        d="M30 14.5 L30 39.5 L36.7 33.4 L41 43.2 L45.1 41.2 L40.9 31.4 L48.8 31.4 Z"
        fill={`url(#${primary})`}
        stroke="#0B0E09"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoLockup({
  size = 34,
  tagline = true,
}: {
  size?: number;
  tagline?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} className="shrink-0 drop-shadow-[0_2px_10px_rgba(163,230,53,0.25)]" />
      <div className="leading-none">
        <div className="font-display text-[17px] font-bold tracking-tight text-fg">
          G1<span className="text-primary2">Wiggle</span>
        </div>
        {tagline && (
          <div className="mt-1 text-[10.5px] font-medium tracking-wide text-fg3">
            Keep your computer active.
          </div>
        )}
      </div>
    </div>
  );
}
