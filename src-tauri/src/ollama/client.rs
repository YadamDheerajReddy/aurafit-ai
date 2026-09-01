use serde_json::{json, Value};
use std::time::Duration;

/// The only network socket AuraFit AI ever opens (TRD, 01 — Trust Boundary).
const OLLAMA_BASE_URL: &str = "http://localhost:11434";

/// A health check should never hang the UI (App Flow doc, 07 — the "Ollama
/// isn't running" banner needs to appear promptly, not after a long stall).
const STATUS_TIMEOUT: Duration = Duration::from_secs(5);

/// CPU-only / RAM-constrained inference can legitimately take minutes, not
/// seconds — this bounds it so a genuinely stuck request still surfaces a
/// clear error instead of an indefinite spinner.
const CHAT_TIMEOUT: Duration = Duration::from_secs(180);

/// The user types what they ate; this model estimates the macros.
pub const TEXT_MODEL: &str = "qwen2.5:3b-instruct";

pub struct OllamaStatus {
    pub running: bool,
    pub models_installed: Vec<String>,
}

pub struct OllamaClient {
    http: reqwest::Client,
}

impl OllamaClient {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::new(),
        }
    }

    /// GET /api/tags — used for the first-run system check and the
    /// "Ollama daemon offline mid-session" banner (App Flow doc, 07).
    pub async fn check_status(&self) -> OllamaStatus {
        let Ok(resp) = self
            .http
            .get(format!("{OLLAMA_BASE_URL}/api/tags"))
            .timeout(STATUS_TIMEOUT)
            .send()
            .await
        else {
            return OllamaStatus {
                running: false,
                models_installed: vec![],
            };
        };

        if !resp.status().is_success() {
            return OllamaStatus {
                running: false,
                models_installed: vec![],
            };
        }

        let body: Value = resp.json().await.unwrap_or_default();
        let models = body["models"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| m["name"].as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        OllamaStatus {
            running: true,
            models_installed: models,
        }
    }

    /// POST /api/chat with a typed meal description and a structured-output
    /// prompt. `retry_context`, when set, appends the prior validation error
    /// so the model can self-correct.
    pub async fn estimate_meal_from_text(
        &self,
        description: &str,
        retry_context: Option<String>,
    ) -> Result<String, String> {
        let prompt = with_retry_context(
            &format!(
                "The user describes a meal they ate: \"{description}\". Identify each distinct \
                 food item mentioned, and for each one estimate its typical weight in grams and \
                 its calories, protein, carbs, and fat using standard nutrition data for that \
                 food. If a quantity isn't given, assume one typical serving. Respond only in \
                 the given JSON schema."
            ),
            retry_context.as_deref(),
        );

        let body = json!({
            "model": TEXT_MODEL,
            "messages": [{
                "role": "user",
                "content": prompt,
            }],
            "format": "json",
            "stream": false,
        });

        self.chat(body).await
    }

    /// POST /api/chat for pantry recipe generation. The full prompt (pantry
    /// items, guardrails, remaining macro budget) is built by the caller,
    /// which owns the DB access this needs — the client stays transport-only.
    pub async fn generate_recipes(
        &self,
        prompt: &str,
        retry_context: Option<String>,
    ) -> Result<String, String> {
        let full_prompt = with_retry_context(prompt, retry_context.as_deref());

        let body = json!({
            "model": TEXT_MODEL,
            "messages": [{
                "role": "user",
                "content": full_prompt,
            }],
            "format": "json",
            "stream": false,
        });

        self.chat(body).await
    }

    /// POST /api/chat for a full-day diet plan. Same shape as recipe
    /// generation — the caller builds the prompt (calorie/macro targets,
    /// cuisine, guardrails, avoid-list), the client stays transport-only.
    pub async fn generate_diet_plan(
        &self,
        prompt: &str,
        retry_context: Option<String>,
    ) -> Result<String, String> {
        let full_prompt = with_retry_context(prompt, retry_context.as_deref());

        let body = json!({
            "model": TEXT_MODEL,
            "messages": [{
                "role": "user",
                "content": full_prompt,
            }],
            "format": "json",
            "stream": false,
        });

        self.chat(body).await
    }

    async fn chat(&self, body: Value) -> Result<String, String> {
        let resp = self
            .http
            .post(format!("{OLLAMA_BASE_URL}/api/chat"))
            .json(&body)
            .timeout(CHAT_TIMEOUT)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    format!(
                        "Ollama didn't respond within {}s. This usually means the model is \
                         running but your system is low on free RAM (swapping to disk is slow) \
                         — try closing other apps and retrying.",
                        CHAT_TIMEOUT.as_secs()
                    )
                } else {
                    format!("Ollama request failed: {e}")
                }
            })?;

        if !resp.status().is_success() {
            return Err(format!("Ollama returned HTTP {}", resp.status()));
        }

        let resp_json: Value = resp
            .json()
            .await
            .map_err(|e| format!("invalid Ollama response: {e}"))?;

        resp_json["message"]["content"]
            .as_str()
            .map(String::from)
            .ok_or_else(|| "missing message.content in Ollama response".to_string())
    }
}

fn with_retry_context(base_prompt: &str, retry_context: Option<&str>) -> String {
    match retry_context {
        Some(ctx) => format!("{base_prompt} {ctx}"),
        None => base_prompt.to_string(),
    }
}
