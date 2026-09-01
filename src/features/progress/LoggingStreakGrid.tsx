import { cn } from "@/lib/utils";

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function LoggingStreakGrid({ loggedDates }: { loggedDates: string[] }) {
  const logged = new Set(loggedDates);
  const today = new Date();
  const days: { key: string; label: string; isLogged: boolean }[] = [];

  for (let i = 41; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    days.push({
      key,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      isLogged: logged.has(key),
    });
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-14">
        {days.map((day) => (
          <div
            key={day.key}
            title={`${day.label}${day.isLogged ? " — logged" : ""}`}
            className={cn(
              "aspect-square rounded-sm",
              day.isLogged ? "bg-macro-onTarget" : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Last 42 days · each square is one day</p>
    </div>
  );
}
