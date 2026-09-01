import { z } from "zod";

/** Mirrors the Rust serde schema (ollama/schemas.rs GeneratedRecipe). */
export const RecipeIngredientSchema = z.object({
  name: z.string(),
  quantity: z.string(),
});

export const GeneratedRecipeSchema = z.object({
  title: z.string().min(1),
  prep_time_minutes: z.number().nonnegative(),
  servings: z.number().positive(),
  calories_per_serving: z.number().nonnegative(),
  protein_g_per_serving: z.number().nonnegative(),
  carbs_g_per_serving: z.number().nonnegative(),
  fat_g_per_serving: z.number().nonnegative(),
  ingredients: z.array(RecipeIngredientSchema).min(1),
  instructions: z.array(z.string()).min(1),
});

export const RecipeCandidateSchema = GeneratedRecipeSchema.extend({
  possible_allergens: z.array(z.string()),
});

export type GeneratedRecipe = z.infer<typeof GeneratedRecipeSchema>;
export type RecipeCandidate = z.infer<typeof RecipeCandidateSchema>;
