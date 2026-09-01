import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GOALS } from "@/features/onboarding/constants";
import { saveProfile, saveGoal, setGuardrails, type GoalType, type TargetResult } from "@/lib/api";
import type { BiometricsValue } from "@/features/onboarding/steps/BiometricsStep";

interface ReadyStepProps {
  biometrics: BiometricsValue;
  goalType: GoalType;
  targetResult: TargetResult;
  diets: string[];
  allergies: string[];
  initialTargetWeightKg?: number | null;
  onBack: () => void;
  onComplete: () => void;
}

export function ReadyStep({
  biometrics,
  goalType,
  targetResult,
  diets,
  allergies,
  initialTargetWeightKg,
  onBack,
  onComplete,
}: ReadyStepProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetWeight, setTargetWeight] = useState(
    initialTargetWeightKg ? String(initialTargetWeightKg) : ""
  );

  const goal = GOALS.find((g) => g.value === goalType)!;

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      await saveProfile({
        sex: biometrics.sex,
        date_of_birth: `${new Date().getFullYear() - biometrics.ageYears}-01-01`,
        height_cm: biometrics.heightCm,
        weight_kg: biometrics.weightKg,
        activity_level: biometrics.activityLevel,
      });
      await saveGoal(
        goalType,
        targetResult.targets,
        targetWeight ? Number(targetWeight) : null
      );
      await setGuardrails(diets, allergies);
      onComplete();
    } catch (e) {
      console.error(e);
      setError("Something went wrong saving your profile. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-aura-gradient">
        <Sparkles className="size-8 text-white" />
      </div>

      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">You're all set</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what we'll track toward — you can change any of this later in Settings.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-md border border-border bg-card px-6 py-5">
        <p className="text-sm text-muted-foreground">{goal.label}</p>
        <p className="font-mono text-4xl font-bold text-foreground">
          {targetResult.targets.calories.toLocaleString()}
          <span className="ml-1 text-base font-normal text-muted-foreground">kcal</span>
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-mono text-sm font-semibold text-macro-protein">
              {Math.round(targetResult.targets.protein_g)}g
            </p>
            <p className="text-xs text-muted-foreground">Protein</p>
          </div>
          <div>
            <p className="font-mono text-sm font-semibold text-macro-carbs">
              {Math.round(targetResult.targets.carbs_g)}g
            </p>
            <p className="text-xs text-muted-foreground">Carbs</p>
          </div>
          <div>
            <p className="font-mono text-sm font-semibold text-macro-fat">
              {Math.round(targetResult.targets.fat_g)}g
            </p>
            <p className="text-xs text-muted-foreground">Fat</p>
          </div>
        </div>
      </div>

      {goalType !== "maintenance" && (
        <div className="grid w-full max-w-sm gap-2 text-left">
          <Label htmlFor="target-weight">Target weight, kg (optional)</Label>
          <Input
            id="target-weight"
            type="number"
            inputMode="decimal"
            placeholder="e.g. 75"
            value={targetWeight}
            onChange={(e) => setTargetWeight(e.target.value)}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Set this to see a projected goal-completion date on your Progress chart.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex w-full max-w-sm gap-3">
        <Button variant="outline" onClick={onBack} disabled={saving} className="flex-1">
          Back
        </Button>
        <Button onClick={handleConfirm} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Start Tracking"}
        </Button>
      </div>
    </div>
  );
}
