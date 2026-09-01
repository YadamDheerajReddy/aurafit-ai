import { useEffect, useState } from "react";
import { Flame, Loader2, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WeightTrendChart } from "@/components/WeightTrendChart";
import { MacroComplianceChart } from "@/features/progress/MacroComplianceChart";
import { LoggingStreakGrid } from "@/features/progress/LoggingStreakGrid";
import { getProgressCharts, type ProgressData } from "@/lib/api";

function projectGoalDate(weightTrend: { date: string; weight_kg: number }[], targetWeightKg: number | null) {
  if (!targetWeightKg || weightTrend.length < 2) return null;

  const recent = weightTrend.slice(-14);
  const first = recent[0];
  const last = recent.at(-1)!;
  const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000;
  if (days < 3) return null;

  const velocityPerDay = (last.weight_kg - first.weight_kg) / days;
  const remaining = targetWeightKg - last.weight_kg;

  // Wrong direction, or already there — no meaningful projection.
  if (Math.abs(velocityPerDay) < 0.005 || Math.sign(remaining) !== Math.sign(velocityPerDay)) {
    return null;
  }

  const daysToGoal = remaining / velocityPerDay;
  if (daysToGoal <= 0 || daysToGoal > 365 * 2) return null;

  const projected = new Date(last.date);
  projected.setDate(projected.getDate() + Math.round(daysToGoal));
  return projected;
}

export function ProgressPage({ targetWeightKg }: { targetWeightKg: number | null }) {
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
    getProgressCharts(90).then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const weights = data.weight_trend.map((w) => w.weight_kg);
  const current = weights.at(-1);
  const sevenDayAvg =
    weights.length > 0
      ? weights.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, weights.length)
      : undefined;
  const trend = weights.length >= 2 ? weights.at(-1)! - weights[0] : 0;
  const projectedGoalDate = projectGoalDate(data.weight_trend, targetWeightKg);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-8 py-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last 90 days.</p>
      </div>

      <Tabs defaultValue="weight">
        <TabsList className="w-full">
          <TabsTrigger value="weight">Weight</TabsTrigger>
          <TabsTrigger value="macros">Macro Compliance</TabsTrigger>
          <TabsTrigger value="streak">Logging Streak</TabsTrigger>
        </TabsList>

        <TabsContent value="weight" className="mt-4">
          <div className="mb-4 grid grid-cols-3 gap-4">
            <Stat label="Current" value={current ? `${current.toFixed(1)} kg` : "—"} />
            <Stat label="7-day avg" value={sevenDayAvg ? `${sevenDayAvg.toFixed(1)} kg` : "—"} />
            <Stat
              label="90-day change"
              value={`${trend >= 0 ? "+" : ""}${trend.toFixed(1)} kg`}
              icon={trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : undefined}
            />
          </div>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Weight trend</CardTitle>
              {targetWeightKg &&
                (projectedGoalDate ? (
                  <Badge variant="outline" className="gap-1.5">
                    <Target className="size-3.5" />
                    Est. goal date:{" "}
                    {projectedGoalDate.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Log a few more consistent weigh-ins to project a goal date.
                  </span>
                ))}
            </CardHeader>
            <CardContent>
              <WeightTrendChart data={data.weight_trend} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="macros" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily calories vs. target</CardTitle>
            </CardHeader>
            <CardContent>
              <MacroComplianceChart data={data.daily_macros} targetCalories={data.target_calories} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="streak" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="size-4 text-macro-carbs" />
                {data.logging_streak_days} day{data.logging_streak_days === 1 ? "" : "s"} streak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LoggingStreakGrid loggedDates={data.daily_macros.map((d) => d.date)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof TrendingUp;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1 font-mono text-lg font-semibold text-foreground">
        {Icon && <Icon className="size-4" />}
        {value}
      </p>
    </div>
  );
}
