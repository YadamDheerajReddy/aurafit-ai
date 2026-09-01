import { useId } from "react";
import { RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";

interface MacroRingProps {
  value: number;
  max: number;
  size?: number;
  overBudget?: boolean;
}

/**
 * The Dashboard's hero macro ring (UI/UX Brief, Component System — "Custom
 * (Recharts RadialBar)"). Animates fill on data change only, per the Motion
 * Principles ("never on idle").
 */
export function MacroRing({ value, max, size = 88, overBudget = false }: MacroRingProps) {
  const uid = useId();
  const gradientId = `macro-ring-gradient-${uid}`;
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const isOver = overBudget && value > max;

  return (
    <div style={{ width: size, height: size }} className="relative shrink-0">
      <svg width={0} height={0}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>
        </defs>
      </svg>
      <RadialBarChart
        width={size}
        height={size}
        cx="50%"
        cy="50%"
        innerRadius="72%"
        outerRadius="100%"
        barSize={size * 0.12}
        data={[{ value: pct }]}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar
          background={{ fill: "hsl(var(--muted))" }}
          dataKey="value"
          cornerRadius={999}
          fill={isOver ? "#DC2626" : `url(#${gradientId})`}
          isAnimationActive
        />
      </RadialBarChart>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-xs font-semibold text-foreground">
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}
