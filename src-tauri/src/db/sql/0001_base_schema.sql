-- AuraFit AI — base schema (Backend & Database Schema doc, 02 — Schema Reference)
-- Single aurafit.db file, WAL mode, additive-only migrations.

PRAGMA journal_mode = WAL;

-- ============================================================
-- 2.1 Profile & Targets
-- ============================================================

CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  sex TEXT NOT NULL CHECK (sex IN ('male','female')),
  date_of_birth TEXT NOT NULL,
  height_cm REAL NOT NULL,
  activity_level TEXT NOT NULL CHECK (activity_level IN
    ('sedentary','light','moderate','active','very_active')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_type TEXT NOT NULL CHECK (goal_type IN
    ('aggressive_fat_loss','lean_bulk','recomposition','maintenance')),
  target_calories INTEGER NOT NULL,
  target_protein_g REAL NOT NULL,
  target_carbs_g REAL NOT NULL,
  target_fat_g REAL NOT NULL,
  target_fiber_g REAL NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE dietary_guardrails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  constraint_type TEXT NOT NULL CHECK (constraint_type IN ('diet','allergy')),
  value TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(constraint_type, value)
);

-- ============================================================
-- 2.2 Logging
-- ============================================================

CREATE TABLE food_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  logged_at TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT NOT NULL CHECK (source IN
    ('vision_ai','quick_lookup','manual','recipe')),
  photo_path TEXT,
  total_calories REAL NOT NULL DEFAULT 0,
  total_protein_g REAL NOT NULL DEFAULT 0,
  total_carbs_g REAL NOT NULL DEFAULT 0,
  total_fat_g REAL NOT NULL DEFAULT 0
);

CREATE TABLE food_log_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  food_log_id INTEGER NOT NULL REFERENCES food_log(id) ON DELETE CASCADE,
  usda_fdc_id INTEGER REFERENCES usda_foods(fdc_id),
  name TEXT NOT NULL,
  estimated_grams REAL NOT NULL,
  calories REAL NOT NULL,
  protein_g REAL NOT NULL,
  carbs_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  confidence TEXT CHECK (confidence IN ('low','medium','high')),
  user_edited INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE weight_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weight_kg REAL NOT NULL,
  logged_at TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT
);

-- ============================================================
-- 2.3 Reference Data & Recipes
-- ============================================================

CREATE TABLE usda_foods (
  fdc_id INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  category TEXT,
  calories_per_100g REAL NOT NULL,
  protein_g_per_100g REAL NOT NULL,
  carbs_g_per_100g REAL NOT NULL,
  fat_g_per_100g REAL NOT NULL,
  fiber_g_per_100g REAL
);

CREATE INDEX idx_usda_description ON usda_foods(description);
CREATE VIRTUAL TABLE usda_foods_fts USING fts5(description, content='usda_foods', content_rowid='fdc_id');

CREATE TABLE recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  prep_time_minutes INTEGER,
  servings INTEGER NOT NULL DEFAULT 1,
  calories_per_serving REAL,
  protein_g_per_serving REAL,
  carbs_g_per_serving REAL,
  fat_g_per_serving REAL,
  instructions TEXT NOT NULL, -- JSON array of step strings
  source TEXT NOT NULL DEFAULT 'generated' CHECK (source IN ('generated','saved','manual')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE recipe_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT NOT NULL
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================================
-- 06 — Indexing & Performance
-- ============================================================

CREATE INDEX idx_food_log_date ON food_log(logged_at);
CREATE INDEX idx_weight_date ON weight_history(logged_at);

-- Keep the FTS5 index in sync with usda_foods automatically.
CREATE TRIGGER usda_foods_ai AFTER INSERT ON usda_foods BEGIN
  INSERT INTO usda_foods_fts(rowid, description) VALUES (new.fdc_id, new.description);
END;

CREATE TRIGGER usda_foods_ad AFTER DELETE ON usda_foods BEGIN
  INSERT INTO usda_foods_fts(usda_foods_fts, rowid, description) VALUES('delete', old.fdc_id, old.description);
END;

CREATE TRIGGER usda_foods_au AFTER UPDATE ON usda_foods BEGIN
  INSERT INTO usda_foods_fts(usda_foods_fts, rowid, description) VALUES('delete', old.fdc_id, old.description);
  INSERT INTO usda_foods_fts(rowid, description) VALUES (new.fdc_id, new.description);
END;
