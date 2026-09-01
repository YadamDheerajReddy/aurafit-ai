import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const RECENT_KEY = "aurafit.recentPantryItems";
const MAX_RECENT = 12;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(items: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch {
    // best-effort only — a per-viewer convenience, not core data
  }
}

interface PantryInputProps {
  items: string[];
  onChange: (items: string[]) => void;
}

export function PantryInput({ items, onChange }: PantryInputProps) {
  const [draft, setDraft] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  function addItem(raw: string) {
    const value = raw.trim();
    if (!value || items.some((i) => i.toLowerCase() === value.toLowerCase())) return;
    const next = [...items, value];
    onChange(next);
    const nextRecent = [value, ...recent.filter((r) => r.toLowerCase() !== value.toLowerCase())];
    setRecent(nextRecent);
    saveRecent(nextRecent);
  }

  function removeItem(value: string) {
    onChange(items.filter((i) => i !== value));
  }

  const suggestions = recent.filter((r) => !items.some((i) => i.toLowerCase() === r.toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addItem(draft);
            setDraft("");
          }
        }}
        placeholder="Type an ingredient, press Enter"
      />

      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge key={item} className="gap-1 pr-1.5">
              {item}
              <button
                type="button"
                onClick={() => removeItem(item)}
                className="rounded-full p-0.5 hover:bg-primary-foreground/20"
                aria-label={`Remove ${item}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Recently used</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((item) => (
              <Badge
                key={item}
                variant="outline"
                className="cursor-pointer"
                onClick={() => addItem(item)}
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
