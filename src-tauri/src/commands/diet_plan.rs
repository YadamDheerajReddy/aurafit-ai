use base64::Engine;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::commands::profiles::ActiveProfile;
use crate::db::models::{DietPlanMealRow, DietPlanRow, GuardrailRow, SavedDietPlan};
use crate::ollama::client::OllamaClient;
use crate::ollama::schemas::{DietPlanMeal, GeneratedDietPlan, MealSlot, RecipeIngredient};

fn slot_label(slot: MealSlot) -> &'static str {
    match slot {
        MealSlot::Breakfast => "Breakfast",
        MealSlot::MidMorning => "Mid-Morning Snack",
        MealSlot::Lunch => "Lunch",
        MealSlot::EveningSnack => "Evening Snack",
        MealSlot::Dinner => "Dinner",
    }
}

fn build_prompt(
    cuisine: Option<&str>,
    diets: &[String],
    allergies: &[String],
    avoided: &[String],
    target_prep_minutes: Option<i32>,
    target_calories: Option<i32>,
    target_protein_g: Option<f64>,
    target_carbs_g: Option<f64>,
    target_fat_g: Option<f64>,
) -> String {
    let mut prompt = String::from(
        "Create a full one-day diet plan with exactly 5 meals, in this order: \
         breakfast, mid_morning (a light snack), lunch, evening_snack, dinner. \
         Each meal needs a realistic, appetizing dish (not just a raw ingredient) with a \
         one-sentence description, plus a complete recipe: a list of ingredients with \
         quantities, and numbered step-by-step cooking instructions — the same level of \
         detail as a standalone recipe, not a summary.",
    );

    if let Some(cuisine) = cuisine.filter(|c| !c.is_empty()) {
        prompt.push_str(&format!(" Every dish MUST be authentic {cuisine} cuisine."));
    }
    if !diets.is_empty() {
        prompt.push_str(&format!(
            " Every meal MUST strictly follow these dietary patterns: {}.",
            diets.join(", ")
        ));
    }
    if !allergies.is_empty() {
        prompt.push_str(&format!(
            " Every meal MUST NOT contain any of these allergens or their derivatives: {}.",
            allergies.join(", ")
        ));
    }
    if !avoided.is_empty() {
        prompt.push_str(&format!(
            " The user dislikes these ingredients and they must NOT appear anywhere in the plan: {}.",
            avoided.join(", ")
        ));
    }
    if let Some(minutes) = target_prep_minutes {
        prompt.push_str(&format!(
            " Every meal MUST be preparable in {minutes} minutes or less — keep recipes \
             realistic for that time budget."
        ));
    }
    if let (Some(cal), Some(p), Some(c), Some(f)) =
        (target_calories, target_protein_g, target_carbs_g, target_fat_g)
    {
        prompt.push_str(&format!(
            " The 5 meals TOGETHER should sum to approximately {cal} kcal, {p:.0}g protein, \
             {c:.0}g carbs, and {f:.0}g fat for the whole day — distribute realistically \
             across meals (e.g. breakfast and dinner larger than the snacks)."
        ));
    }

    prompt.push_str(
        " Respond only in JSON with this shape: {\"meals\": [{\"slot\": \
         \"breakfast\"|\"mid_morning\"|\"lunch\"|\"evening_snack\"|\"dinner\", \"dish_name\": \
         string, \"description\": string, \"prep_time_minutes\": number, \"calories\": number, \
         \"protein_g\": number, \"carbs_g\": number, \"fat_g\": number, \"ingredients\": \
         [{\"name\": string, \"quantity\": string}], \"instructions\": [string]}]} with \
         exactly one entry per slot.",
    );

    prompt
}

