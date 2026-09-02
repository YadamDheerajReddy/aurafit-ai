use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::commands::profiles::ActiveProfile;
use crate::db::models::WaterLogRow;

#[derive(Debug, Deserialize)]
pub struct LogWaterInput {
    pub amount_ml: i32,
}

#[tauri::command]
pub async fn log_water(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
    input: LogWaterInput,
) -> Result<i64, String> {
    if input.amount_ml <= 0 {
        return Err("Amount must be positive.".to_string());
    }

    let id: i64 = sqlx::query_scalar(
        "INSERT INTO water_log (profile_id, amount_ml) VALUES (?, ?) RETURNING id",
    )
    .bind(active.get())
    .bind(input.amount_ml)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(id)
}

#[derive(Debug, Serialize)]
pub struct TodaysWater {
    pub total_ml: i64,
    pub entries: Vec<WaterLogRow>,
}

#[tauri::command]
pub async fn get_todays_water(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
) -> Result<TodaysWater, String> {
    let entries = sqlx::query_as::<_, WaterLogRow>(
        "SELECT id, amount_ml, logged_at FROM water_log
         WHERE date(logged_at) = date('now') AND profile_id = ? ORDER BY logged_at DESC, id DESC",
    )
    .bind(active.get())
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let total_ml = entries.iter().map(|e| e.amount_ml).sum();

    Ok(TodaysWater { total_ml, entries })
}

#[tauri::command]
pub async fn delete_water_entry(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
    id: i64,
) -> Result<(), String> {
    sqlx::query("DELETE FROM water_log WHERE id = ? AND profile_id = ?")
        .bind(id)
        .bind(active.get())
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct DailyWaterPoint {
    pub date: String,
    pub total_ml: i64,
}

#[tauri::command]
pub async fn get_water_history(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
    days: i32,
) -> Result<Vec<DailyWaterPoint>, String> {
    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT date(logged_at) as day, SUM(amount_ml) as total
         FROM water_log
         WHERE logged_at >= date('now', ? || ' days') AND profile_id = ?
         GROUP BY day ORDER BY day ASC",
    )
    .bind(format!("-{days}"))
    .bind(active.get())
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|(date, total_ml)| DailyWaterPoint { date, total_ml })
        .collect())
}
