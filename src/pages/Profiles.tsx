import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  Download,
  Keyboard,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Card, Chip } from "../components/controls";
import { Modal } from "../components/Modal";
import { ProfileEditor } from "./ProfileEditor";
import { useStore } from "../store/useStore";
import { defaultProfile } from "../lib/persistence";
import { formatMinutes } from "../lib/time";
import { MODE_META, type Profile } from "../lib/types";
import { cn } from "../utils/cn";

function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function CardMenu({ profile, onEdit, onRename, onDelete }: {
  profile: Profile;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const duplicateProfile = useStore((s) => s.duplicateProfile);
  const exportProfilesJson = useStore((s) => s.exportProfilesJson);
  const toast = useStore((s) => s.toast);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const Item = ({ icon: Icon, label, onClick, error }: {
    icon: typeof Copy;
    label: string;
    onClick: () => void;
    error?: boolean;
  }) => (
    <button
      onClick={() => {
        onClick();
        setOpen(false);
      }}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[12.5px] font-medium transition-colors",
        error ? "text-error hover:bg-error/10" : "text-fg2 hover:bg-surface hover:text-fg",
      )}
    >
      <Icon size={13} />
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-border bg-elevated p-1.5 text-fg3 transition-colors hover:text-fg"
        aria-label={`More actions for ${profile.name}`}
      >
        <MoreHorizontal size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            className="absolute right-0 top-full z-[60] mt-1.5 w-[168px] overflow-hidden rounded-xl border border-border bg-elevated py-1 shadow-xl"
          >
            <Item icon={Pencil} label="Edit" onClick={onEdit} />
            <Item icon={Copy} label="Duplicate" onClick={() => duplicateProfile(profile.id)} />
            <Item
              icon={Download}
              label="Export JSON"
              onClick={() => {
                downloadJson(
                  `g1wiggle-profile-${profile.name.toLowerCase().replace(/\s+/g, "-")}.json`,
                  exportProfilesJson([profile.id]),
                );
                toast("Profile exported", `“${profile.name}” was saved as JSON.`, "success");
              }}
            />
            <Item icon={Pencil} label="Rename" onClick={onRename} />
            <div className="mx-2 my-1 h-px bg-border" />
            <Item icon={Trash2} label="Delete" onClick={onDelete} error />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Profiles() {
  const profiles = useStore((s) => s.config.profiles);
  const activeId = useStore((s) => s.config.activeProfileId);
  const setActiveProfile = useStore((s) => s.setActiveProfile);
  const addProfile = useStore((s) => s.addProfile);
  const updateProfile = useStore((s) => s.updateProfile);
  const renameProfile = useStore((s) => s.renameProfile);
  const deleteProfile = useStore((s) => s.deleteProfile);
  const importProfilesJson = useStore((s) => s.importProfilesJson);
  const exportProfilesJson = useStore((s) => s.exportProfilesJson);
  const toast = useStore((s) => s.toast);

  const [editing, setEditing] = useState<{ profile: Profile; isNew: boolean } | null>(null);
  const [renaming, setRenaming] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState<Profile | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">Profiles</h1>
          <p className="mt-1 text-[13.5px] text-fg3">
            Behaviour presets you can switch between instantly — from the dashboard or the tray.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              f.text().then((t) => importProfilesJson(t));
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-border bg-elevated px-3.5 py-2.5 text-[13px] font-medium text-fg2 transition-colors hover:border-border2 hover:text-fg"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            onClick={() => {
              downloadJson("g1wiggle-profiles.json", exportProfilesJson());
              toast("Profiles exported", "All profiles were saved as JSON.", "success");
            }}
            className="flex items-center gap-2 rounded-xl border border-border bg-elevated px-3.5 py-2.5 text-[13px] font-medium text-fg2 transition-colors hover:border-border2 hover:text-fg"
          >
            <Download size={14} />
            Export all
          </button>
          <button
            onClick={() =>
              setEditing({
                profile: defaultProfile("New Profile", "#a3e635", "natural"),
                isNew: true,
              })
            }
            className="flex items-center gap-2 btn btn-primary px-4 py-2.5 text-[13.5px]"
          >
            <Plus size={15} />
            New profile
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {profiles.map((p, i) => {
          const active = p.id === activeId;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, type: "spring", stiffness: 320, damping: 30 }}
            >
              <Card
                className={cn(
                  "h-full transition-colors",
                  active && "border-primary/50 shadow-[0_0_0_1px_var(--c-primary),0_12px_32px_-16px_rgba(0,0,0,0.35)]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-9 w-9 rounded-xl border border-border"
                      style={{
                        background: `linear-gradient(135deg, ${p.color}33, ${p.color}0d)`,
                        boxShadow: `inset 0 0 0 1px ${p.color}44`,
                      }}
                    >
                      <span
                        className="mx-auto mt-3 block h-2.5 w-2.5 rounded-full"
                        style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }}
                      />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-[15px] font-semibold tracking-tight text-fg">
                          {p.name}
                        </span>
                        {active && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-primary2">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[12px] text-fg3">{MODE_META[p.mode].label}</div>
                    </div>
                  </div>
                  <CardMenu
                    profile={p}
                    onEdit={() => setEditing({ profile: p, isNew: false })}
                    onRename={() => {
                      setRenaming(p);
                      setRenameValue(p.name);
                    }}
                    onDelete={() => setDeleting(p)}
                  />
                </div>

                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  <Chip>
                    {p.mode === "natural" || p.mode === "custom"
                      ? `${Math.min(p.minIntervalSec, p.maxIntervalSec)}–${Math.max(p.minIntervalSec, p.maxIntervalSec)} s`
                      : `${p.intervalSec} s`}
                  </Chip>
                  <Chip>
                    {p.maxDistancePx > p.minDistancePx
                      ? `${p.minDistancePx}–${p.maxDistancePx} px`
                      : `${p.distancePx} px`}
                  </Chip>
                  <Chip>{formatMinutes(p.sessionMinutes)}</Chip>
                  {p.returnToOrigin && <Chip>Returns to position</Chip>}
                  {p.keyboard.enabled && (
                    <Chip className="border-warning/40 text-warning">
                      <Keyboard size={11} />
                      Keys
                    </Chip>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  {active ? (
                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2 text-[12.5px] font-semibold text-primary2">
                      <Check size={14} />
                      In use — settings apply on the next movement
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveProfile(p.id);
                        toast("Profile activated", `G1Wiggle will use “${p.name}”.`, "success");
                      }}
                      className="flex-1 rounded-xl border border-border bg-elevated px-3.5 py-2 text-[12.5px] font-semibold text-fg2 transition-colors hover:border-border2 hover:text-fg"
                    >
                      Use this profile
                    </button>
                  )}
                  <button
                    onClick={() => setEditing({ profile: p, isNew: false })}
                    className="rounded-xl border border-border bg-elevated px-3 py-2 text-fg3 transition-colors hover:border-border2 hover:text-fg"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* editor */}
      {editing && (
        <ProfileEditor
          profile={editing.profile}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            if (editing.isNew) {
              addProfile(p);
              toast("Profile created", `“${p.name}” is ready to use.`, "success");
            } else {
              updateProfile(p.id, p);
              toast("Profile saved", `“${p.name}” was updated.`, "success");
            }
            setEditing(null);
          }}
        />
      )}

      {/* rename */}
      <Modal
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Rename profile"
      >
        <input
          className="field"
          value={renameValue}
          maxLength={40}
          autoFocus
          placeholder="Profile name"
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && renameValue.trim() && renaming) {
              renameProfile(renaming.id, renameValue);
              setRenaming(null);
            }
          }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setRenaming(null)}
            className="rounded-xl border border-border bg-elevated px-4 py-2 text-[13px] font-medium text-fg2 hover:border-border2 hover:text-fg"
          >
            Cancel
          </button>
          <button
            disabled={!renameValue.trim()}
            onClick={() => {
              if (renaming) renameProfile(renaming.id, renameValue);
              setRenaming(null);
            }}
            className="rounded-xl bg-primary px-4 py-2 font-display text-[13px] font-semibold text-onprimary hover:brightness-105 disabled:opacity-40"
          >
            Rename
          </button>
        </div>
      </Modal>

      {/* delete */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting ? `Delete “${deleting.name}”?` : "Delete profile?"}
        subtitle="This cannot be undone."
      >
        <p className="text-[13px] leading-relaxed text-fg2">
          Sessions and schedules that referenced this profile will fall back to the first
          remaining profile.
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
                if (profiles.length <= 1) {
                  toast("Can't delete", "G1Wiggle needs at least one profile.", "error");
                } else {
                  deleteProfile(deleting.id);
                  toast("Profile deleted", `“${deleting.name}” was removed.`, "info");
                }
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
