use sqlx::SqlitePool;
use tauri::State;

use crate::db::models::FoodItemRow;

/// Builds a per-term FTS5 prefix query (e.g. "chick* bre*") from free text,
/// so a partial word still matches (App Flow doc, 04 — Quick Lookup Logging).
fn to_fts_prefix_query(raw: &str) -> Option<String> {
    let terms: Vec<String> = raw
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|t| !t.is_empty())
        .map(|t| format!("{t}*"))
        .collect();

    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" "))
    }
}

/// Sub-5ms indexed full-text search against the pre-seeded usda_foods table
/// (Backend & Database Schema doc, 06 — Indexing & Performance).
#[tauri::command]
pub async fn search_usda_foods(
    pool: State<'_, SqlitePool>,
    query: String,
) -> Result<Vec<FoodItemRow>, String> {
    let Some(fts_query) = to_fts_prefix_query(&query) else {
        return Ok(vec![]);
    };

    sqlx::query_as::<_, FoodItemRow>(
        "SELECT f.fdc_id, f.description, f.category, f.calories_per_100g,
                f.protein_g_per_100g, f.carbs_g_per_100g, f.fat_g_per_100g, f.fiber_g_per_100g
         FROM usda_foods_fts
         JOIN usda_foods f ON f.fdc_id = usda_foods_fts.rowid
         WHERE usda_foods_fts MATCH ?
         ORDER BY rank
         LIMIT 20",
    )
    .bind(fts_query)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}
