import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuraMark } from "@/components/AuraMark";
import { cn } from "@/lib/utils";
import {
  MAX_PROFILES,
  PROFILE_COLORS,
  createProfile,
  deleteProfile,
  getProfiles,
  switchProfile,
  updateProfile,
  type Profile,
} from "@/lib/api";

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

interface EditorState {
  target: "new" | number;
  name: string;
  color: string;
}

export function ProfileSelector({ onSelected }: { onSelected: () => void }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [managing, setManaging] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setProfiles(await getProfiles());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handlePick(id: number) {
    if (managing) return;
    setSwitching(id);
    setError(null);
    try {
      await switchProfile(id);
      onSelected();
    } catch (e) {
      console.error(e);
      setError(String(e));
      setSwitching(null);
    }
  }

  function openNewEditor() {
    const usedColors = new Set((profiles ?? []).map((p) => p.avatar_color));
    const color = PROFILE_COLORS.find((c) => !usedColors.has(c)) ?? PROFILE_COLORS[0];
    setEditor({ target: "new", name: "", color });
  }

  function openEditEditor(p: Profile) {
    setEditor({ target: p.id, name: p.name, color: p.avatar_color });
  }

  async function handleSaveEditor() {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      if (editor.target === "new") {
        await createProfile(name, editor.color);
      } else {
        await updateProfile(editor.target, name, editor.color);
      }
      setEditor(null);
      await refresh();
    } catch (e) {
      console.error(e);
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setSaving(true);
    setError(null);
    try {
      await deleteProfile(id);
      await refresh();
    } catch (e) {
      console.error(e);
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (profiles === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canAddMore = profiles.length < MAX_PROFILES;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-12">
      <div className="flex flex-col items-center gap-3">
        <AuraMark className="size-12 rounded-xl" />
        <h1 className="font-display text-2xl font-bold text-foreground">
          {managing ? "Manage Profiles" : "Who's tracking?"}
        </h1>
      </div>

      {editor ? (
        <div className="flex w-full max-w-xs flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <div
            className="mx-auto flex size-20 items-center justify-center rounded-full text-2xl font-bold text-white"
            style={{ backgroundColor: editor.color }}
          >
            {initial(editor.name || "?")}
          </div>
          <Input
            autoFocus
            placeholder="Name"
            value={editor.name}
            onChange={(e) => setEditor({ ...editor, name: e.target.value })}
            maxLength={24}
          />
          <div className="flex justify-center gap-2">
            {PROFILE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEditor({ ...editor, color: c })}
                aria-label={`Choose color ${c}`}
                className={cn(
                  "size-7 rounded-full ring-offset-2 ring-offset-card transition-shadow",
                  editor.color === c && "ring-2 ring-primary"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditor(null)} disabled={saving}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSaveEditor} disabled={saving || !editor.name.trim()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-center gap-6">
            {profiles.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => (managing ? openEditEditor(p) : handlePick(p.id))}
                  disabled={switching !== null}
                  className={cn(
                    "relative flex size-24 items-center justify-center rounded-full text-3xl font-bold text-white transition-transform hover:scale-105",
                    managing && "ring-2 ring-primary/40"
                  )}
                  style={{ backgroundColor: p.avatar_color }}
                >
                  {switching === p.id ? (
                    <Loader2 className="size-7 animate-spin" />
                  ) : (
                    initial(p.name)
                  )}
                  {managing && (
                    <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-card text-muted-foreground shadow">
                      <Pencil className="size-3.5" />
                    </span>
                  )}
                  {managing && profiles.length > 1 && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.id);
                      }}
                      aria-label={`Delete ${p.name}`}
                      className="absolute -top-1 -right-1 flex size-7 items-center justify-center rounded-full bg-destructive text-white shadow hover:bg-destructive/90"
                    >
                      <X className="size-3.5" />
                    </span>
                  )}
                </button>
                <span className="text-sm font-medium text-foreground">{p.name}</span>
              </div>
            ))}

            {canAddMore && (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={openNewEditor}
                  className="flex size-24 items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  aria-label="Add profile"
                >
                  <Plus className="size-8" />
                </button>
                <span className="text-sm text-muted-foreground">Add Profile</span>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button variant="outline" size="sm" onClick={() => setManaging((m) => !m)} className="gap-1.5">
            {managing ? (
              "Done"
            ) : (
              <>
                <Trash2 className="size-3.5" />
                Manage Profiles
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
