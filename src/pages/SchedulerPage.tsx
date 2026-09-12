import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, Chip, Divider, Segmented, Toggle } from "../components/controls";
import { Modal } from "../components/Modal";
import { useStore } from "../store/useStore";
import { describeSchedule, nextWindow, validateSchedule } from "../lib/scheduler";
import { DAY_NAMES, formatDateTime, relativeUntil } from "../lib/time";
import { uid } from "../lib/persistence";
import type { Schedule, ScheduleType } from "../lib/types";
import { cn } from "../utils/cn";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function blankSchedule(profileId: string): Schedule {
  return {
    id: "",
    name: "",
    enabled: true,
    profileId,
    type: "weekdays",
    date: todayISO(),
    days: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "18:00",
  };
}

function ScheduleEditor({
  schedule,
  isNew,
  onClose,
}: {
  schedule: Schedule;
  isNew: boolean;
  onClose: () => void;
}) {
  const profiles = useStore((s) => s.config.profiles);
  const addSchedule = useStore((s) => s.addSchedule);
  const updateSchedule = useStore((s) => s.updateSchedule);
  const toast = useStore((s) => s.toast);
  const [draft, setDraft] = useState<Schedule>(() => JSON.parse(JSON.stringify(schedule)));
  const upd = (patch: Partial<Schedule>) => setDraft((d) => ({ ...d, ...patch }));

  const preview = useMemo(() => {
    const problems = validateSchedule(draft);
    if (problems.length) return null;
    const w = nextWindow({ ...draft, id: draft.id || "preview", enabled: true }, new Date());
    return w ? `Next run: ${formatDateTime(w.start.getTime())} (${relativeUntil(w.start.getTime())})` : "No future occurrence.";
  }, [draft]);

  const save = () => {
    const problems = validateSchedule(draft);
    if (problems.length) {
      toast("Check the schedule", problems[0], "error");
      return;
    }
    if (isNew) {
      addSchedule({ ...draft, id: uid("schedule") });
      toast("Schedule created", describeSchedule(draft), "success");
    } else {
      updateSchedule(draft.id, draft);
      toast("Schedule saved", describeSchedule(draft), "success");
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "New schedule" : "Edit schedule"}
      subtitle="G1Wiggle starts and stops itself inside the window."
      wide
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-fg3">
            Name <span className="font-medium normal-case tracking-normal">(optional)</span>
          </div>
          <input
            className="field"
            placeholder="e.g. Office hours"
            maxLength={48}
            value={draft.name}
            onChange={(e) => upd({ name: e.target.value })}
          />
        </div>

        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-fg3">
            Repeat
          </div>
          <Segmented<ScheduleType>
            options={[
              { value: "once", label: "One-time" },
              { value: "daily", label: "Daily" },
              { value: "weekdays", label: "Weekdays" },
              { value: "custom", label: "Custom" },
            ]}
            value={draft.type}
            onChange={(type) => upd({ type })}
            small
          />
        </div>

        {draft.type === "once" && (
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-fg3">
              Date
            </div>
            <input
              type="date"
              className="field w-48 font-mono tabular"
              value={draft.date}
              onChange={(e) => upd({ date: e.target.value })}
            />
          </div>
        )}

        {draft.type === "custom" && (
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-fg3">
              Days
            </div>
            <div className="flex gap-1.5">
              {DAY_NAMES.map((d, i) => {
                const on = draft.days.includes(i);
                return (
                  <button
                    key={d + i}
                    onClick={() =>
                      upd({
                        days: on ? draft.days.filter((x) => x !== i) : [...draft.days, i].sort(),
                      })
                    }
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border text-[11px] font-bold transition-all",
                      on
                        ? "border-primary/70 bg-primary/15 text-primary2"
                        : "border-border bg-elevated text-fg3 hover:border-border2",
                    )}
                  >
                    {d[0]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-fg3">
              Starts at
            </div>
            <input
              type="time"
              className="field w-36 font-mono tabular"
              value={draft.startTime}
              onChange={(e) => upd({ startTime: e.target.value })}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-fg3">
              Stops at
            </div>
            <input
              type="time"
              className="field w-36 font-mono tabular"
              value={draft.endTime}
              onChange={(e) => upd({ endTime: e.target.value })}
            />
          </div>
          <div className="min-w-[180px] flex-1">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-fg3">
              Profile
            </div>
            <select
              className="field w-full"
              value={draft.profileId}
              onChange={(e) => upd({ profileId: e.target.value })}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-elevated px-3.5 py-2.5 font-mono text-[12px] text-fg3 tabular">
          {preview ?? "Set a valid window to see the next run."}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-xl border border-border bg-elevated px-4 py-2.5 text-[13px] font-medium text-fg2 hover:border-border2 hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="btn btn-primary px-5 py-2.5 text-[13.5px]"
          >
            {isNew ? "Create schedule" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function SchedulerPage() {
  const schedules = useStore((s) => s.config.schedules);
  const profiles = useStore((s) => s.config.profiles);
  const activeProfileId = useStore((s) => s.config.activeProfileId);
  const updateSchedule = useStore((s) => s.updateSchedule);
  const deleteSchedule = useStore((s) => s.deleteSchedule);
  const toast = useStore((s) => s.toast);
  const [editing, setEditing] = useState<{ schedule: Schedule; isNew: boolean } | null>(null);
  const [deleting, setDeleting] = useState<Schedule | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">Scheduler</h1>
          <p className="mt-1 text-[13.5px] text-fg3">
            Automatic sessions — G1Wiggle starts and stops on your timetable.
          </p>
        </div>
        <button
          onClick={() => setEditing({ schedule: blankSchedule(activeProfileId), isNew: true })}
          className="flex items-center gap-2 btn btn-primary px-4 py-2.5 text-[13.5px]"
        >
          <Plus size={15} />
          New schedule
        </button>
      </header>

      {schedules.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-elevated text-fg3">
              <CalendarClock size={20} />
            </div>
            <p className="mt-4 max-w-[340px] text-[13.5px] leading-relaxed text-fg3">
              No schedules yet. Try weekdays, 09:00 → 18:00, with the{" "}
              <span className="font-medium text-fg2">Work</span> profile.
            </p>
            <button
              onClick={() =>
                setEditing({ schedule: blankSchedule(activeProfileId), isNew: true })
              }
              className="mt-5 flex items-center gap-2 btn btn-primary px-4 py-2.5 text-[13.5px]"
            >
              <Plus size={15} />
              Create your first schedule
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => {
            const profile = profiles.find((p) => p.id === s.profileId) ?? profiles[0];
            const w = s.enabled ? nextWindow(s, new Date()) : null;
            return (
              <Card key={s.id} className={cn(!s.enabled && "opacity-60")}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                        s.enabled
                          ? "border-primary/40 bg-primary/10 text-primary2"
                          : "border-border bg-elevated text-fg3",
                      )}
                    >
                      <CalendarClock size={17} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-fg">
                        {s.name || describeSchedule(s)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Chip>{describeSchedule(s)}</Chip>
                        <Chip color={profile.color}>{profile.name}</Chip>
                      </div>
                      <div className="mt-1.5 font-mono text-[11px] text-fg3 tabular">
                        {!s.enabled
                          ? "Disabled"
                          : w
                            ? `Next: ${formatDateTime(w.start.getTime())} · ${relativeUntil(w.start.getTime())}`
                            : "No future occurrence"}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Toggle
                      checked={s.enabled}
                      onChange={(v) => updateSchedule(s.id, { enabled: v })}
                      label={`Enable ${s.name || "schedule"}`}
                    />
                    <button
                      onClick={() => setEditing({ schedule: s, isNew: false })}
                      className="rounded-lg border border-border bg-elevated p-2 text-fg3 transition-colors hover:border-border2 hover:text-fg"
                      aria-label="Edit schedule"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleting(s)}
                      className="rounded-lg border border-border bg-elevated p-2 text-fg3 transition-colors hover:border-error/50 hover:text-error"
                      aria-label="Delete schedule"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Divider />

      <p className="text-center text-[12px] text-fg3">
        Schedules are checked in the background — no sessions start without an enabled schedule
        and an explicit profile.
      </p>

      {editing && (
        <ScheduleEditor
          schedule={editing.schedule}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
        />
      )}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting ? `Delete “${deleting.name || describeSchedule(deleting)}”?` : "Delete schedule?"}
      >
        <p className="text-[13px] leading-relaxed text-fg2">
          G1Wiggle will no longer start automatically for this window.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setDeleting(null)}
            className="rounded-xl border border-border bg-elevated px-4 py-2 text-[13px] font-medium text-fg2 hover:border-border2 hover:text-fg"
          >
            Keep
          </button>
          <button
            onClick={() => {
              if (deleting) {
                deleteSchedule(deleting.id);
                toast("Schedule deleted", undefined, "info");
              }
              setDeleting(null);
            }}
            className="btn btn-danger px-4 py-2 text-[13px]"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
