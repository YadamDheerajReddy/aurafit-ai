use serde::{Deserialize, Serialize};

/// Mirrors the frontend Zod schema exactly (TRD, 4.2 — Response Schema), so a
/// payload that fails validation on one side fails identically on the other.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FoodItem {
    pub name: String,
    pub estimated_grams: f32,
    pub calories: f32,
    pub protein_g: f32,
    pub carbs_g: f32,
    pub fat_g: f32,
    pub confidence: Confidence,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Confidence {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MealAnalysis {
    pub items: Vec<FoodItem>,
    pub total_calories: f32,
}
