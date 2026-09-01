# AuraFit AI — User Guide

AuraFit AI is a calorie and body-transformation tracker that runs entirely on
your computer. There's no account, no cloud sync, and no subscription —
every piece of data you enter, and every AI response you get, stays on this
machine.

## 1. Before you install

AuraFit AI's AI features (meal description parsing and recipe generation)
run on a local model server called [Ollama](https://ollama.com). You don't
need it to track calories manually, but you'll want it for the fast logging
and recipe features.

1. Download and install Ollama from [ollama.com/download](https://ollama.com/download).
2. Open a terminal and pull the model AuraFit AI uses:

   ```bash
   ollama pull qwen2.5:3b-instruct
   ```

   This is roughly a 2GB download and only happens once. AuraFit AI checks
   for this model automatically and will tell you if it's missing (Settings
   → Model Management).

Ollama needs to be **running** (it starts automatically after install on
most systems) whenever you want to use "Describe" meal logging or the
Recipes tab. Everything else in the app — manual logging, weight tracking,
charts, export — works with Ollama off.

## 2. Installing AuraFit AI

Grab the installer for your platform from the project's GitHub Releases
page and run it like any other desktop app:

- **Windows** — `.msi` installer
- **macOS** — `.dmg` (Apple Silicon and Intel builds)
- **Linux** — `.AppImage` or `.deb`

No account or sign-in is required. The app creates a single local SQLite
database file on first launch and never talks to any server other than
`localhost:11434` (your own Ollama instance).

## 3. First run

The onboarding wizard walks you through four short steps:

1. **About you** — sex, age, height, weight, and activity level. This is
   used only to calculate your calorie and macro targets and is never sent
   anywhere.
2. **Goal** — Aggressive Fat Loss, Lean Bulk, Recomposition, or Maintenance.
   Your daily calorie and macro targets update live as you pick.
3. **Dietary guardrails** — optional diet patterns (Vegan, Vegetarian, Keto,
   Halal, etc.) and allergy exclusions (Gluten, Lactose, Nuts, Shellfish).
   These are applied everywhere the app suggests food, including the recipe
   generator. They reduce the chance of a conflicting suggestion but aren't
   a substitute for reading ingredient labels yourself.
4. **Ready** — review your targets and optionally set a target weight, then
   start tracking.

Everything from this wizard can be changed later from **Settings → Profile
& Goals → Edit**.

## 4. Day to day

- **Dashboard** — today's calories and macros against your targets, a
  weight-entry box, your weight trend, and today's logged meals.
- **Log Meal** — two ways to log:
  - **Describe** — type what you ate in plain English ("two eggs and
    toast with butter") and the local AI estimates the macros. You can
    edit every number before saving.
  - **Quick Lookup** — search the built-in USDA nutrition database for
    exact values.
- **Recipes** — list what's in your pantry, and the app generates
  guardrail-safe recipes that fit your remaining calories for the day.
  Save favorites to a personal library, or open a recipe in **Cook Mode**
  for a full-screen, step-by-step view with a timer and one-tap logging.
- **Progress** — weight trend (with a projected goal-completion date once
  you've logged a few consistent weigh-ins and set a target weight),
  macro compliance over time, and your logging streak.
- **Settings** — edit your profile/goal/guardrails, manage the Ollama
  model, export all your data as CSV/JSON, and see the "Local & Private"
  status.

## 5. Your data

Everything lives in a single SQLite file on your machine. Use **Settings →
Export All Data** at any time to save everything you've logged as CSV and
JSON — no throttling, no paywall, no waiting period. This is your data
regardless of whether you keep using the app.

## 6. Troubleshooting

**"Ollama isn't running" / AI features greyed out**
Make sure the Ollama app or service is running, then reopen Settings to
re-check status. On Windows/macOS, Ollama typically runs in the background
after install — look for it in your system tray/menu bar.

**AI logging or recipe generation is slow or times out**
Local inference speed depends entirely on your hardware. If it consistently
times out, try closing other memory-heavy applications, or check
`%LOCALAPPDATA%\Ollama\server.log` (Windows) for errors. You can always fall
back to Quick Lookup for instant, exact logging.

**I want to start over**
There's currently no in-app "reset" — close the app and delete its local
database file to start fresh. Export your data first if you want to keep
it.

## 7. Attribution

Nutrition data is provided by the U.S. Department of Agriculture, FoodData
Central (fdc.nal.usda.gov). AuraFit AI is not affiliated with or endorsed
by the USDA.
