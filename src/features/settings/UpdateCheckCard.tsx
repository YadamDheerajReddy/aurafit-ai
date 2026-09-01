import { useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { CheckCircle2, Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "up-to-date" }
  | { kind: "available"; update: Update }
  | { kind: "installing" }
  | { kind: "error"; message: string };

export function UpdateCheckCard() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleCheck() {
    setStatus({ kind: "checking" });
    try {
      const update = await check();
      setStatus(update ? { kind: "available", update } : { kind: "up-to-date" });
    } catch (e) {
      console.error(e);
      setStatus({ kind: "error", message: String(e) });
    }
  }

  async function handleInstall(update: Update) {
    setStatus({ kind: "installing" });
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      console.error(e);
      setStatus({ kind: "error", message: String(e) });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Updates</CardTitle>
        <CardDescription>
          Manual only — AuraFit AI never checks for updates automatically. This is the only
          action in the app that reaches the internet beyond your local Ollama instance.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status.kind === "available" ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-foreground">
              Version {status.update.version} is available (you're on {status.update.currentVersion}).
            </p>
            <Button
              onClick={() => handleInstall(status.update)}
              className="w-fit gap-1.5"
              disabled={false}
            >
              <Download className="size-4" />
              Download &amp; Install
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={handleCheck}
            disabled={status.kind === "checking" || status.kind === "installing"}
            className="w-fit gap-1.5"
          >
            {status.kind === "checking" || status.kind === "installing" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {status.kind === "installing" ? "Installing…" : "Check for Updates"}
          </Button>
        )}

        {status.kind === "up-to-date" && (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="size-4" />
            You're on the latest version.
          </p>
        )}
        {status.kind === "error" && (
          <p className="text-sm text-destructive">Couldn't check for updates: {status.message}</p>
        )}
      </CardContent>
    </Card>
  );
}
