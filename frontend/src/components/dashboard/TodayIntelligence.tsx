import { ArrowUpRight, Beef, Flame, Sparkles, Wallet } from "lucide-react";
import { ProgressRing } from "./ProgressRing";
import { fmtEur, fmtNum, pct } from "@/lib/format";
import type { DailySummary, WeeklySummary } from "@/lib/api";

function buildHeadline(daily?: DailySummary, weekly?: WeeklySummary) {
  if (!daily) {
    return {
      title: "Awaiting today's signal",
      body: "Log one meal to unlock your daily intelligence brief.",
    };
  }

  const proteinPct = pct(daily.total_protein, daily.protein_goal);
  const caloriePct = pct(daily.total_calories, daily.calorie_goal);
  const budgetPct = weekly ? pct(weekly.total_spent_eur, weekly.weekly_budget_eur) : 0;

  if (daily.meal_count === 0) {
    return {
      title: "No meals logged yet today",
      body: "Log your first meal to restore forecast confidence and personalise recommendations.",
    };
  }
  if (proteinPct < 50) {
    return {
      title: "Protein is your highest-impact move today.",
      body: `You are at ${fmtNum(daily.total_protein, 0)} g of ${daily.protein_goal} g. A high-protein meal can close the gap by dinner.`,
    };
  }
  if (budgetPct > 85) {
    return {
      title: "Budget pressure detected this week.",
      body: `Weekly spend is at ${budgetPct}% of plan. Use efficiency swaps to preserve cost momentum.`,
    };
  }
  if (caloriePct < 60) {
    return {
      title: "Calories are trailing your target.",
      body: `You have logged ${fmtNum(daily.total_calories, 0)} kcal. A balanced meal can recenter today's plan.`,
    };
  }
  return {
    title: "You are on track today.",
    body: "Nutrition, protein and budget are all in healthy zones. Keep the momentum.",
  };
}

export function TodayIntelligence({
  daily,
  weekly,
  isLoading,
  onActOnCoach,
}: {
  daily?: DailySummary;
  weekly?: WeeklySummary;
  isLoading?: boolean;
  onActOnCoach?: () => void;
}) {
  const { title, body } = buildHeadline(daily, weekly);
  const readiness = daily
    ? Math.round(
        Math.min(pct(daily.total_protein, daily.protein_goal), 100) * 0.5 +
          Math.min(pct(daily.total_calories, daily.calorie_goal), 100) * 0.3 +
          (weekly ? Math.max(0, 100 - pct(weekly.total_spent_eur, weekly.weekly_budget_eur)) : 50) * 0.2,
      )
    : 0;

  return (
    <section className="glass-dark relative overflow-hidden rounded-3xl p-5 md:p-7">
      <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85 backdrop-blur">
              <Sparkles className="h-3 w-3" style={{ color: "var(--intel)" }} />
              Today Intelligence
            </span>
            <span className="text-[10.5px] text-white/55">
              Updated {new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <h2 className="mt-3 max-w-xl text-[22px] font-semibold leading-[1.15] tracking-tight text-white md:text-[28px]">
            {isLoading ? <span className="shimmer inline-block h-7 w-72 rounded" /> : title}
          </h2>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/70">{body}</p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            <StatusChip
              icon={<Flame className="h-3 w-3" />}
              label="Calories"
              value={daily ? `${fmtNum(daily.total_calories, 0)} / ${daily.calorie_goal}` : "-"}
            />
            <StatusChip
              icon={<Beef className="h-3 w-3" />}
              label="Protein"
              value={daily ? `${fmtNum(daily.total_protein, 0)} / ${daily.protein_goal} g` : "-"}
              accent="health"
            />
            <StatusChip
              icon={<Wallet className="h-3 w-3" />}
              label="Week spend"
              value={weekly ? fmtEur(weekly.total_spent_eur) : "-"}
              accent="cost"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onActOnCoach}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[color:var(--ink)] shadow-sm transition hover:bg-white/90"
            >
              <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--intel)" }} />
              Ask NutriMind
            </button>
            <button
              type="button"
              onClick={onActOnCoach}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[12px] font-medium text-white/85 transition hover:bg-white/10"
            >
              See recommended action
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center md:items-end">
          <ProgressRing value={readiness} size={132} stroke={10} accent="intel">
            <div className="tnum text-[28px] font-semibold leading-none text-white">{readiness}</div>
            <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Readiness
            </div>
          </ProgressRing>
          <div className="mt-2 text-[10.5px] text-white/55">Protein + calories + budget</div>
        </div>
      </div>
    </section>
  );
}

function StatusChip({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "health" | "cost" | "intel";
}) {
  const color = accent === "health" ? "var(--health)" : accent === "cost" ? "var(--cost)" : "var(--intel)";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur">
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full"
        style={{ background: `color-mix(in oklab, ${color} 25%, transparent)`, color }}
      >
        {icon}
      </span>
      <span className="text-white/55">{label}</span>
      <span className="tnum font-semibold text-white">{value}</span>
    </span>
  );
}
