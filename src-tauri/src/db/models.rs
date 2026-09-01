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
    pub target_weight_kg: Option<f64>,
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

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FoodItemRow {
    pub fdc_id: i64,
    pub description: String,
    pub category: Option<String>,
    pub calories_per_100g: f64,
    pub protein_g_per_100g: f64,
    pub carbs_g_per_100g: f64,
    pub fat_g_per_100g: f64,
    pub fiber_g_per_100g: Option<f64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FoodLogRow {
    pub id: i64,
    pub logged_at: String,
    pub source: String,
    pub total_calories: f64,
    pub total_protein_g: f64,
    pub total_carbs_g: f64,
    pub total_fat_g: f64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FoodLogItemRow {
    pub id: i64,
    pub food_log_id: i64,
    pub name: String,
    pub estimated_grams: f64,
    pub calories: f64,
    pub protein_g: f64,
    pub carbs_g: f64,
    pub fat_g: f64,
    pub confidence: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FoodLogEntry {
    #[serde(flatten)]
    pub log: FoodLogRow,
    pub items: Vec<FoodLogItemRow>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WeightHistoryRow {
    pub id: i64,
    pub weight_kg: f64,
    pub logged_at: String,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RecipeRow {
    pub id: i64,
    pub title: String,
    pub prep_time_minutes: Option<i32>,
    pub servings: i32,
    pub calories_per_serving: Option<f64>,
    pub protein_g_per_serving: Option<f64>,
    pub carbs_g_per_serving: Option<f64>,
    pub fat_g_per_serving: Option<f64>,
    /// JSON array of step strings, as stored — parsed on the frontend.
    pub instructions: String,
    pub source: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RecipeIngredientRow {
    pub id: i64,
    pub recipe_id: i64,
    pub name: String,
    pub quantity: String,
}

#[derive(Debug, Serialize)]
pub struct SavedRecipe {
    #[serde(flatten)]
    pub recipe: RecipeRow,
    pub ingredients: Vec<RecipeIngredientRow>,
}
