import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Copy, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { checkOllamaStatus, type OllamaStatusResult } from "@/lib/api";

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-left font-mono text-sm text-foreground transition-colors hover:bg-muted"
    >
      {command}
      {copied ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <Copy className="size-4 shrink-0 text-muted-foreground" />}
    </button>
  );
}

export function ModelManagementCard() {
  const [status, setStatus] = useState<OllamaStatusResult | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setStatus(await checkOllamaStatus());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-4 text-muted-foreground" />
          AI Models
        </CardTitle>
        <CardDescription>
          Describe (Log Meal) runs entirely through a local Ollama instance.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking Ollama…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
              <span className="text-sm text-foreground">Ollama daemon</span>
              {status?.running ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="size-3" /> Running
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                  <XCircle className="size-3" /> Not detected
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
              <span className="text-sm text-foreground">qwen2.5:3b-instruct (Describe)</span>
              {status?.text_model_ready ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="size-3" /> Installed
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                  <XCircle className="size-3" /> Not installed
                </Badge>
              )}
            </div>

            {status && status.models_installed.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Installed models</p>
                <div className="flex flex-wrap gap-1.5">
                  {status.models_installed.map((m) => (
                    <Badge key={m} variant="outline" className="font-mono text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {!status?.running && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-4 py-3">
                <p className="text-sm text-foreground">Install Ollama, then pull the model(s) you want:</p>
                <a
                  href="https://ollama.com/download"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline underline-offset-2"
                >
                  ollama.com/download
                </a>
              </div>
            )}

            {status?.running && !status.text_model_ready && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-4 py-3">
                <p className="text-sm text-foreground">
                  Run this command to pull the Describe model (lightweight, text-only):
                </p>
                <CopyableCommand command="ollama pull qwen2.5:3b-instruct" />
                <p className="text-xs text-muted-foreground">~2GB, one-time download.</p>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={refresh} className="w-fit gap-1.5">
              <RotateCcw className="size-3.5" />
              Recheck status
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
