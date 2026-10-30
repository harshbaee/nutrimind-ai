import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRankings } from "@/hooks/useNutriQueries";
import { ErrorBanner } from "./ErrorBanner";
import { fmtEur } from "@/lib/format";

export function RankingsList() {
  const { data, isLoading, error } = useRankings();
  const items = data?.rankings ?? [];

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Protein efficiency rankings</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? <ErrorBanner error={error} /> : null}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">No rankings yet</div>
        ) : (
          <ol className="space-y-1.5">
            {items.map((r, i) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-xs font-semibold text-emerald-700">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.brand ?? "—"} · {r.protein_per_100g.toFixed(1)}g protein/100g · {fmtEur(r.price_eur)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">
                    {r.protein_efficiency_score.toFixed(2)}
                  </Badge>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {r.calories_per_euro.toFixed(0)} kcal/€
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
