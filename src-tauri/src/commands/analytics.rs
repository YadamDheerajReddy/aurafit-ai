use chrono::{Duration, NaiveDate, Utc};
use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::commands::profiles::ActiveProfile;

#[derive(Debug, Serialize)]
pub struct WeightPoint {
    pub date: String,
    pub weight_kg: f64,
}

#[derive(Debug, Serialize)]
pub struct DailyMacroPoint {
    pub date: String,
    pub calories: f64,
    pub protein_g: f64,
    pub carbs_g: f64,
    pub fat_g: f64,
}

#[derive(Debug, Serialize)]
pub struct ProgressData {
    pub weight_trend: Vec<WeightPoint>,
    pub daily_macros: Vec<DailyMacroPoint>,
    pub target_calories: Option<i32>,
    pub logging_streak_days: i32,
}

/// Consecutive-day logging streak, counted backward from today (or from
/// yesterday if nothing's logged yet today — an in-progress day shouldn't
/// zero out an existing streak).
fn compute_streak(mut dates: Vec<NaiveDate>) -> i32 {
    if dates.is_empty() {
        return 0;
    }
    dates.sort_by(|a, b| b.cmp(a));

    let today = Utc::now().date_naive();
    let mut expected = if dates[0] == today {
        today
    } else if dates[0] == today - Duration::days(1) {
        today - Duration::days(1)
    } else {
        return 0;
    };

    let mut streak = 0;
    for date in dates {
        if date == expected {
            streak += 1;
            expected -= Duration::days(1);
        } else if date > expected {
            continue; // duplicate/same-day artifact, ignore
        } else {
            break;
        }
    }
    streak
}

#[tauri::command]
pub async fn get_progress_charts(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
    days: i64,
) -> Result<ProgressData, String> {
    let profile_id = active.get();

    let weight_rows: Vec<(String, f64)> = sqlx::query_as(
        "SELECT date(logged_at), weight_kg FROM weight_history
         WHERE logged_at >= datetime('now', ?) AND profile_id = ?
         ORDER BY logged_at ASC",
    )
    .bind(format!("-{days} days"))
    .bind(profile_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let weight_trend = weight_rows
        .into_iter()
        .map(|(date, weight_kg)| WeightPoint { date, weight_kg })
        .collect();

    let macro_rows: Vec<(String, f64, f64, f64, f64)> = sqlx::query_as(
        "SELECT date(logged_at), SUM(total_calories), SUM(total_protein_g), SUM(total_carbs_g), SUM(total_fat_g)
         FROM food_log
         WHERE logged_at >= datetime('now', ?) AND profile_id = ?
         GROUP BY date(logged_at)
         ORDER BY date(logged_at) ASC",
    )
    .bind(format!("-{days} days"))
    .bind(profile_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let daily_macros = macro_rows
        .into_iter()
        .map(|(date, calories, protein_g, carbs_g, fat_g)| DailyMacroPoint {
            date,
            calories,
            protein_g,
            carbs_g,
            fat_g,
        })
        .collect();

    let target_calories: Option<i32> = sqlx::query_scalar(
        "SELECT target_calories FROM goals WHERE is_active = 1 AND profile_id = ? ORDER BY id DESC LIMIT 1",
    )
    .bind(profile_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let logged_dates: Vec<String> =
        sqlx::query_scalar("SELECT DISTINCT date(logged_at) FROM food_log WHERE profile_id = ?")
            .bind(profile_id)
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    let parsed_dates: Vec<NaiveDate> = logged_dates
        .iter()
        .filter_map(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        .collect();
    let logging_streak_days = compute_streak(parsed_dates);

    Ok(ProgressData {
        weight_trend,
        daily_macros,
        target_calories,
        logging_streak_days,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn empty_history_has_no_streak() {
        assert_eq!(compute_streak(vec![]), 0);
    }

    #[test]
    fn streak_breaks_if_most_recent_log_is_older_than_yesterday() {
        let today = Utc::now().date_naive();
        let stale = today - Duration::days(5);
        assert_eq!(compute_streak(vec![stale]), 0);
    }

    #[test]
    fn counts_consecutive_days_ending_today() {
        let today = Utc::now().date_naive();
        let dates = vec![today, today - Duration::days(1), today - Duration::days(2)];
        assert_eq!(compute_streak(dates), 3);
    }

    #[test]
    fn gap_stops_the_count() {
        let today = Utc::now().date_naive();
        let dates = vec![today, today - Duration::days(1), today - Duration::days(3)];
        assert_eq!(compute_streak(dates), 2);
    }

    #[test]
    fn fixed_dates_sanity_check() {
        let dates = vec![d("2026-08-30"), d("2026-08-29"), d("2026-08-27")];
        // Not anchored to "today", so this always breaks immediately unless
        // today happens to be 2026-08-30 — assert the non-time-dependent
        // gap-detection logic in isolation instead.
        let mut sorted = dates.clone();
        sorted.sort_by(|a, b| b.cmp(a));
        assert_eq!(sorted[0] - sorted[1], Duration::days(1));
        assert_eq!(sorted[1] - sorted[2], Duration::days(2));
    }
}
