import { useState, type RefObject } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRefreshUserData, useSaved } from "@/hooks/useNutriQueries";
import { Receipt, round } from "./parts";

// The most frequent job: a side panel where the meal builds up as a receipt before it is logged.
export function LogMeal({ dialog, userId }: { dialog: RefObject<HTMLDialogElement | null>; userId?: number }) {
  const foods = useSaved().data ?? [];
  const refresh = useRefreshUserData();
  const [name, setName] = useState("");
  const [type, setType] = useState("lunch");
  const [foodId, setFoodId] = useState("");
  const [grams, setGrams] = useState("100");
  const [items, setItems] = useState<{ product_id: number; quantity_g: number }[]>([]);

  const log = useMutation({
    mutationFn: () => api.logMeal({ user_id: userId!, name: name.trim() || "Meal", meal_type: type, items }),
    onSuccess: () => {
      toast.success("Meal logged");
      setName("");
      setItems([]);
      refresh(userId);
      dialog.current?.close();
    },
    onError: (e: Error) => toast.error(`Couldn't log the meal. ${e.message}`),
  });

  const lines = items.map((it, i) => {
    const f = foods.find((p) => p.id === it.product_id);
    const cost = f?.estimated_price_eur && f.serving_size_g ? (f.estimated_price_eur / f.serving_size_g) * it.quantity_g : null;
    return { i, f, it, cost, protein: ((f?.protein_per_100g ?? 0) * it.quantity_g) / 100, kcal: ((f?.calories_per_100g ?? 0) * it.quantity_g) / 100 };
  });

  return (
    <dialog ref={dialog} className="na-dialog" aria-labelledby="log-title">
      <div className="na-dialog-head">
        <h2 id="log-title" className="np-h2">Log a meal</h2>
        <button type="button" className="na-text-btn" onClick={() => dialog.current?.close()}>Close</button>
      </div>

      <form
        className="na-form"
        onSubmit={(e) => {
          e.preventDefault();
          const q = Number(grams);
          // The backend caps one item at 5 kg.
          if (!foodId || !(q > 0) || q > 5000) return;
          setItems((prev) => [...prev, { product_id: Number(foodId), quantity_g: q }]);
          setFoodId("");
          setGrams("100");
        }}
      >
        <div className="na-row">
          <label>
            Meal name
            <input className="na-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chicken and rice" />
          </label>
          <label>
            Type
            <select className="na-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </label>
        </div>
        <div className="na-row">
          <label>
            Food from your pantry
            <select className="na-input" value={foodId} onChange={(e) => setFoodId(e.target.value)}>
              <option value="">Choose a food</option>
              {foods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label style={{ flex: "0 0 9ch" }}>
            Grams
            <input className="na-input" type="number" min="1" max="5000" value={grams} onChange={(e) => setGrams(e.target.value)} />
          </label>
          <button type="submit" className="na-ink-btn" disabled={!foodId}>Add</button>
        </div>
      </form>

      <Receipt
        title={name.trim() || "Your meal"}
        lines={lines.map((l) => ({
          key: l.i,
          name: (
            <>
              {l.f?.name ?? "Food"}{" "}
              <button type="button" className="na-text-btn" aria-label={`Remove ${l.f?.name ?? "food"}`} onClick={() => setItems((prev) => prev.filter((_, k) => k !== l.i))}>
                remove
              </button>
            </>
          ),
          qty: `${round(l.it.quantity_g)} g`,
          amount: l.cost,
        }))}
        empty="Add the foods in this meal."
        note={`Protein ${round(lines.reduce((s, l) => s + l.protein, 0))} g · ${round(lines.reduce((s, l) => s + l.kcal, 0))} kcal`}
      />

      <button type="button" className="np-btn" style={{ marginTop: 24, width: "100%" }} disabled={!userId || items.length === 0 || log.isPending} onClick={() => log.mutate()}>
        {log.isPending ? "Logging…" : "Log meal"}
      </button>
    </dialog>
  );
}
