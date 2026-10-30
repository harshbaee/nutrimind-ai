import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Lightbulb, Loader2, RefreshCcw, Sparkles, TrendingDown } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type RecommendationItem } from "@/lib/api";
import { fmtEur } from "@/lib/format";
import { useRecommendations, useRefreshUserData } from "@/hooks/useNutriQueries";
import { ErrorBanner } from "./ErrorBanner";

const labelByType: Record<string, string> = {
  substitution: "Substitution",
  expensive_food: "Cost flag",
  budget_alert: "Budget",
  protein_alert: "Protein",
  efficiency_tip: "Efficiency",
};

function typeIcon(type: string) {
  if (type === "substitution") return <TrendingDown className="h-3.5 w-3.5" />;
  if (type === "budget_alert" || type === "expensive_food") return <AlertTriangle className="h-3.5 w-3.5" />;
  if (type === "protein_alert") return <Sparkles className="h-3.5 w-3.5" />;
  return <Lightbulb className="h-3.5 w-3.5" />;
}

function typeTone(type: string) {
  if (type === "substitution" || type === "efficiency_tip") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (type === "budget_alert" || type === "expensive_food") return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function RecommendationRow({ item }: { item: RecommendationItem }) {
  return (
    <li className="rounded-md border px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Badge variant="outline" className={`h-6 gap-1.5 px-2 text-[10px] uppercase ${typeTone(item.type)}`}>
          {typeIcon(item.type)}
          {labelByType[item.type] ?? item.type}
        </Badge>
        {item.savings_eur && item.savings_eur > 0 ? (
          <span className="text-xs font-semibold text-emerald-700">{fmtEur(item.savings_eur)} saved</span>
        ) : null}
      </div>
      <p className="text-sm leading-5 text-foreground">{item.message}</p>
      {(item.source_product_name || item.suggested_product_name) && (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {item.source_product_name ? <span>From: {item.source_product_name}</span> : null}
          {item.suggested_product_name ? <span>Try: {item.suggested_product_name}</span> : null}
        </div>
      )}
    </li>
  );
}

export function RecommendationCards({ userId }: { userId?: number }) {
  const { data, isLoading, error } = useRecommendations(userId);
  const refresh = useRefreshUserData();

  const generate = useMutation({
    mutationFn: () => api.generateRecommendations(userId!),
    onSuccess: () => {
      toast.success("Recommendations refreshed");
      refresh(userId);
    },
    onError: (e: Error) => toast.error(`Recommendation refresh failed: ${e.message}`),
  });

  const items = data?.recommendations ?? [];

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">AI recommendations</CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!userId || generate.isPending}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? <ErrorBanner error={error} /> : null}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Log meals and save priced products to generate recommendations.
          </div>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {items.slice(0, 6).map((item) => (
              <RecommendationRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
