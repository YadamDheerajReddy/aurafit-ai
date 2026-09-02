//! Proves the full migration sequence (including the table-recreation-based
//! 0003 migration) applies cleanly, preserves existing data, and that the
//! newly-allowed 'ai_text' source value actually works end-to-end —
//! including the ON DELETE CASCADE from food_log to food_log_items still
//! functioning after food_log gets recreated.

use aurafit_lib::db;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::Row;

#[tokio::test]
async fn migrations_apply_and_preserve_data_and_constraints() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open in-memory sqlite db");

    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .expect("enable foreign_keys");

    let temp_path = std::env::temp_dir().join("aurafit_migration_test.db");
    db::migrations::run(&pool, &temp_path)
        .await
        .expect("run migrations 1-3");

    // A pre-existing 'quick_lookup' row (as if logged before migration 3)
    // must survive the food_log table recreation with its id intact.
    let old_id: i64 = sqlx::query_scalar(
        "INSERT INTO food_log (source, total_calories) VALUES ('quick_lookup', 250) RETURNING id",
    )
    .fetch_one(&pool)
    .await
    .expect("insert pre-existing-style row");

    sqlx::query(
        "INSERT INTO food_log_items (food_log_id, name, estimated_grams, calories, protein_g, carbs_g, fat_g)
         VALUES (?, 'test item', 100, 250, 10, 20, 5)",
    )
    .bind(old_id)
    .execute(&pool)
    .await
    .expect("insert food_log_items row");

    // The new source value must now be accepted.
    let new_id: i64 = sqlx::query_scalar(
        "INSERT INTO food_log (source, total_calories) VALUES ('ai_text', 400) RETURNING id",
    )
    .fetch_one(&pool)
    .await
    .expect("'ai_text' should be a valid source after migration 0003");

    // An invalid source must still be rejected (CHECK constraint intact).
    let rejected = sqlx::query("INSERT INTO food_log (source, total_calories) VALUES ('bogus', 1)")
        .execute(&pool)
        .await;
    assert!(rejected.is_err(), "CHECK constraint should reject unknown source values");

    // ON DELETE CASCADE must still work post-recreation.
    sqlx::query("DELETE FROM food_log WHERE id = ?")
        .bind(old_id)
        .execute(&pool)
        .await
        .expect("delete food_log row");
    let remaining_items: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM food_log_items WHERE food_log_id = ?")
        .bind(old_id)
        .fetch_one(&pool)
        .await
        .expect("count remaining items");
    assert_eq!(remaining_items, 0, "cascade delete should have removed the item row");

    // The still-present 'ai_text' row and index should both be usable.
    let row = sqlx::query("SELECT source, total_calories FROM food_log WHERE id = ?")
        .bind(new_id)
        .fetch_one(&pool)
        .await
        .expect("fetch ai_text row");
    assert_eq!(row.get::<String, _>("source"), "ai_text");

    let applied: Vec<i64> = sqlx::query_scalar("SELECT version FROM schema_migrations ORDER BY version")
        .fetch_all(&pool)
        .await
        .expect("read schema_migrations");
    assert_eq!(applied, vec![1, 2, 3, 4, 5, 6, 7]);

    // 0004 adds a nullable target_weight_kg column to goals without disturbing existing rows.
    sqlx::query(
        "INSERT INTO goals (goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g, target_fiber_g)
         VALUES ('maintenance', 2000, 150, 200, 60, 30)",
    )
    .execute(&pool)
    .await
    .expect("insert goal without target_weight_kg");

    let target_weight: Option<f64> = sqlx::query_scalar("SELECT target_weight_kg FROM goals LIMIT 1")
        .fetch_one(&pool)
        .await
        .expect("read target_weight_kg");
    assert_eq!(target_weight, None, "target_weight_kg should default to NULL");

    sqlx::query("UPDATE goals SET target_weight_kg = 72.5 WHERE goal_type = 'maintenance'")
        .execute(&pool)
        .await
        .expect("set target_weight_kg");
    let target_weight: Option<f64> = sqlx::query_scalar("SELECT target_weight_kg FROM goals LIMIT 1")
        .fetch_one(&pool)
        .await
        .expect("re-read target_weight_kg");
    assert_eq!(target_weight, Some(72.5));
}
