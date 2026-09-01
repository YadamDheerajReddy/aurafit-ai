import { useEffect, useState } from "react";
import { NavRail, type NavDestination } from "@/components/shell/NavRail";
import { AuraMark } from "@/components/AuraMark";
import { Onboarding } from "@/features/onboarding/Onboarding";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { LogMealPage } from "@/features/logging/LogMealPage";
import { RecipesPage } from "@/features/recipes/RecipesPage";
import { ProgressPage } from "@/features/progress/ProgressPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
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
      {nav === "dashboard" && <Dashboard userState={userState} onDataChanged={refresh} />}
      {nav === "log-meal" && <LogMealPage onLogged={() => setNav("dashboard")} />}
      {nav === "recipes" && <RecipesPage />}
      {nav === "progress" && <ProgressPage targetWeightKg={userState.active_goal?.target_weight_kg ?? null} />}
      {nav === "settings" && <SettingsPage userState={userState} onDataChanged={refresh} />}
    </div>
  );
}

export default App;
