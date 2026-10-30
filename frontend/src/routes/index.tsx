import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import {
  Activity,
  Beef,
  Flame,
  Leaf,
  PiggyBank,
  RefreshCcw,
  Wallet,
  WifiOff,
} from "lucide-react";

import { useDaily, useUsers, useWeekly } from "@/hooks/useNutriQueries";
import { API_BASE_URL, type DailySummary, type WeeklySummary } from "@/lib/api";
import { fmtEur, fmtNum, pct } from "@/lib/format";
import { UserSelector } from "@/components/dashboard/UserSelector";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { SectionNav, type SectionKey } from "@/components/dashboard/SectionNav";
import { TodayIntelligence } from "@/components/dashboard/TodayIntelligence";
import { SpendingProteinCharts } from "@/components/dashboard/SpendingProteinCharts";
import { MacroAndMealTypeCharts } from "@/components/dashboard/MacroAndMealTypeCharts";
import { CoachBriefingPanel } from "@/components/dashboard/CoachBriefingPanel";
import { RecommendationCards } from "@/components/dashboard/RecommendationCards";
import { MealPlanOptimizer } from "@/components/dashboard/MealPlanOptimizer";
import { BehaviourAnalyticsPanel } from "@/components/dashboard/BehaviourAnalyticsPanel";
import { PredictiveAnalyticsPanel } from "@/components/dashboard/PredictiveAnalyticsPanel";
import { GamifiedInsightsPanel } from "@/components/dashboard/GamifiedInsightsPanel";
import { FoodSearchPanel } from "@/components/dashboard/FoodSearchPanel";
import { SavedProductsTable } from "@/components/dashboard/SavedProductsTable";
import { MealLogger } from "@/components/dashboard/MealLogger";
import { RankingsList } from "@/components/dashboard/RankingsList";
import { RecentMealsList } from "@/components/dashboard/RecentMealsList";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const usersQ = useUsers();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | undefined>();
  const [section, setSection] = useState<SectionKey>("overview");

  useEffect(() => {
    if (!activeId && usersQ.data?.length) setActiveId(usersQ.data[0].id);
  }, [usersQ.data, activeId]);

  const dailyQ = useDaily(activeId);
  const weeklyQ = useWeekly(activeId);
  const daily = dailyQ.data;
  const weekly = weeklyQ.data;
  const apiOk = !usersQ.error;

  return (
    <div className="min-h-screen text-foreground">
      <Toaster richColors closeButton position="top-right" />

      <header className="sticky top-0 z-30 border-b border-white/45 bg-white/60 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 md:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-2xl text-white shadow-md"
              style={{ background: "linear-gradient(135deg, var(--health), var(--intel))" }}
            >
              <Leaf className="h-4 w-4" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-semibold tracking-tight">NutriMind AI</span>
                <span className="hidden rounded-full bg-ai-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[color:var(--ai)] sm:inline">
                  AI Nutrition OS
                </span>
              </div>
              <div className="mt-0.5 hidden text-[10.5px] text-muted-foreground md:block">
                Nutrition intelligence for health and budget
              </div>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <UserSelector
              users={usersQ.data}
              activeId={activeId}
              onChange={setActiveId}
              isLoading={usersQ.isLoading}
              compact
            />
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries()}
              title={`API ${API_BASE_URL}`}
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium md:flex ${
                apiOk
                  ? "border-[color-mix(in_oklab,var(--health)_30%,transparent)] bg-health-soft text-[color:var(--health)]"
                  : "border-[color-mix(in_oklab,var(--warn)_35%,transparent)] bg-warn-soft text-[color:var(--warn)]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${apiOk ? "animate-pulse" : ""}`}
                style={{ background: apiOk ? "var(--health)" : "var(--warn)" }}
              />
              {apiOk ? "Live" : "Offline"}
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1440px] items-center justify-center px-4 pb-2.5 md:justify-start md:px-6">
          <SectionNav active={section} onChange={setSection} />
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-5 md:px-6 md:py-7">
        {!apiOk ? <BackendOfflineCard onRetry={() => queryClient.invalidateQueries()} /> : null}

        {section === "overview" ? (
          <OverviewSection
            daily={daily}
            weekly={weekly}
            dailyLoading={dailyQ.isLoading}
            activeId={activeId}
            onActOnCoach={() => setSection("coach")}
          />
        ) : null}

        {section === "coach" ? <CoachSection userId={activeId} /> : null}

        {section === "plan" ? <PlanSection userId={activeId} /> : null}

        {section === "analytics" ? <AnalyticsSection userId={activeId} /> : null}

        {section === "workspace" ? <WorkspaceSection userId={activeId} /> : null}

        <footer className="pt-6 text-center text-[11px] text-muted-foreground">
          NutriMind AI - AI Nutrition OS - API{" "}
          <code className="rounded bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] px-1 py-0.5">
            {API_BASE_URL}
          </code>
        </footer>
      </main>
    </div>
  );
}

