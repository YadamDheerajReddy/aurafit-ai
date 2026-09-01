mod db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_url = format!("sqlite:{}", db::DB_FILENAME);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_url, db::migrations::migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
