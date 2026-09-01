import { useEffect, useState } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { searchUsdaFoods, saveFoodLog, type FoodItem } from "@/lib/api";

function scale(perHundred: number, grams: number) {
  return (perHundred * grams) / 100;
}

export function QuickLookupTab({ onLogged }: { onLogged: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState(100);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    searchUsdaFoods(query).then((rows) => {
      if (!cancelled) setResults(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  async function handleAdd() {
    if (!selected) return;
    setAdding(true);
    try {
      await saveFoodLog("quick_lookup", [
        {
          usda_fdc_id: selected.fdc_id,
          name: selected.description,
          estimated_grams: grams,
          calories: scale(selected.calories_per_100g, grams),
          protein_g: scale(selected.protein_g_per_100g, grams),
          carbs_g: scale(selected.carbs_g_per_100g, grams),
          fat_g: scale(selected.fat_g_per_100g, grams),
          confidence: null,
        },
      ]);
      // Screen Transition Map (App Flow doc): Quick Lookup -> Select+Add ->
      // Dashboard with rings updated. No intermediate confirmation screen.
      onLogged();
    } finally {
      setAdding(false);
    }
  }

  if (selected) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-medium text-foreground">{selected.description}</p>
            {selected.category && (
              <p className="text-xs text-muted-foreground">{selected.category}</p>
            )}
          </div>

          <div className="grid gap-2">
            <label htmlFor="grams" className="text-xs text-muted-foreground">
              Quantity (grams)
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setGrams((g) => Math.max(1, g - 10))}
              >
                −
              </Button>
              <Input
                id="grams"
                type="number"
                inputMode="numeric"
                value={grams}
                onChange={(e) => setGrams(Math.max(0, Number(e.target.value)))}
                className="text-center font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setGrams((g) => g + 10)}
              >
                +
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold text-foreground">
                {Math.round(scale(selected.calories_per_100g, grams))}
              </span>
              <span className="text-sm text-muted-foreground">kcal</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-mono text-sm font-semibold text-macro-protein">
                  {scale(selected.protein_g_per_100g, grams).toFixed(1)}g
                </p>
                <p className="text-xs text-muted-foreground">Protein</p>
              </div>
              <div>
                <p className="font-mono text-sm font-semibold text-macro-carbs">
                  {scale(selected.carbs_g_per_100g, grams).toFixed(1)}g
                </p>
                <p className="text-xs text-muted-foreground">Carbs</p>
              </div>
              <div>
                <p className="font-mono text-sm font-semibold text-macro-fat">
                  {scale(selected.fat_g_per_100g, grams).toFixed(1)}g
                </p>
                <p className="text-xs text-muted-foreground">Fat</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setSelected(null)} className="flex-1">
              Back
            </Button>
            <Button onClick={handleAdd} disabled={adding || grams <= 0} className="flex-1 gap-1.5">
              {adding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Plus className="size-4" /> Add to Log
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods, e.g. “chicken breast”"
          className="pl-9"
          autoFocus
        />
      </div>

      <ul className="flex flex-col gap-1">
        {results.map((item) => (
          <li key={item.fdc_id}>
            <button
              type="button"
              onClick={() => setSelected(item)}
              className="flex w-full items-center justify-between gap-4 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.description}</p>
                {item.category && (
                  <p className="text-xs text-muted-foreground">{item.category}</p>
                )}
              </div>
              <span className="shrink-0 font-mono text-sm text-muted-foreground">
                {Math.round(item.calories_per_100g)} kcal/100g
              </span>
            </button>
          </li>
        ))}
      </ul>

      {query.trim() && results.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">No matches yet — keep typing.</p>
      )}
    </div>
  );
}
