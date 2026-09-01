mod calc;
mod commands;
mod db;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join(db::DB_FILENAME);

            // Runs synchronously here, before the webview loads, so the
            // schema is guaranteed to exist before any frontend code touches
            // the file.
            let pool = tauri::async_runtime::block_on(async {
                let pool = db::pool::connect(&db_path)
                    .await
                    .expect("failed to open database");
                db::migrations::run(&pool, &db_path)
                    .await
                    .expect("failed to run migrations");
                pool
            });

            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::biometrics::calculate_targets,
            commands::biometrics::save_profile,
            commands::biometrics::save_goal,
            commands::biometrics::set_guardrails,
            commands::biometrics::get_user_state,
            commands::lookup::search_usda_foods,
            commands::logging::save_food_log,
            commands::logging::get_todays_log,
            commands::logging::delete_food_log,
            commands::logging::save_weight_entry,
            commands::logging::get_weight_history,
            commands::analytics::get_progress_charts,
            commands::export::export_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
