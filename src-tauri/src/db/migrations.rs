use sqlx::SqlitePool;
use std::path::Path;

struct MigrationFile {
    version: i64,
    description: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[MigrationFile] = &[
    MigrationFile {
        version: 1,
        description: "base_schema",
        sql: include_str!("./sql/0001_base_schema.sql"),
    },
    MigrationFile {
        version: 2,
        description: "usda_seed",
        sql: include_str!("./sql/0002_usda_seed.sql"),
    },
    MigrationFile {
        version: 3,
        description: "add_ai_text_source",
        sql: include_str!("./sql/0003_add_ai_text_source.sql"),
    },
    MigrationFile {
        version: 4,
        description: "add_target_weight",
        sql: include_str!("./sql/0004_add_target_weight.sql"),
    },
    MigrationFile {
        version: 5,
        description: "water_diet_plans_profile",
        sql: include_str!("./sql/0005_water_diet_plans_profile.sql"),
    },
    MigrationFile {
        version: 6,
        description: "diet_plan_recipes",
        sql: include_str!("./sql/0006_diet_plan_recipes.sql"),
    },
    MigrationFile {
        version: 7,
        description: "profiles",
        sql: include_str!("./sql/0007_profiles.sql"),
    },
];

/// Applies pending migrations in order, tracked in `schema_migrations`
/// (Backend & Database Schema doc, 07 — Migration Strategy). Additive-only:
/// migrations only ever add tables/columns, never drop or rename, so a
/// downgrade never corrupts local data.
///
/// This runs synchronously during Tauri's `.setup()` hook, before the
/// webview loads — guaranteeing the schema exists before any frontend code
/// (including the JS-side `tauri-plugin-sql` USDA search) can touch the file.
pub async fn run(pool: &SqlitePool, db_path: &Path) -> Result<(), sqlx::Error> {
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            description TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    let applied: Vec<i64> = sqlx::query_scalar("SELECT version FROM schema_migrations")
        .fetch_all(pool)
        .await?;

    for migration in MIGRATIONS {
        if applied.contains(&migration.version) {
            continue;
        }

        // Automatic pre-migration backup of a database that already has
        // prior migrations applied (nothing to back up on first bootstrap).
        if !applied.is_empty() {
            let backup_path =
                db_path.with_extension(format!("db.bak-v{}", migration.version));
            let _ = std::fs::copy(db_path, &backup_path);
        }

        sqlx::raw_sql(migration.sql).execute(pool).await?;
        sqlx::query("INSERT INTO schema_migrations (version, description) VALUES (?, ?)")
            .bind(migration.version)
            .bind(migration.description)
            .execute(pool)
            .await?;
    }

    Ok(())
}