function OverviewSection({
  daily,
  weekly,
  dailyLoading,
  activeId,
  onActOnCoach,
}: {
  daily?: DailySummary;
  weekly?: WeeklySummary;
  dailyLoading: boolean;
  activeId?: number;
  onActOnCoach: () => void;
}) {
  return (
    <div className="space-y-6">
      <TodayIntelligence daily={daily} weekly={weekly} isLoading={dailyLoading} onActOnCoach={onActOnCoach} />

      <section className="space-y-3">
        <SectionHeader
          eyebrow="Today"
          title="Live widgets"
          description="Calories, protein and spend against your active goals."
          right={
            daily ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] px-2.5 py-1 text-[10.5px] font-medium text-muted-foreground">
                <Activity className="h-3 w-3" />
                {daily.meal_count} meal{daily.meal_count === 1 ? "" : "s"} logged
              </span>
            ) : null
          }
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Calories"
            value={fmtNum(daily?.total_calories, 0)}
            sub={daily ? `of ${daily.calorie_goal} kcal` : dailyLoading ? "Loading..." : "-"}
            progress={daily ? pct(daily.total_calories, daily.calorie_goal) : undefined}
            accent="cost"
            icon={<Flame className="h-3.5 w-3.5" />}
            micro={daily ? `${pct(daily.total_calories, daily.calorie_goal)}% of goal` : undefined}
          />
          <KpiCard
            label="Protein"
            value={`${fmtNum(daily?.total_protein, 0)} g`}
            sub={daily ? `of ${daily.protein_goal} g` : dailyLoading ? "Loading..." : "-"}
            progress={daily ? pct(daily.total_protein, daily.protein_goal) : undefined}
            accent="health"
            icon={<Beef className="h-3.5 w-3.5" />}
            micro={daily ? `${pct(daily.total_protein, daily.protein_goal)}% of goal` : undefined}
          />
          <KpiCard
            label="Spend today"
            value={fmtEur(daily?.total_spent_eur)}
            sub={weekly ? `Week: ${fmtEur(weekly.total_spent_eur)}` : "-"}
            accent="ai"
            icon={<Wallet className="h-3.5 w-3.5" />}
            micro={weekly ? `Avg meal ${fmtEur(weekly.avg_meal_cost_eur)}` : undefined}
          />
          <KpiCard
            label="Budget left"
            value={fmtEur(weekly?.budget_remaining_eur)}
            sub={weekly ? `of ${fmtEur(weekly.weekly_budget_eur)}` : "-"}
            progress={weekly ? Math.max(0, 100 - pct(weekly.total_spent_eur, weekly.weekly_budget_eur)) : undefined}
            accent="intel"
            icon={<PiggyBank className="h-3.5 w-3.5" />}
            micro={weekly ? `${pct(weekly.total_spent_eur, weekly.weekly_budget_eur)}% used` : undefined}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader
          eyebrow="Trends"
          title="Spending and protein over time"
          description="Track how spend and protein intake evolve across logged days."
        />
        <SpendingProteinCharts userId={activeId} />
      </section>
    </div>
  );
}

function CoachSection({ userId }: { userId?: number }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Coach"
        title="AI briefing and next best actions"
        description="A connected summary from nutrition, budget, recommendations, forecasting and momentum signals."
      />
      <CoachBriefingPanel userId={userId} />
      <RecommendationCards userId={userId} />
    </div>
  );
}

function PlanSection({ userId }: { userId?: number }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Plan"
        title="Meal plan optimiser"
        description="Generate a macro-balanced, budget-aware plan from saved products."
      />
      <MealPlanOptimizer userId={userId} />
    </div>
  );
}

function AnalyticsSection({ userId }: { userId?: number }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Analytics"
        title="Behaviour, trends and forecasts"
        description="Spend, macros, habit intelligence, predictive risk and progress momentum."
      />
      <SpendingProteinCharts userId={userId} />
      <MacroAndMealTypeCharts userId={userId} />
      <BehaviourAnalyticsPanel userId={userId} />
      <PredictiveAnalyticsPanel userId={userId} />
      <GamifiedInsightsPanel userId={userId} />
    </div>
  );
}

function WorkspaceSection({ userId }: { userId?: number }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Workspace"
        title="Food data and meal logging"
        description="Operational tooling for products, prices, food search, meals and efficiency rankings."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SavedProductsTable />
          <RecentMealsList userId={userId} />
        </div>
        <div className="space-y-4">
          <FoodSearchPanel />
          <MealLogger userId={userId} />
          <RankingsList />
        </div>
      </div>
    </div>
  );
}

function BackendOfflineCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="glass flex items-center justify-between gap-3 rounded-2xl p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warn-soft text-[color:var(--warn)]">
          <WifiOff className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">Backend offline</div>
          <div className="text-[11.5px] text-muted-foreground">
            Start FastAPI on port 8000.{" "}
            <code className="rounded bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] px-1 py-0.5 text-[10.5px]">
              {API_BASE_URL}
            </code>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--ink)_10%,transparent)] bg-white/70 px-3 py-1.5 text-[11.5px] font-medium hover:bg-white"
      >
        <RefreshCcw className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  );
}
