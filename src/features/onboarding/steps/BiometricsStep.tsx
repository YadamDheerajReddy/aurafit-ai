import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OptionCard } from "@/features/onboarding/OptionCard";
import { ACTIVITY_LEVELS } from "@/features/onboarding/constants";
import type { ActivityLevel, Sex } from "@/lib/api";

export interface BiometricsValue {
  name: string;
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}

interface BiometricsStepProps {
  value: BiometricsValue;
  onChange: (value: BiometricsValue) => void;
  onNext: () => void;
  onBack: () => void;
}

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

export function BiometricsStep({ value, onChange, onNext, onBack }: BiometricsStepProps) {
  const [heightUnit, setHeightUnit] = useState<"cm" | "in">("cm");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");

  const heightDisplay =
    heightUnit === "cm" ? value.heightCm : value.heightCm / CM_PER_INCH;
  const weightDisplay =
    weightUnit === "kg" ? value.weightKg : value.weightKg / KG_PER_LB;

  const canContinue =
    value.ageYears > 0 && value.heightCm > 0 && value.weightKg > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">About you</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Used only to calculate your calorie and macro targets — stored locally.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="name">Name (optional)</Label>
        <Input
          id="name"
          type="text"
          placeholder="What should we call you?"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <Label>Sex</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={value.sex}
          onValueChange={(v) => v && onChange({ ...value, sex: v as Sex })}
          className="w-full"
        >
          <ToggleGroupItem value="male" className="flex-1">Male</ToggleGroupItem>
          <ToggleGroupItem value="female" className="flex-1">Female</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            type="number"
            inputMode="numeric"
            min={13}
            max={100}
            value={value.ageYears || ""}
            onChange={(e) => onChange({ ...value, ageYears: Number(e.target.value) })}
            className="font-mono"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="height">Height</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={heightUnit}
              onValueChange={(v) => v && setHeightUnit(v as "cm" | "in")}
            >
              <ToggleGroupItem value="cm" className="px-2 text-xs">cm</ToggleGroupItem>
              <ToggleGroupItem value="in" className="px-2 text-xs">in</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <Input
            id="height"
            type="number"
            inputMode="decimal"
            value={heightDisplay ? Math.round(heightDisplay * 10) / 10 : ""}
            onChange={(e) => {
              const raw = Number(e.target.value);
              const cm = heightUnit === "cm" ? raw : raw * CM_PER_INCH;
              onChange({ ...value, heightCm: cm });
            }}
            className="font-mono"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="weight">Weight</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={weightUnit}
              onValueChange={(v) => v && setWeightUnit(v as "kg" | "lb")}
            >
              <ToggleGroupItem value="kg" className="px-2 text-xs">kg</ToggleGroupItem>
              <ToggleGroupItem value="lb" className="px-2 text-xs">lb</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <Input
            id="weight"
            type="number"
            inputMode="decimal"
            value={weightDisplay ? Math.round(weightDisplay * 10) / 10 : ""}
            onChange={(e) => {
              const raw = Number(e.target.value);
              const kg = weightUnit === "kg" ? raw : raw * KG_PER_LB;
              onChange({ ...value, weightKg: kg });
            }}
            className="font-mono"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Activity level</Label>
        <div className="grid gap-2">
          {ACTIVITY_LEVELS.map((level) => (
            <OptionCard
              key={level.value}
              label={level.label}
              description={level.description}
              selected={value.activityLevel === level.value}
              onClick={() => onChange({ ...value, activityLevel: level.value })}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onNext} disabled={!canContinue} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
}
