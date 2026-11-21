import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type User } from "@/lib/api";
import { useCoachBriefing, useRecommendations, useRefreshUserData } from "@/hooks/useNutriQueries";
import { fmtEur } from "@/lib/format";
import { Receipt, Section, round } from "./parts";

export function Plan({ user }: { user?: User }) {
  const userId = user?.id;
  const refresh = useRefreshUserData();
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [budget, setBudget] = useState("");
  const [diet, setDiet] = useState("none");
  const [meals, setMeals] = useState("3");

  // Start from the profile's own goals: a week's budget split over seven days.
  useEffect(() => {
    if (!user) return;
    setKcal(String(user.calorie_goal));
    setProtein(String(user.protein_goal));
    setBudget((user.budget_weekly / 7).toFixed(2));
    setDiet(user.dietary_preference || "none");
  }, [user]);

  const plan = useMutation({
    mutationFn: () =>
      api.optimizeMealPlan({
        user_id: userId!,
        calorie_target: Number(kcal),
        protein_target: Number(protein),
        budget_eur: Number(budget),
        dietary_preference: diet,
        meals_per_day: Number(meals),
      }),
    onError: (e: Error) => toast.error(`Couldn't plan the day. ${e.message}`),
  });
  const day = plan.data;

  const recs = useRecommendations(userId);
  const regenerate = useMutation({
    mutationFn: () => api.generateRecommendations(userId!),
    onSuccess: () => refresh(userId),
    onError: (e: Error) => toast.error(`Couldn't refresh the swaps. ${e.message}`),
  });

  const coach = useCoachBriefing(userId).data;
  const [question, setQuestion] = useState("");
  const ask = useMutation({
    mutationFn: () => api.askCoach({ user_id: userId!, question: question.trim() }),
    onError: (e: Error) => toast.error(`The coach couldn't answer. ${e.message}`),
  });

  return (
    <>
      <Section
        ground="np-receipt-sec"
        page
        title="Plan a day inside your budget"
        intro="Set your targets. NutriMind picks from your pantry the cheapest day of meals that meets them."
        side={
          <form
            className="na-form"
            onSubmit={(e) => {
              e.preventDefault();
              plan.mutate();
            }}
          >
            <label>
              Calories (kcal)
              <input className="na-input" type="number" min="1" required value={kcal} onChange={(e) => setKcal(e.target.value)} />
            </label>
            <label>
              Protein (g)
              <input className="na-input" type="number" min="0" required value={protein} onChange={(e) => setProtein(e.target.value)} />
            </label>
            <label>
              Budget for the day (€)
              <input className="na-input" type="number" min="0" step="0.01" required value={budget} onChange={(e) => setBudget(e.target.value)} />
            </label>
            <div className="na-row">
              <label>
                Diet
                <select className="na-input" value={diet} onChange={(e) => setDiet(e.target.value)}>
                  <option value="none">No preference</option>
                  <option value="high-protein">High protein</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                </select>
              </label>
              <label>
                Meals
                <select className="na-input" value={meals} onChange={(e) => setMeals(e.target.value)}>
                  {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
            <button type="submit" className="np-btn" disabled={!userId || plan.isPending}>
              {plan.isPending ? "Planning…" : "Plan my day"}
            </button>
          </form>
        }
      >
        <div className="np-receipts">
          <Receipt
            title="Your day"
            lines={(day?.meals ?? []).map((m) => ({
              key: m.meal_type,
              name: (
                <>
                  <span style={{ textTransform: "capitalize" }}>{m.meal_type}</span>
                  <span className="np-food-pack">{m.items.map((i) => `${i.name} ${round(i.quantity_g)} g`).join(", ")}</span>
                </>
              ),
              qty: `${round(m.total_protein)} g`,
              amount: m.total_cost_eur,
            }))}
            empty="Set your targets and plan the day."
            total={day?.totals.cost_eur}
            note={day ? `Protein ${round(day.totals.protein)} g · ${round(day.totals.calories)} kcal` : undefined}
          />
          <Receipt
            title="Shopping list"
            lines={(day?.shopping_list ?? []).map((s) => ({ key: s.product_id, name: s.name, qty: `${round(s.quantity_g)} g`, amount: s.estimated_cost_eur }))}
            empty="Your shopping list appears here."
          />
        </div>
        {day ? (
          <>
            <p className="np-saving">
              {day.totals.cost_eur <= day.budget_eur
                ? `${fmtEur(day.budget_eur - day.totals.cost_eur)} under budget.`
                : `${fmtEur(day.totals.cost_eur - day.budget_eur)} over budget.`}
            </p>
            {day.warnings.map((w) => <p key={w} className="np-saving-note">{w}</p>)}
          </>
        ) : null}
      </Section>

      <Section
        ground="np-benefits"
        title="Swaps that save"
        side={
          <>
            <p className="np-note">Found by comparing the price of 100 g and the protein in it, across everything in your pantry.</p>
            <p className="np-hero-actions">
              <button type="button" className="na-text-btn" disabled={!userId || regenerate.isPending} onClick={() => regenerate.mutate()}>
                {regenerate.isPending ? "Looking again…" : "Look again"}
              </button>
            </p>
          </>
        }
      >
        <ul className="na-rows">
          {(recs.data?.recommendations ?? []).map((r) => (
            <li key={r.id}>
              <span>{r.message}</span>
              {(r.savings_eur ?? 0) > 0 ? <span className="na-chip num">Saves {fmtEur(r.savings_eur)}</span> : null}
            </li>
          ))}
          {recs.data && recs.data.recommendations.length === 0 ? <li>No swaps yet. Add prices to your pantry foods.</li> : null}
        </ul>
      </Section>

      <Section
        ground="na-white"
        title="Ask the coach"
        side={
          <form
            className="na-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (question.trim()) ask.mutate();
            }}
          >
            <label>
              Your question
              <input className="na-input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="How can I get more protein for less?" />
            </label>
            <button type="submit" className="na-ink-btn" disabled={!userId || !question.trim() || ask.isPending}>
              {ask.isPending ? "Thinking…" : "Ask"}
            </button>
          </form>
        }
      >
        {ask.data ? (
          <>
            <p className="np-standfirst" style={{ maxWidth: "46ch" }}>{ask.data.answer}</p>
            <ul className="na-rows na-sub">
              {ask.data.suggested_actions.map((a) => (
                <li key={a.title}>
                  <span>
                    {a.title}
                    <small>{a.impact}</small>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className="na-rows">
            {(coach?.talking_points ?? []).map((t) => <li key={t}>{t}</li>)}
          </ul>
        )}
      </Section>
    </>
  );
}
