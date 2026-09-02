import { useEffect, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Loader2,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CUISINES } from "@/features/onboarding/constants";
import { dietPlanPdfBase64 } from "@/lib/dietPlanPdf";
import {
  deleteDietPlan,
  exportDietPlanPdf,
  generateDietPlan,
  getSavedDietPlans,
  saveDietPlan,
  saveFoodLog,
  type DietMealCandidate,
  type DietPlanGenerationResult,
  type DietPlanMeal,
  type SavedDietPlan,
  type SavedDietPlanMeal,
  type UserState,
} from "@/lib/api";

function savedMealToPlain(meal: SavedDietPlanMeal): DietPlanMeal {
  let ingredients: DietPlanMeal["ingredients"] = [];
  let instructions: string[] = [];
  try {
    ingredients = meal.ingredients ? JSON.parse(meal.ingredients) : [];
  } catch {
    ingredients = [];
  }
  try {
    instructions = meal.instructions ? JSON.parse(meal.instructions) : [];
  } catch {
    instructions = [];
  }
  return {
    slot: meal.slot,
    dish_name: meal.dish_name,
    description: meal.description ?? "",
    prep_time_minutes: meal.prep_time_minutes ?? 0,
    calories: meal.calories ?? 0,
    protein_g: meal.protein_g ?? 0,
    carbs_g: meal.carbs_g ?? 0,
    fat_g: meal.fat_g ?? 0,
    ingredients,
    instructions,
  };
}

