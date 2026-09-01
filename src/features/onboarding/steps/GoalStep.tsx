import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GOALS } from "@/features/onboarding/constants";
import { calculateTargets, type GoalType, type TargetResult } from "@/lib/api";
import type { BiometricsValue } from "@/features/onboarding/steps/BiometricsStep";

const SHORT_LABEL: Record<GoalType, string> = {
  aggressive_fat_loss: "Fat Loss",
  lean_bulk: "Lean Bulk",
  recomposition: "Recomp",
  maintenance: "Maintain",
};

interface GoalStepProps {
  biometrics: BiometricsValue;
  goalType: GoalType | null;
  onSelect: (goal: GoalType, result: TargetResult) => void;
  onNext: () => void;
  onBack: () => void;
}

export function GoalStep({ biometrics, goalType, onSelect, onNext, onBack }: GoalStepProps) {
  const [results, setResults] = useState<Partial<Record<GoalType, TargetResult>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    Promise.all(
      GOALS.map((g) =>
        calculateTargets({
          sex: biometrics.sex,
          date_of_birth: `${new Date().getFullYear() - biometrics.ageYears}-01-01`,
          height_cm: biometrics.heightCm,
          weight_kg: biometrics.weightKg,
          activity_level: biometrics.activityLevel,
          goal_type: g.value,
        }).then((result) => [g.value, result] as const)
      )
    ).then((pairs) => {
      if (cancelled) return;
      setResults(Object.fromEntries(pairs));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometrics.sex, biometrics.ageYears, biometrics.heightCm, biometrics.weightKg, biometrics.activityLevel]);

  const selectedGoal = GOALS.find((g) => g.value === goalType);
  const selectedResult = goalType ? results[goalType] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Choose your goal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your calorie and macro targets adjust automatically based on this.
        </p>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        value={goalType ?? undefined}
        onValueChange={(v) => {
          if (v && results[v as GoalType]) {
            onSelect(v as GoalType, results[v as GoalType]!);
          }
        }}
        className="w-full"
      >
        {GOALS.map((g) => (
          <ToggleGroupItem key={g.value} value={g.value} className="flex-1 text-xs sm:text-sm">
            {SHORT_LABEL[g.value]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Card>
        <CardContent className="flex flex-col gap-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Calculating targets…</p>
          ) : selectedGoal && selectedResult ? (
            <>
              <div>
                <p className="font-display text-lg font-semibold text-foreground">
                  {selectedGoal.label}
                </p>
                <p className="text-sm text-muted-foreground">{selectedGoal.description}</p>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-mono text-4xl font-bold text-foreground">
                  {selectedResult.targets.calories.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">kcal / day</span>
              </div>

              <div className="grid grid-cols-4 gap-3 text-center">
                <MacroStat label="Protein" grams={selectedResult.targets.protein_g} colorClass="text-macro-protein" />
                <MacroStat label="Carbs" grams={selectedResult.targets.carbs_g} colorClass="text-macro-carbs" />
                <MacroStat label="Fat" grams={selectedResult.targets.fat_g} colorClass="text-macro-fat" />
                <MacroStat label="Fiber" grams={selectedResult.targets.fiber_g} colorClass="text-macro-fiber" />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Pick a goal above to see your targets.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onNext} disabled={!goalType} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
}

function MacroStat({ label, grams, colorClass }: { label: string; grams: number; colorClass: string }) {
  return (
    <div>
      <p className={`font-mono text-lg font-semibold ${colorClass}`}>{Math.round(grams)}g</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
