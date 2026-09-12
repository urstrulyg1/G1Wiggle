import { Check, FolderGit2, Heart, Minus, Scale, ShieldCheck, Sparkles } from "lucide-react";
import { Card, Chip, Divider, Row } from "../components/controls";
import { LogoMark } from "../components/Logo";
import { APP_VERSION, BUILD_CHANNEL, useStore } from "../store/useStore";

function InfoRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
      <span className="text-[12.5px] text-fg3">{label}</span>
      <span
        className={
          mono
            ? "font-mono text-[12.5px] font-semibold text-fg tabular"
            : "text-[12.5px] font-semibold text-fg"
        }
      >
        {value}
      </span>
    </div>
  );
}

/* ---------- feature matrix ---------- */

type Cell = true | string;

function MatrixCell({ cell }: { cell: Cell }) {
  if (cell === true)
    return (
      <span className="inline-flex items-center justify-center text-success">
        <Check size={14} strokeWidth={2.75} />
      </span>
    );
  return <span className="font-mono text-[10.5px] font-medium text-fg3">{cell}</span>;
}

const MATRIX: { feature: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  { feature: "Mouse movement", cells: [true, true, true, "Preview"] },
  { feature: "Movement patterns & randomisation", cells: [true, true, true, true] },
  { feature: "Profiles", cells: [true, true, true, true] },
  { feature: "Scheduling", cells: [true, true, true, true] },
  { feature: "Keyboard activity", cells: [true, true, true, "Simulated"] },
  { feature: "System tray", cells: [true, true, true, "In-app"] },
  { feature: "Global shortcuts", cells: [true, true, true, "Window"] },
  { feature: "Launch at startup", cells: [true, true, true, "Remembered"] },
  { feature: "Notifications", cells: [true, true, true, true] },
  { feature: "Dark / light / system themes", cells: [true, true, true, true] },
];

