import type { ActivityLevel, GoalType } from "@/lib/api";

export const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: "sedentary", label: "Sedentary", description: "Little or no exercise, desk job" },
  { value: "light", label: "Lightly active", description: "Light exercise 1–3 days a week" },
  { value: "moderate", label: "Moderately active", description: "Moderate exercise 3–5 days a week" },
  { value: "active", label: "Active", description: "Hard exercise 6–7 days a week" },
  { value: "very_active", label: "Very active", description: "Very hard training or a physical job" },
];

export const GOALS: { value: GoalType; label: string; description: string }[] = [
  { value: "aggressive_fat_loss", label: "Aggressive Fat Loss", description: "A hard calorie deficit with a high protein floor" },
  { value: "lean_bulk", label: "Lean Bulk", description: "A controlled surplus to build muscle with minimal fat gain" },
  { value: "recomposition", label: "Recomposition", description: "A mild deficit with very high protein to build and lose at once" },
  { value: "maintenance", label: "Maintenance", description: "Hold steady at your current weight" },
];

export const DIET_PATTERNS = [
  "Vegan",
  "Vegetarian",
  "Eggetarian",
  "Non-Veg",
  "Keto",
  "Paleo",
  "Halal",
  "Kosher",
  "Low-FODMAP",
] as const;

export const ALLERGIES = ["Gluten", "Lactose", "Nuts", "Shellfish"] as const;

export const CUISINES = [
  "South Indian",
  "North Indian",
  "Punjabi",
  "Gujarati",
  "Bengali",
  "Mediterranean",
  "Continental",
  "Chinese",
  "Mexican",
  "No preference",
] as const;

/**
 * Not exhaustive dietary science — just enough to surface a non-blocking
 * heads-up at onboarding, per the PRD's Dietary Guardrail Matrix ("conflicting
 * combinations surface a warning, not a blocking error").
 */
const RESTRICTIVE_COMBOS: { a: string; b: string; message: string }[] = [
  { a: "Vegan", b: "Keto", message: "Vegan + Keto is a very restrictive combination — recipe and meal variety may be limited." },
  { a: "Vegan", b: "Paleo", message: "Vegan + Paleo is a very restrictive combination — recipe and meal variety may be limited." },
  { a: "Vegan", b: "Eggetarian", message: "Vegan excludes eggs, so Vegan + Eggetarian are contradictory — pick one." },
  { a: "Vegan", b: "Non-Veg", message: "Vegan and Non-Veg are contradictory — pick one." },
  { a: "Vegetarian", b: "Non-Veg", message: "Vegetarian and Non-Veg are contradictory — pick one." },
  { a: "Eggetarian", b: "Non-Veg", message: "Eggetarian and Non-Veg overlap — Non-Veg already includes eggs, so Eggetarian is redundant here." },
];

export function findRestrictiveComboWarning(diets: string[]): string | null {
  for (const { a, b, message } of RESTRICTIVE_COMBOS) {
    if (diets.includes(a) && diets.includes(b)) {
      return message;
    }
  }
  return null;
}
