import { useEffect, useState } from "react";
import { NavRail, type NavDestination } from "@/components/shell/NavRail";
import { AuraMark } from "@/components/AuraMark";
import { Onboarding } from "@/features/onboarding/Onboarding";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { LogMealPage } from "@/features/logging/LogMealPage";
import { RecipesPage } from "@/features/recipes/RecipesPage";
import { DietPlanPage } from "@/features/dietplan/DietPlanPage";
import { ProgressPage } from "@/features/progress/ProgressPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ProfileSelector } from "@/features/profiles/ProfileSelector";
import {
  getActiveProfileId,
  getProfiles,
  getUserState,
  switchProfile,
  type Profile,
  type UserState,
} from "@/lib/api";

type Phase = "loading" | "profile-picker" | "app";

function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [userState, setUserState] = useState<UserState | null>(null);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [nav, setNav] = useState<NavDestination>("dashboard");

  async function refresh() {
    const [state, activeId, profiles] = await Promise.all([
      getUserState(),
      getActiveProfileId(),
      getProfiles(),
    ]);
    setUserState(state);
    setActiveProfile(profiles.find((p) => p.id === activeId) ?? null);
  }

  async function enterApp() {
    setPhase("loading");
    await refresh();
    setPhase("app");
  }

  useEffect(() => {
    (async () => {
      const profiles = await getProfiles();
      if (profiles.length === 1) {
        // Zero-friction common case: skip the picker entirely.
        await switchProfile(profiles[0].id);
        await enterApp();
      } else {
        setPhase("profile-picker");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <AuraMark className="size-10 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (phase === "profile-picker") {
    return <ProfileSelector onSelected={enterApp} />;
  }

  if (!userState?.onboarded) {
    return (
      <Onboarding
        onComplete={() => {
          setPhase("loading");
          refresh().finally(() => setPhase("app"));
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <NavRail
        active={nav}
        onSelect={setNav}
        activeProfile={activeProfile}
        onSwitchProfile={() => setPhase("profile-picker")}
      />
      <div key={nav} className="flex min-w-0 flex-1 animate-in fade-in duration-200 ease-out">
        {nav === "dashboard" && <Dashboard userState={userState} onDataChanged={refresh} />}
        {nav === "log-meal" && <LogMealPage onLogged={() => setNav("dashboard")} />}
        {nav === "recipes" && <RecipesPage />}
        {nav === "diet-plan" && <DietPlanPage userState={userState} />}
        {nav === "progress" && (
          <ProgressPage targetWeightKg={userState.active_goal?.target_weight_kg ?? null} />
        )}
        {nav === "settings" && (
          <SettingsPage
            userState={userState}
            onDataChanged={refresh}
            onSwitchProfile={() => setPhase("profile-picker")}
          />
        )}
      </div>
    </div>
  );
}

export default App;
