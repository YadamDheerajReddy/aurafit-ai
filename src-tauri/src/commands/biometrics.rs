use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::calc::nutrition::{self, ActivityLevel, GoalType, MacroTargets, Sex};
use crate::db::models::{GoalRow, GuardrailRow, LatestWeightRow, ProfileRow};

fn activity_level_to_str(level: ActivityLevel) -> &'static str {
    match level {
        ActivityLevel::Sedentary => "sedentary",
        ActivityLevel::Light => "light",
        ActivityLevel::Moderate => "moderate",
        ActivityLevel::Active => "active",
        ActivityLevel::VeryActive => "very_active",
    }
}

fn goal_type_to_str(goal: GoalType) -> &'static str {
    match goal {
        GoalType::AggressiveFatLoss => "aggressive_fat_loss",
        GoalType::LeanBulk => "lean_bulk",
        GoalType::Recomposition => "recomposition",
        GoalType::Maintenance => "maintenance",
    }
}

fn sex_to_str(sex: Sex) -> &'static str {
    match sex {
        Sex::Male => "male",
        Sex::Female => "female",
    }
}

#[derive(Debug, Deserialize)]
pub struct TargetRequest {
    pub sex: Sex,
    pub date_of_birth: String,
    pub height_cm: f64,
    pub weight_kg: f64,
    pub activity_level: ActivityLevel,
    pub goal_type: GoalType,
}

#[derive(Debug, Serialize)]
pub struct TargetResult {
    pub bmi: f64,
    pub bmr: f64,
    pub tdee: f64,
    pub targets: MacroTargets,
}

/// Pure calculation, no persistence — BMR/TDEE/macro math lives in Rust
/// (TRD, Roles & Responsibilities; Backend & Database Schema doc, 04).
#[tauri::command]
pub fn calculate_targets(request: TargetRequest) -> Result<TargetResult, String> {
    let age_years = nutrition::age_years_from_dob(&request.date_of_birth)
        .map_err(|e| format!("invalid date_of_birth: {e}"))?;

    let bmi = nutrition::bmi(request.weight_kg, request.height_cm);
    let bmr = nutrition::bmr_mifflin_st_jeor(
        request.sex,
        request.weight_kg,
        request.height_cm,
        age_years as f64,
    );
    let tdee = nutrition::tdee(bmr, request.activity_level);
    let targets = nutrition::macro_targets(tdee, request.goal_type, request.weight_kg);

    Ok(TargetResult {
        bmi,
        bmr,
        tdee,
        targets,
    })
}

#[derive(Debug, Deserialize)]
pub struct SaveProfileInput {
    pub name: Option<String>,
    pub sex: Sex,
    pub date_of_birth: String,
    pub height_cm: f64,
    pub weight_kg: f64,
    pub activity_level: ActivityLevel,
    pub cuisine_preference: Option<String>,
}

