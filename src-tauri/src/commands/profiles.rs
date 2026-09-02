use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::sync::Mutex;
use tauri::State;

/// The currently active profile, in-memory only -- reset to the
/// least-recently-created profile on every app launch (see lib.rs setup).
/// Every other command reads this to scope its queries; it is deliberately
/// NOT itself persisted so a fresh launch doesn't silently reopen whatever
/// profile happened to be active when the app last closed on a shared
/// machine.
pub struct ActiveProfile(pub Mutex<i64>);

impl ActiveProfile {
    pub fn get(&self) -> i64 {
        *self.0.lock().unwrap()
    }
}

/// Tables whose profile_id column has no DB-level foreign key (added via a
/// plain ALTER TABLE ADD COLUMN in migration 0007, since SQLite restricts
/// adding a FK column to a non-empty table) -- delete_profile cleans these
/// up explicitly instead of relying on ON DELETE CASCADE.
const MANUALLY_SCOPED_TABLES: &[&str] =
    &["goals", "food_log", "weight_history", "water_log", "diet_plans", "recipes"];

pub const MAX_PROFILES: i64 = 3;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AccountProfile {
    pub id: i64,
    pub name: String,
    pub avatar_color: String,
    pub created_at: String,
    pub last_active_at: String,
}

#[tauri::command]
pub async fn get_profiles(pool: State<'_, SqlitePool>) -> Result<Vec<AccountProfile>, String> {
    sqlx::query_as::<_, AccountProfile>(
        "SELECT id, name, avatar_color, created_at, last_active_at FROM profiles ORDER BY id ASC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_active_profile_id(active: State<'_, ActiveProfile>) -> i64 {
    active.get()
}

#[derive(Debug, Deserialize)]
pub struct CreateProfileInput {
    pub name: String,
    pub avatar_color: String,
}

#[tauri::command]
pub async fn create_profile(
    pool: State<'_, SqlitePool>,
    input: CreateProfileInput,
) -> Result<i64, String> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("Profile name can't be empty.".to_string());
    }

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM profiles")
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    if count >= MAX_PROFILES {
        return Err(format!("You can have at most {MAX_PROFILES} profiles on one device."));
    }

    let id: i64 = sqlx::query_scalar(
        "INSERT INTO profiles (name, avatar_color) VALUES (?, ?) RETURNING id",
    )
    .bind(&name)
    .bind(&input.avatar_color)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(id)
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileInput {
    pub id: i64,
    pub name: String,
    pub avatar_color: String,
}

#[tauri::command]
pub async fn update_profile(
    pool: State<'_, SqlitePool>,
    input: UpdateProfileInput,
) -> Result<(), String> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("Profile name can't be empty.".to_string());
    }
    sqlx::query("UPDATE profiles SET name = ?, avatar_color = ? WHERE id = ?")
        .bind(&name)
        .bind(&input.avatar_color)
        .bind(input.id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn switch_profile(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
    id: i64,
) -> Result<(), String> {
    let exists: Option<i64> = sqlx::query_scalar("SELECT id FROM profiles WHERE id = ?")
        .bind(id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    if exists.is_none() {
        return Err("That profile no longer exists.".to_string());
    }

    sqlx::query("UPDATE profiles SET last_active_at = datetime('now') WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    *active.0.lock().unwrap() = id;
    Ok(())
}

/// Deletes a profile and every piece of data scoped to it. Always leaves at
/// least one profile behind, and if the deleted profile was the active one,
/// switches to whatever profile remains.
#[tauri::command]
pub async fn delete_profile(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
    id: i64,
) -> Result<(), String> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM profiles")
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    if count <= 1 {
        return Err("Can't delete your only profile.".to_string());
    }

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    for table in MANUALLY_SCOPED_TABLES {
        sqlx::query(&format!("DELETE FROM {table} WHERE profile_id = ?"))
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    // user_profile, dietary_guardrails, and avoided_ingredients cascade
    // automatically -- they were recreated in migration 0007 with a real
    // FK to profiles(id) ON DELETE CASCADE.
    sqlx::query("DELETE FROM profiles WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    // Sweep this profile's namespaced app_settings rows (e.g. water_goal_ml:<id>).
    sqlx::query("DELETE FROM app_settings WHERE key LIKE ?")
        .bind(format!("%:{id}"))
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    // Read the current value and drop the guard immediately -- holding a
    // std::sync::MutexGuard across an .await makes the command's future
    // non-Send, which tauri::generate_handler requires.
    let currently_active = *active.0.lock().unwrap();
    if currently_active == id {
        let fallback: i64 = sqlx::query_scalar("SELECT id FROM profiles ORDER BY id ASC LIMIT 1")
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
        *active.0.lock().unwrap() = fallback;
    }

    Ok(())
}
