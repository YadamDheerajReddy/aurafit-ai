use serde_json::json;

/// The only network socket AuraFit AI ever opens (TRD, 01 — Trust Boundary).
const OLLAMA_BASE_URL: &str = "http://localhost:11434";
// TRD 4.1 names llama3.2-vision:11b, but that needs ~8GB+ VRAM/RAM headroom
// this dev machine doesn't have. qwen2.5vl:7b (~6GB) is a deliberate
// lighter-hardware substitution — same request/response contract, same
// JSON-mode structured output, just a smaller backing model.
pub const VISION_MODEL: &str = "qwen2.5vl:7b";

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

        let body: serde_json::Value = resp.json().await.unwrap_or_default();
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

    /// POST /api/chat with a base64 JPEG and a structured-output prompt
    /// (TRD, 4.1 — Request Contract). `retry_context`, when set, appends the
    /// prior validation error so the model can self-correct.
    pub async fn analyze_meal_photo(
        &self,
        image_base64: &str,
        retry_context: Option<&str>,
    ) -> Result<String, String> {
        let mut prompt = "Identify each food item on this plate. For each item, estimate its \
             weight in grams and its calories, protein, carbs, and fat. Respond only in the \
             given JSON schema."
            .to_string();
        if let Some(ctx) = retry_context {
            prompt.push(' ');
            prompt.push_str(ctx);
        }

        let body = json!({
            "model": VISION_MODEL,
            "messages": [{
                "role": "user",
                "content": prompt,
                "images": [image_base64],
            }],
            "format": "json",
            "stream": false,
        });

        let resp = self
            .http
            .post(format!("{OLLAMA_BASE_URL}/api/chat"))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!("Ollama returned HTTP {}", resp.status()));
        }

        let resp_json: serde_json::Value =
            resp.json().await.map_err(|e| format!("invalid Ollama response: {e}"))?;

        resp_json["message"]["content"]
            .as_str()
            .map(String::from)
            .ok_or_else(|| "missing message.content in Ollama response".to_string())
    }
}
