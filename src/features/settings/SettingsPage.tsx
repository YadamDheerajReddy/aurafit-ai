import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { CheckCircle2, Download, Loader2, ShieldCheck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exportData } from "@/lib/api";

export function SettingsPage() {
  const [exporting, setExporting] = useState(false);
  const [exportedTo, setExportedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Local &amp; Private, and your data.</p>
      </div>

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
    </div>
  );
}
