use serde::Serialize;
use sqlx::SqlitePool;
use std::path::PathBuf;
use tauri::State;

use crate::db::models::{
    FoodLogEntry, FoodLogItemRow, FoodLogRow, GoalRow, GuardrailRow, ProfileRow, WeightHistoryRow,
};

#[derive(Debug, Serialize)]
struct ExportBundle {
    exported_at: String,
    profile: Option<ProfileRow>,
    goals: Vec<GoalRow>,
    guardrails: Vec<GuardrailRow>,
    food_log: Vec<FoodLogEntry>,
    weight_history: Vec<WeightHistoryRow>,
}

/// Writes `aurafit_export.json` (full structured bundle) plus
/// `aurafit_food_log.csv` and `aurafit_weight_history.csv` (flattened, for
/// spreadsheets) to `dest_dir`. Returns the paths written.
///
/// No format toggle — "Export All Data" always writes everything, with zero
/// throttling or paywall (PRD DAT-04; App Flow doc, 06 — Progress Review &
/// Export).
#[tauri::command]
pub async fn export_data(
    pool: State<'_, SqlitePool>,
    dest_dir: String,
) -> Result<Vec<String>, String> {
    let dest = PathBuf::from(&dest_dir);
    if !dest.is_dir() {
        return Err(format!("destination is not a directory: {dest_dir}"));
    }

    let profile = sqlx::query_as::<_, ProfileRow>(
        "SELECT sex, date_of_birth, height_cm, activity_level FROM user_profile WHERE id = 1",
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let goals = sqlx::query_as::<_, GoalRow>(
        "SELECT goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g, target_fiber_g, target_weight_kg
         FROM goals ORDER BY id ASC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let guardrails = sqlx::query_as::<_, GuardrailRow>(
        "SELECT constraint_type, value FROM dietary_guardrails WHERE is_active = 1",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let log_rows = sqlx::query_as::<_, FoodLogRow>(
        "SELECT id, logged_at, source, total_calories, total_protein_g, total_carbs_g, total_fat_g
         FROM food_log ORDER BY logged_at ASC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let mut food_log = Vec::with_capacity(log_rows.len());
    for log in log_rows {
        let items = sqlx::query_as::<_, FoodLogItemRow>(
            "SELECT id, food_log_id, name, estimated_grams, calories, protein_g, carbs_g, fat_g, confidence
             FROM food_log_items WHERE food_log_id = ?",
        )
        .bind(log.id)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
        food_log.push(FoodLogEntry { log, items });
    }

    let weight_history = sqlx::query_as::<_, WeightHistoryRow>(
        "SELECT id, weight_kg, logged_at, note FROM weight_history ORDER BY logged_at ASC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let mut written = Vec::new();

    let food_log_csv_path = dest.join("aurafit_food_log.csv");
    write_food_log_csv(&food_log_csv_path, &food_log).map_err(|e| e.to_string())?;
    written.push(food_log_csv_path.to_string_lossy().to_string());

    let weight_csv_path = dest.join("aurafit_weight_history.csv");
    write_weight_csv(&weight_csv_path, &weight_history).map_err(|e| e.to_string())?;
    written.push(weight_csv_path.to_string_lossy().to_string());

    let bundle = ExportBundle {
        exported_at: chrono::Utc::now().to_rfc3339(),
        profile,
        goals,
        guardrails,
        food_log,
        weight_history,
    };
    let json_path = dest.join("aurafit_export.json");
    let json_str = serde_json::to_string_pretty(&bundle).map_err(|e| e.to_string())?;
    std::fs::write(&json_path, json_str).map_err(|e| e.to_string())?;
    written.push(json_path.to_string_lossy().to_string());

    Ok(written)
}

fn write_food_log_csv(path: &PathBuf, entries: &[FoodLogEntry]) -> Result<(), csv::Error> {
    let mut writer = csv::Writer::from_path(path)?;
    writer.write_record([
        "logged_at",
        "source",
        "item_name",
        "estimated_grams",
        "calories",
        "protein_g",
        "carbs_g",
        "fat_g",
        "confidence",
    ])?;

    for entry in entries {
        for item in &entry.items {
            writer.write_record([
                entry.log.logged_at.clone(),
                entry.log.source.clone(),
                item.name.clone(),
                item.estimated_grams.to_string(),
                item.calories.to_string(),
                item.protein_g.to_string(),
                item.carbs_g.to_string(),
                item.fat_g.to_string(),
                item.confidence.clone().unwrap_or_default(),
            ])?;
        }
    }

    writer.flush()?;
    Ok(())
}

fn write_weight_csv(path: &PathBuf, rows: &[WeightHistoryRow]) -> Result<(), csv::Error> {
    let mut writer = csv::Writer::from_path(path)?;
    writer.write_record(["logged_at", "weight_kg", "note"])?;

    for row in rows {
        writer.write_record([
            row.logged_at.clone(),
            row.weight_kg.to_string(),
            row.note.clone().unwrap_or_default(),
        ])?;
    }

    writer.flush()?;
    Ok(())
}
