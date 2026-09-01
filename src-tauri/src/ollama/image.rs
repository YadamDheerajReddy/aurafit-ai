use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use image::imageops::FilterType;
use image::ImageFormat;
use std::io::Cursor;

/// Bounds inference latency (TRD, 4.1 — Encode).
const MAX_EDGE: u32 = 1024;

/// Accepts a data URL (`data:image/...;base64,...`) or raw base64, downscales
/// to a max 1024px edge, and re-encodes as base64 JPEG for the Ollama
/// request payload.
pub fn prepare_image(input: &str) -> Result<String, String> {
    let raw_base64 = input.rsplit(',').next().ok_or("empty image data")?;

    let bytes = STANDARD
        .decode(raw_base64)
        .map_err(|e| format!("invalid base64 image: {e}"))?;
    let img = image::load_from_memory(&bytes)
        .map_err(|e| format!("unrecognized image format: {e}"))?;

    let resized = if img.width().max(img.height()) > MAX_EDGE {
        img.resize(MAX_EDGE, MAX_EDGE, FilterType::Lanczos3)
    } else {
        img
    };

    let mut buf = Cursor::new(Vec::new());
    resized
        .to_rgb8()
        .write_to(&mut buf, ImageFormat::Jpeg)
        .map_err(|e| format!("failed to encode image: {e}"))?;

    Ok(STANDARD.encode(buf.into_inner()))
}
