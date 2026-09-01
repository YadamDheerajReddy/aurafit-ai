import { useEffect, useState } from "react";
import { AlertTriangle, Plus, RotateCcw, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VerificationTable, type VerificationRow } from "@/features/logging/VerificationTable";
import { MealAnalysisSchema } from "@/lib/schemas/mealAnalysis";
import {
  checkOllamaStatus,
  estimateMealFromText,
  saveFoodLog,
  type OllamaStatusResult,
} from "@/lib/api";

type Stage = "input" | "analyzing" | "verifying";

export function DescribeMealTab({ onLogged }: { onLogged: () => void }) {
  const [stage, setStage] = useState<Stage>("input");
  const [description, setDescription] = useState("");
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatusResult | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(true);
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [manualFallback, setManualFallback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  async function refreshOllamaStatus() {
    setCheckingOllama(true);
    try {
      setOllamaStatus(await checkOllamaStatus());
    } finally {
      setCheckingOllama(false);
    }
  }

  useEffect(() => {
    refreshOllamaStatus();
  }, []);

  useEffect(() => {
    if (stage !== "analyzing") return;
    setElapsedSeconds(0);
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [stage]);

  async function handleEstimate() {
    if (!description.trim()) return;
    setStage("analyzing");
    setManualFallback(false);
    setAnalyzeError(null);

    try {
      const result = await estimateMealFromText(description.trim());

      if (result.needs_manual_entry || !result.analysis) {
        setManualFallback(true);
        setRows([emptyRow()]);
        setStage("verifying");
        return;
      }

      const parsed = MealAnalysisSchema.safeParse(result.analysis);
      if (!parsed.success) {
        console.error("Text estimate failed frontend schema validation", parsed.error);
        setManualFallback(true);
        setRows([emptyRow()]);
        setStage("verifying");
        return;
      }

      setRows(parsed.data.items.map((item) => ({ ...item })));
      setStage("verifying");
    } catch (e) {
      console.error(e);
      setAnalyzeError(String(e));
      await refreshOllamaStatus();
      setStage("input");
    }
  }

  async function handleSave() {
    const validRows = rows.filter((r) => r.name.trim() && r.calories > 0);
    if (validRows.length === 0) return;

    setSaving(true);
    try {
      await saveFoodLog(
        "ai_text",
        validRows.map((r) => ({
          usda_fdc_id: null,
          name: r.name,
          estimated_grams: r.estimated_grams,
          calories: r.calories,
          protein_g: r.protein_g,
          carbs_g: r.carbs_g,
          fat_g: r.fat_g,
          confidence: r.confidence,
        }))
      );
      onLogged();
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setStage("input");
    setRows([]);
    setManualFallback(false);
  }

  if (!checkingOllama && ollamaStatus && (!ollamaStatus.running || !ollamaStatus.text_model_ready)) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-macro-carbs/30 bg-macro-carbs/5 px-6 py-10 text-center">
        <AlertTriangle className="size-6 text-macro-carbs" />
        <div>
          <p className="font-display text-base font-semibold text-foreground">
            {ollamaStatus.running ? "Text model not installed" : "AI features paused — Ollama isn't running"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {ollamaStatus.running
              ? "Run ollama pull qwen2.5:3b-instruct, then retry."
              : "Start the Ollama app, then retry. Quick Lookup still works normally."}
          </p>
        </div>
        <Button variant="outline" onClick={refreshOllamaStatus} className="gap-1.5">
          <RotateCcw className="size-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (stage === "analyzing") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card px-6 py-16 text-center">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Estimating macros… ({elapsedSeconds}s)</p>
        {elapsedSeconds > 15 && (
          <p className="max-w-xs text-xs text-muted-foreground">
            Still working — local AI on CPU can take a minute or two.
          </p>
        )}
      </div>
    );
  }

  if (stage === "verifying") {
    return (
      <div className="flex flex-col gap-4">
        {manualFallback && (
          <div className="flex items-start gap-2 rounded-md border border-macro-carbs/30 bg-macro-carbs/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-macro-carbs" />
            <p className="text-sm text-foreground">
              Couldn't get a reliable estimate — add the items manually below.
            </p>
          </div>
        )}

        <VerificationTable rows={rows} onChange={setRows} />

        <div className="flex gap-3">
          <Button variant="outline" onClick={reset} className="flex-1">
            Start Over
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add to Log
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {analyzeError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-sm text-foreground">{analyzeError}</p>
        </div>
      )}

      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe what you ate, e.g. “grilled chicken breast with a cup of rice and steamed broccoli”"
        rows={4}
        autoFocus
      />
      <p className="text-xs text-muted-foreground">
        Be as specific as you can — quantities, cooking method, and portion size all help.
      </p>

      <Button onClick={handleEstimate} disabled={!description.trim()} className="gap-1.5">
        <Sparkles className="size-4" />
        Estimate Macros
      </Button>
    </div>
  );
}

function emptyRow(): VerificationRow {
  return {
    name: "",
    estimated_grams: 0,
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    confidence: null,
  };
}
