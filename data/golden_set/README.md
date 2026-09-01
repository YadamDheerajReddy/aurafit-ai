# Golden Set — Vision AI Accuracy Harness

This measures the vision logger's real-world accuracy against photos with
known, correct calorie counts (SDLC doc, Quality Assurance Strategy). The
Implementation Plan's Phase 3 exit criterion is **mean absolute error ≤15%**
on calories, re-checked whenever the prompt or model changes.

## Adding a labeled photo

1. Drop the photo into `photos/`, e.g. `photos/chicken_rice_bowl.jpg`.
2. Add a label file in `labels/` with the same base name, e.g.
   `labels/chicken_rice_bowl.json`:

   ```json
   {
     "photo": "chicken_rice_bowl.jpg",
     "true_total_calories": 650,
     "notes": "Grilled chicken breast, white rice, steamed broccoli — weighed on a kitchen scale"
   }
   ```

   `true_total_calories` should come from something you trust — a kitchen
   scale + nutrition label, a known recipe, or a restaurant's published
   values. Vague guesses defeat the point of a "ground truth" set.

3. Aim for variety: different plate compositions, lighting, angles, and
   portion sizes. 40 photos is the target size for a statistically
   meaningful benchmark, but the harness works fine with fewer while you're
   building up the set.

## Running it

Requires Ollama running locally with `llama3.2-vision:11b` pulled (Settings →
AI Models in the app will tell you if it's ready).

```bash
cd src-tauri
cargo run --bin golden_set
```

Prints a per-photo result, writes `report.csv` in this folder, and exits
non-zero if the mean absolute error exceeds 15% — safe to wire into CI once
Ollama can run there, or just run locally after prompt changes.
