import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CUISINES } from "@/features/onboarding/constants";

interface PreferencesStepProps {
  cuisine: string;
  avoidedIngredients: string[];
  onChange: (cuisine: string, avoidedIngredients: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PreferencesStep({
  cuisine,
  avoidedIngredients,
  onChange,
  onNext,
  onBack,
}: PreferencesStepProps) {
  const [draft, setDraft] = useState("");

  function addIngredient() {
    const value = draft.trim();
    if (!value || avoidedIngredients.some((i) => i.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange(cuisine, [...avoidedIngredients, value]);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addIngredient();
    }
  }

  function removeIngredient(item: string) {
    onChange(cuisine, avoidedIngredients.filter((i) => i !== item));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Food preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Used to steer recipe and diet plan generation. Optional — skip if none apply.
        </p>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium text-foreground">Cuisine preference</p>
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((c) => (
            <Badge
              key={c}
              variant={cuisine === c ? "default" : "outline"}
              className="cursor-pointer px-3 py-1.5 text-sm"
              onClick={() => onChange(cuisine === c ? "" : c, avoidedIngredients)}
            >
              {c}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="avoid-ingredient">Ingredients to always avoid</Label>
        <div className="flex gap-2">
          <Input
            id="avoid-ingredient"
            placeholder="e.g. drumstick"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button type="button" variant="outline" onClick={addIngredient}>
            Add
          </Button>
        </div>
        {avoidedIngredients.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {avoidedIngredients.map((item) => (
              <Badge key={item} variant="secondary" className="gap-1 px-2.5 py-1 text-sm">
                {item}
                <button
                  type="button"
                  onClick={() => removeIngredient(item)}
                  aria-label={`Remove ${item}`}
                  className="rounded-full hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          These are hard excluded from every generated recipe and diet plan, on top of your
          allergy exclusions.
        </p>
      </div>

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
