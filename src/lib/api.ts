import { invoke } from "@tauri-apps/api/core";

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType = "aggressive_fat_loss" | "lean_bulk" | "recomposition" | "maintenance";

export interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface TargetRequest {
  sex: Sex;
  date_of_birth: string;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal_type: GoalType;
}

export interface TargetResult {
  bmi: number;
  bmr: number;
  tdee: number;
  targets: MacroTargets;
}

export function calculateTargets(request: TargetRequest): Promise<TargetResult> {
  return invoke("calculate_targets", { request });
}

export interface SaveProfileInput {
  name?: string | null;
  sex: Sex;
  date_of_birth: string;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  cuisine_preference?: string | null;
}

export function saveProfile(input: SaveProfileInput): Promise<void> {
  return invoke("save_profile", { input });
}

export function saveGoal(
  goalType: GoalType,
  targets: MacroTargets,
  targetWeightKg?: number | null
): Promise<void> {
  return invoke("save_goal", {
    input: { goal_type: goalType, targets, target_weight_kg: targetWeightKg ?? null },
  });
}

export function setGuardrails(diets: string[], allergies: string[]): Promise<void> {
  return invoke("set_guardrails", { input: { diets, allergies } });
}

export function setAvoidedIngredients(ingredients: string[]): Promise<void> {
  return invoke("set_avoided_ingredients", { input: { ingredients } });
}

export function setWaterGoal(goalMl: number): Promise<void> {
  return invoke("set_water_goal", { input: { goal_ml: goalMl } });
}

export interface UserState {
  onboarded: boolean;
  profile: {
    name: string | null;
    sex: Sex;
    date_of_birth: string;
    height_cm: number;
    activity_level: ActivityLevel;
    cuisine_preference: string | null;
  } | null;
  latest_weight_kg: number | null;
  active_goal: {
    goal_type: GoalType;
    target_calories: number;
    target_protein_g: number;
    target_carbs_g: number;
    target_fat_g: number;
    target_fiber_g: number;
    target_weight_kg: number | null;
  } | null;
  guardrails: { constraint_type: "diet" | "allergy"; value: string }[];
  avoided_ingredients: string[];
  water_goal_ml: number | null;
}

export function getUserState(): Promise<UserState> {
  return invoke("get_user_state");
}

// ---------------------------------------------------------------------------
// Quick Lookup (USDA search)
// ---------------------------------------------------------------------------

export interface FoodItem {
  fdc_id: number;
  description: string;
  category: string | null;
  calories_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  fiber_g_per_100g: number | null;
}

export function searchUsdaFoods(query: string): Promise<FoodItem[]> {
  return invoke("search_usda_foods", { query });
}

// ---------------------------------------------------------------------------
// Food logging
// ---------------------------------------------------------------------------

export type FoodLogSource = "vision_ai" | "quick_lookup" | "manual" | "recipe" | "ai_text";
export type Confidence = "low" | "medium" | "high";

export interface FoodLogItemInput {
  usda_fdc_id: number | null;
  name: string;
  estimated_grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence | null;
}

export function saveFoodLog(source: FoodLogSource, items: FoodLogItemInput[]): Promise<number> {
  return invoke("save_food_log", { input: { source, items } });
}

export interface FoodLogItemRow {
  id: number;
  food_log_id: number;
  name: string;
  estimated_grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence | null;
}

export interface FoodLogEntry {
  id: number;
  logged_at: string;
  source: FoodLogSource;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  items: FoodLogItemRow[];
}

export function getTodaysLog(): Promise<FoodLogEntry[]> {
  return invoke("get_todays_log");
}

export function deleteFoodLog(id: number): Promise<void> {
  return invoke("delete_food_log", { id });
}

export function saveWeightEntry(weightKg: number, note?: string): Promise<void> {
  return invoke("save_weight_entry", { weightKg, note: note ?? null });
}

export interface WeightHistoryRow {
  id: number;
  weight_kg: number;
  logged_at: string;
  note: string | null;
}

