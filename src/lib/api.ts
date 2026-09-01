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
