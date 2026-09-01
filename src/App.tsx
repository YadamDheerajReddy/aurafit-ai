import { useEffect, useState } from "react";
import { Camera, ChefHat, TrendingUp, Settings } from "lucide-react";
import { NavRail, type NavDestination } from "@/components/shell/NavRail";
import { ComingSoon } from "@/components/shell/ComingSoon";
import { AuraMark } from "@/components/AuraMark";
import { Onboarding } from "@/features/onboarding/Onboarding";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { getUserState, type UserState } from "@/lib/api";

function App() {
  const [loading, setLoading] = useState(true);
  const [userState, setUserState] = useState<UserState | null>(null);
  const [nav, setNav] = useState<NavDestination>("dashboard");

  const refresh = () => getUserState().then(setUserState);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <AuraMark className="size-10 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!userState?.onboarded) {
    return (
      <Onboarding
        onComplete={() => {
          setLoading(true);
          refresh().finally(() => setLoading(false));
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <NavRail active={nav} onSelect={setNav} />
      {nav === "dashboard" && <Dashboard userState={userState} />}
      {nav === "log-meal" && (
        <ComingSoon
          icon={Camera}
          title="Vision Meal Logger"
          description="Photo-based logging with local AI is coming in Phase 3."
        />
      )}
      {nav === "recipes" && (
        <ComingSoon
          icon={ChefHat}
          title="Recipe Generator"
          description="Pantry-aware, guardrail-safe recipes are coming in Phase 4."
        />
      )}
      {nav === "progress" && (
        <ComingSoon
          icon={TrendingUp}
          title="Progress & Analytics"
          description="Weight trends and macro compliance charts are coming in Phase 2."
        />
      )}
      {nav === "settings" && (
        <ComingSoon
          icon={Settings}
          title="Settings & Privacy"
          description="Profile editing, model management, and data export are coming soon."
        />
      )}
    </div>
  );
}

export default App;
