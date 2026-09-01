import { z } from "zod";

/**
 * Mirrors the Rust serde schema exactly (ollama/schemas.rs), per TRD 4.2 —
 * so a payload that fails validation on one side fails identically on the
 * other. Used to validate what comes back over the Tauri IPC boundary before
 * it ever reaches the Verification Table state.
 */
export const FoodItemSchema = z.object({
  name: z.string(),
  estimated_grams: z.number().positive(),
  calories: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  confidence: z.enum(["low", "medium", "high"]),
});

export const MealAnalysisSchema = z.object({
  items: z.array(FoodItemSchema).min(1),
  total_calories: z.number().nonnegative(),
});

export type FoodItem = z.infer<typeof FoodItemSchema>;
export type MealAnalysis = z.infer<typeof MealAnalysisSchema>;
