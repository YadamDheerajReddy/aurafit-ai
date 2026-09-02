mod calc;
mod commands;
pub mod db;
pub mod ollama;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // tauri-plugin-updater's HTTPS requests pull rustls into every
    // reqwest::Client build via feature unification, including our own
    // plain-HTTP Ollama client — rustls 0.23+ panics on first use unless a
    // crypto provider is installed first.
    let _ = rustls::crypto::ring::default_provider().install_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join(db::DB_FILENAME);

            // Runs synchronously here, before the webview loads, so the
            // schema is guaranteed to exist before any frontend code touches
            // the file.
            let (pool, initial_profile_id) = tauri::async_runtime::block_on(async {
                let pool = db::pool::connect(&db_path)
                    .await
                    .expect("failed to open database");
                db::migrations::run(&pool, &db_path)
                    .await
                    .expect("failed to run migrations");

                // Best-effort default: whichever profile was used most
                // recently. The frontend still shows a profile picker (skipped
                // only when there's exactly one profile) and calls
                // switch_profile explicitly once the user picks, so this is
                // only what's active for the brief window before that.
                let most_recent: i64 = sqlx::query_scalar(
                    "SELECT id FROM profiles ORDER BY last_active_at DESC, id ASC LIMIT 1",
                )
                .fetch_optional(&pool)
                .await
                .ok()
                .flatten()
                .unwrap_or(1);

                (pool, most_recent)
            });

            app.manage(pool);
            app.manage(commands::profiles::ActiveProfile(std::sync::Mutex::new(
                initial_profile_id,
            )));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::profiles::get_profiles,
            commands::profiles::get_active_profile_id,
            commands::profiles::create_profile,
            commands::profiles::update_profile,
            commands::profiles::switch_profile,
            commands::profiles::delete_profile,
            commands::biometrics::calculate_targets,
            commands::biometrics::save_profile,
            commands::biometrics::save_goal,
            commands::biometrics::set_guardrails,
            commands::biometrics::set_avoided_ingredients,
            commands::biometrics::set_water_goal,
            commands::biometrics::get_user_state,
            commands::water::log_water,
            commands::water::get_todays_water,
            commands::water::delete_water_entry,
            commands::water::get_water_history,
            commands::diet_plan::generate_diet_plan,
            commands::diet_plan::save_diet_plan,
            commands::diet_plan::get_saved_diet_plans,
            commands::diet_plan::delete_diet_plan,
            commands::diet_plan::export_diet_plan_pdf,
            commands::lookup::search_usda_foods,
            commands::logging::save_food_log,
            commands::logging::get_todays_log,
            commands::logging::delete_food_log,
            commands::logging::save_weight_entry,
            commands::logging::get_weight_history,
            commands::analytics::get_progress_charts,
            commands::export::export_data,
            commands::meal_estimate::check_ollama_status,
            commands::meal_estimate::estimate_meal_from_text,
            commands::recipes::generate_recipes,
            commands::recipes::save_recipe,
            commands::recipes::get_saved_recipes,
            commands::recipes::delete_recipe,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