fn parse_and_validate(raw: &str) -> Result<Vec<DietPlanMeal>, String> {
    let plan = serde_json::from_str::<GeneratedDietPlan>(raw).map_err(|e| e.to_string())?;
    if plan.meals.len() != 5 {
        return Err(format!("model returned {} meals, expected 5", plan.meals.len()));
    }
    let slots = [
        MealSlot::Breakfast,
        MealSlot::MidMorning,
        MealSlot::Lunch,
        MealSlot::EveningSnack,
        MealSlot::Dinner,
    ];
    for slot in slots {
        if !plan.meals.iter().any(|m| m.slot == slot) {
            return Err(format!("missing meal for slot {slot:?}"));
        }
    }
    Ok(plan.meals)
}

/// Same coarse, keyword-based post-generation safety net used for recipes
/// (PRD Dietary Guardrail Matrix), applied to a meal's dish name +
/// description since diet plan meals don't have a structured ingredient
/// list. Flags rather than silently discards.
fn flag_conflicts(meal: &DietPlanMeal, allergies: &[String], avoided: &[String]) -> Vec<String> {
    let keywords: &[(&str, &[&str])] = &[
        ("Gluten", &["wheat", "flour", "bread", "pasta", "barley", "rye", "noodle", "roti", "naan", "chapati"]),
        ("Lactose", &["milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "whey", "paneer", "ghee", "curd"]),
        ("Nuts", &["almond", "peanut", "walnut", "cashew", "pecan", "hazelnut", "pistachio", "macadamia"]),
        ("Shellfish", &["shrimp", "prawn", "crab", "lobster", "scallop", "oyster", "clam", "mussel"]),
    ];

    let ingredient_text = meal
        .ingredients
        .iter()
        .map(|i| i.name.to_lowercase())
        .collect::<Vec<_>>()
        .join(" ");
    let text = format!("{} {} {}", meal.dish_name, meal.description, ingredient_text).to_lowercase();

    let mut flags: Vec<String> = allergies
        .iter()
        .filter(|allergy| {
            keywords
                .iter()
                .find(|(name, _)| name.eq_ignore_ascii_case(allergy))
                .is_some_and(|(_, words)| words.iter().any(|w| text.contains(w)))
        })
        .cloned()
        .collect();

    for item in avoided {
        let needle = item.to_lowercase();
        if !needle.is_empty() && text.contains(&needle) {
            flags.push(item.clone());
        }
    }

    flags
}

#[derive(Debug, Serialize)]
pub struct DietMealCandidate {
    #[serde(flatten)]
    pub meal: DietPlanMeal,
    pub slot_label: String,
    pub possible_conflicts: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct GenerateDietPlanInput {
    /// Falls back to the saved profile cuisine preference if not given.
    pub cuisine: Option<String>,
    pub target_prep_minutes: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct DietPlanGenerationResult {
    pub meals: Vec<DietMealCandidate>,
    pub cuisine: Option<String>,
    pub target_calories: Option<i32>,
    pub target_protein_g: Option<f64>,
    pub target_carbs_g: Option<f64>,
    pub target_fat_g: Option<f64>,
}

#[tauri::command]
pub async fn generate_diet_plan(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
    input: GenerateDietPlanInput,
) -> Result<DietPlanGenerationResult, String> {
    let profile_id = active.get();

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

    let cuisine = match input.cuisine.filter(|c| !c.trim().is_empty()) {
        Some(c) => Some(c),
        None => sqlx::query_scalar("SELECT cuisine_preference FROM user_profile WHERE id = ?")
            .bind(profile_id)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?
            .flatten(),
    };

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
    let target_carbs: Option<f64> = sqlx::query_scalar(
        "SELECT target_carbs_g FROM goals WHERE is_active = 1 AND profile_id = ? ORDER BY id DESC LIMIT 1",
    )
    .bind(profile_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    let target_fat: Option<f64> = sqlx::query_scalar(
        "SELECT target_fat_g FROM goals WHERE is_active = 1 AND profile_id = ? ORDER BY id DESC LIMIT 1",
    )
    .bind(profile_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let prompt = build_prompt(
        cuisine.as_deref(),
        &diets,
        &allergies,
        &avoided,
        input.target_prep_minutes,
        target_calories,
        target_protein,
        target_carbs,
        target_fat,
    );

    let client = OllamaClient::new();
    let raw = client.generate_diet_plan(&prompt, None).await?;

    let meals = match parse_and_validate(&raw) {
        Ok(meals) => meals,
        Err(first_error) => {
            let retry_context = format!(
                "Your previous response was invalid: {first_error}. Respond ONLY with valid \
                 JSON matching the exact schema requested, with exactly one meal per slot."
            );
            let retry_raw = client.generate_diet_plan(&prompt, Some(retry_context)).await?;
            parse_and_validate(&retry_raw)
                .map_err(|e| format!("Couldn't generate a valid diet plan: {e}"))?
        }
    };

    let mut candidates: Vec<DietMealCandidate> = meals
        .into_iter()
        .map(|meal| {
            let possible_conflicts = flag_conflicts(&meal, &allergies, &avoided);
            let slot_label = slot_label(meal.slot).to_string();
            DietMealCandidate { meal, slot_label, possible_conflicts }
        })
        .collect();

    let slot_order = |s: MealSlot| match s {
        MealSlot::Breakfast => 0,
        MealSlot::MidMorning => 1,
        MealSlot::Lunch => 2,
        MealSlot::EveningSnack => 3,
        MealSlot::Dinner => 4,
    };
    candidates.sort_by_key(|c| slot_order(c.meal.slot));

    Ok(DietPlanGenerationResult {
        meals: candidates,
        cuisine,
        target_calories,
        target_protein_g: target_protein,
        target_carbs_g: target_carbs,
        target_fat_g: target_fat,
    })
}

#[derive(Debug, Deserialize)]
pub struct SaveDietPlanMealInput {
    pub slot: MealSlot,
    pub dish_name: String,
    pub description: String,
    pub prep_time_minutes: i32,
    pub calories: f64,
    pub protein_g: f64,
    pub carbs_g: f64,
    pub fat_g: f64,
    pub ingredients: Vec<RecipeIngredient>,
    pub instructions: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct SaveDietPlanInput {
    pub title: String,
    pub cuisine: Option<String>,
    pub target_calories: Option<i32>,
    pub target_protein_g: Option<f64>,
    pub target_carbs_g: Option<f64>,
    pub target_fat_g: Option<f64>,
    pub meals: Vec<SaveDietPlanMealInput>,
}

fn slot_to_str(slot: MealSlot) -> &'static str {
    match slot {
        MealSlot::Breakfast => "breakfast",
        MealSlot::MidMorning => "mid_morning",
        MealSlot::Lunch => "lunch",
        MealSlot::EveningSnack => "evening_snack",
        MealSlot::Dinner => "dinner",
    }
}

#[tauri::command]
pub async fn save_diet_plan(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
    input: SaveDietPlanInput,
) -> Result<i64, String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let plan_id: i64 = sqlx::query_scalar(
        "INSERT INTO diet_plans (profile_id, title, cuisine, target_calories, target_protein_g, target_carbs_g, target_fat_g)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(active.get())
    .bind(&input.title)
    .bind(&input.cuisine)
    .bind(input.target_calories)
    .bind(input.target_protein_g)
    .bind(input.target_carbs_g)
    .bind(input.target_fat_g)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    for (i, meal) in input.meals.iter().enumerate() {
        let ingredients_json = serde_json::to_string(&meal.ingredients).map_err(|e| e.to_string())?;
        let instructions_json = serde_json::to_string(&meal.instructions).map_err(|e| e.to_string())?;

        sqlx::query(
            "INSERT INTO diet_plan_meals
               (diet_plan_id, slot, dish_name, description, prep_time_minutes, calories, protein_g, carbs_g, fat_g, ingredients, instructions, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(plan_id)
        .bind(slot_to_str(meal.slot))
        .bind(&meal.dish_name)
        .bind(&meal.description)
        .bind(meal.prep_time_minutes)
        .bind(meal.calories)
        .bind(meal.protein_g)
        .bind(meal.carbs_g)
        .bind(meal.fat_g)
        .bind(&ingredients_json)
        .bind(&instructions_json)
        .bind(i as i32)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(plan_id)
}

#[tauri::command]
pub async fn get_saved_diet_plans(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
) -> Result<Vec<SavedDietPlan>, String> {
    let plans = sqlx::query_as::<_, DietPlanRow>(
        "SELECT id, title, cuisine, target_calories, target_protein_g, target_carbs_g, target_fat_g, created_at
         FROM diet_plans WHERE profile_id = ? ORDER BY created_at DESC",
    )
    .bind(active.get())
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let mut result = Vec::with_capacity(plans.len());
    for plan in plans {
        let meals = sqlx::query_as::<_, DietPlanMealRow>(
            "SELECT id, diet_plan_id, slot, dish_name, description, prep_time_minutes, calories, protein_g, carbs_g, fat_g, ingredients, instructions, sort_order
             FROM diet_plan_meals WHERE diet_plan_id = ? ORDER BY sort_order ASC",
        )
        .bind(plan.id)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
        result.push(SavedDietPlan { plan, meals });
    }

    Ok(result)
}

#[tauri::command]
pub async fn delete_diet_plan(
    pool: State<'_, SqlitePool>,
    active: State<'_, ActiveProfile>,
    id: i64,
) -> Result<(), String> {
    sqlx::query("DELETE FROM diet_plans WHERE id = ? AND profile_id = ?")
        .bind(id)
        .bind(active.get())
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// The PDF itself is rendered entirely client-side (jsPDF, no network call);
/// this just decodes and writes the bytes to a path the user already chose
/// via the native save dialog — same "Rust does the disk I/O" split as CSV/
/// JSON export.
#[tauri::command]
pub async fn export_diet_plan_pdf(dest_path: String, base64_data: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| format!("invalid PDF data: {e}"))?;
    std::fs::write(&dest_path, bytes).map_err(|e| format!("couldn't write file: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn meal(slot: MealSlot, dish_name: &str, description: &str) -> DietPlanMeal {
        DietPlanMeal {
            slot,
            dish_name: dish_name.to_string(),
            description: description.to_string(),
            prep_time_minutes: 20,
            calories: 400.0,
            protein_g: 20.0,
            carbs_g: 40.0,
            fat_g: 10.0,
            ingredients: vec![RecipeIngredient { name: "test ingredient".to_string(), quantity: "1 cup".to_string() }],
            instructions: vec!["Cook it.".to_string()],
        }
    }

    /// Distinct from `meal()` above: puts the target keyword in the
    /// ingredients list rather than the dish name/description, matching how
    /// flag_conflicts now searches ingredients too.
    fn meal_with_ingredient(slot: MealSlot, dish_name: &str, ingredient: &str) -> DietPlanMeal {
        DietPlanMeal {
            slot,
            dish_name: dish_name.to_string(),
            description: "A tasty dish.".to_string(),
            prep_time_minutes: 20,
            calories: 400.0,
            protein_g: 20.0,
            carbs_g: 40.0,
            fat_g: 10.0,
            ingredients: vec![RecipeIngredient { name: ingredient.to_string(), quantity: "1 cup".to_string() }],
            instructions: vec!["Cook it.".to_string()],
        }
    }

    #[test]
    fn flags_matching_allergen() {
        let m = meal(MealSlot::Breakfast, "Paneer Paratha", "Stuffed flatbread with paneer");
        let flags = flag_conflicts(&m, &["Lactose".to_string()], &[]);
        assert_eq!(flags, vec!["Lactose".to_string()]);
    }

    #[test]
    fn flags_avoided_ingredient() {
        let m = meal(MealSlot::Lunch, "Drumstick Sambar", "South Indian lentil stew with drumstick");
        let flags = flag_conflicts(&m, &[], &["drumstick".to_string()]);
        assert_eq!(flags, vec!["drumstick".to_string()]);
    }

    #[test]
    fn no_false_flag_when_clean() {
        let m = meal(MealSlot::Dinner, "Grilled Chicken", "With steamed vegetables");
        let flags = flag_conflicts(&m, &["Gluten".to_string(), "Nuts".to_string()], &["drumstick".to_string()]);
        assert!(flags.is_empty());
    }

    #[test]
    fn malformed_diet_plan_json_never_panics() {
        let malformed_inputs = [
            "",
            "not json",
            "{}",
            r#"{"meals": []}"#,
            r#"{"meals": [{"slot": "breakfast"}]}"#,
            r#"{"meals": [{"slot": "bogus_slot", "dish_name": 5}]}"#,
        ];
        for input in malformed_inputs {
            let _ = parse_and_validate(input);
        }
    }

    #[test]
    fn rejects_missing_slot() {
        let raw = r#"{"meals": [
            {"slot": "breakfast", "dish_name": "Idli", "description": "Steamed rice cakes", "calories": 200, "protein_g": 6, "carbs_g": 40, "fat_g": 1},
            {"slot": "lunch", "dish_name": "Sambar Rice", "description": "Rice with lentil stew", "calories": 500, "protein_g": 15, "carbs_g": 80, "fat_g": 10}
        ]}"#;
        let result = parse_and_validate(raw);
        assert!(result.is_err());
    }

    #[test]
    fn valid_diet_plan_json_parses() {
        let raw = r#"{"meals": [
            {"slot": "breakfast", "dish_name": "Idli Sambar", "description": "Steamed rice cakes with lentil stew", "prep_time_minutes": 20, "calories": 300, "protein_g": 10, "carbs_g": 50, "fat_g": 5, "ingredients": [{"name": "idli batter", "quantity": "2 cups"}], "instructions": ["Steam the batter.", "Serve with sambar."]},
            {"slot": "mid_morning", "dish_name": "Fruit Bowl", "description": "Seasonal fruits", "prep_time_minutes": 5, "calories": 150, "protein_g": 2, "carbs_g": 35, "fat_g": 1, "ingredients": [{"name": "mixed fruit", "quantity": "1 bowl"}], "instructions": ["Chop and serve."]},
            {"slot": "lunch", "dish_name": "Sambar Rice with Poriyal", "description": "Rice, lentil stew, and stir-fried vegetables", "prep_time_minutes": 35, "calories": 600, "protein_g": 18, "carbs_g": 90, "fat_g": 15, "ingredients": [{"name": "rice", "quantity": "1 cup"}], "instructions": ["Cook rice.", "Prepare sambar.", "Combine and serve."]},
            {"slot": "evening_snack", "dish_name": "Roasted Chana", "description": "Roasted chickpeas", "prep_time_minutes": 10, "calories": 180, "protein_g": 9, "carbs_g": 25, "fat_g": 5, "ingredients": [{"name": "chickpeas", "quantity": "1 cup"}], "instructions": ["Roast with spices."]},
            {"slot": "dinner", "dish_name": "Vegetable Uthappam", "description": "Savory rice pancake with vegetables", "prep_time_minutes": 25, "calories": 400, "protein_g": 12, "carbs_g": 60, "fat_g": 10, "ingredients": [{"name": "rice batter", "quantity": "2 cups"}], "instructions": ["Pour batter on griddle.", "Top with vegetables.", "Cook until golden."]}
        ]}"#;
        let result = parse_and_validate(raw);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 5);
    }

    #[test]
    fn flags_conflict_in_ingredient_list_not_just_dish_name() {
        let m = meal_with_ingredient(MealSlot::Dinner, "Mystery Bowl", "roasted cashews");
        let flags = flag_conflicts(&m, &["Nuts".to_string()], &[]);
        assert_eq!(flags, vec!["Nuts".to_string()]);
    }
}
