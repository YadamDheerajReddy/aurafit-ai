use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::commands::profiles::ActiveProfile;
use crate::db::models::{GuardrailRow, RecipeIngredientRow, RecipeRow, SavedRecipe};
use crate::ollama::client::OllamaClient;
use crate::ollama::schemas::{GeneratedRecipe, RecipeCandidates};

fn build_prompt(
    pantry_items: &[String],
    diets: &[String],
    allergies: &[String],
    avoided: &[String],
    target_prep_minutes: Option<i32>,
    remaining_calories: Option<f64>,
    remaining_protein_g: Option<f64>,
) -> String {
    let mut prompt = format!(
        "Suggest 2 to 3 recipes using some or all of these pantry ingredients: {}. \
         Each recipe should be realistic to cook with commonly available staples \
         (salt, oil, water, basic spices) in addition to the pantry items listed.",
        pantry_items.join(", ")
    );

    if !diets.is_empty() {
        prompt.push_str(&format!(
            " Every recipe MUST strictly follow these dietary patterns: {}.",
            diets.join(", ")
        ));
    }
    if !allergies.is_empty() {
        prompt.push_str(&format!(
            " Every recipe MUST NOT contain any of these allergens or their derivatives: {}.",
            allergies.join(", ")
        ));
    }
    if !avoided.is_empty() {
        prompt.push_str(&format!(
            " The user dislikes these ingredients and they must NOT appear in any recipe: {}.",
            avoided.join(", ")
        ));
    }
    if let Some(minutes) = target_prep_minutes {
        prompt.push_str(&format!(" Prefer recipes that take {minutes} minutes or less to prepare."));
    }
    if let (Some(cal), Some(protein)) = (remaining_calories, remaining_protein_g) {
        prompt.push_str(&format!(
            " The user has about {cal:.0} kcal and {protein:.0}g of protein left in their \
             budget for today — prefer recipes whose per-serving macros fit within that."
        ));
    }

    prompt.push_str(
        " Respond only in JSON with this shape: {\"recipes\": [{\"title\": string, \
         \"prep_time_minutes\": number, \"servings\": number, \"calories_per_serving\": number, \
         \"protein_g_per_serving\": number, \"carbs_g_per_serving\": number, \
         \"fat_g_per_serving\": number, \"ingredients\": [{\"name\": string, \"quantity\": string}], \
         \"instructions\": [string]}]}",
    );

    prompt
}

fn parse_and_validate(raw: &str) -> Result<Vec<GeneratedRecipe>, String> {
    let candidates =
        serde_json::from_str::<RecipeCandidates>(raw).map_err(|e| e.to_string())?;
    if candidates.recipes.is_empty() {
        return Err("model returned zero recipes".to_string());
    }
    Ok(candidates.recipes)
}

