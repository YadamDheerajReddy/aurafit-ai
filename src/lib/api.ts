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
  sex: Sex;
  date_of_birth: string;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
}

export function saveProfile(input: SaveProfileInput): Promise<void> {
  return invoke("save_profile", { input });
}

export function saveGoal(goalType: GoalType, targets: MacroTargets): Promise<void> {
  return invoke("save_goal", { input: { goal_type: goalType, targets } });
}

export function setGuardrails(diets: string[], allergies: string[]): Promise<void> {
  return invoke("set_guardrails", { input: { diets, allergies } });
}

export interface UserState {
  onboarded: boolean;
  profile: {
    sex: Sex;
    date_of_birth: string;
    height_cm: number;
    activity_level: ActivityLevel;
  } | null;
  latest_weight_kg: number | null;
  active_goal: {
    goal_type: GoalType;
    target_calories: number;
    target_protein_g: number;
    target_carbs_g: number;
    target_fat_g: number;
    target_fiber_g: number;
  } | null;
  guardrails: { constraint_type: "diet" | "allergy"; value: string }[];
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

export type FoodLogSource = "vision_ai" | "quick_lookup" | "manual" | "recipe";
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
// Vision AI (Ollama)
// ---------------------------------------------------------------------------

export interface OllamaStatusResult {
  running: boolean;
  models_installed: string[];
  vision_model_ready: boolean;
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

/** `imageDataUrl` is a `data:image/...;base64,...` string. */
export function analyzeMealPhoto(imageDataUrl: string): Promise<MealAnalysisResult> {
  return invoke("analyze_meal_photo", { imageDataUrl });
}
