pub mod migrations;
pub mod models;
pub mod pool;

/// Filename of the single embedded SQLite database (Backend & Database Schema doc, 01).
pub const DB_FILENAME: &str = "aurafit.db";
