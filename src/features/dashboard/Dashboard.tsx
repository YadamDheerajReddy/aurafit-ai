import { ShieldCheck, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GOALS } from "@/features/onboarding/constants";
import type { UserState } from "@/lib/api";

const TODAY = new Date().toLocaleDateString(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function Dashboard({ userState }: { userState: UserState }) {
  const goal = userState.active_goal;
  const goalLabel = GOALS.find((g) => g.value === goal?.goal_type)?.label ?? "Your Goal";

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
        <Card>
          <CardHeader>
            <CardTitle>{goalLabel}</CardTitle>
            <CardDescription>Your daily target</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-5xl font-bold text-foreground">
                {goal.target_calories.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">kcal / day</span>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <MacroTile label="Protein" grams={goal.target_protein_g} colorClass="bg-macro-protein" />
              <MacroTile label="Carbs" grams={goal.target_carbs_g} colorClass="bg-macro-carbs" />
              <MacroTile label="Fat" grams={goal.target_fat_g} colorClass="bg-macro-fat" />
              <MacroTile label="Fiber" grams={goal.target_fiber_g} colorClass="bg-macro-fiber" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active target found — try restarting onboarding from Settings.
          </CardContent>
        </Card>
      )}

      <Card className="flex-1 border-dashed">
        <CardContent className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <UtensilsCrossed className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-foreground">Log your first meal</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Meal logging, macro rings, and progress charts arrive in the next
              build phase. Your targets above are already being calculated and
              saved locally.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MacroTile({ label, grams, colorClass }: { label: string; grams: number; colorClass: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${colorClass}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 font-mono text-lg font-semibold text-foreground">{Math.round(grams)}g</p>
    </div>
  );
}
