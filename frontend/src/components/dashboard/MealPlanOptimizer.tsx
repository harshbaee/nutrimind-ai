import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calculator, Loader2, RefreshCcw, ShoppingBasket, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type OptimizationResponse } from "@/lib/api";
import { fmtEur, fmtNum } from "@/lib/format";
import { useDaily, useWeekly } from "@/hooks/useNutriQueries";

export function MealPlanOptimizer({ userId }: { userId?: number }) {
  const { data: daily } = useDaily(userId);
  const { data: weekly } = useWeekly(userId);
  const [calorieTarget, setCalorieTarget] = useState("2200");
  const [proteinTarget, setProteinTarget] = useState("160");
  const [budget, setBudget] = useState("8");
  const [dietaryPreference, setDietaryPreference] = useState("high-protein");
  const [mealsPerDay, setMealsPerDay] = useState("3");
  const [plan, setPlan] = useState<OptimizationResponse | null>(null);

  useEffect(() => {
    if (daily?.calorie_goal) setCalorieTarget(String(daily.calorie_goal));
    if (daily?.protein_goal) setProteinTarget(String(daily.protein_goal));
    if (weekly?.weekly_budget_eur) setBudget(String(Math.max(1, weekly.weekly_budget_eur / 7).toFixed(2)));
  }, [daily?.calorie_goal, daily?.protein_goal, weekly?.weekly_budget_eur]);

  const optimize = useMutation({
    mutationFn: () =>
      api.optimizeMealPlan({
        user_id: userId!,
        calorie_target: parseInt(calorieTarget, 10),
        protein_target: parseFloat(proteinTarget),
        budget_eur: parseFloat(budget),
        dietary_preference: dietaryPreference,
        meals_per_day: parseInt(mealsPerDay, 10),
        max_items: 8,
      }),
    onSuccess: (data) => {
      setPlan(data);
      toast.success("Meal plan optimised");
    },
    onError: (e: Error) => toast.error(`Optimisation failed: ${e.message}`),
  });

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            Meal plan optimiser
          </CardTitle>
          {plan ? (
            <Badge variant="outline" className="h-6 text-[10px] uppercase">
              {plan.status}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-5">
          <Input
            type="number"
            min="1"
            value={calorieTarget}
            onChange={(event) => setCalorieTarget(event.target.value)}
            aria-label="Calorie target"
          />
          <Input
            type="number"
            min="0"
            value={proteinTarget}
            onChange={(event) => setProteinTarget(event.target.value)}
            aria-label="Protein target"
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            aria-label="Daily budget"
          />
          <Select value={dietaryPreference} onValueChange={setDietaryPreference}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high-protein">High protein</SelectItem>
              <SelectItem value="none">No preference</SelectItem>
              <SelectItem value="vegetarian">Vegetarian</SelectItem>
              <SelectItem value="vegan">Vegan</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Select value={mealsPerDay} onValueChange={setMealsPerDay}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 meals</SelectItem>
                <SelectItem value="3">3 meals</SelectItem>
                <SelectItem value="4">4 meals</SelectItem>
                <SelectItem value="5">5 meals</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="shrink-0"
              disabled={!userId || optimize.isPending}
              onClick={() => optimize.mutate()}
            >
              {optimize.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-2 h-4 w-4" />
              )}
              Run
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Calories" value={fmtNum(plan?.totals.calories, 0)} sub={`target ${calorieTarget}`} />
          <Metric label="Protein" value={`${fmtNum(plan?.totals.protein, 1)} g`} sub={`target ${proteinTarget} g`} />
          <Metric label="Cost" value={fmtEur(plan?.totals.cost_eur)} sub={`budget ${fmtEur(parseFloat(budget))}`} />
          <Metric label="Items" value={fmtNum(plan?.items.length, 0)} sub={`${mealsPerDay} planned meals`} />
        </div>

        {plan?.warnings.length ? (
          <Alert>
            <AlertDescription className="space-y-1 text-xs">
              {plan.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}

        {plan ? (
          <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
            <div className="grid gap-3 md:grid-cols-3">
              {plan.meals.map((meal) => (
                <div key={meal.meal_type} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold capitalize">{meal.meal_type}</div>
                    <span className="text-xs text-orange-600">{fmtEur(meal.total_cost_eur)}</span>
                  </div>
                  <div className="mb-2 text-xs text-muted-foreground">
                    {fmtNum(meal.total_calories, 0)} kcal · P {fmtNum(meal.total_protein, 1)}g
                  </div>
                  <ul className="space-y-1.5">
                    {meal.items.map((item) => (
                      <li key={`${meal.meal_type}-${item.product_id}`} className="text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="min-w-0 truncate">{item.name}</span>
                          <span className="shrink-0 text-muted-foreground">{fmtNum(item.quantity_g, 0)}g</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ShoppingBasket className="h-4 w-4 text-emerald-600" />
                Shopping list
              </div>
              <ul className="space-y-2">
                {plan.shopping_list.map((item) => (
                  <li key={item.product_id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {fmtNum(item.quantity_g, 0)}g · {fmtEur(item.estimated_cost_eur)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
            Run the optimiser to generate a macro-balanced, budget-aware plan.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-[10px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