/// Coarse, keyword-based post-generation safety net (PRD Dietary Guardrail
/// Matrix: allergy enforcement point is "prompt constraints + post-generation
/// filter", not prompt constraints alone — local LLMs don't always follow
/// instructions perfectly). Flags rather than silently discards, matching
/// the PRD's "not a medical safety system" stance: the user still sees and
/// judges the recipe themselves.
fn flag_allergy_conflicts(recipe: &GeneratedRecipe, allergies: &[String], avoided: &[String]) -> Vec<String> {
    let keywords: &[(&str, &[&str])] = &[
        ("Gluten", &["wheat", "flour", "bread", "pasta", "barley", "rye", "noodle", "breadcrumb"]),
        ("Lactose", &["milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "whey"]),
        ("Nuts", &["almond", "peanut", "walnut", "cashew", "pecan", "hazelnut", "pistachio", "macadamia"]),
        ("Shellfish", &["shrimp", "prawn", "crab", "lobster", "scallop", "oyster", "clam", "mussel"]),
    ];

    let ingredient_text = recipe
        .ingredients
        .iter()
        .map(|i| i.name.to_lowercase())
        .collect::<Vec<_>>()
        .join(" ");

    let mut flags: Vec<String> = allergies
        .iter()
        .filter(|allergy| {
            keywords
                .iter()
                .find(|(name, _)| name.eq_ignore_ascii_case(allergy))
                .is_some_and(|(_, words)| words.iter().any(|w| ingredient_text.contains(w)))
        })
        .cloned()
        .collect();

    for item in avoided {
        let needle = item.to_lowercase();
        if !needle.is_empty() && ingredient_text.contains(&needle) {
            flags.push(item.clone());
        }
    }

    flags
}

#[derive(Debug, Serialize)]
pub struct RecipeCandidate {
    #[serde(flatten)]
    pub recipe: GeneratedRecipe,
    pub possible_allergens: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct GenerateRecipesInput {
    pub pantry_items: Vec<String>,
    pub target_prep_minutes: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct RecipeGenerationResult {
    pub recipes: Vec<RecipeCandidate>,
    /// Today's remaining calorie/protein budget at generation time, so the
    /// frontend can render each candidate's macro-fit bar without a second
    /// round trip (UI/UX Brief, Recipe Generator screen).
    pub remaining_calories: Option<f64>,
    pub remaining_protein_g: Option<f64>,
}

#[tauri::command]
pub async fn generate_recipes(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
    input: GenerateRecipesInput,
) -> Result<RecipeGenerationResult, String> {
    let profile_id = active.get();
    let pantry_items: Vec<String> = input
        .pantry_items
        .into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if pantry_items.is_empty() {
        return Err("Add at least one pantry ingredient.".to_string());
    }

    let guardrails = sqlx::query_as::<_, GuardrailRow>(
        "SELECT constraint_type, value FROM dietary_guardrails WHERE is_active = 1 AND profile_id = ?",
    )
    .bind(profile_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    let diets: Vec<String> = guardrails
        .iter()
        .filter(|g| g.constraint_type == "diet")
        .map(|g| g.value.clone())
        .collect();
    let allergies: Vec<String> = guardrails
        .iter()
        .filter(|g| g.constraint_type == "allergy")
        .map(|g| g.value.clone())
        .collect();

    let avoided: Vec<String> = sqlx::query_scalar("SELECT name FROM avoided_ingredients WHERE profile_id = ?")
        .bind(profile_id)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    let target_calories: Option<i32> = sqlx::query_scalar(
        "SELECT target_calories FROM goals WHERE is_active = 1 AND profile_id = ? ORDER BY id DESC LIMIT 1",
    )
    .bind(profile_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    let target_protein: Option<f64> = sqlx::query_scalar(
        "SELECT target_protein_g FROM goals WHERE is_active = 1 AND profile_id = ? ORDER BY id DESC LIMIT 1",
    )
    .bind(profile_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let todays_totals: (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(total_calories),0), COALESCE(SUM(total_protein_g),0)
         FROM food_log WHERE date(logged_at) = date('now') AND profile_id = ?",
    )
    .bind(profile_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let remaining_calories = target_calories.map(|t| (t as f64 - todays_totals.0).max(0.0));
    let remaining_protein = target_protein.map(|t| (t - todays_totals.1).max(0.0));

    let prompt = build_prompt(
        &pantry_items,
        &diets,
        &allergies,
        &avoided,
        input.target_prep_minutes,
        remaining_calories,
        remaining_protein,
    );

    let client = OllamaClient::new();
    let raw = client.generate_recipes(&prompt, None).await?;

    let recipes = match parse_and_validate(&raw) {
        Ok(recipes) => recipes,
        Err(first_error) => {
            let retry_context = format!(
                "Your previous response was invalid: {first_error}. Respond ONLY with valid \
                 JSON matching the exact schema requested, with at least one recipe."
            );
            let retry_raw = client.generate_recipes(&prompt, Some(retry_context)).await?;
            parse_and_validate(&retry_raw)
                .map_err(|e| format!("Couldn't generate valid recipes: {e}"))?
        }
    };

    let candidates = recipes
        .into_iter()
        .map(|recipe| {
            let possible_allergens = flag_allergy_conflicts(&recipe, &allergies, &avoided);
            RecipeCandidate { recipe, possible_allergens }
        })
        .collect();

    Ok(RecipeGenerationResult {
        recipes: candidates,
        remaining_calories,
        remaining_protein_g: remaining_protein,
    })
}

#[derive(Debug, Deserialize)]
pub struct SaveRecipeInput {
    pub title: String,
    pub prep_time_minutes: i32,
    pub servings: i32,
    pub calories_per_serving: f32,
    pub protein_g_per_serving: f32,
    pub carbs_g_per_serving: f32,
    pub fat_g_per_serving: f32,
    pub ingredients: Vec<IngredientInput>,
    pub instructions: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct IngredientInput {
    pub name: String,
    pub quantity: String,
}

#[tauri::command]
pub async fn save_recipe(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
    input: SaveRecipeInput,
) -> Result<i64, String> {
    let instructions_json = serde_json::to_string(&input.instructions).map_err(|e| e.to_string())?;

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let recipe_id: i64 = sqlx::query_scalar(
        "INSERT INTO recipes
           (profile_id, title, prep_time_minutes, servings, calories_per_serving, protein_g_per_serving, carbs_g_per_serving, fat_g_per_serving, instructions, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated') RETURNING id",
    )
    .bind(active.get())
    .bind(&input.title)
    .bind(input.prep_time_minutes)
    .bind(input.servings)
    .bind(input.calories_per_serving)
    .bind(input.protein_g_per_serving)
    .bind(input.carbs_g_per_serving)
    .bind(input.fat_g_per_serving)
    .bind(&instructions_json)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    for ingredient in &input.ingredients {
        sqlx::query("INSERT INTO recipe_ingredients (recipe_id, name, quantity) VALUES (?, ?, ?)")
            .bind(recipe_id)
            .bind(&ingredient.name)
            .bind(&ingredient.quantity)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(recipe_id)
}

#[tauri::command]
pub async fn get_saved_recipes(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
) -> Result<Vec<SavedRecipe>, String> {
    let recipes = sqlx::query_as::<_, RecipeRow>(
        "SELECT id, title, prep_time_minutes, servings, calories_per_serving, protein_g_per_serving, carbs_g_per_serving, fat_g_per_serving, instructions, source, created_at
         FROM recipes WHERE profile_id = ? ORDER BY created_at DESC",
    )
    .bind(active.get())
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let mut result = Vec::with_capacity(recipes.len());
    for recipe in recipes {
        let ingredients = sqlx::query_as::<_, RecipeIngredientRow>(
            "SELECT id, recipe_id, name, quantity FROM recipe_ingredients WHERE recipe_id = ?",
        )
        .bind(recipe.id)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
        result.push(SavedRecipe { recipe, ingredients });
    }

    Ok(result)
}

#[tauri::command]
pub async fn delete_recipe(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
    id: i64,
) -> Result<(), String> {
    sqlx::query("DELETE FROM recipes WHERE id = ? AND profile_id = ?")
        .bind(id)
        .bind(active.get())
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ollama::schemas::RecipeIngredient;

    fn recipe_with_ingredients(names: &[&str]) -> GeneratedRecipe {
        GeneratedRecipe {
            title: "Test Recipe".to_string(),
            prep_time_minutes: 20,
            servings: 2,
            calories_per_serving: 400.0,
            protein_g_per_serving: 30.0,
            carbs_g_per_serving: 40.0,
            fat_g_per_serving: 10.0,
            ingredients: names
                .iter()
                .map(|n| RecipeIngredient { name: n.to_string(), quantity: "1 cup".to_string() })
                .collect(),
            instructions: vec!["Cook it.".to_string()],
        }
    }

    #[test]
    fn flags_matching_allergen() {
        let recipe = recipe_with_ingredients(&["chicken breast", "whole wheat flour", "olive oil"]);
        let flags = flag_allergy_conflicts(&recipe, &["Gluten".to_string()], &[]);
        assert_eq!(flags, vec!["Gluten".to_string()]);
    }

    #[test]
    fn no_false_flag_when_clean() {
        let recipe = recipe_with_ingredients(&["chicken breast", "white rice", "broccoli"]);
        let flags = flag_allergy_conflicts(&recipe, &["Gluten".to_string(), "Nuts".to_string()], &[]);
        assert!(flags.is_empty());
    }

    #[test]
    fn flags_multiple_allergens_independently() {
        let recipe = recipe_with_ingredients(&["cheddar cheese", "roasted almonds"]);
        let flags = flag_allergy_conflicts(&recipe, &["Lactose".to_string(), "Nuts".to_string(), "Shellfish".to_string()], &[]);
        assert_eq!(flags.len(), 2);
        assert!(flags.contains(&"Lactose".to_string()));
        assert!(flags.contains(&"Nuts".to_string()));
    }

    #[test]
    fn flags_avoided_ingredient() {
        let recipe = recipe_with_ingredients(&["chicken breast", "drumstick", "rice"]);
        let flags = flag_allergy_conflicts(&recipe, &[], &["drumstick".to_string()]);
        assert_eq!(flags, vec!["drumstick".to_string()]);
    }

    #[test]
    fn malformed_recipe_json_never_panics() {
        let malformed_inputs = [
            "",
            "not json",
            "{}",
            r#"{"recipes": []}"#,
            r#"{"recipes": [{"title": "x"}]}"#,
            r#"{"recipes": [{"title": 5, "prep_time_minutes": "fast"}]}"#,
        ];
        for input in malformed_inputs {
            let _ = parse_and_validate(input);
        }
    }

    #[test]
    fn valid_recipe_json_parses() {
        let valid = r#"{
            "recipes": [{
                "title": "Chicken Stir Fry",
                "prep_time_minutes": 15,
                "servings": 2,
                "calories_per_serving": 450.0,
                "protein_g_per_serving": 35.0,
                "carbs_g_per_serving": 30.0,
                "fat_g_per_serving": 15.0,
                "ingredients": [{"name": "chicken breast", "quantity": "200g"}],
                "instructions": ["Slice chicken.", "Stir fry with vegetables."]
            }]
        }"#;
        let result = parse_and_validate(valid);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 1);
    }
}
