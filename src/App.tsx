import { useEffect, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { searchUsdaFoods, type FoodItem } from "@/lib/db";

function MacroStat({ label, value, colorClass }: { label: string; value: string; colorClass: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${colorClass}`} />
      <span className="font-mono text-xs text-muted-foreground">
        {value} <span className="text-muted-foreground/70">{label}</span>
      </span>
    </span>
  );
}

function App() {
  const [query, setQuery] = useState("chicken");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!query.trim()) {
      setResults([]);
      setStatus("idle");
      setElapsedMs(null);
      return;
    }

    setStatus("loading");
    const start = performance.now();

    searchUsdaFoods(query)
      .then((rows) => {
        if (cancelled) return;
        setResults(rows);
        setElapsedMs(performance.now() - start);
        setStatus("ready");
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-aura-gradient" />
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
              AuraFit AI
            </h1>
          </div>
          <Badge variant="outline" className="gap-1.5 border-success/30 text-success">
            <ShieldCheck className="size-3.5" />
            Local &amp; Private
          </Badge>
        </header>

        <div>
          <p className="font-display text-3xl font-bold text-foreground">
            Foundation online.
          </p>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            The local database is wired up and pre-seeded with USDA nutrition data.
            Try a search below — every query runs against the on-device SQLite
            index, with zero network calls.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Lookup — USDA Reference Data</CardTitle>
            <CardDescription>
              Sub-5ms indexed full-text search, entirely offline.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search foods, e.g. “salmon” or “oats”"
                className="pl-9"
                autoFocus
              />
            </div>

            {status === "error" && (
              <p className="text-sm text-destructive">
                Search failed — check the console for details.
              </p>
            )}

            {status === "ready" && (
              <p className="text-xs text-muted-foreground">
                {results.length} result{results.length === 1 ? "" : "s"}
                {elapsedMs !== null && (
                  <>
                    {" "}
                    in <span className="font-mono">{elapsedMs.toFixed(1)}ms</span>
                  </>
                )}
              </p>
            )}

            <ul className="flex flex-col gap-1">
              {results.map((item) => (
                <li
                  key={item.fdc_id}
                  className="flex items-center justify-between gap-4 rounded-md border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.description}
                    </p>
                    {item.category && (
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-sm text-foreground">
                      {Math.round(item.calories_per_100g)}
                      <span className="text-xs text-muted-foreground"> kcal</span>
                    </span>
                    <MacroStat
                      label="P"
                      value={`${item.protein_g_per_100g.toFixed(0)}g`}
                      colorClass="bg-macro-protein"
                    />
                    <MacroStat
                      label="C"
                      value={`${item.carbs_g_per_100g.toFixed(0)}g`}
                      colorClass="bg-macro-carbs"
                    />
                    <MacroStat
                      label="F"
                      value={`${item.fat_g_per_100g.toFixed(0)}g`}
                      colorClass="bg-macro-fat"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Phase 0 — Foundation &amp; Tooling · per-100g values from the pre-seeded reference set
        </p>
      </div>
    </div>
  );
}

export default App;
