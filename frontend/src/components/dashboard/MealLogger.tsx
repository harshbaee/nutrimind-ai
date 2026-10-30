import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { useSaved, useRefreshUserData } from "@/hooks/useNutriQueries";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Item = { product_id: number; quantity_g: number };

export function MealLogger({ userId }: { userId?: number }) {
  const { data: saved } = useSaved();
  const refresh = useRefreshUserData();
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState("lunch");
  const [items, setItems] = useState<Item[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [qty, setQty] = useState("100");

  const log = useMutation({
    mutationFn: () =>
      api.logMeal({
        user_id: userId!,
        name: name.trim() || "Unnamed meal",
        meal_type: mealType,
        items,
      }),
    onSuccess: () => {
      toast.success("Meal logged");
      setName("");
      setItems([]);
      refresh(userId);
    },
    onError: (e: Error) => toast.error(`Log failed: ${e.message}`),
  });

  function addItem() {
    const pid = parseInt(selectedProduct, 10);
    const q = parseFloat(qty);
    if (!pid || !q || isNaN(q)) return;
    setItems((prev) => [...prev, { product_id: pid, quantity_g: q }]);
    setQty("100");
    setSelectedProduct("");
  }

  const productById = (id: number) => saved?.find((p) => p.id === id);

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Log a meal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Meal name"
            className="h-9"
          />
          <Select value={mealType} onValueChange={setMealType}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="breakfast">Breakfast</SelectItem>
              <SelectItem value="lunch">Lunch</SelectItem>
              <SelectItem value="dinner">Dinner</SelectItem>
              <SelectItem value="snack">Snack</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="h-9 flex-1">
              <SelectValue placeholder="Select saved product..." />
            </SelectTrigger>
            <SelectContent>
              {(saved ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
              {(saved?.length ?? 0) === 0 ? (
                <div className="p-2 text-xs text-muted-foreground">No saved products yet</div>
              ) : null}
            </SelectContent>
          </Select>
          <Input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            type="number"
            className="h-9 w-24"
            placeholder="g"
          />
          <Button size="sm" variant="outline" onClick={addItem} disabled={!selectedProduct}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="rounded-md border">
          {items.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              No items added yet
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((it, idx) => {
                const p = productById(it.product_id);
                return (
                  <li key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p?.name ?? `#${it.product_id}`}</div>
                      <div className="text-xs text-muted-foreground">{it.quantity_g} g</div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Button
          className="w-full"
          size="sm"
          disabled={!userId || items.length === 0 || log.isPending}
          onClick={() => log.mutate()}
        >
          {log.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Log meal
        </Button>
      </CardContent>
    </Card>
  );
}
