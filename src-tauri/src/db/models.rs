use serde::Serialize;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProfileRow {
    pub sex: String,
    pub date_of_birth: String,
    pub height_cm: f64,
    pub activity_level: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct GoalRow {
    pub goal_type: String,
    pub target_calories: i32,
    pub target_protein_g: f64,
    pub target_carbs_g: f64,
    pub target_fat_g: f64,
    pub target_fiber_g: f64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct GuardrailRow {
    pub constraint_type: String,
    pub value: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LatestWeightRow {
    pub weight_kg: f64,
}
