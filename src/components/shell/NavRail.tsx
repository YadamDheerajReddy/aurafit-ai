import { LayoutDashboard, Camera, ChefHat, TrendingUp, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuraMark } from "@/components/AuraMark";

export type NavDestination = "dashboard" | "log-meal" | "recipes" | "progress" | "settings";

const ITEMS: { id: NavDestination; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "log-meal", label: "Log Meal", icon: Camera },
  { id: "recipes", label: "Recipes", icon: ChefHat },
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
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-card px-3 py-6">
      <div className="mb-6 flex items-center gap-2 px-2">
        <AuraMark className="size-7 rounded-md" />
        <span className="font-display text-sm font-bold text-foreground">AuraFit AI</span>
      </div>

      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
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
    </nav>
  );
}
