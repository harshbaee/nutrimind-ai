import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Loader2 } from "lucide-react";
import { api, type FoodSearchResult } from "@/lib/api";
import { toast } from "sonner";
import { useRefreshUserData } from "@/hooks/useNutriQueries";
import { ErrorBanner } from "./ErrorBanner";

export function FoodSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const refresh = useRefreshUserData();

  const search = useMutation({
    mutationFn: (q: string) => api.searchFood(q),
    onSuccess: (data) => setResults(data.results ?? []),
    onError: (e: Error) => toast.error(`Search failed: ${e.message}`),
  });

  const save = useMutation({
    mutationFn: (r: FoodSearchResult) =>
      api.saveProduct({
        barcode: r.barcode,
        name: r.name,
        brand: r.brand ?? null,
        calories_per_100g: r.calories_per_100g,
        protein_per_100g: r.protein_per_100g,
        carbs_per_100g: r.carbs_per_100g,
        fat_per_100g: r.fat_per_100g,
        serving_size_g: r.serving_size_g ?? undefined,
        category: r.category ?? null,
      }),
    onSuccess: (p) => {
      toast.success(`Saved: ${p.product?.name ?? "product"}`);
      refresh();
    },
    onError: (e: Error) => toast.error(`Save failed: ${e.message}`),
  });

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Food search</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) search.mutate(query.trim());
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products (e.g. chicken, skyr...)"
            className="h-9 rounded-md"
          />
          <Button type="submit" size="sm" disabled={search.isPending || !query.trim()}>
            {search.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>
        {search.error ? <ErrorBanner error={search.error} title="Search failed" /> : null}
        <div className="max-h-[360px] divide-y overflow-y-auto rounded-md border">
          {results.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {search.isPending ? "Searching..." : "Enter a query to search the food database."}
            </div>
          ) : (
            results.map((r) => (
              <div key={r.barcode} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    {r.nutriscore ? (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px] uppercase">
                        {r.nutriscore}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.brand ?? "—"} · {r.category ?? "—"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>{r.calories_per_100g?.toFixed(0)} kcal</span>
                    <span className="text-emerald-600">P {r.protein_per_100g?.toFixed(1)}g</span>
                    <span>C {r.carbs_per_100g?.toFixed(1)}g</span>
                    <span>F {r.fat_per_100g?.toFixed(1)}g</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => save.mutate(r)}
                  disabled={save.isPending}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Save
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
