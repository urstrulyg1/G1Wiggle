import { useState } from "react";
import { Keyboard } from "lucide-react";
import { Modal } from "../components/Modal";
import { Divider, Row, Segmented, SliderRow, Toggle } from "../components/controls";
import { MODE_META, PROFILE_COLORS, type MovementMode, type Profile } from "../lib/types";
import { cn } from "../utils/cn";

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-1 mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-fg3">
      {children}
    </div>
  );
}

export function ProfileEditor({
  profile,
  isNew,
  onSave,
  onClose,
}: {
  profile: Profile;
  isNew: boolean;
  onSave: (p: Profile) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Profile>(() => JSON.parse(JSON.stringify(profile)));
  const upd = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }));
  const nameOk = draft.name.trim().length > 0;
  const ranged = draft.mode === "natural" || draft.mode === "custom" || draft.mode === "random";

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "New profile" : `Edit “${profile.name}”`}
      subtitle="Movement, session and keyboard behaviour."
      wide
    >
      {/* identity */}
      <SectionLabel>Profile</SectionLabel>
      <div className="flex items-center gap-3">
        <input
          className="field flex-1"
          value={draft.name}
          maxLength={40}
          placeholder="Profile name"
          onChange={(e) => upd({ name: e.target.value })}
        />
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-2 py-2">
          {PROFILE_COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Colour ${c}`}
              onClick={() => upd({ color: c })}
              className={cn(
                "h-4 w-4 rounded-full transition-transform",
                draft.color === c ? "scale-125 ring-2 ring-ink/30" : "hover:scale-110",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* mode */}
      <SectionLabel>Movement mode</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(Object.keys(MODE_META) as MovementMode[]).map((m) => (
          <button
            key={m}
            onClick={() => upd({ mode: m })}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left transition-all",
              draft.mode === m
                ? "border-primary/70 bg-primary/10 shadow-[0_0_0_1px_var(--c-primary)]"
                : "border-border bg-elevated hover:border-border2",
            )}
          >
            <div className="text-[13px] font-semibold text-fg">{MODE_META[m].label}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-fg3">{MODE_META[m].blurb}</div>
          </button>
        ))}
      </div>

      {/* movement tuning */}
      <SectionLabel>Movement</SectionLabel>
      {draft.mode === "natural" || draft.mode === "custom" ? (
        <>
          <SliderRow
            label="Minimum interval"
            unit="s"
            min={1}
            max={300}
            value={draft.minIntervalSec}
            onChange={(v) => upd({ minIntervalSec: Math.min(v, draft.maxIntervalSec) })}
          />
          <SliderRow
            label="Maximum interval"
            unit="s"
            min={1}
            max={300}
            value={draft.maxIntervalSec}
            onChange={(v) => upd({ maxIntervalSec: Math.max(v, draft.minIntervalSec) })}
          />
        </>
      ) : (
        <SliderRow
          label="Interval between movements"
          unit="s"
          min={1}
          max={300}
          value={draft.intervalSec}
          onChange={(v) => upd({ intervalSec: v })}
        />
      )}
      {!ranged ? (
        <SliderRow
          label="Distance"
          unit="px"
          min={1}
          max={60}
          value={draft.distancePx}
          onChange={(v) => upd({ distancePx: v })}
        />
      ) : (
        <>
          <SliderRow
            label="Minimum distance"
            unit="px"
            min={1}
            max={60}
            value={draft.minDistancePx}
            onChange={(v) => upd({ minDistancePx: Math.min(v, draft.maxDistancePx), distancePx: v })}
          />
          <SliderRow
            label="Maximum distance"
            unit="px"
            min={1}
            max={60}
            value={draft.maxDistancePx}
            onChange={(v) => upd({ maxDistancePx: Math.max(v, draft.minDistancePx) })}
          />
        </>
      )}
      <SliderRow
        label="Randomisation"
        unit="%"
        min={0}
        max={100}
        value={draft.randomizePct}
        onChange={(v) => upd({ randomizePct: v })}
      />

      {draft.mode === "custom" && (
        <div className="mt-2 rounded-xl border border-border bg-elevated p-3.5">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fg3">
            Custom pattern
          </div>
          <Segmented
            options={[
              { value: "orbit", label: "Orbit" },
              { value: "pingpong", label: "Ping-pong" },
              { value: "scatter", label: "Scatter" },
            ]}
            value={draft.custom.pattern}
            onChange={(pattern) => upd({ custom: { ...draft.custom, pattern } })}
            small
          />
          <div className="mt-2">
            <SliderRow
              label="Steps per cycle"
              min={2}
              max={24}
              value={draft.custom.stepsPerCycle}
              onChange={(v) => upd({ custom: { ...draft.custom, stepsPerCycle: v } })}
            />
            <SliderRow
              label="Amplitude"
              unit="px"
              min={1}
              max={40}
              value={draft.custom.amplitude}
              onChange={(v) => upd({ custom: { ...draft.custom, amplitude: v } })}
            />
          </div>
          <Row label="Vertical component" hint="Let the pattern move up and down too.">
            <Toggle
              checked={draft.custom.vertical}
              onChange={(v) => upd({ custom: { ...draft.custom, vertical: v } })}
              label="Vertical component"
            />
          </Row>
        </div>
      )}

      <div className="mt-2 space-y-0.5">
        <Row label="Return cursor to position" hint="After each excursion the cursor slips back to where it started.">
          <Toggle
            checked={draft.returnToOrigin}
            onChange={(v) => upd({ returnToOrigin: v })}
            label="Return cursor to position"
          />
        </Row>
        <Row label="Edge avoidance" hint="Movements never push the cursor against screen edges.">
          <Toggle
            checked={draft.edgeAvoidance}
            onChange={(v) => upd({ edgeAvoidance: v })}
            label="Edge avoidance"
          />
        </Row>
        {draft.mode === "simple" && (
          <Row label="Multi-direction" hint="Cycle through horizontal and vertical moves.">
            <Toggle
              checked={draft.multiDirection}
              onChange={(v) => upd({ multiDirection: v })}
              label="Multi-direction"
            />
          </Row>
        )}
      </div>

      <Divider />

      {/* session */}
      <SectionLabel>Session</SectionLabel>
      <Row label="Unlimited session" hint="Run until you stop G1Wiggle manually.">
        <Toggle
          checked={draft.sessionMinutes === 0}
          onChange={(v) => upd({ sessionMinutes: v ? 0 : 120 })}
          label="Unlimited session"
        />
      </Row>
      {draft.sessionMinutes > 0 && (
        <SliderRow
          label="Session duration"
          unit="min"
          min={5}
          max={720}
          step={5}
          value={draft.sessionMinutes}
          onChange={(v) => upd({ sessionMinutes: v })}
        />
      )}
      <SliderRow
        label="Start delay"
        unit="s"
        min={0}
        max={120}
        value={draft.startDelaySec}
        onChange={(v) => upd({ startDelaySec: v })}
      />
      <SliderRow
        label="Auto-resume after pause"
        unit="min"
        min={0}
        max={120}
        step={5}
        value={draft.autoRestartAfterPauseMin}
        onChange={(v) => upd({ autoRestartAfterPauseMin: v })}
      />

      <Divider />

      {/* keyboard */}
      <SectionLabel>Keyboard activity</SectionLabel>
      <div
        className={cn(
          "rounded-xl border p-3.5",
          draft.keyboard.enabled ? "border-warning/40 bg-warning/5" : "border-border bg-elevated",
        )}
      >
        <Row
          label="Simulate occasional key presses"
          hint="Optional. Sends a harmless modifier-less key event now and then. Clearly indicated while on."
        >
          <Toggle
            checked={draft.keyboard.enabled}
            onChange={(v) => upd({ keyboard: { ...draft.keyboard, enabled: v } })}
            label="Keyboard activity"
          />
        </Row>
        {draft.keyboard.enabled && (
          <>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[11.5px] font-medium text-warning">
              <Keyboard size={13} />
              Keyboard simulation is enabled for this profile.
            </div>
            <SliderRow
              label="Keyboard interval"
              unit="s"
              min={10}
              max={600}
              step={5}
              value={draft.keyboard.intervalSec}
              onChange={(v) => upd({ keyboard: { ...draft.keyboard, intervalSec: v } })}
            />
            <Row label="Randomise timing" hint="Vary each interval by roughly ±40%.">
              <Toggle
                checked={draft.keyboard.randomize}
                onChange={(v) => upd({ keyboard: { ...draft.keyboard, randomize: v } })}
                label="Randomise keyboard timing"
              />
            </Row>
          </>
        )}
      </div>

      {/* footer */}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-xl border border-border bg-elevated px-4 py-2.5 text-[13px] font-medium text-fg2 transition-colors hover:border-border2 hover:text-fg"
        >
          Cancel
        </button>
        <button
          disabled={!nameOk}
          onClick={() => onSave(draft)}
          className={cn(
            "btn btn-primary px-5 py-2.5 text-[13.5px]",
            !nameOk && "cursor-not-allowed opacity-40",
          )}
        >
          {isNew ? "Create profile" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}