export function DietPlanPage({ userState }: { userState: UserState }) {
  const [cuisine, setCuisine] = useState(userState.profile?.cuisine_preference ?? "");
  const [title, setTitle] = useState("Today's Diet Plan");
  const [targetPrepMinutes, setTargetPrepMinutes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<DietPlanGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [savedPlans, setSavedPlans] = useState<SavedDietPlan[] | null>(null);

  async function refreshSaved() {
    setSavedPlans(await getSavedDietPlans());
  }

  useEffect(() => {
    refreshSaved();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const r = await generateDietPlan(
        cuisine || null,
        targetPrepMinutes ? Number(targetPrepMinutes) : null
      );
      setResult(r);
    } catch (e) {
      console.error(e);
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      await saveDietPlan({
        title,
        cuisine: result.cuisine,
        target_calories: result.target_calories,
        target_protein_g: result.target_protein_g,
        target_carbs_g: result.target_carbs_g,
        target_fat_g: result.target_fat_g,
        meals: result.meals.map((m) => ({
          slot: m.slot,
          dish_name: m.dish_name,
          description: m.description,
          prep_time_minutes: m.prep_time_minutes,
          calories: m.calories,
          protein_g: m.protein_g,
          carbs_g: m.carbs_g,
          fat_g: m.fat_g,
          ingredients: m.ingredients,
          instructions: m.instructions,
        })),
      });
      setSaved(true);
      await refreshSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleExportPdf(
    meals: (DietPlanMeal & { possible_conflicts?: string[] })[],
    planTitle: string,
    planCuisine: string | null,
    targetCalories: number | null,
    targetProteinG: number | null,
    targetCarbsG: number | null,
    targetFatG: number | null
  ) {
    const path = await save({
      defaultPath: `${planTitle.replace(/[^\w\- ]/g, "")}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!path) return;

    setExportingPdf(true);
    try {
      const base64 = dietPlanPdfBase64({
        title: planTitle,
        cuisine: planCuisine,
        targetCalories,
        targetProteinG,
        targetCarbsG,
        targetFatG,
        meals,
        personName: userState.profile?.name,
      });
      await exportDietPlanPdf(path, base64);
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleDeleteSaved(id: number) {
    await deleteDietPlan(id);
    await refreshSaved();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-8 py-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Diet Plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A full day's timetable with complete recipes, generated from your calorie goal and
          cuisine preference — nothing leaves this device.
        </p>
      </div>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate" className="gap-1.5">
            <Sparkles className="size-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-1.5">
            <Bookmark className="size-4" />
            Saved ({savedPlans?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="plan-title">Plan title</Label>
                <Input id="plan-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Cuisine</Label>
                <div className="flex flex-wrap gap-2">
                  {CUISINES.map((c) => (
                    <Badge
                      key={c}
                      variant={cuisine === c ? "default" : "outline"}
                      className="cursor-pointer px-3 py-1.5 text-sm"
                      onClick={() => setCuisine(cuisine === c ? "" : c)}
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="prep-time">Prep time per meal (optional)</Label>
                <Input
                  id="prep-time"
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 20 minutes"
                  value={targetPrepMinutes}
                  onChange={(e) => setTargetPrepMinutes(e.target.value)}
                  className="w-48"
                />
              </div>

              <Button onClick={handleGenerate} disabled={generating} className="w-fit gap-1.5">
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Generate Diet Plan
              </Button>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>

          {generating && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-16 text-center text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Building your day's timetable and recipes — local AI can take a few minutes.
            </div>
          )}

          {!generating && result && (
            <>
              <div className="flex flex-col gap-3">
                {result.meals.map((meal) => (
                  <MealRow key={meal.slot} meal={meal} />
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleSave} disabled={saving || saved} variant="outline" className="gap-1.5">
                  <Bookmark className="size-4" />
                  {saved ? "Saved" : saving ? "Saving…" : "Save Plan"}
                </Button>
                <Button
                  onClick={() =>
                    handleExportPdf(
                      result.meals,
                      title,
                      result.cuisine,
                      result.target_calories,
                      result.target_protein_g,
                      result.target_carbs_g,
                      result.target_fat_g
                    )
                  }
                  disabled={exportingPdf}
                  variant="outline"
                  className="gap-1.5"
                >
                  {exportingPdf ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Export as PDF
                </Button>
              </div>
            </>
          )}

          {!generating && !result && !error && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border py-16 text-center">
              <CalendarDays className="size-8 text-muted-foreground" />
              <p className="max-w-xs text-sm text-muted-foreground">
                Pick a cuisine and generate to see your day's timetable here.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved" className="mt-4">
          {savedPlans === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : savedPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border py-16 text-center">
              <Bookmark className="size-8 text-muted-foreground" />
              <p className="max-w-xs text-sm text-muted-foreground">
                Plans you save from Generate will show up here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {savedPlans.map((plan) => {
                const meals = plan.meals.map(savedMealToPlain);
                return (
                  <Card key={plan.id}>
                    <CardContent className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-base font-semibold text-foreground">
                            {plan.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {plan.cuisine ?? "No cuisine set"} ·{" "}
                            {new Date(plan.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={exportingPdf}
                            onClick={() =>
                              handleExportPdf(
                                meals,
                                plan.title,
                                plan.cuisine,
                                plan.target_calories,
                                plan.target_protein_g,
                                plan.target_carbs_g,
                                plan.target_fat_g
                              )
                            }
                          >
                            <Download className="size-3.5" />
                            PDF
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSaved(plan.id)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Delete plan"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {meals.map((meal, i) => (
                          <MealRow
                            key={i}
                            meal={{ ...meal, slot_label: SLOT_LABELS[meal.slot], possible_conflicts: [] }}
                            compact
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  mid_morning: "Mid-Morning Snack",
  lunch: "Lunch",
  evening_snack: "Evening Snack",
  dinner: "Dinner",
};

function MealRow({ meal, compact }: { meal: DietMealCandidate; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  async function handleLog() {
    setLogging(true);
    try {
      await saveFoodLog("recipe", [
        {
          usda_fdc_id: null,
          name: meal.dish_name,
          estimated_grams: 0,
          calories: meal.calories,
          protein_g: meal.protein_g,
          carbs_g: meal.carbs_g,
          fat_g: meal.fat_g,
          confidence: null,
        },
      ]);
      setLogged(true);
    } finally {
      setLogging(false);
    }
  }

  return (
    <Card>
      <CardContent className={cn("flex flex-col gap-2", compact && "py-3")}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-xs">
                {meal.slot_label}
              </Badge>
              {meal.prep_time_minutes > 0 && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Clock className="size-3" />
                  {meal.prep_time_minutes} min
                </Badge>
              )}
            </div>
            <p className="font-display text-base font-semibold text-foreground">{meal.dish_name}</p>
            <p className="text-sm text-muted-foreground">{meal.description}</p>
            {meal.possible_conflicts.length > 0 && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                <p className="text-xs text-foreground">
                  May contain: {meal.possible_conflicts.join(", ")} — double-check before eating.
                </p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-3 text-right sm:flex-col sm:gap-1">
            <span className="font-mono text-sm font-semibold text-foreground">
              {Math.round(meal.calories)} kcal
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              P {Math.round(meal.protein_g)}g · C {Math.round(meal.carbs_g)}g · F{" "}
              {Math.round(meal.fat_g)}g
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(meal.ingredients.length > 0 || meal.instructions.length > 0) && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
              {expanded ? "Hide recipe" : "View recipe"}
            </button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleLog}
            disabled={logging || logged}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            {logging ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : logged ? (
              <CheckCircle2 className="size-3.5 text-success" />
            ) : (
              <UtensilsCrossed className="size-3.5" />
            )}
            {logged ? "Logged" : "Log this meal"}
          </Button>
        </div>

        {expanded && (
          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                Ingredients
              </p>
              <ul className="flex flex-col gap-1 text-sm text-foreground">
                {meal.ingredients.map((ing, i) => (
                  <li key={i}>
                    {ing.name} <span className="text-muted-foreground">— {ing.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                Instructions
              </p>
              <ol className="flex flex-col gap-1.5 text-sm text-foreground">
                {meal.instructions.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
