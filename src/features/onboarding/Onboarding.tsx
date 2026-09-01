import { useState } from "react";
import { ProgressDots } from "@/features/onboarding/ProgressDots";
import { WelcomeStep } from "@/features/onboarding/steps/WelcomeStep";
import { BiometricsStep, type BiometricsValue } from "@/features/onboarding/steps/BiometricsStep";
import { GoalStep } from "@/features/onboarding/steps/GoalStep";
import { GuardrailsStep } from "@/features/onboarding/steps/GuardrailsStep";
import { ReadyStep } from "@/features/onboarding/steps/ReadyStep";
import type { GoalType, TargetResult } from "@/lib/api";

const STEPS = ["welcome", "biometrics", "goal", "guardrails", "ready"] as const;
type Step = (typeof STEPS)[number];

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>("welcome");
  const [biometrics, setBiometrics] = useState<BiometricsValue>({
    sex: "male",
    ageYears: 0,
    heightCm: 0,
    weightKg: 0,
    activityLevel: "moderate",
  });
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [targetResult, setTargetResult] = useState<TargetResult | null>(null);
  const [diets, setDiets] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);

  const stepIndex = STEPS.indexOf(step);
  const goTo = (s: Step) => setStep(s);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {step !== "welcome" && (
        <div className="pt-8">
          <ProgressDots total={STEPS.length - 1} current={stepIndex - 1} />
        </div>
      )}

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-12">
        {step === "welcome" && <WelcomeStep onNext={() => goTo("biometrics")} />}

        {step === "biometrics" && (
          <BiometricsStep
            value={biometrics}
            onChange={setBiometrics}
            onNext={() => goTo("goal")}
            onBack={() => goTo("welcome")}
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
            onNext={() => goTo("guardrails")}
            onBack={() => goTo("biometrics")}
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
            onNext={() => goTo("ready")}
            onBack={() => goTo("goal")}
          />
        )}

        {step === "ready" && goalType && targetResult && (
          <ReadyStep
            biometrics={biometrics}
            goalType={goalType}
            targetResult={targetResult}
            diets={diets}
            allergies={allergies}
            onBack={() => goTo("guardrails")}
            onComplete={onComplete}
          />
        )}
      </div>
    </div>
  );
}
