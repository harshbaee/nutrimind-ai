import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useBehaviour, useDaily, useGamification, useHistory, usePredictive, useRefreshUserData, useSpending, useWeekly } from "@/hooks/useNutriQueries";
import { fmtEur } from "@/lib/format";
import { Columns, Section, round, shortDate } from "./parts";

export function Progress({ userId }: { userId?: number }) {
  const refresh = useRefreshUserData();
  const days = (useSpending(userId).data?.history ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const habits = useBehaviour(userId).data;
  const game = useGamification(userId).data;
  const forecast = usePredictive(userId).data;
  const weekly = useWeekly(userId).data;
  const meals = useHistory(userId).data ?? [];
  const proteinGoal = useDaily(userId).data?.protein_goal;
  const dayBudget = weekly ? weekly.weekly_budget_eur / 7 : undefined;
  const dayOfMonth = (iso: string) => String(new Date(iso).getDate());
  const span = days.length ? `${shortDate(days[0].date)} to ${shortDate(days[days.length - 1].date)}` : "";
  const within = dayBudget !== undefined ? days.filter((d) => d.spent <= dayBudget).length : undefined;
  const reached = proteinGoal !== undefined ? days.filter((d) => d.protein >= proteinGoal).length : undefined;

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteMeal(id),
    onSuccess: () => refresh(userId),
    onError: (e: Error) => toast.error(`Couldn't delete that meal. ${e.message}`),
  });

  return (
    <>
      <Section
        page
        title="Your last 30 days"
        intro="What each logged day cost and how much protein it carried."
        side={
          <dl className="na-figs num">
            <div>
              <dt>Days logged</dt>
              <dd>{habits ? habits.days_logged : "—"} <small>of {habits?.days_considered ?? 30}</small></dd>
            </div>
            <div>
              <dt>Logging streak</dt>
              <dd>{game ? game.current_logging_streak : "—"} <small>{game?.current_logging_streak === 1 ? "day" : "days"}, best {game?.best_logging_streak ?? "—"}</small></dd>
            </div>
            <div>
              <dt>On your goals</dt>
              <dd>{habits ? `${round(habits.overall_adherence_score)}%` : "—"} <small>across protein, calories and budget</small></dd>
            </div>
          </dl>
        }
      >
        <div className="na-two">
          <div>
            <h3>Spending per day</h3>
            <Columns
              rows={days.map((d) => ({ key: d.date, label: dayOfMonth(d.date), value: d.spent, text: fmtEur(d.spent) }))}
              target={dayBudget}
              targetText={`${fmtEur(dayBudget)} a day`}
              good="under"
              missText="over your daily budget"
            />
            <p className="na-caption">{span}. {within !== undefined ? `${within} of ${days.length} days stayed inside your budget; coral days went over.` : ""}</p>
          </div>
          <div>
            <h3>Protein per day</h3>
            <Columns
              rows={days.map((d) => ({ key: d.date, label: dayOfMonth(d.date), value: d.protein, text: `${round(d.protein)} g` }))}
              target={proteinGoal}
              targetText={`${proteinGoal} g goal`}
              good="over"
              missText="below your protein goal"
            />
            <p className="na-caption">{span}. {reached !== undefined ? `${reached} of ${days.length} days reached your goal; coral days fell short.` : ""}</p>
          </div>
        </div>
      </Section>

      <Section
        ground="np-benefits"
        title="Next week, forecast"
        side={
          <dl className="na-figs num">
            <div>
              <dt>Spending</dt>
              <dd>{fmtEur(forecast?.predicted_weekly_cost_eur)} <small>of your {fmtEur(weekly?.weekly_budget_eur)} budget</small></dd>
            </div>
            <div>
              <dt>Protein</dt>
              <dd>{forecast ? `${round(forecast.predicted_weekly_protein)} g` : "—"} <small>over the week</small></dd>
            </div>
            <div>
              <dt>Calories</dt>
              <dd>{forecast ? round(forecast.predicted_avg_daily_calories) : "—"} <small>kcal a day</small></dd>
            </div>
          </dl>
        }
      >
        <ul className="na-rows">
          {[...(forecast?.insights ?? []), ...(habits?.insights ?? [])].map((i) => <li key={i.message}>{i.message}</li>)}
        </ul>
        <h3 className="na-sub">This week's challenges</h3>
        <ul className="na-rows" style={{ marginTop: 16 }}>
          {(game?.challenges ?? []).map((c) => (
            <li key={c.id}>
              <span>
                {c.title}
                <small>{c.description}</small>
              </span>
              <span className="na-chip num">{round(c.progress)} of {round(c.target)} {c.unit}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section ground="na-white" title="Meal log" side={<p className="np-note">Your most recent meals. Delete one if you logged it by mistake; your totals update straight away.</p>}>
        <div className="na-scroll">
          <table className="na-table">
            <thead>
              <tr>
                <th>Meal</th>
                <th>When</th>
                <th className="r">kcal</th>
                <th className="r">Protein</th>
                <th className="r">Cost</th>
                <th className="r"><span className="sr-only">Delete</span></th>
              </tr>
            </thead>
            <tbody className="num">
              {meals.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{shortDate(m.logged_at)}</td>
                  <td className="r">{round(m.total_calories)}</td>
                  <td className="r">{round(m.total_protein)} g</td>
                  <td className="r">{fmtEur(m.total_cost_eur)}</td>
                  <td className="r">
                    <button
                      type="button"
                      className="na-text-btn"
                      aria-label={`Delete ${m.name}`}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete "${m.name}"? This can't be undone.`)) remove.mutate(m.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
