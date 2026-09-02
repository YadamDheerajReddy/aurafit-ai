-- Multi-profile support (one device, up to 3 profiles, Netflix-style).
-- Every existing row is attached to profile id=1 so upgrading users keep
-- all their data exactly as-is under their first profile.

CREATE TABLE profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#7C3AED',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO profiles (id, name)
  SELECT 1, COALESCE((SELECT name FROM user_profile WHERE id = 1), 'My Profile');

-- user_profile.id was a hardcoded singleton (CHECK (id = 1)); it now IS the
-- profile id (one row per profile), so the CHECK has to go. SQLite has no
-- ALTER TABLE to drop a CHECK constraint, hence the recreate-table pattern.
CREATE TABLE user_profile_new (
  id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT,
  sex TEXT NOT NULL CHECK (sex IN ('male','female')),
  date_of_birth TEXT NOT NULL,
  height_cm REAL NOT NULL,
  activity_level TEXT NOT NULL CHECK (activity_level IN
    ('sedentary','light','moderate','active','very_active')),
  cuisine_preference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO user_profile_new (id, name, sex, date_of_birth, height_cm, activity_level, cuisine_preference, created_at, updated_at)
  SELECT id, name, sex, date_of_birth, height_cm, activity_level, cuisine_preference, created_at, updated_at FROM user_profile;

DROP TABLE user_profile;
ALTER TABLE user_profile_new RENAME TO user_profile;

-- dietary_guardrails' uniqueness was global (one "Vegetarian" row ever);
-- it needs to be per-profile so two profiles can each have their own.
CREATE TABLE dietary_guardrails_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL DEFAULT 1 REFERENCES profiles(id) ON DELETE CASCADE,
  constraint_type TEXT NOT NULL CHECK (constraint_type IN ('diet','allergy')),
  value TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(profile_id, constraint_type, value)
);

INSERT INTO dietary_guardrails_new (id, profile_id, constraint_type, value, is_active)
  SELECT id, 1, constraint_type, value, is_active FROM dietary_guardrails;

DROP TABLE dietary_guardrails;
ALTER TABLE dietary_guardrails_new RENAME TO dietary_guardrails;

-- Same story for avoided_ingredients' UNIQUE(name).
CREATE TABLE avoided_ingredients_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL DEFAULT 1 REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(profile_id, name)
);

INSERT INTO avoided_ingredients_new (id, profile_id, name)
  SELECT id, 1, name FROM avoided_ingredients;

DROP TABLE avoided_ingredients;
ALTER TABLE avoided_ingredients_new RENAME TO avoided_ingredients;

-- The rest have no CHECK/UNIQUE constraint on the column being added, so a
-- plain ADD COLUMN with a constant default (attaching all existing rows to
-- profile 1) is enough -- no recreate needed. Deliberately no REFERENCES
-- clause here: SQLite restricts adding a foreign-key column via ADD COLUMN
-- on a non-empty table unless the default is NULL or the constraint is
-- deferred, and this runs against real existing data, so referential
-- integrity for these six columns is enforced in the Rust command layer
-- (delete_profile explicitly cleans up each table) instead of by the DB.
ALTER TABLE goals ADD COLUMN profile_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE food_log ADD COLUMN profile_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE weight_history ADD COLUMN profile_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE water_log ADD COLUMN profile_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE diet_plans ADD COLUMN profile_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE recipes ADD COLUMN profile_id INTEGER NOT NULL DEFAULT 1;

CREATE INDEX idx_goals_profile ON goals(profile_id, is_active);
CREATE INDEX idx_food_log_profile_date ON food_log(profile_id, logged_at);
CREATE INDEX idx_weight_profile_date ON weight_history(profile_id, logged_at);
CREATE INDEX idx_water_log_profile_date ON water_log(profile_id, logged_at);
CREATE INDEX idx_diet_plans_profile ON diet_plans(profile_id);
CREATE INDEX idx_recipes_profile ON recipes(profile_id);

-- app_settings stays a plain key-value table; per-profile settings (like
-- water_goal_ml) are namespaced at the application level as
-- "water_goal_ml:<profile_id>" rather than reshaping its primary key.
