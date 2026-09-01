import { AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ProgressBar";
import type { RecipeCandidate } from "@/lib/schemas/recipe";

interface RecipeCardProps {
  recipe: RecipeCandidate;
  remainingCalories: number | null;
  onOpen: () => void;
}

export function RecipeCard({ recipe, remainingCalories, onOpen }: RecipeCardProps) {
  const hasFitBar = remainingCalories !== null && remainingCalories > 0;
  const fitPct = hasFitBar
    ? Math.min(100, (recipe.calories_per_serving / remainingCalories) * 100)
    : null;

  return (
    <Card className="cursor-pointer transition-colors hover:border-primary/40" onClick={onOpen}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-foreground">{recipe.title}</h3>
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <Clock className="size-3" />
            {recipe.prep_time_minutes} min
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            {Math.round(recipe.calories_per_serving)} kcal
          </Badge>
          <Badge variant="outline" className="font-mono text-xs text-macro-protein">
            {Math.round(recipe.protein_g_per_serving)}g P
          </Badge>
          <Badge variant="outline" className="font-mono text-xs text-macro-carbs">
            {Math.round(recipe.carbs_g_per_serving)}g C
          </Badge>
          <Badge variant="outline" className="font-mono text-xs text-macro-fat">
            {Math.round(recipe.fat_g_per_serving)}g F
          </Badge>
        </div>

        {recipe.possible_allergens.length > 0 && (
          <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            <p className="text-xs text-foreground">
              May contain: {recipe.possible_allergens.join(", ")} — double-check ingredients.
            </p>
          </div>
        )}

        <p className="line-clamp-2 text-xs text-muted-foreground">
          {recipe.ingredients.map((i) => i.name).join(", ")}
        </p>

        {hasFitBar && fitPct !== null && (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Fits your remaining budget</span>
              <span className="font-mono">{Math.round(fitPct)}%</span>
            </div>
            <ProgressBar value={recipe.calories_per_serving} max={remainingCalories!} gradient />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
