//! Golden-set accuracy harness (SDLC doc, 05 — Quality Assurance Strategy;
//! Implementation Plan, Phase 3 exit criterion: "Golden-set mean absolute
//! calorie error <= 15%").
//!
//! Run with: `cargo run --bin golden_set` (from src-tauri/), with Ollama
//! running and llama3.2-vision:11b pulled. See data/golden_set/README.md for
//! how to add labeled photos.

use aurafit_lib::ollama::client::OllamaClient;
use aurafit_lib::ollama::image::prepare_image;
use aurafit_lib::ollama::schemas::MealAnalysis;
use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use serde::Deserialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
struct GoldenLabel {
    photo: String,
    true_total_calories: f32,
    #[serde(default)]
    #[allow(dead_code)]
    notes: String,
}

#[derive(Debug)]
struct ScoreRow {
    photo: String,
    true_calories: f32,
    predicted_calories: f32,
    pct_error: f32,
}

fn pct_error(truth: f32, predicted: f32) -> f32 {
    if truth == 0.0 {
        return 0.0;
    }
    ((predicted - truth).abs() / truth) * 100.0
}

fn mean_abs_pct_error(rows: &[ScoreRow]) -> f32 {
    if rows.is_empty() {
        return 0.0;
    }
    rows.iter().map(|r| r.pct_error).sum::<f32>() / rows.len() as f32
}

#[tokio::main]
async fn main() {
    let base = Path::new("data/golden_set");
    let labels_dir = base.join("labels");
    let photos_dir = base.join("photos");

    let Ok(entries) = std::fs::read_dir(&labels_dir) else {
        eprintln!(
            "No golden-set labels found at {}. See data/golden_set/README.md.",
            labels_dir.display()
        );
        std::process::exit(1);
    };

    let mut label_files: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("json"))
        .collect();
    label_files.sort();

    if label_files.is_empty() {
        eprintln!(
            "No labeled photos yet in {}. See data/golden_set/README.md to add some.",
            labels_dir.display()
        );
        std::process::exit(1);
    }

    let client = OllamaClient::new();
    let mut rows = Vec::new();

    for label_path in &label_files {
        let label_str = match std::fs::read_to_string(label_path) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("skip {}: {e}", label_path.display());
                continue;
            }
        };
        let label: GoldenLabel = match serde_json::from_str(&label_str) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("skip {}: invalid label JSON: {e}", label_path.display());
                continue;
            }
        };

        let photo_path = photos_dir.join(&label.photo);
        let image_bytes = match std::fs::read(&photo_path) {
            Ok(b) => b,
            Err(e) => {
                eprintln!(
                    "skip {}: couldn't read photo {}: {e}",
                    label.photo,
                    photo_path.display()
                );
                continue;
            }
        };

        let data_url = format!("data:image/jpeg;base64,{}", STANDARD.encode(&image_bytes));
        let prepared = match prepare_image(&data_url) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("skip {}: {e}", label.photo);
                continue;
            }
        };

        let raw = match client.analyze_meal_photo(&prepared, None).await {
            Ok(r) => r,
            Err(e) => {
                eprintln!("skip {}: Ollama request failed: {e}", label.photo);
                continue;
            }
        };

        let predicted_calories = match serde_json::from_str::<MealAnalysis>(&raw) {
            Ok(a) => a.total_calories,
            Err(e) => {
                eprintln!("skip {}: invalid model output: {e}", label.photo);
                continue;
            }
        };

        let error = pct_error(label.true_total_calories, predicted_calories);
        println!(
            "{}: truth={:.0} predicted={:.0} error={:.1}%",
            label.photo, label.true_total_calories, predicted_calories, error
        );

        rows.push(ScoreRow {
            photo: label.photo.clone(),
            true_calories: label.true_total_calories,
            predicted_calories,
            pct_error: error,
        });
    }

    if rows.is_empty() {
        eprintln!("No photos were successfully scored.");
        std::process::exit(1);
    }

    let mae = mean_abs_pct_error(&rows);

    let report_path = base.join("report.csv");
    let mut writer = csv::Writer::from_path(&report_path).expect("open report.csv for writing");
    writer
        .write_record(["photo", "true_calories", "predicted_calories", "pct_error"])
        .unwrap();
    for row in &rows {
        writer
            .write_record([
                row.photo.clone(),
                row.true_calories.to_string(),
                row.predicted_calories.to_string(),
                format!("{:.1}", row.pct_error),
            ])
            .unwrap();
    }
    writer.flush().unwrap();

    println!(
        "\nScored {} photo(s). Mean absolute % error: {:.1}% (target: <=15%)",
        rows.len(),
        mae
    );
    println!("Report written to {}", report_path.display());

    if mae > 15.0 {
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pct_error_computes_correctly() {
        assert!((pct_error(500.0, 575.0) - 15.0).abs() < 0.01);
        assert!(pct_error(500.0, 500.0).abs() < 0.01);
        assert!((pct_error(500.0, 425.0) - 15.0).abs() < 0.01);
    }

    #[test]
    fn mean_abs_pct_error_averages_correctly() {
        let rows = vec![
            ScoreRow {
                photo: "a".into(),
                true_calories: 500.0,
                predicted_calories: 550.0,
                pct_error: pct_error(500.0, 550.0),
            },
            ScoreRow {
                photo: "b".into(),
                true_calories: 400.0,
                predicted_calories: 360.0,
                pct_error: pct_error(400.0, 360.0),
            },
        ];
        assert!((mean_abs_pct_error(&rows) - 10.0).abs() < 0.01);
    }

    #[test]
    fn empty_set_has_zero_error() {
        assert_eq!(mean_abs_pct_error(&[]), 0.0);
    }
}
