import type { CSSProperties } from "react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { useCoachBriefing, useDaily, useHistory, useRecommendations, useSpending, useWeekly } from "@/hooks/useNutriQueries";
import { fmtEur } from "@/lib/format";
import { Meter, Receipt, Section, Stack, round, weekday } from "./parts";

// The ticker keeps the headline's own type and colour.
const TICK = "tracking-[inherit] text-inherit";

// Answers one question first: am I on track for protein today, and how much budget is left?
export function Today({ userId, onLog, onSeeSwaps }: { userId?: number; onLog: () => void; onSeeSwaps: () => void }) {
  const daily = useDaily(userId).data;
  const weekly = useWeekly(userId).data;
  const history = useHistory(userId).data ?? [];
  const spending = useSpending(userId).data?.history ?? [];
  const recs = useRecommendations(userId).data?.recommendations ?? [];
  const coach = useCoachBriefing(userId).data;

  const now = new Date();
  const meals = history.filter((m) => new Date(m.logged_at).toDateString() === now.toDateString());
  // Every figure is the sum of the rows on screen, so the receipts always add up.
  const protein = meals.reduce((s, m) => s + m.total_protein, 0);
  const kcal = meals.reduce((s, m) => s + m.total_calories, 0);
  const carbs = meals.reduce((s, m) => s + m.total_carbs, 0);
  const fat = meals.reduce((s, m) => s + m.total_fat, 0);
  const days = spending.filter((d) => !weekly || d.date >= weekly.week_start).sort((a, b) => a.date.localeCompare(b.date));
  const weekSpent = days.reduce((s, d) => s + d.spent, 0);
  const budget = weekly?.weekly_budget_eur;
  const left = budget !== undefined ? budget - weekSpent : undefined;
  const toGo = daily ? Math.max(0, daily.protein_goal - protein) : undefined;
  const swap = recs.filter((r) => r.type === "substitution" && (r.savings_eur ?? 0) > 0).sort((a, b) => (b.savings_eur ?? 0) - (a.savings_eur ?? 0))[0];

  return (
    <>
      <div className="na-hero">
        <div data-reveal>
          <p className="np-standfirst">
            {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.{" "}
            {!daily
              ? "Loading your day."
              : meals.length === 0
                ? `Nothing logged yet. Your goal is ${daily.protein_goal} g of protein and ${round(daily.calorie_goal)} kcal.`
                : `${round(protein)} g of protein and ${round(kcal)} kcal logged across ${meals.length} ${meals.length === 1 ? "meal" : "meals"}.`}
          </p>
          <p className="np-hero-actions">
            <button type="button" className="na-text-btn" onClick={onLog}>Log a meal</button>
          </p>
        </div>
        <div data-reveal style={{ "--d": "80ms" } as CSSProperties}>
          {/* The label carries the final figures; the visible ones count up. */}
          <h1 className="np-h1" aria-label={`${toGo === undefined ? "Today." : toGo > 0 ? `${round(toGo)} g to go.` : "Goal reached."} ${left === undefined ? "" : left >= 0 ? `${fmtEur(left)} left.` : `${fmtEur(-left)} over.`}`}>
            <span aria-hidden>{toGo === undefined ? "Today." : toGo > 0 ? <><NumberTicker className={TICK} value={Math.round(toGo)} /> g to go.</> : "Goal reached."}</span>
            <span aria-hidden>{left === undefined ? "" : <>€<NumberTicker className={TICK} value={Math.abs(left)} decimalPlaces={2} /> {left >= 0 ? "left." : "over."}</>}</span>
          </h1>
        </div>
      </div>

      <Section
        ground="np-receipt-sec"
        title="Today's receipt"
        intro="What you ate today and what the week has cost so far, against your own goals and budget."
        side={
          <>
            <p className="np-side-title">Your goals</p>
            <ul className="na-meters">
              <Meter label="Protein" value={protein} goal={daily?.protein_goal} text={`${round(protein)} of ${daily?.protein_goal ?? "—"} g`} />
              <Meter label="Calories" value={kcal} goal={daily?.calorie_goal} text={`${round(kcal)} of ${daily ? round(daily.calorie_goal) : "—"} kcal`} />
              <Meter label="Week's budget" value={weekSpent} goal={budget} text={`${fmtEur(weekSpent)} of ${fmtEur(budget)}`} />
            </ul>
            {/* 4 kcal in a gram of protein or carbohydrate, 9 in a gram of fat */}
            <Stack
              label="Where today's calories come from"
              parts={[
                { name: "Protein", value: protein * 4, text: `${round(protein)} g` },
                { name: "Carbs", value: carbs * 4, text: `${round(carbs)} g` },
                { name: "Fat", value: fat * 9, text: `${round(fat)} g` },
              ]}
            />
          </>
        }
      >
        <div className="np-receipts">
          <Receipt
            title="Today"
            lines={meals.map((m) => ({ key: m.id, name: m.name, qty: `${round(m.total_protein)} g`, amount: m.total_cost_eur }))}
            empty={
              <>
                No meals yet. <button type="button" className="na-text-btn" onClick={onLog}>Log your first meal</button>
              </>
            }
            note={`Protein ${round(protein)} g · ${round(kcal)} kcal`}
          />
          <Receipt
            title="This week"
            lines={days.map((d) => ({ key: d.date, name: weekday(d.date), qty: `${d.meals} ${d.meals === 1 ? "meal" : "meals"}`, amount: d.spent }))}
            empty="No spending logged this week."
            note={`Budget ${fmtEur(budget)} · left ${fmtEur(left)}`}
          />
        </div>
        {swap ? (
          <>
            <p className="np-saving">Save {fmtEur(swap.savings_eur)} on your next shop.</p>
            <p className="np-saving-note">
              Swap {swap.source_product_name} for {swap.suggested_product_name} and keep the protein.{" "}
              <button type="button" className="na-text-btn" onClick={onSeeSwaps}>See all swaps</button>
            </p>
          </>
        ) : null}
      </Section>

      <Section
        ground="na-white"
        title="Next steps"
        side={<p className="np-note">{coach?.headline ?? "Your coach reads the last 30 days and picks what matters most."}</p>}
      >
        <ol className="na-cols">
          {(coach?.action_plan ?? []).slice(0, 3).map((a) => (
            <li key={a.title}>
              <h3>{a.title}</h3>
              <p>{a.impact}</p>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
