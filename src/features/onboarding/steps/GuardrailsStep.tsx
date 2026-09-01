import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ALLERGIES, DIET_PATTERNS, findRestrictiveComboWarning } from "@/features/onboarding/constants";

interface GuardrailsStepProps {
  diets: string[];
  allergies: string[];
  onChange: (diets: string[], allergies: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function GuardrailsStep({ diets, allergies, onChange, onNext, onBack }: GuardrailsStepProps) {
  const warning = findRestrictiveComboWarning(diets);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Dietary guardrails</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Applied everywhere the app suggests food. Optional — skip if none apply.
        </p>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium text-foreground">Diet pattern</p>
        <div className="flex flex-wrap gap-2">
          {DIET_PATTERNS.map((diet) => (
            <Badge
              key={diet}
              variant={diets.includes(diet) ? "default" : "outline"}
              className="cursor-pointer px-3 py-1.5 text-sm"
              onClick={() => onChange(toggleValue(diets, diet), allergies)}
            >
              {diet}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium text-foreground">Allergy exclusions</p>
        <div className="flex flex-wrap gap-2">
          {ALLERGIES.map((allergy) => (
            <Badge
              key={allergy}
              variant={allergies.includes(allergy) ? "destructive" : "outline"}
              className="cursor-pointer px-3 py-1.5 text-sm"
              onClick={() => onChange(diets, toggleValue(allergies, allergy))}
            >
              {allergy}
            </Badge>
          ))}
        </div>
      </div>

      {warning && (
        <div className="flex items-start gap-2 rounded-md border border-macro-carbs/30 bg-macro-carbs/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-macro-carbs" />
          <p className="text-sm text-foreground">{warning}</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        These guardrails reduce diet-conflicting suggestions but aren't a substitute for reading ingredient labels.
      </p>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onNext} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
}
