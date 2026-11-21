import { useState, type RefObject } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type MealHistoryItem } from "@/lib/api";
import { useHistory, useRefreshUserData, useSaved } from "@/hooks/useNutriQueries";
import { fmtEur } from "@/lib/format";
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

  // Past meals work as templates: the latest of each name, logged again in one tap.
  const history = useHistory(userId).data ?? [];
  const recent = history.filter((m, i) => history.findIndex((x) => x.name === m.name) === i).slice(0, 4);
  const again = useMutation({
    mutationFn: (m: MealHistoryItem) => api.repeatMeal(m.id),
    onSuccess: (_, m) => {
      toast.success(`${m.name} logged again`);
      refresh(userId);
      dialog.current?.close();
    },
    onError: (e: Error) => toast.error(`Couldn't log that meal again. ${e.message}`),
  });

  // A meal photo: the AI model names the foods and guesses grams; pantry matches land on the receipt to check.
  const [notInPantry, setNotInPantry] = useState<string[]>([]);
  const photo = useMutation({
    mutationFn: async (file: File) => api.mealPhoto(await shrinkPhoto(file)),
    onSuccess: ({ foods: seen }) => {
      const matched = seen.filter((f) => f.product_id !== null);
      setItems((prev) => [...prev, ...matched.map((f) => ({ product_id: f.product_id!, quantity_g: f.grams }))]);
      setNotInPantry(seen.filter((f) => f.product_id === null).map((f) => f.name));
      toast[matched.length ? "success" : "info"](
        matched.length ? `Added ${matched.length} ${matched.length === 1 ? "food" : "foods"} from the photo. Check the amounts.` : "No foods from your pantry in that photo.",
      );
    },
    onError: (e: Error) =>
      toast.error(e.message.startsWith("503") ? "Photo recognition isn't set up yet. Add the AI model's key first." : `Couldn't read the photo. ${e.message}`),
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

      {recent.length ? (
        <section className="na-again" aria-labelledby="again-title">
          <h3 id="again-title">Eat it again</h3>
          <ul className="na-rows">
            {recent.map((m) => (
              <li key={m.id}>
                <span>
                  {m.name}
                  <small className="num">{round(m.total_protein)} g protein · {fmtEur(m.total_cost_eur)}</small>
                </span>
                <button type="button" className="na-ink-btn" disabled={!userId || again.isPending} onClick={() => again.mutate(m)}>
                  Log again
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="na-sub">
        <label className="na-text-btn">
          {photo.isPending ? "Reading the photo…" : "From a photo"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={photo.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // lets the same photo be picked again
              if (file) photo.mutate(file);
            }}
          />
        </label>
      </p>
      {notInPantry.length ? (
        <p className="na-caption">Not in your pantry, so not added: {notInPantry.join(", ")}. Add them on the Pantry screen first.</p>
      ) : null}

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

// Phone photos are several MB; 1024 px on the long side is plenty to recognise food and keeps the upload small.
async function shrinkPhoto(file: File, longSide = 1024): Promise<string> {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, longSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}
