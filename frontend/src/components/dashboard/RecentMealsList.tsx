import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { useHistory, useRefreshUserData } from "@/hooks/useNutriQueries";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ErrorBanner } from "./ErrorBanner";
import { fmtDateTime, fmtEur } from "@/lib/format";

export function RecentMealsList({ userId }: { userId?: number }) {
  const { data, isLoading, error } = useHistory(userId);
  const refresh = useRefreshUserData();
  const del = useMutation({
    mutationFn: (id: number) => api.deleteMeal(id),
    onSuccess: () => {
      toast.success("Meal deleted");
      refresh(userId);
    },
    onError: (e: Error) => toast.error(`Delete failed: ${e.message}`),
  });

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Recent meals</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? <ErrorBanner error={error} /> : null}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">No meals logged yet</div>
        ) : (
          <ul className="space-y-2">
            {data!.map((m) => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium">{m.name}</div>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase">
                      {m.meal_type}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {fmtDateTime(m.logged_at)}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    <span>{m.total_calories?.toFixed(0)} kcal</span>
                    <span className="text-emerald-600">P {m.total_protein?.toFixed(1)}g</span>
                    <span>C {m.total_carbs?.toFixed(1)}g</span>
                    <span>F {m.total_fat?.toFixed(1)}g</span>
                    <span className="text-orange-600">{fmtEur(m.total_cost_eur)}</span>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => del.mutate(m.id)}
                  disabled={del.isPending}
                >
                  {del.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
