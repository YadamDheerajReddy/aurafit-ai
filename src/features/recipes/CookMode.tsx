import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Timer, Pause, Play, RotateCcw, UtensilsCrossed, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveFoodLog } from "@/lib/api";
import type { RecipeCandidate } from "@/lib/schemas/recipe";

function formatTime(totalSeconds: number) {
  const m = Math.floor(Math.abs(totalSeconds) / 60);
  const s = Math.abs(totalSeconds) % 60;
  const sign = totalSeconds < 0 ? "-" : "";
  return `${sign}${m}:${s.toString().padStart(2, "0")}`;
}

export function CookMode({
  recipe,
  onClose,
  onLogged,
}: {
  recipe: RecipeCandidate;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(recipe.prep_time_minutes * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning]);

  const isLastStep = stepIndex === recipe.instructions.length - 1;

  async function handleLogMeal() {
    setLogging(true);
    try {
      await saveFoodLog("recipe", [
        {
          usda_fdc_id: null,
          name: recipe.title,
          estimated_grams: 0,
          calories: recipe.calories_per_serving,
          protein_g: recipe.protein_g_per_serving,
          carbs_g: recipe.carbs_g_per_serving,
          fat_g: recipe.fat_g_per_serving,
          confidence: null,
        },
      ]);
      setLogged(true);
      onLogged();
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <p className="font-display text-lg font-semibold text-foreground">{recipe.title}</p>
          <p className="text-xs text-muted-foreground">
            Step {stepIndex + 1} of {recipe.instructions.length}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close Cook Mode"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 py-8">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2">
          <Timer className="size-4 text-muted-foreground" />
          <span className={`font-mono text-lg font-semibold ${secondsLeft < 0 ? "text-destructive" : "text-foreground"}`}>
            {formatTime(secondsLeft)}
          </span>
          <button
            type="button"
            onClick={() => setTimerRunning((r) => !r)}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={timerRunning ? "Pause timer" : "Start timer"}
          >
            {timerRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setTimerRunning(false);
              setSecondsLeft(recipe.prep_time_minutes * 60);
            }}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Reset timer"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>

        <p className="max-w-xl text-center font-display text-2xl font-medium leading-relaxed text-foreground">
          {recipe.instructions[stepIndex]}
        </p>
      </div>

      <footer className="flex flex-col gap-3 border-t border-border px-6 py-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            className="flex-1 gap-1.5"
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
          {isLastStep ? (
            <Button onClick={handleLogMeal} disabled={logging || logged} className="flex-1 gap-1.5">
              {logging ? (
                <Loader2 className="size-4 animate-spin" />
              ) : logged ? (
                "Logged!"
              ) : (
                <>
                  <UtensilsCrossed className="size-4" />
                  Log this meal
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => setStepIndex((i) => Math.min(recipe.instructions.length - 1, i + 1))}
              className="flex-1 gap-1.5"
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
