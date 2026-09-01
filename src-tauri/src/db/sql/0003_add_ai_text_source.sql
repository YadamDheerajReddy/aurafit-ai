-- Adds 'ai_text' as a valid food_log.source value, for meals estimated by a
-- local text LLM from a typed description (no photo/vision model required).
-- Additive: existing rows and their source values are preserved exactly;
-- only the set of allowed future values grows.
--
-- SQLite has no ALTER TABLE ... to modify a CHECK constraint, so this
-- follows SQLite's own documented "recreate the table" pattern.

CREATE TABLE food_log_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  logged_at TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT NOT NULL CHECK (source IN
    ('vision_ai','quick_lookup','manual','recipe','ai_text')),
  photo_path TEXT,
  total_calories REAL NOT NULL DEFAULT 0,
  total_protein_g REAL NOT NULL DEFAULT 0,
  total_carbs_g REAL NOT NULL DEFAULT 0,
  total_fat_g REAL NOT NULL DEFAULT 0
);

INSERT INTO food_log_new (id, logged_at, source, photo_path, total_calories, total_protein_g, total_carbs_g, total_fat_g)
SELECT id, logged_at, source, photo_path, total_calories, total_protein_g, total_carbs_g, total_fat_g FROM food_log;

DROP TABLE food_log;
ALTER TABLE food_log_new RENAME TO food_log;

CREATE INDEX idx_food_log_date ON food_log(logged_at);
