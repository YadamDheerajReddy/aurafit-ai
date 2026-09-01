import { useEffect, useState } from "react";
import { ShieldCheck, UtensilsCrossed, Scale, Trash2, Loader2, Droplets, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ProgressBar";
import { MacroRing } from "@/components/MacroRing";
import { WeightTrendChart } from "@/components/WeightTrendChart";
import { GOALS } from "@/features/onboarding/constants";
import {
  deleteFoodLog,
  getProgressCharts,
  getTodaysLog,
  getTodaysWater,
  logWater,
  saveWeightEntry,
  type FoodLogEntry,
  type TodaysWater,
  type UserState,
  type WeightPoint,
} from "@/lib/api";

const QUICK_ADD_ML = [150, 250, 500];

const TODAY = new Date().toLocaleDateString(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function Dashboard({
  userState,
  onDataChanged,
}: {
  userState: UserState;
  onDataChanged?: () => void;
}) {
  const goal = userState.active_goal;
  const goalLabel = GOALS.find((g) => g.value === goal?.goal_type)?.label ?? "Your Goal";

  const [todaysLog, setTodaysLog] = useState<FoodLogEntry[] | null>(null);
  const [weightTrend, setWeightTrend] = useState<WeightPoint[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightWarning, setWeightWarning] = useState<string | null>(null);
  const [water, setWater] = useState<TodaysWater | null>(null);
  const [loggingWater, setLoggingWater] = useState(false);

  async function refresh() {
    const [log, progress, todaysWater] = await Promise.all([
      getTodaysLog(),
      getProgressCharts(30),
      getTodaysWater(),
    ]);
    setTodaysLog(log);
    setWeightTrend(progress.weight_trend);
    setWater(todaysWater);
  }

  async function handleAddWater(amountMl: number) {
    setLoggingWater(true);
    try {
      await logWater(amountMl);
      const todaysWater = await getTodaysWater();
      setWater(todaysWater);
    } finally {
      setLoggingWater(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = (todaysLog ?? []).reduce(
    (acc, entry) => ({
      calories: acc.calories + entry.total_calories,
      protein_g: acc.protein_g + entry.total_protein_g,
      carbs_g: acc.carbs_g + entry.total_carbs_g,
      fat_g: acc.fat_g + entry.total_fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  async function handleDelete(id: number) {
    await deleteFoodLog(id);
    await refresh();
    onDataChanged?.();
  }

  async function handleSaveWeight() {
    const kg = Number(weightInput);
    if (!kg || kg <= 0) return;

    const lastWeight = weightTrend.at(-1)?.weight_kg ?? userState.latest_weight_kg;
    if (lastWeight && Math.abs(kg - lastWeight) > 15 && !weightWarning) {
      setWeightWarning(
        `That's a big change from your last entry (${lastWeight.toFixed(1)}kg) — save anyway?`
      );
      return;
    }

    setSavingWeight(true);
    setWeightWarning(null);
    try {
      await saveWeightEntry(kg);
      setWeightInput("");
      await refresh();
      onDataChanged?.();
    } finally {
      setSavingWeight(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-8 py-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{TODAY}</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Today's Progress</h1>
        </div>
        <Badge variant="outline" className="gap-1.5 border-success/30 text-success">
          <ShieldCheck className="size-3.5" />
          Local &amp; Private
        </Badge>
      </header>

      {goal ? (
        <>
          <Card>
            <CardContent className="flex items-center gap-6">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{goalLabel}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-4xl font-bold text-foreground">
                    {Math.round(totals.calories).toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {goal.target_calories.toLocaleString()} kcal
                  </span>
                </div>
                <ProgressBar
                  value={totals.calories}
                  max={goal.target_calories}
                  className="mt-3 h-2.5"
                  gradient
                  overBudgetColor
                />
              </div>
              <MacroRing
                value={totals.calories}
                max={goal.target_calories}
                overBudget
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-4 gap-4">
            <MacroStrip
              label="Protein"
              value={totals.protein_g}
              max={goal.target_protein_g}
              colorClass="bg-macro-protein"
            />
            <MacroStrip
              label="Carbs"
              value={totals.carbs_g}
              max={goal.target_carbs_g}
              colorClass="bg-macro-carbs"
            />
            <MacroStrip
              label="Fat"
              value={totals.fat_g}
              max={goal.target_fat_g}
              colorClass="bg-macro-fat"
            />
            <MacroStrip
              label="Fiber target"
              value={goal.target_fiber_g}
              max={goal.target_fiber_g}
              colorClass="bg-macro-fiber"
              staticDisplay
            />
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active target found — try restarting onboarding from Settings.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-4 text-muted-foreground" />
            Log today's weight
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Weight in kg"
              value={weightInput}
              onChange={(e) => {
                setWeightInput(e.target.value);
                setWeightWarning(null);
              }}
              className="font-mono"
            />
            <Button onClick={handleSaveWeight} disabled={savingWeight || !weightInput}>
              {savingWeight ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </div>
          {weightWarning && (
            <p className="text-sm text-macro-carbs">{weightWarning} Click Save again to confirm.</p>
          )}
        </CardContent>
      </Card>

      {userState.water_goal_ml && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Droplets className="size-4 text-blue-400" />
              Water intake
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-foreground">
                {((water?.total_ml ?? 0) / 1000).toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground">
                / {(userState.water_goal_ml / 1000).toFixed(1)} L
              </span>
            </div>
            <ProgressBar
              value={water?.total_ml ?? 0}
              max={userState.water_goal_ml}
              className="h-2"
              barClassName="bg-blue-400"
            />
            <div className="flex flex-wrap gap-2">
              {QUICK_ADD_ML.map((ml) => (
                <Button
                  key={ml}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddWater(ml)}
                  disabled={loggingWater}
                  className="gap-1"
                >
                  <Plus className="size-3.5" />
                  {ml}ml
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weight trend — 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <WeightTrendChart data={weightTrend} />
        </CardContent>
      </Card>

      {todaysLog === null ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : todaysLog.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <UtensilsCrossed className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-foreground">
                Log your first meal today
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Use Log Meal in the left rail — Quick Lookup searches the local
                USDA reference set instantly.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's log</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {todaysLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 rounded-md px-3 py-2.5 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {entry.items.map((i) => i.name).join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.logged_at).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm text-foreground">
                    {Math.round(entry.total_calories)} kcal
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MacroStrip({
  label,
  value,
  max,
  colorClass,
  staticDisplay = false,
}: {
  label: string;
  value: number;
  max: number;
  colorClass: string;
  staticDisplay?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${colorClass}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 font-mono text-lg font-semibold text-foreground">
        {staticDisplay ? Math.round(value) : `${Math.round(value)} / ${Math.round(max)}`}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">g</span>
      </p>
      {!staticDisplay && (
        <ProgressBar value={value} max={max} className="mt-2 h-1.5" barClassName={colorClass} />
      )}
    </div>
  );
}
