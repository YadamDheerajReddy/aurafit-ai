import { useEffect, useState } from "react";
import { AlertTriangle, Plus, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoDropZone } from "@/features/logging/PhotoDropZone";
import { VerificationTable, type VerificationRow } from "@/features/logging/VerificationTable";
import { MealAnalysisSchema } from "@/lib/schemas/mealAnalysis";
import {
  analyzeMealPhoto,
  checkOllamaStatus,
  saveFoodLog,
  type OllamaStatusResult,
} from "@/lib/api";

type Stage = "idle" | "analyzing" | "verifying";

export function VisionTab({ onLogged }: { onLogged: () => void }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatusResult | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [manualFallback, setManualFallback] = useState(false);
  const [saving, setSaving] = useState(false);

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

  async function handleCapture(dataUrl: string) {
    setPhotoPreview(dataUrl);
    setStage("analyzing");
    setManualFallback(false);

    try {
      const result = await analyzeMealPhoto(dataUrl);

      if (result.needs_manual_entry || !result.analysis) {
        setManualFallback(true);
        setRows([emptyRow()]);
        setStage("verifying");
        return;
      }

      const parsed = MealAnalysisSchema.safeParse(result.analysis);
      if (!parsed.success) {
        console.error("Vision response failed frontend schema validation", parsed.error);
        setManualFallback(true);
        setRows([emptyRow()]);
        setStage("verifying");
        return;
      }

      setRows(parsed.data.items.map((item) => ({ ...item })));
      setStage("verifying");
    } catch (e) {
      console.error(e);
      await refreshOllamaStatus();
      setStage("idle");
      setPhotoPreview(null);
    }
  }

  async function handleSave() {
    const validRows = rows.filter((r) => r.name.trim() && r.calories > 0);
    if (validRows.length === 0) return;

    setSaving(true);
    try {
      await saveFoodLog(
        "vision_ai",
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
    setStage("idle");
    setPhotoPreview(null);
    setRows([]);
    setManualFallback(false);
  }

  if (!checkingOllama && ollamaStatus && (!ollamaStatus.running || !ollamaStatus.vision_model_ready)) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-macro-carbs/30 bg-macro-carbs/5 px-6 py-10 text-center">
        <AlertTriangle className="size-6 text-macro-carbs" />
        <div>
          <p className="font-display text-base font-semibold text-foreground">
            {ollamaStatus.running ? "Vision model not installed" : "AI features paused — Ollama isn't running"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {ollamaStatus.running
              ? "Run ollama pull qwen2.5vl:7b, then retry."
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

  if (stage === "idle") {
    return <PhotoDropZone onCapture={handleCapture} />;
  }

  if (stage === "analyzing") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card px-6 py-16 text-center">
        {photoPreview && (
          <img
            src={photoPreview}
            alt="Captured meal"
            className="mb-2 max-h-32 rounded-md object-cover opacity-60"
          />
        )}
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Analyzing your plate…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {photoPreview && (
        <img src={photoPreview} alt="Captured meal" className="max-h-40 w-full rounded-md object-cover" />
      )}

      {manualFallback && (
        <div className="flex items-start gap-2 rounded-md border border-macro-carbs/30 bg-macro-carbs/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-macro-carbs" />
          <p className="text-sm text-foreground">
            Couldn't get a reliable reading from that photo — add the items manually below.
          </p>
        </div>
      )}

      <VerificationTable rows={rows} onChange={setRows} />

      <div className="flex gap-3">
        <Button variant="outline" onClick={reset} className="flex-1">
          Retake
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1 gap-1.5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add to Log
        </Button>
      </div>
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
