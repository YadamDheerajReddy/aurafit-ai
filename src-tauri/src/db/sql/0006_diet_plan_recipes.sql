-- Diet plan meals now carry a full recipe (prep time, ingredients,
-- instructions), not just a dish name/description. Additive-only.

ALTER TABLE diet_plan_meals ADD COLUMN prep_time_minutes INTEGER;
ALTER TABLE diet_plan_meals ADD COLUMN ingredients TEXT; -- JSON array of {name, quantity}
ALTER TABLE diet_plan_meals ADD COLUMN instructions TEXT; -- JSON array of step strings
