import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  CheckCircle2,
  Download,
  Droplets,
  Loader2,
  PenLine,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ModelManagementCard } from "@/features/settings/ModelManagementCard";
import { EditProfileModal } from "@/features/settings/EditProfileModal";
import { UpdateCheckCard } from "@/features/settings/UpdateCheckCard";
import { GOALS } from "@/features/onboarding/constants";
import { exportData, setWaterGoal, type UserState } from "@/lib/api";

export function SettingsPage({
  userState,
  onDataChanged,
}: {
  userState: UserState;
  onDataChanged: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [exportedTo, setExportedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [waterGoalInput, setWaterGoalInput] = useState(
    userState.water_goal_ml ? String(userState.water_goal_ml) : ""
  );
  const [savingWaterGoal, setSavingWaterGoal] = useState(false);

  const goal = userState.active_goal;
  const goalLabel = GOALS.find((g) => g.value === goal?.goal_type)?.label ?? "—";
  const diets = userState.guardrails.filter((g) => g.constraint_type === "diet");
  const allergies = userState.guardrails.filter((g) => g.constraint_type === "allergy");

  async function handleSaveWaterGoal() {
    const ml = Number(waterGoalInput);
    if (!ml || ml <= 0) return;
    setSavingWaterGoal(true);
    try {
      await setWaterGoal(ml);
      onDataChanged();
    } finally {
      setSavingWaterGoal(false);
    }
  }

  async function handleExport() {
    setError(null);
    setExportedTo(null);

    const dir = await open({ directory: true, multiple: false, title: "Choose export folder" });
    if (!dir || Array.isArray(dir)) return;

    setExporting(true);
    try {
      await exportData(dir);
      setExportedTo(dir);
    } catch (e) {
      console.error(e);
      setError(
        `Couldn't write to that folder. Choose a different one and try again. (${String(e)})`
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-8 py-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {userState.profile?.name ? `Settings — ${userState.profile.name}` : "Settings"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Local &amp; Private, and your data.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Profile &amp; Goals</CardTitle>
            <CardDescription>Your stats, active goal, and dietary guardrails.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
            <PenLine className="size-3.5" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Goal</p>
              <p className="text-sm font-medium text-foreground">{goalLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cuisine preference</p>
              <p className="text-sm font-medium text-foreground">
                {userState.profile?.cuisine_preference || "None set"}
              </p>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Dietary guardrails</p>
            {diets.length === 0 && allergies.length === 0 ? (
              <p className="text-sm text-muted-foreground">None set.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {diets.map((d) => (
                  <Badge key={d.value} variant="default">
                    {d.value}
                  </Badge>
                ))}
                {allergies.map((a) => (
                  <Badge key={a.value} variant="destructive">
                    {a.value}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Always avoid</p>
            {userState.avoided_ingredients.length === 0 ? (
              <p className="text-sm text-muted-foreground">None set.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {userState.avoided_ingredients.map((item) => (
                  <Badge key={item} variant="secondary">
                    {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Guardrails reduce diet-conflicting suggestions but aren't a substitute for reading
            ingredient labels.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Droplets className="size-4 text-blue-400" />
            Daily water goal
          </CardTitle>
          <CardDescription>Tracked from the Dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 2500"
            value={waterGoalInput}
            onChange={(e) => setWaterGoalInput(e.target.value)}
            className="w-40 font-mono"
          />
          <span className="text-sm text-muted-foreground">ml / day</span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveWaterGoal}
            disabled={savingWaterGoal || !waterGoalInput}
            className="ml-auto"
          >
            {savingWaterGoal ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Local &amp; Private</CardTitle>
          <CardDescription>The core promise, verified live.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/5 px-4 py-3">
            <ShieldCheck className="size-4 shrink-0 text-success" />
            <p className="text-sm text-foreground">
              Every gram of data and every AI inference stays on this machine.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/5 px-4 py-3">
            <WifiOff className="size-4 shrink-0 text-success" />
            <p className="text-sm text-foreground">
              Zero network calls during core use — this build's CI verifies it automatically.
            </p>
          </div>
        </CardContent>
      </Card>

      <ModelManagementCard />

      <UpdateCheckCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export your data</CardTitle>
          <CardDescription>
            Everything you've logged, as CSV and JSON, with no throttling or paywall.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={handleExport} disabled={exporting} className="w-fit gap-1.5">
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Export All Data
          </Button>

          {exportedTo && (
            <p className="flex items-center gap-1.5 text-sm text-success">
              <CheckCircle2 className="size-4" />
              Exported to {exportedTo}
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <p className="px-1 text-xs text-muted-foreground">
        Nutrition data provided by the U.S. Department of Agriculture, FoodData Central
        (fdc.nal.usda.gov). AuraFit AI is not affiliated with or endorsed by the USDA.
      </p>

      {editing && (
        <EditProfileModal
          userState={userState}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onDataChanged();
          }}
        />
      )}
    </div>
  );
}