export function getWeightHistory(days: number): Promise<WeightHistoryRow[]> {
  return invoke("get_weight_history", { days });
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface WeightPoint {
  date: string;
  weight_kg: number;
}

export interface DailyMacroPoint {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ProgressData {
  weight_trend: WeightPoint[];
  daily_macros: DailyMacroPoint[];
  target_calories: number | null;
  logging_streak_days: number;
}

export function getProgressCharts(days: number): Promise<ProgressData> {
  return invoke("get_progress_charts", { days });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function exportData(destDir: string): Promise<string[]> {
  return invoke("export_data", { destDir });
}

// ---------------------------------------------------------------------------
// AI meal estimation (Ollama)
// ---------------------------------------------------------------------------

export interface OllamaStatusResult {
  running: boolean;
  models_installed: string[];
  text_model_ready: boolean;
}

export function checkOllamaStatus(): Promise<OllamaStatusResult> {
  return invoke("check_ollama_status");
}

export interface RawFoodItem {
  name: string;
  estimated_grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence;
}

export interface RawMealAnalysis {
  items: RawFoodItem[];
  total_calories: number;
}

export interface MealAnalysisResult {
  analysis: RawMealAnalysis | null;
  needs_manual_entry: boolean;
  error: string | null;
}

/** Describe what you ate; a local text LLM estimates the macros. */
export function estimateMealFromText(description: string): Promise<MealAnalysisResult> {
  return invoke("estimate_meal_from_text", { description });
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export interface RecipeIngredient {
  name: string;
  quantity: string;
}

export interface GeneratedRecipe {
  title: string;
  prep_time_minutes: number;
  servings: number;
  calories_per_serving: number;
  protein_g_per_serving: number;
  carbs_g_per_serving: number;
  fat_g_per_serving: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
}

export interface RecipeCandidate extends GeneratedRecipe {
  possible_allergens: string[];
}

export interface RecipeGenerationResult {
  recipes: RecipeCandidate[];
  remaining_calories: number | null;
  remaining_protein_g: number | null;
}

export function generateRecipes(
  pantryItems: string[],
  targetPrepMinutes?: number
): Promise<RecipeGenerationResult> {
  return invoke("generate_recipes", {
    input: { pantry_items: pantryItems, target_prep_minutes: targetPrepMinutes ?? null },
  });
}

export function saveRecipe(recipe: GeneratedRecipe): Promise<number> {
  return invoke("save_recipe", { input: recipe });
}

export interface SavedRecipe {
  id: number;
  title: string;
  prep_time_minutes: number | null;
  servings: number;
  calories_per_serving: number | null;
  protein_g_per_serving: number | null;
  carbs_g_per_serving: number | null;
  fat_g_per_serving: number | null;
  /** JSON-encoded string array — parse before use. */
  instructions: string;
  source: "generated" | "saved" | "manual";
  created_at: string;
  ingredients: { id: number; recipe_id: number; name: string; quantity: string }[];
}

export function getSavedRecipes(): Promise<SavedRecipe[]> {
  return invoke("get_saved_recipes");
}

export function deleteRecipe(id: number): Promise<void> {
  return invoke("delete_recipe", { id });
}

// ---------------------------------------------------------------------------
// Water tracking
// ---------------------------------------------------------------------------

export function logWater(amountMl: number): Promise<number> {
  return invoke("log_water", { input: { amount_ml: amountMl } });
}

export interface WaterLogEntry {
  id: number;
  amount_ml: number;
  logged_at: string;
}

export interface TodaysWater {
  total_ml: number;
  entries: WaterLogEntry[];
}

export function getTodaysWater(): Promise<TodaysWater> {
  return invoke("get_todays_water");
}

export function deleteWaterEntry(id: number): Promise<void> {
  return invoke("delete_water_entry", { id });
}

export interface DailyWaterPoint {
  date: string;
  total_ml: number;
}

export function getWaterHistory(days: number): Promise<DailyWaterPoint[]> {
  return invoke("get_water_history", { days });
}

// ---------------------------------------------------------------------------
// Diet plans
// ---------------------------------------------------------------------------

export type MealSlot = "breakfast" | "mid_morning" | "lunch" | "evening_snack" | "dinner";

export interface DietPlanMeal {
  slot: MealSlot;
  dish_name: string;
  description: string;
  prep_time_minutes: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
}

export interface DietMealCandidate extends DietPlanMeal {
  slot_label: string;
  possible_conflicts: string[];
}

export interface DietPlanGenerationResult {
  meals: DietMealCandidate[];
  cuisine: string | null;
  target_calories: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
}

export function generateDietPlan(
  cuisine?: string | null,
  targetPrepMinutes?: number | null
): Promise<DietPlanGenerationResult> {
  return invoke("generate_diet_plan", {
    input: { cuisine: cuisine ?? null, target_prep_minutes: targetPrepMinutes ?? null },
  });
}

export interface SaveDietPlanInput {
  title: string;
  cuisine: string | null;
  target_calories: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
  meals: DietPlanMeal[];
}

export function saveDietPlan(input: SaveDietPlanInput): Promise<number> {
  return invoke("save_diet_plan", { input });
}

export interface SavedDietPlanMeal {
  id: number;
  diet_plan_id: number;
  slot: MealSlot;
  dish_name: string;
  description: string | null;
  prep_time_minutes: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  /** JSON-encoded array — parse before use. */
  ingredients: string | null;
  /** JSON-encoded array — parse before use. */
  instructions: string | null;
  sort_order: number;
}

export interface SavedDietPlan {
  id: number;
  title: string;
  cuisine: string | null;
  target_calories: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
  created_at: string;
  meals: SavedDietPlanMeal[];
}

export function getSavedDietPlans(): Promise<SavedDietPlan[]> {
  return invoke("get_saved_diet_plans");
}

export function deleteDietPlan(id: number): Promise<void> {
  return invoke("delete_diet_plan", { id });
}

/** `base64Data` is the raw base64 body of a PDF generated client-side (jsPDF). */
export function exportDietPlanPdf(destPath: string, base64Data: string): Promise<void> {
  return invoke("export_diet_plan_pdf", { destPath, base64Data });
}
