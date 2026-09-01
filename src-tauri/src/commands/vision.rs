use serde::Serialize;

use crate::ollama::client::OllamaClient;
use crate::ollama::image::prepare_image;
use crate::ollama::schemas::MealAnalysis;

#[derive(Debug, Serialize)]
pub struct OllamaStatusResult {
    pub running: bool,
    pub models_installed: Vec<String>,
    pub vision_model_ready: bool,
}

#[tauri::command]
pub async fn check_ollama_status() -> OllamaStatusResult {
    let status = OllamaClient::new().check_status().await;
    let vision_model_ready = status
        .models_installed
        .iter()
        .any(|m| m.starts_with("llama3.2-vision"));

    OllamaStatusResult {
        running: status.running,
        models_installed: status.models_installed,
        vision_model_ready,
    }
}

#[derive(Debug, Serialize)]
pub struct MealAnalysisResult {
    pub analysis: Option<MealAnalysis>,
    /// Set once the model has failed schema validation twice — the frontend
    /// falls back to the manual/Quick-Lookup entry form (PRD VIS-04).
    pub needs_manual_entry: bool,
    pub error: Option<String>,
}

fn parse_and_validate(raw: &str) -> Result<MealAnalysis, String> {
    serde_json::from_str::<MealAnalysis>(raw).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Implementation Plan Phase 3 exit criterion: "zero unhandled
    /// schema-validation crashes across 200 test runs." Ollama is a local
    /// LLM — its JSON-mode output can still be truncated, malformed, or
    /// structurally wrong, and this must never panic, only return Err.
    #[test]
    fn malformed_model_output_never_panics() {
        let malformed_inputs = [
            "",
            "not json at all",
            "{",
            "{}",
            "null",
            "[]",
            "42",
            "\"just a string\"",
            r#"{"items": [], "total_calories": 0}"#, // structurally valid but semantically empty
            r#"{"items": null, "total_calories": 1}"#,
            r#"{"total_calories": 500}"#,           // missing items
            r#"{"items": [{"name": "chicken"}], "total_calories": 500}"#, // missing item fields
            r#"{"items": [{"name": "chicken", "estimated_grams": -5, "calories": 100, "protein_g": 1, "carbs_g": 1, "fat_g": 1, "confidence": "low"}], "total_calories": 100}"#, // negative grams — serde alone doesn't range-check; the frontend Zod schema's .positive() is the second gate
            r#"{"items": [{"name": "chicken", "estimated_grams": 100, "calories": 100, "protein_g": 1, "carbs_g": 1, "fat_g": 1, "confidence": "extreme"}], "total_calories": 100}"#, // bad enum value
            r#"{"items": [{"name": 5, "estimated_grams": "a lot", "calories": 100, "protein_g": 1, "carbs_g": 1, "fat_g": 1, "confidence": "low"}], "total_calories": 100}"#, // wrong types
            "{\"items\": [{\"name\": \"chicken\", \"estimated_grams\": 100, \"calories\": 100, \"protein_g\": 1, \"carbs_g\": 1, \"fat_g\": 1, \"confidence\": \"low\"}], \"total_calories\": 100", // truncated (missing closing brace)
            "\u{0}\u{1}\u{2} binary garbage \u{fffd}",
            &"x".repeat(100_000), // absurdly long non-JSON string
        ];

        for input in malformed_inputs {
            // The only assertion that matters: this must not panic.
            let _ = parse_and_validate(input);
        }
    }

    #[test]
    fn valid_model_output_parses() {
        let valid = r#"{
            "items": [{
                "name": "grilled chicken breast",
                "estimated_grams": 150.0,
                "calories": 250.0,
                "protein_g": 46.0,
                "carbs_g": 0.0,
                "fat_g": 6.0,
                "confidence": "high"
            }],
            "total_calories": 250.0
        }"#;
        let result = parse_and_validate(valid);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().items.len(), 1);
    }
}

/// Runs the full vision pipeline (TRD 4.1: Encode -> Infer -> Validate),
/// with one automatic re-prompt carrying the validation error as context
/// before giving up and asking the frontend to fall back to manual entry.
#[tauri::command]
pub async fn analyze_meal_photo(image_data_url: String) -> Result<MealAnalysisResult, String> {
    let image_base64 = prepare_image(&image_data_url)?;
    let client = OllamaClient::new();

    let raw = client.analyze_meal_photo(&image_base64, None).await?;
    match parse_and_validate(&raw) {
        Ok(analysis) => {
            return Ok(MealAnalysisResult {
                analysis: Some(analysis),
                needs_manual_entry: false,
                error: None,
            })
        }
        Err(first_error) => {
            let retry_context = format!(
                "Your previous response was invalid JSON for the expected schema: {first_error}. \
                 Respond ONLY with a JSON object matching: {{\"items\": [{{\"name\": string, \
                 \"estimated_grams\": number, \"calories\": number, \"protein_g\": number, \
                 \"carbs_g\": number, \"fat_g\": number, \"confidence\": \"low\"|\"medium\"|\"high\"}}], \
                 \"total_calories\": number}}."
            );

            let retry_raw = client
                .analyze_meal_photo(&image_base64, Some(&retry_context))
                .await?;

            match parse_and_validate(&retry_raw) {
                Ok(analysis) => Ok(MealAnalysisResult {
                    analysis: Some(analysis),
                    needs_manual_entry: false,
                    error: None,
                }),
                Err(second_error) => Ok(MealAnalysisResult {
                    analysis: None,
                    needs_manual_entry: true,
                    error: Some(second_error),
                }),
            }
        }
    }
}
