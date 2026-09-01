import { useState } from "react";
import { X } from "lucide-react";
import { ProgressDots } from "@/features/onboarding/ProgressDots";
import { BiometricsStep, type BiometricsValue } from "@/features/onboarding/steps/BiometricsStep";
import { GoalStep } from "@/features/onboarding/steps/GoalStep";
import { GuardrailsStep } from "@/features/onboarding/steps/GuardrailsStep";
import { ReadyStep } from "@/features/onboarding/steps/ReadyStep";
import type { GoalType, TargetResult, UserState } from "@/lib/api";

const STEPS = ["biometrics", "goal", "guardrails", "ready"] as const;
type Step = (typeof STEPS)[number];

function ageFromDob(dob: string | undefined): number {
  if (!dob) return 0;
  const birthYear = Number(dob.slice(0, 4));
  if (!birthYear) return 0;
  return new Date().getFullYear() - birthYear;
}

export function EditProfileModal({
  userState,
  onClose,
  onSaved,
}: {
  userState: UserState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<Step>("biometrics");
  const [biometrics, setBiometrics] = useState<BiometricsValue>({
    sex: userState.profile?.sex ?? "male",
    ageYears: ageFromDob(userState.profile?.date_of_birth),
    heightCm: userState.profile?.height_cm ?? 0,
    weightKg: userState.latest_weight_kg ?? 0,
    activityLevel: userState.profile?.activity_level ?? "moderate",
  });
  const [goalType, setGoalType] = useState<GoalType | null>(
    userState.active_goal?.goal_type ?? null
  );
  const [targetResult, setTargetResult] = useState<TargetResult | null>(null);
  const [diets, setDiets] = useState<string[]>(
    userState.guardrails.filter((g) => g.constraint_type === "diet").map((g) => g.value)
  );
  const [allergies, setAllergies] = useState<string[]>(
    userState.guardrails.filter((g) => g.constraint_type === "allergy").map((g) => g.value)
  );

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <p className="font-display text-lg font-semibold text-foreground">
          Edit Profile &amp; Goals
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="pt-8">
        <ProgressDots total={STEPS.length} current={stepIndex} />
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-12">
        {step === "biometrics" && (
          <BiometricsStep
            value={biometrics}
            onChange={setBiometrics}
            onNext={() => setStep("goal")}
            onBack={onClose}
          />
        )}

        {step === "goal" && (
          <GoalStep
            biometrics={biometrics}
            goalType={goalType}
            onSelect={(goal, result) => {
              setGoalType(goal);
              setTargetResult(result);
            }}
            onNext={() => setStep("guardrails")}
            onBack={() => setStep("biometrics")}
          />
        )}

        {step === "guardrails" && (
          <GuardrailsStep
            diets={diets}
            allergies={allergies}
            onChange={(d, a) => {
              setDiets(d);
              setAllergies(a);
            }}
            onNext={() => setStep("ready")}
            onBack={() => setStep("goal")}
          />
        )}

        {step === "ready" && goalType && targetResult && (
          <ReadyStep
            biometrics={biometrics}
            goalType={goalType}
            targetResult={targetResult}
            diets={diets}
            allergies={allergies}
            initialTargetWeightKg={userState.active_goal?.target_weight_kg}
            onBack={() => setStep("guardrails")}
            onComplete={onSaved}
          />
        )}
      </div>
    </div>
  );
}
