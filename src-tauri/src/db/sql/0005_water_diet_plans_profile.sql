-- Adds: personal name + cuisine preference on the profile, daily water
-- tracking, a free-text ingredient avoid-list, and AI-generated diet plans.
-- All additive -- no existing table's CHECK constraints change, so no
-- recreate-table trick needed this time.

ALTER TABLE user_profile ADD COLUMN name TEXT;
ALTER TABLE user_profile ADD COLUMN cuisine_preference TEXT;

CREATE TABLE water_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount_ml INTEGER NOT NULL,
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_water_log_date ON water_log(logged_at);

CREATE TABLE avoided_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE diet_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  cuisine TEXT,
  target_calories INTEGER,
  target_protein_g REAL,
  target_carbs_g REAL,
  target_fat_g REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE diet_plan_meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  diet_plan_id INTEGER NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN
    ('breakfast','mid_morning','lunch','evening_snack','dinner')),
  dish_name TEXT NOT NULL,
  description TEXT,
  calories REAL,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_diet_plan_meals_plan ON diet_plan_meals(diet_plan_id);