function FeatureMatrix() {
  return (
    <Card
      title="Cross-platform feature matrix"
      description="Identical feature set everywhere; OS integration depth differs per build."
      className="md:col-span-2"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] text-left">
          <thead>
            <tr className="border-b border-border text-[10px] font-bold uppercase tracking-[0.14em] text-fg3">
              <th className="py-2 pr-2 font-bold">Feature</th>
              <th className="px-2 py-2 text-center font-bold">Windows</th>
              <th className="px-2 py-2 text-center font-bold">macOS</th>
              <th className="px-2 py-2 text-center font-bold">Linux</th>
              <th className="py-2 pl-2 text-center font-bold">Web preview</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr key={row.feature} className="border-b border-border/60 last:border-0">
                <td className="py-2 pr-2 text-[12.5px] font-medium text-fg2">{row.feature}</td>
                {row.cells.map((cell, i) => (
                  <td key={i} className="px-2 py-2 text-center">
                    <MatrixCell cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-fg3">
        macOS pointer control requires Accessibility permission — G1Wiggle asks with a guided
        first-run flow and never fails silently. Linux targets X11 fully; on Wayland, pointer
        injection depends on compositor portal support and is reported honestly in Settings →
        Desktop integration.
      </p>
    </Card>
  );
}

/* ---------- page ---------- */

export function About() {
  const repositoryUrl = useStore((s) => s.config.settings.repositoryUrl);

  return (
    <div className="mx-auto w-full max-w-[900px]">
      {/* hero */}
      <div className="flex flex-col items-center pb-8 pt-4 text-center">
        <div className="relative">
          <div className="drift-glow absolute -inset-6 rounded-full bg-primary/15 blur-2xl" />
          <LogoMark size={76} className="relative drop-shadow-[0_8px_32px_rgba(163,230,53,0.35)]" />
        </div>
        <h1 className="mt-5 font-display text-[34px] font-bold tracking-tight text-fg">
          G1<span className="text-primary2">Wiggle</span>
        </h1>
        <p className="mt-1.5 text-[15px] text-fg2">Keep your computer active.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          <Chip>v{APP_VERSION}</Chip>
          <Chip>{BUILD_CHANNEL}</Chip>
          <Chip>MIT licence</Chip>
          <Chip>Windows · macOS · Linux</Chip>
          <Chip className="border-primary/40 text-primary2">
            <Sparkles size={11} />
            Free forever
          </Chip>
        </div>
        <p className="mt-3 max-w-[440px] text-[12.5px] leading-relaxed text-fg3">
          Part of the G1 utility family — alongside G1Code and G1DM. An independent, original
          implementation; not affiliated with any other mouse-jiggler product.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card title="Free & open source" description="No strings attached.">
          <div className="flex items-start gap-3">
            <Heart size={16} className="mt-0.5 shrink-0 text-primary2" />
            <p className="text-[13px] leading-relaxed text-fg2">
              G1Wiggle is completely free. There is no paid tier, no subscriptions, no licence
              keys, no advertisements, no accounts and no artificial limits — every feature is
              available to everyone. The source is released under the MIT licence.
            </p>
          </div>
        </Card>

        <Card title="Privacy first">
          <div className="flex items-start gap-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary2" />
            <div className="text-[13px] leading-relaxed text-fg2">
              <p>
                G1Wiggle is a free, offline-first utility. Your activity stays on your computer.
              </p>
              <ul className="mt-2 list-inside space-y-1 text-[12.5px] text-fg3">
                <li className="flex items-center gap-1.5">
                  <Minus size={11} className="text-fg3" /> Works fully offline — no internet
                  required
                </li>
                <li className="flex items-center gap-1.5">
                  <Minus size={11} className="text-fg3" /> No telemetry or analytics of any kind
                </li>
                <li className="flex items-center gap-1.5">
                  <Minus size={11} className="text-fg3" /> No mouse data ever leaves the device
                </li>
                <li className="flex items-center gap-1.5">
                  <Minus size={11} className="text-fg3" /> Configuration stays in local storage
                </li>
              </ul>
            </div>
          </div>
        </Card>

        <FeatureMatrix />

        <Card title="Build information">
          <InfoRow label="Version" value={APP_VERSION} />
          <InfoRow label="Channel" value={BUILD_CHANNEL} />
          <InfoRow label="Engine" value="excursion model · seeded rng" />
          <InfoRow label="Targets" value="win32 · darwin · linux" />
          <InfoRow label="Config schema" value="v1 · local storage" />
        </Card>

        <Card title="Credits & licence">
          <div className="flex items-start gap-3">
            <Scale size={16} className="mt-0.5 shrink-0 text-primary2" />
            <div className="text-[12.5px] leading-relaxed text-fg3">
              <p>
                Designed and engineered by <span className="font-medium text-fg2">G1 Labs</span>.
                Type by <span className="font-medium text-fg2">Space Grotesk</span>,{" "}
                <span className="font-medium text-fg2">Inter</span> and{" "}
                <span className="font-medium text-fg2">JetBrains Mono</span>; icons by{" "}
                <span className="font-medium text-fg2">Lucide</span>; built with{" "}
                <span className="font-medium text-fg2">React</span>,{" "}
                <span className="font-medium text-fg2">Vite</span> and{" "}
                <span className="font-medium text-fg2">Tailwind CSS</span>.
              </p>
              <p className="mt-2">Released under the MIT Licence — see LICENSE in the repository.</p>
            </div>
          </div>
          <Divider />
          <Row
            label="Source repository"
            hint={repositoryUrl ? undefined : "Not configured — set settings.repositoryUrl in config/app.json once the repository is published."}
          >
            {repositoryUrl ? (
              <a
                href={repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-3 py-1.5 text-[12.5px] font-medium text-fg2 transition-colors hover:border-border2 hover:text-fg"
              >
                <FolderGit2 size={13} />
                Open
              </a>
            ) : (
              <span className="flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-3 py-1.5 text-[12px] font-medium text-fg3">
                <FolderGit2 size={13} />
                Not configured
              </span>
            )}
          </Row>
        </Card>
      </div>

      <p className="mt-8 text-center font-mono text-[11px] text-fg3">
        © {new Date().getFullYear()} G1 Labs · G1Wiggle is and will always be free.
      </p>
    </div>
  );
}