#[tauri::command]
pub async fn save_profile(
    pool: State<'_, SqlitePool>,
    input: SaveProfileInput,
) -> Result<(), String> {
    let name = input.name.map(|n| n.trim().to_string()).filter(|n| !n.is_empty());
    let cuisine = input.cuisine_preference.filter(|c| !c.is_empty());

    sqlx::query(
        "INSERT INTO user_profile (id, name, sex, date_of_birth, height_cm, activity_level, cuisine_preference)
         VALUES (1, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           sex = excluded.sex,
           date_of_birth = excluded.date_of_birth,
           height_cm = excluded.height_cm,
           activity_level = excluded.activity_level,
           cuisine_preference = excluded.cuisine_preference,
           updated_at = datetime('now')",
    )
    .bind(&name)
    .bind(sex_to_str(input.sex))
    .bind(&input.date_of_birth)
    .bind(input.height_cm)
    .bind(activity_level_to_str(input.activity_level))
    .bind(&cuisine)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("INSERT INTO weight_history (weight_kg, note) VALUES (?, 'Onboarding')")
        .bind(input.weight_kg)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct SaveGoalInput {
    pub goal_type: GoalType,
    pub targets: MacroTargets,
    pub target_weight_kg: Option<f64>,
}

#[tauri::command]
pub async fn save_goal(pool: State<'_, SqlitePool>, input: SaveGoalInput) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE goals SET is_active = 0 WHERE is_active = 1")
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO goals
           (goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g, target_fiber_g, target_weight_kg, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
    )
    .bind(goal_type_to_str(input.goal_type))
    .bind(input.targets.calories)
    .bind(input.targets.protein_g)
    .bind(input.targets.carbs_g)
    .bind(input.targets.fat_g)
    .bind(input.targets.fiber_g)
    .bind(input.target_weight_kg)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct SetGuardrailsInput {
    pub diets: Vec<String>,
    pub allergies: Vec<String>,
}

/// Replaces the guardrail set wholesale — diet patterns and allergy
/// exclusions are edited together as one active configuration (PRD, Dietary
/// Guardrail Matrix).
#[tauri::command]
pub async fn set_guardrails(
    pool: State<'_, SqlitePool>,
    input: SetGuardrailsInput,
) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM dietary_guardrails")
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    for diet in &input.diets {
        sqlx::query("INSERT INTO dietary_guardrails (constraint_type, value) VALUES ('diet', ?)")
            .bind(diet)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }
    for allergy in &input.allergies {
        sqlx::query(
            "INSERT INTO dietary_guardrails (constraint_type, value) VALUES ('allergy', ?)",
        )
        .bind(allergy)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct SetAvoidedIngredientsInput {
    pub ingredients: Vec<String>,
}

/// Free-text personal dislikes (e.g. "drumstick") — distinct from the fixed
/// allergy list, and enforced the same way: injected into every recipe/diet
/// plan generation prompt, with a post-generation keyword flag as backup.
#[tauri::command]
pub async fn set_avoided_ingredients(
    pool: State<'_, SqlitePool>,
    input: SetAvoidedIngredientsInput,
) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM avoided_ingredients")
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    for ingredient in input
        .ingredients
        .iter()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        sqlx::query("INSERT OR IGNORE INTO avoided_ingredients (name) VALUES (?)")
            .bind(ingredient)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct SetWaterGoalInput {
    pub goal_ml: i32,
}

#[tauri::command]
pub async fn set_water_goal(
    pool: State<'_, SqlitePool>,
    input: SetWaterGoalInput,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO app_settings (key, value) VALUES ('water_goal_ml', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(input.goal_ml.to_string())
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct UserState {
    pub onboarded: bool,
    pub profile: Option<ProfileRow>,
    pub latest_weight_kg: Option<f64>,
    pub active_goal: Option<GoalRow>,
    pub guardrails: Vec<GuardrailRow>,
    pub avoided_ingredients: Vec<String>,
    pub water_goal_ml: Option<i32>,
}

/// Read-back for app launch: is onboarding already complete, and if so,
/// what are the user's current targets (used by the placeholder Dashboard).
#[tauri::command]
pub async fn get_user_state(pool: State<'_, SqlitePool>) -> Result<UserState, String> {
    let profile = sqlx::query_as::<_, ProfileRow>(
        "SELECT name, sex, date_of_birth, height_cm, activity_level, cuisine_preference FROM user_profile WHERE id = 1",
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let latest_weight = sqlx::query_as::<_, LatestWeightRow>(
        "SELECT weight_kg FROM weight_history ORDER BY logged_at DESC, id DESC LIMIT 1",
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let active_goal = sqlx::query_as::<_, GoalRow>(
        "SELECT goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g, target_fiber_g, target_weight_kg
         FROM goals WHERE is_active = 1 ORDER BY id DESC LIMIT 1",
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let guardrails = sqlx::query_as::<_, GuardrailRow>(
        "SELECT constraint_type, value FROM dietary_guardrails WHERE is_active = 1",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let avoided_ingredients: Vec<String> =
        sqlx::query_scalar("SELECT name FROM avoided_ingredients ORDER BY name")
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    let water_goal_raw: Option<String> =
        sqlx::query_scalar("SELECT value FROM app_settings WHERE key = 'water_goal_ml'")
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    let water_goal_ml = water_goal_raw.and_then(|v| v.parse::<i32>().ok());

    let onboarded = profile.is_some() && active_goal.is_some();

    Ok(UserState {
        onboarded,
        profile,
        latest_weight_kg: latest_weight.map(|w| w.weight_kg),
        active_goal,
        guardrails,
        avoided_ingredients,
        water_goal_ml,
    })
}
