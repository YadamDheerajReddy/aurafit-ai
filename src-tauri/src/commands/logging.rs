use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::db::models::{FoodLogEntry, FoodLogItemRow, FoodLogRow, WeightHistoryRow};

#[derive(Debug, Deserialize)]
pub struct FoodLogItemInput {
    pub usda_fdc_id: Option<i64>,
    pub name: String,
    pub estimated_grams: f64,
    pub calories: f64,
    pub protein_g: f64,
    pub carbs_g: f64,
    pub fat_g: f64,
    pub confidence: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SaveFoodLogInput {
    /// One of 'vision_ai' | 'quick_lookup' | 'manual' | 'recipe' | 'ai_text'
    /// (food_log.source CHECK). 'vision_ai' remains a valid historical value
    /// even though the vision logging feature itself was removed.
    pub source: String,
    pub items: Vec<FoodLogItemInput>,
}

/// Commits one or more items as a single meal entry. Quick Lookup always
/// sends exactly one item; the schema supports multi-item plates for the
/// Describe (text-estimate) and recipe (Phase 4) paths without changes here.
#[tauri::command]
pub async fn save_food_log(
    pool: State<'_, SqlitePool>,
    input: SaveFoodLogInput,
) -> Result<i64, String> {
    if input.items.is_empty() {
        return Err("at least one item is required".to_string());
    }

    let total_calories: f64 = input.items.iter().map(|i| i.calories).sum();
    let total_protein_g: f64 = input.items.iter().map(|i| i.protein_g).sum();
    let total_carbs_g: f64 = input.items.iter().map(|i| i.carbs_g).sum();
    let total_fat_g: f64 = input.items.iter().map(|i| i.fat_g).sum();

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let food_log_id: i64 = sqlx::query_scalar(
        "INSERT INTO food_log (source, total_calories, total_protein_g, total_carbs_g, total_fat_g)
         VALUES (?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(&input.source)
    .bind(total_calories)
    .bind(total_protein_g)
    .bind(total_carbs_g)
    .bind(total_fat_g)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    for item in &input.items {
        sqlx::query(
            "INSERT INTO food_log_items
               (food_log_id, usda_fdc_id, name, estimated_grams, calories, protein_g, carbs_g, fat_g, confidence)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(food_log_id)
        .bind(item.usda_fdc_id)
        .bind(&item.name)
        .bind(item.estimated_grams)
        .bind(item.calories)
        .bind(item.protein_g)
        .bind(item.carbs_g)
        .bind(item.fat_g)
        .bind(&item.confidence)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(food_log_id)
}

/// Today's logged meals with their items, most recent first — powers the
/// Dashboard's macro rings and log list.
#[tauri::command]
pub async fn get_todays_log(pool: State<'_, SqlitePool>) -> Result<Vec<FoodLogEntry>, String> {
    let logs = sqlx::query_as::<_, FoodLogRow>(
        "SELECT id, logged_at, source, total_calories, total_protein_g, total_carbs_g, total_fat_g
         FROM food_log
         WHERE date(logged_at) = date('now')
         ORDER BY logged_at DESC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let mut entries = Vec::with_capacity(logs.len());
    for log in logs {
        let items = sqlx::query_as::<_, FoodLogItemRow>(
            "SELECT id, food_log_id, name, estimated_grams, calories, protein_g, carbs_g, fat_g, confidence
             FROM food_log_items WHERE food_log_id = ?",
        )
        .bind(log.id)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        entries.push(FoodLogEntry { log, items });
    }

    Ok(entries)
}

/// Cascades to food_log_items via ON DELETE CASCADE (foreign_keys pragma
/// enabled in db::pool::connect). Matches the App Flow edge case: deleting
/// the only meal of the day reverts the Dashboard to its empty state.
#[tauri::command]
pub async fn delete_food_log(pool: State<'_, SqlitePool>, id: i64) -> Result<(), String> {
    sqlx::query("DELETE FROM food_log WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn save_weight_entry(
    pool: State<'_, SqlitePool>,
    weight_kg: f64,
    note: Option<String>,
) -> Result<(), String> {
    sqlx::query("INSERT INTO weight_history (weight_kg, note) VALUES (?, ?)")
        .bind(weight_kg)
        .bind(note)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_weight_history(
    pool: State<'_, SqlitePool>,
    days: i64,
) -> Result<Vec<WeightHistoryRow>, String> {
    sqlx::query_as::<_, WeightHistoryRow>(
        "SELECT id, weight_kg, logged_at, note FROM weight_history
         WHERE logged_at >= datetime('now', ?)
         ORDER BY logged_at ASC",
    )
    .bind(format!("-{days} days"))
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}
