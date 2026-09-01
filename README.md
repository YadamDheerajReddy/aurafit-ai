# AuraFit AI

A privacy-first, fully local calorie and body-transformation tracker.
Every gram of data and every AI inference stays on your machine — no
account, no cloud sync, no subscription, zero network calls beyond your
own local [Ollama](https://ollama.com) instance.

Built with Tauri v2 (Rust + SQLite) and React/TypeScript.

- **Using the app?** See the [User Guide](docs/USER_GUIDE.md) for
  installation, setup, and a walkthrough of every screen.
- **Product docs** (vision, requirements, design system, schema,
  implementation plan) live in [`docs/`](docs).

## Development

```bash
npm install
npm run tauri dev
```

Requires the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)
for your platform (Rust toolchain, plus platform-specific WebView deps).

```bash
npm run build          # type-check + build the frontend
cd src-tauri
cargo check --all-targets
cargo test
```

CI runs the same checks on Windows, macOS, and Linux for every push.

## License

Nutrition data is provided by the U.S. Department of Agriculture, FoodData
Central (fdc.nal.usda.gov). AuraFit AI is not affiliated with or endorsed
by the USDA.
