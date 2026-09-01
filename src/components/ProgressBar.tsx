import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max: number;
  className?: string;
  barClassName?: string;
  gradient?: boolean;
  overBudgetColor?: boolean;
}

export function ProgressBar({
  value,
  max,
  className,
  barClassName,
  gradient = false,
  overBudgetColor = false,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const isOver = overBudgetColor && value > max;

  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-200 ease-out",
          isOver ? "bg-macro-over" : gradient ? "bg-aura-gradient" : barClassName
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
