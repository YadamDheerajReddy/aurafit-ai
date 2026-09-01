# AuraFit AI

A privacy-first, fully local calorie and body-transformation tracker. No cloud, no
accounts, no subscriptions — every gram of data and every AI inference stays on
your machine. See `docs/` for the full product, technical, and design specs this
build follows.

**Status:** Phase 0 — Foundation & Tooling (see `docs/07_Implementation_Plan.pdf`).

## Stack

- **Shell:** [Tauri v2](https://tauri.app/) (Rust core + native OS webview)
- **UI:** React 18 + TypeScript, Tailwind CSS, shadcn/ui, Recharts
- **Database:** Embedded SQLite (`tauri-plugin-sql`), pre-seeded with USDA food data
- **Local AI:** [Ollama](https://ollama.com/) (added in Phase 3+) — never required for the app to install/build

## Running it locally

You'll need [Node.js](https://nodejs.org/) 20+ and the [Rust toolchain](https://www.rust-lang.org/tools/install)
installed. On Windows you'll also need the "Desktop development with C++" workload
from [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).

```bash
npm install
npm run tauri dev
```

This launches the app in a native window with hot-reload. First launch runs the
database migrations automatically (schema + the seeded food reference set).

## Useful scripts

| Command | What it does |
| --- | --- |
| `npm run tauri dev` | Run the app locally with hot reload |
| `npm run build` | Type-check and build the frontend bundle |
| `npm run tauri build` | Produce a signed-ready installer for your OS |
| `npm run ingest:usda` | Regenerate the seeded food database from `data/usda_seed.csv` |

## Project layout

```
src/                  React frontend
  components/ui/      shadcn/ui components, themed to the AuraFit palette
  lib/db.ts           SQLite access (search, etc.)
  index.css           Design tokens (colors, fonts) from the UI/UX Brief
src-tauri/             Rust backend (the Tauri "core")
  src/db/              Migrations + schema (the single source of truth for the DB)
  src/db/sql/          Raw SQL migration files, applied in order on launch
data/usda_seed.csv     Starter nutrition dataset (~130 common foods)
scripts/ingest-usda.mjs  Converts a nutrition CSV into a seed migration
docs/                  The 7 planning documents this build follows
```

## Notes on the current seed data

`data/usda_seed.csv` is a curated starter set of ~130 well-known foods so the app
is searchable and demoable today. The Technical Requirements doc calls for the
full USDA FoodData Central dataset (~400k rows) — that's a large download from a
government server, so it's a deliberate follow-up rather than something bundled
automatically. To swap it in: download a CSV export from
[fdc.nal.usda.gov/download-datasets](https://fdc.nal.usda.gov/download-datasets),
map its columns to match `data/usda_seed.csv`'s header, then run
`npm run ingest:usda -- path/to/full-export.csv`.
