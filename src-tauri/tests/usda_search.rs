//! Phase 0 exit criterion (Implementation Plan, Timeline Summary):
//! "CI green on all 3 OS targets; USDA table returns results in <5ms."
//!
//! This test applies the same schema + seed SQL the app ships (via `include_str!`
//! in `db::migrations`) to a throwaway in-memory database, then times an FTS5
//! query identical in shape to the one the frontend runs (`src/lib/db.ts`).
//! The assertion threshold is relaxed vs. the <5ms target to absorb CI-runner
//! jitter (cold caches, shared vCPUs) — the point is to catch a query plan
//! regression (e.g. a dropped index), not to benchmark a single machine.

use sqlx::sqlite::SqlitePoolOptions;
use std::time::Instant;

const BASE_SCHEMA: &str = include_str!("../src/db/sql/0001_base_schema.sql");
const USDA_SEED: &str = include_str!("../src/db/sql/0002_usda_seed.sql");

#[tokio::test]
async fn usda_search_is_fast_and_correct() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open in-memory sqlite db");

    sqlx::raw_sql(BASE_SCHEMA)
        .execute(&pool)
        .await
        .expect("apply base schema");
    sqlx::raw_sql(USDA_SEED)
        .execute(&pool)
        .await
        .expect("apply USDA seed data");

    let row_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM usda_foods")
        .fetch_one(&pool)
        .await
        .expect("count usda_foods rows");
    assert!(row_count > 0, "seed migration inserted no rows");

    let start = Instant::now();
    let descriptions: Vec<String> = sqlx::query_scalar(
        "SELECT f.description
         FROM usda_foods_fts
         JOIN usda_foods f ON f.fdc_id = usda_foods_fts.rowid
         WHERE usda_foods_fts MATCH 'chick*'
         ORDER BY rank
         LIMIT 20",
    )
    .fetch_all(&pool)
    .await
    .expect("run FTS5 search query");
    let elapsed = start.elapsed();

    assert!(
        !descriptions.is_empty(),
        "expected at least one match for 'chick*'"
    );
    assert!(
        descriptions
            .iter()
            .any(|d| d.to_lowercase().contains("chicken")),
        "expected a chicken result, got: {descriptions:?}"
    );
    assert!(
        elapsed.as_millis() < 50,
        "USDA FTS5 search took {elapsed:?}, expected well under 50ms on CI hardware \
         (production target on end-user hardware is <5ms)"
    );
}
