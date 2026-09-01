import { LayoutDashboard, NotebookPen, ChefHat, CalendarDays, TrendingUp, Settings, ShieldCheck, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuraMark } from "@/components/AuraMark";
import { useTheme } from "@/lib/theme";

export type NavDestination =
  | "dashboard"
  | "log-meal"
  | "recipes"
  | "diet-plan"
  | "progress"
  | "settings";

const ITEMS: { id: NavDestination; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "log-meal", label: "Log Meal", icon: NotebookPen },
  { id: "recipes", label: "Recipes", icon: ChefHat },
  { id: "diet-plan", label: "Diet Plan", icon: CalendarDays },
  { id: "progress", label: "Progress", icon: TrendingUp },
  { id: "settings", label: "Settings", icon: Settings },
];

export function NavRail({
  active,
  onSelect,
}: {
  active: NavDestination;
  onSelect: (destination: NavDestination) => void;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-card px-3 py-6">
      <div className="mb-4 flex items-center gap-2 px-2">
        <AuraMark className="size-7 rounded-md" />
        <span className="font-display text-sm font-bold text-foreground">AuraFit AI</span>
      </div>

      <div className="mb-6 flex items-center gap-1.5 rounded-md border border-success/30 bg-success/5 px-2.5 py-1.5">
        <ShieldCheck className="size-3.5 shrink-0 text-success" />
        <span className="text-xs font-medium text-success">Local &amp; Private</span>
      </div>

      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-150",
              isActive
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </button>
        );
      })}

      <div className="flex-1" />

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
      >
        {theme === "dark" ? (
          <Sun className="size-4 shrink-0" />
        ) : (
          <Moon className="size-4 shrink-0" />
        )}
        {theme === "dark" ? "Light theme" : "Dark theme"}
      </button>
    </nav>
  );
}
