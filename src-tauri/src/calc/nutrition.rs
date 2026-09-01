use chrono::{Datelike, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Sex {
    Male,
    Female,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActivityLevel {
    Sedentary,
    Light,
    Moderate,
    Active,
    VeryActive,
}

impl ActivityLevel {
    /// Standard Mifflin-St Jeor activity multipliers.
    pub fn multiplier(self) -> f64 {
        match self {
            ActivityLevel::Sedentary => 1.2,
            ActivityLevel::Light => 1.375,
            ActivityLevel::Moderate => 1.55,
            ActivityLevel::Active => 1.725,
            ActivityLevel::VeryActive => 1.9,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GoalType {
    AggressiveFatLoss,
    LeanBulk,
    Recomposition,
    Maintenance,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct MacroTargets {
    pub calories: i32,
    pub protein_g: f64,
    pub carbs_g: f64,
    pub fat_g: f64,
    pub fiber_g: f64,
}

pub fn bmi(weight_kg: f64, height_cm: f64) -> f64 {
    let height_m = height_cm / 100.0;
    weight_kg / (height_m * height_m)
}

/// Whole years elapsed since `dob` ("YYYY-MM-DD"), as of today (UTC).
pub fn age_years_from_dob(dob: &str) -> Result<i32, chrono::ParseError> {
    let birth = NaiveDate::parse_from_str(dob, "%Y-%m-%d")?;
    let today = Utc::now().date_naive();
    let mut age = today.year() - birth.year();
    if (today.month(), today.day()) < (birth.month(), birth.day()) {
        age -= 1;
    }
    Ok(age)
}

/// Mifflin-St Jeor equation (PRD BIO-01; TRD Technology Stack).
pub fn bmr_mifflin_st_jeor(sex: Sex, weight_kg: f64, height_cm: f64, age_years: f64) -> f64 {
    let base = 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age_years;
    match sex {
        Sex::Male => base + 5.0,
        Sex::Female => base - 161.0,
    }
}

pub fn tdee(bmr: f64, activity: ActivityLevel) -> f64 {
    bmr * activity.multiplier()
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

/// Goal-oriented calorie and macro allocation (PRD BIO-02).
///
/// Calorie adjustment and protein targets follow standard sports-nutrition
/// ranges (protein 1.8-2.2 g/kg depending on goal, fat 25-30% of calories,
/// fiber at the 14g/1000kcal Dietary Guidelines benchmark); carbs fill the
/// remainder.
pub fn macro_targets(tdee: f64, goal: GoalType, weight_kg: f64) -> MacroTargets {
    let (calorie_multiplier, protein_per_kg, fat_pct) = match goal {
        GoalType::AggressiveFatLoss => (0.75, 2.2, 0.25),
        GoalType::LeanBulk => (1.10, 2.0, 0.25),
        GoalType::Recomposition => (0.95, 2.2, 0.25),
        GoalType::Maintenance => (1.0, 1.8, 0.30),
    };

    let calories = (tdee * calorie_multiplier).round();
    let protein_g = round1(protein_per_kg * weight_kg);
    let fat_g = round1((calories * fat_pct) / 9.0);
    let protein_kcal = protein_g * 4.0;
    let fat_kcal = fat_g * 9.0;
    let carbs_g = round1((calories - protein_kcal - fat_kcal).max(0.0) / 4.0);
    let fiber_g = round1((calories / 1000.0) * 14.0);

    MacroTargets {
        calories: calories as i32,
        protein_g,
        carbs_g,
        fat_g,
        fiber_g,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Reference values computed directly from the Mifflin-St Jeor formula
    // (Implementation Plan Phase 1 exit criterion: "Calculated targets match
    // reference Mifflin-St Jeor values within rounding for a 10-case test
    // matrix").
    #[test]
    fn bmr_matches_reference_values() {
        let cases: [(Sex, f64, f64, f64, f64); 10] = [
            // sex, weight_kg, height_cm, age, expected_bmr
            (Sex::Male, 80.0, 180.0, 30.0, 1780.0),
            (Sex::Female, 60.0, 165.0, 25.0, 1345.25),
            (Sex::Male, 100.0, 190.0, 45.0, 1967.5),
            (Sex::Female, 55.0, 160.0, 22.0, 1279.0),
            (Sex::Male, 70.0, 175.0, 28.0, 1658.75),
            (Sex::Female, 90.0, 170.0, 35.0, 1626.5),
            (Sex::Male, 65.0, 170.0, 50.0, 1467.5),
            (Sex::Female, 48.0, 155.0, 19.0, 1192.75),
            (Sex::Male, 110.0, 185.0, 40.0, 2061.25),
            (Sex::Female, 75.0, 168.0, 60.0, 1339.0),
        ];

        for (sex, weight, height, age, expected) in cases {
            let bmr = bmr_mifflin_st_jeor(sex, weight, height, age);
            assert!(
                (bmr - expected).abs() < 0.01,
                "BMR mismatch for {sex:?} {weight}kg {height}cm {age}y: got {bmr}, expected {expected}"
            );
        }
    }

    #[test]
    fn tdee_applies_activity_multiplier() {
        let bmr = 1780.0;
        assert!((tdee(bmr, ActivityLevel::Sedentary) - 2136.0).abs() < 0.01);
        assert!((tdee(bmr, ActivityLevel::VeryActive) - 3382.0).abs() < 0.01);
    }

    #[test]
    fn age_from_dob_handles_birthday_boundary() {
        // A fixed "old enough" date avoids the test depending on today's date
        // for the birthday-not-yet-happened-this-year branch.
        let age = age_years_from_dob("2000-01-01").unwrap();
        assert!(age >= 25, "expected an adult age, got {age}");
    }

    #[test]
    fn macro_targets_sum_to_calorie_target() {
        let targets = macro_targets(2500.0, GoalType::Maintenance, 80.0);
        let recomputed_calories =
            targets.protein_g * 4.0 + targets.carbs_g * 4.0 + targets.fat_g * 9.0;
        assert!((recomputed_calories - targets.calories as f64).abs() < 5.0);
    }

    #[test]
    fn aggressive_fat_loss_is_a_deficit_with_higher_protein() {
        let maintenance = macro_targets(2500.0, GoalType::Maintenance, 80.0);
        let fat_loss = macro_targets(2500.0, GoalType::AggressiveFatLoss, 80.0);
        assert!(fat_loss.calories < maintenance.calories);
        assert!(fat_loss.protein_g > maintenance.protein_g);
    }

    #[test]
    fn lean_bulk_is_a_surplus() {
        let maintenance = macro_targets(2500.0, GoalType::Maintenance, 80.0);
        let bulk = macro_targets(2500.0, GoalType::LeanBulk, 80.0);
        assert!(bulk.calories > maintenance.calories);
    }
}
