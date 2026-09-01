import { useEffect, useState } from "react";
import { Bookmark, ChefHat, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PantryInput } from "@/features/recipes/PantryInput";
import { RecipeCard } from "@/features/recipes/RecipeCard";
import { CookMode } from "@/features/recipes/CookMode";
import { RecipeCandidateSchema, type RecipeCandidate } from "@/lib/schemas/recipe";
import {
  deleteRecipe,
  generateRecipes,
  getSavedRecipes,
  saveRecipe,
  type SavedRecipe,
} from "@/lib/api";

function savedToCandidate(saved: SavedRecipe): RecipeCandidate {
  let instructions: string[] = [];
  try {
    instructions = JSON.parse(saved.instructions);
  } catch {
    instructions = [];
  }
  return {
    title: saved.title,
    prep_time_minutes: saved.prep_time_minutes ?? 0,
    servings: saved.servings,
    calories_per_serving: saved.calories_per_serving ?? 0,
    protein_g_per_serving: saved.protein_g_per_serving ?? 0,
    carbs_g_per_serving: saved.carbs_g_per_serving ?? 0,
    fat_g_per_serving: saved.fat_g_per_serving ?? 0,
    ingredients: saved.ingredients.map((i) => ({ name: i.name, quantity: i.quantity })),
    instructions,
    possible_allergens: [],
  };
}

export function RecipesPage() {
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [targetPrepMinutes, setTargetPrepMinutes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [candidates, setCandidates] = useState<RecipeCandidate[]>([]);
  const [remainingCalories, setRemainingCalories] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cookingRecipe, setCookingRecipe] = useState<RecipeCandidate | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedTitles, setSavedTitles] = useState<Set<string>>(new Set());

  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[] | null>(null);

  async function refreshSaved() {
    setSavedRecipes(await getSavedRecipes());
  }

  useEffect(() => {
    refreshSaved();
  }, []);

  async function handleGenerate() {
    if (pantryItems.length === 0) return;
    setGenerating(true);
    setError(null);
    setCandidates([]);
    try {
      const result = await generateRecipes(
        pantryItems,
        targetPrepMinutes ? Number(targetPrepMinutes) : undefined
      );
      const parsed = result.recipes
        .map((r) => RecipeCandidateSchema.safeParse(r))
        .filter((p) => p.success)
        .map((p) => p.data);
      setCandidates(parsed);
      setRemainingCalories(result.remaining_calories);
      if (parsed.length === 0) {
        setError("Didn't get any usable recipes back — try again or adjust your pantry items.");
      }
    } catch (e) {
      console.error(e);
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave(recipe: RecipeCandidate, index: number) {
    setSavingIndex(index);
    try {
      await saveRecipe(recipe);
      setSavedTitles((prev) => new Set(prev).add(recipe.title));
      await refreshSaved();
    } finally {
      setSavingIndex(null);
    }
  }

  async function handleDeleteSaved(id: number) {
    await deleteRecipe(id);
    await refreshSaved();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-8 py-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Recipes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate guardrail-safe recipes from what's in your pantry — nothing
          leaves this device.
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
            Saved ({savedRecipes?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
            <div className="flex flex-col gap-4">
              <div>
                <Label className="mb-2 block">Pantry ingredients</Label>
                <PantryInput items={pantryItems} onChange={setPantryItems} />
              </div>

              <div>
                <Label htmlFor="prep-time" className="mb-2 block">
                  Target prep time (optional)
                </Label>
                <Input
                  id="prep-time"
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 20 minutes"
                  value={targetPrepMinutes}
                  onChange={(e) => setTargetPrepMinutes(e.target.value)}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={pantryItems.length === 0 || generating}
                className="gap-1.5"
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Generate Recipes
              </Button>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="flex flex-col gap-4">
              {generating && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-16 text-center text-sm text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                  Generating recipes from your pantry… local AI can take a minute.
                </div>
              )}

              {!generating && candidates.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border py-16 text-center">
                  <ChefHat className="size-8 text-muted-foreground" />
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Add a few pantry items on the left, then generate to see recipe ideas here.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {candidates.map((recipe, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <RecipeCard
                      recipe={recipe}
                      remainingCalories={remainingCalories}
                      onOpen={() => setCookingRecipe(recipe)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit gap-1.5"
                      onClick={() => handleSave(recipe, i)}
                      disabled={savingIndex === i || savedTitles.has(recipe.title)}
                    >
                      <Bookmark className="size-3.5" />
                      {savedTitles.has(recipe.title) ? "Saved" : "Save recipe"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="saved" className="mt-4">
          {savedRecipes === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : savedRecipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border py-16 text-center">
              <Bookmark className="size-8 text-muted-foreground" />
              <p className="max-w-xs text-sm text-muted-foreground">
                Recipes you save from Generate will show up here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {savedRecipes.map((saved) => (
                <div key={saved.id} className="flex flex-col gap-2">
                  <RecipeCard
                    recipe={savedToCandidate(saved)}
                    remainingCalories={remainingCalories}
                    onOpen={() => setCookingRecipe(savedToCandidate(saved))}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit text-destructive hover:text-destructive"
                    onClick={() => handleDeleteSaved(saved.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {cookingRecipe && (
        <CookMode
          recipe={cookingRecipe}
          onClose={() => setCookingRecipe(null)}
          onLogged={() => setCookingRecipe(null)}
        />
      )}
    </div>
  );
}
