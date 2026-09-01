import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Confidence } from "@/lib/api";

export interface VerificationRow {
  name: string;
  estimated_grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence | null;
}

function ConfidenceBadge({ confidence }: { confidence: Confidence | null }) {
  if (!confidence) return null;
  const variant = confidence === "high" ? "success" : confidence === "medium" ? "outline" : "outline";
  return (
    <Badge
      variant={variant}
      className={cn(
        "shrink-0 text-[10px] uppercase",
        confidence === "low" && "border-macro-carbs/40 text-macro-carbs"
      )}
    >
      {confidence}
    </Badge>
  );
}

function numberField(value: number, onChange: (v: number) => void) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-8 w-full font-mono text-sm"
    />
  );
}

export function VerificationTable({
  rows,
  onChange,
}: {
  rows: VerificationRow[];
  onChange: (rows: VerificationRow[]) => void;
}) {
  function update(index: number, patch: Partial<VerificationRow>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  const total = rows.reduce((sum, r) => sum + (r.calories || 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div
            key={i}
            className={cn(
              "rounded-md border border-border bg-card p-3",
              row.confidence === "low" && "border-l-4 border-l-macro-carbs"
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <Input
                value={row.name}
                onChange={(e) => update(i, { name: e.target.value })}
                className="h-8 flex-1 text-sm font-medium"
                placeholder="Item name"
              />
              <ConfidenceBadge confidence={row.confidence} />
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove item"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <Field label="grams">{numberField(row.estimated_grams, (v) => update(i, { estimated_grams: v }))}</Field>
              <Field label="kcal">{numberField(row.calories, (v) => update(i, { calories: v }))}</Field>
              <Field label="protein g">{numberField(row.protein_g, (v) => update(i, { protein_g: v }))}</Field>
              <Field label="carbs g">{numberField(row.carbs_g, (v) => update(i, { carbs_g: v }))}</Field>
              <Field label="fat g">{numberField(row.fat_g, (v) => update(i, { fat_g: v }))}</Field>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          onChange([
            ...rows,
            { name: "", estimated_grams: 0, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, confidence: null },
          ])
        }
        className="rounded-md border border-dashed border-border py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        + Add item
      </button>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="font-mono text-lg font-semibold text-foreground">
          {Math.round(total)} kcal
        </span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
