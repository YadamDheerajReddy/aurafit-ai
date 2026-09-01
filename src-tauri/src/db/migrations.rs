use tauri_plugin_sql::{Migration, MigrationKind};

/// Additive-only within a MINOR version: migrations only ever add columns/tables
/// with safe defaults, never drop or rename, so a user can downgrade one version
/// without losing local data (SDLC doc, Risk Register; Backend Schema doc, 07).
pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "base_schema",
            sql: include_str!("./sql/0001_base_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "usda_seed",
            sql: include_str!("./sql/0002_usda_seed.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
