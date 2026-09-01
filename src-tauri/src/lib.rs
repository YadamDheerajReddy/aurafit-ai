mod calc;
mod commands;
mod db;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join(db::DB_FILENAME);

            // Runs synchronously here, before the webview loads, so the
            // schema is guaranteed to exist before any frontend code
            // (including the JS-side USDA search via tauri-plugin-sql)
            // touches the file.
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
