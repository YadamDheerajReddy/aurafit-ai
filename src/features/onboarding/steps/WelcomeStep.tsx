import { ShieldCheck, WifiOff, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuraMark } from "@/components/AuraMark";

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <AuraMark className="size-16 rounded-2xl" />

      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Welcome to AuraFit AI</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          A calorie and body-transformation tracker that never leaves your device.
          No account, no cloud sync, no subscription — just accurate tools that
          are entirely yours.
        </p>
      </div>

      <div className="grid w-full max-w-md gap-3 text-left">
        <div className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <p className="text-sm text-muted-foreground">
            Every gram of data and every AI inference stays on this machine.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3">
          <WifiOff className="mt-0.5 size-4 shrink-0 text-success" />
          <p className="text-sm text-muted-foreground">
            Zero network calls during core use — verifiable any time.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3">
          <Download className="mt-0.5 size-4 shrink-0 text-success" />
          <p className="text-sm text-muted-foreground">
            Your data is exportable as CSV/JSON, on demand, with no paywall.
          </p>
        </div>
      </div>

      <Button size="lg" onClick={onNext} className="w-full max-w-md">
        Get Started
      </Button>
    </div>
  );
}
