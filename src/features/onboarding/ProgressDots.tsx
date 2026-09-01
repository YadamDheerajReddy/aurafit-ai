import { cn } from "@/lib/utils";

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-200",
            i === current ? "w-6 bg-aura-gradient" : i < current ? "w-1.5 bg-primary/60" : "w-1.5 bg-muted"
          )}
        />
      ))}
    </div>
  );
}
