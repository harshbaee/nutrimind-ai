import { Fragment, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type FoodSearchResult, type SavedProduct } from "@/lib/api";
import { useRefreshUserData, useSaved, useShoppingList } from "@/hooks/useNutriQueries";
import { fmtEur } from "@/lib/format";
import { Receipt, Section, round, shortDate } from "./parts";
import { Scanner, canScan } from "./Scanner";

const BARCODE = /^\d{6,14}$/;

// Same formula as the backend: protein per 100 g divided by the cost of 100 g.
const proteinPerEuro = (p: SavedProduct) =>
  p.estimated_price_eur && p.serving_size_g ? p.protein_per_100g / ((p.estimated_price_eur / p.serving_size_g) * 100) : undefined;

export function Pantry({ userId }: { userId?: number }) {
  const refresh = useRefreshUserData();
  const foods = (useSaved().data ?? []).slice().sort((a, b) => (proteinPerEuro(b) ?? -1) - (proteinPerEuro(a) ?? -1));
  const best = foods[0];

  const [editing, setEditing] = useState<number>();
  const [price, setPrice] = useState("");
  const [pack, setPack] = useState("");
  const save = useMutation({
    mutationFn: () => api.updatePrice(editing!, { estimated_price_eur: Number(price), ...(Number(pack) > 0 ? { serving_size_g: Number(pack) } : {}) }),
    onSuccess: () => {
      setEditing(undefined);
      refresh(userId);
    },
    onError: (e: Error) => toast.error(`Couldn't save the price. ${e.message}`),
  });

  const [query, setQuery] = useState("");
  const search = useMutation({
    mutationFn: () => api.searchFood(query.trim()),
    onError: (e: Error) => toast.error(`Search didn't work. ${e.message}`),
  });

  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanOk, setScanOk] = useState(false);
  useEffect(() => setScanOk(canScan()), []); // after hydration: the server can't know the browser's features
  const lookup = useMutation({
    mutationFn: (c: string) => api.barcode(c),
    onError: (e: Error, c) =>
      toast.error(e.message.startsWith("404") ? `No food found for barcode ${c}.` : `Barcode lookup didn't work. ${e.message}`),
  });
  const findBarcode = (c: string) => {
    search.reset();
    lookup.mutate(c);
  };
  const results = lookup.data ? [lookup.data] : (search.data?.results ?? []);

  const shop = useShoppingList(userId).data;

  // Shelf prices for one food at a time, from Open Food Facts' crowd-sourced Open Prices.
  const [comparing, setComparing] = useState<number>();
  const prices = useQuery({
    queryKey: ["prices", comparing],
    queryFn: () => api.comparePrices(comparing!),
    enabled: comparing !== undefined,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  const adoptPrice = useMutation({
    mutationFn: ({ id, price }: { id: number; price: number }) => api.updatePrice(id, { estimated_price_eur: price }),
    onSuccess: () => {
      toast.success("Price updated");
      refresh(userId);
      prices.refetch();
    },
    onError: (e: Error) => toast.error(`Couldn't save the price. ${e.message}`),
  });
  const add = useMutation({
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
    onSuccess: (res) => {
      toast.success(`${res.product.name} added. Set its price to rank it.`);
      refresh(userId);
    },
    onError: (e: Error) => toast.error(`Couldn't add that food. ${e.message}`),
  });

  return (
    <>
      <Section
        page
        title="Your pantry"
        intro="Every food you buy, ranked by how much protein a euro of it gets you. Keep the prices current and the ranking stays honest."
        side={
          best && proteinPerEuro(best) ? (
            <dl className="na-figs">
              <div>
                <dt>Best value right now</dt>
                <dd>
                  {round(proteinPerEuro(best)!)} g <small>of protein per euro, from {best.name}</small>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="np-note">Add a food and its price to see what a euro buys.</p>
          )
        }
      >
        <div className="na-scroll">
          <table className="na-table">
            <thead>
              <tr>
                <th>Food</th>
                <th className="r">Pack</th>
                <th className="r">Price</th>
                <th className="r">Protein per €</th>
                <th className="r"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody className="num">
              {foods.map((p) => {
                const ppe = proteinPerEuro(p);
                return editing === p.id ? (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="r">
                      <input className="na-input" type="number" min="1" max="9999" aria-label={`Pack size of ${p.name} in grams`} value={pack} onChange={(e) => setPack(e.target.value)} /> g
                    </td>
                    <td className="r">
                      € <input className="na-input" type="number" min="0" step="0.01" aria-label={`Price of ${p.name} in euros`} value={price} onChange={(e) => setPrice(e.target.value)} />
                    </td>
                    <td className="r" colSpan={2}>
                      <button type="button" className="na-ink-btn" disabled={price === "" || save.isPending} onClick={() => save.mutate()}>Save</button>{" "}
                      <button type="button" className="na-text-btn" onClick={() => setEditing(undefined)}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <Fragment key={p.id}>
                  <tr>
                    <td>
                      {p.name}
                      {p.brand ? <span className="np-food-pack">{p.brand}</span> : null}
                    </td>
                    <td className="r">{p.serving_size_g ? `${round(p.serving_size_g)} g` : "—"}</td>
                    <td className="r">{fmtEur(p.estimated_price_eur)}</td>
                    <td className="r">
                      {ppe && best ? <span className="na-mini" aria-hidden><span style={{ width: `${(ppe / proteinPerEuro(best)!) * 100}%` }} /></span> : null}
                      {ppe ? `${round(ppe)} g` : "—"}
                    </td>
                    <td className="r">
                      <button
                        type="button"
                        className="na-text-btn"
                        aria-label={`Edit ${p.name}`}
                        onClick={() => {
                          setEditing(p.id);
                          setPrice(p.estimated_price_eur != null ? String(p.estimated_price_eur) : "");
                          setPack(p.serving_size_g != null ? String(p.serving_size_g) : "");
                        }}
                      >
                        {p.estimated_price_eur != null ? "Edit" : "Add price"}
                      </button>
                      {p.barcode && /^\d+$/.test(p.barcode) ? (
                        <>
                          {" · "}
                          <button
                            type="button"
                            className="na-text-btn"
                            aria-expanded={comparing === p.id}
                            aria-label={`Compare shop prices for ${p.name}`}
                            onClick={() => setComparing(comparing === p.id ? undefined : p.id)}
                          >
                            {comparing === p.id ? "Hide" : "Compare"}
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                  {comparing === p.id ? (
                    <tr>
                      <td colSpan={5}>
                        {prices.isPending ? (
                          <p className="na-caption">Looking up shop prices…</p>
                        ) : prices.error ? (
                          <p className="na-caption" role="alert">{prices.error.message.startsWith("502") ? "Open Prices can't be reached right now. Try again shortly." : `Couldn't load prices. ${prices.error.message}`}</p>
                        ) : !prices.data?.shops.length ? (
                          <p className="na-caption">No shop has reported a price for this food in the last six months.</p>
                        ) : (
                          <ul className="na-rows">
                            {prices.data.shops.map((s) => (
                              <li key={`${s.shop}-${s.city}`}>
                                <span>
                                  {s.shop}
                                  <small className="num">
                                    {[s.city, `seen ${shortDate(s.date)}`, s.discounted ? "on offer" : ""].filter(Boolean).join(" · ")}
                                  </small>
                                </span>
                                <span className="num">
                                  {fmtEur(s.price_eur)}{" "}
                                  {p.estimated_price_eur !== s.price_eur ? (
                                    <button type="button" className="na-text-btn" disabled={adoptPrice.isPending} onClick={() => adoptPrice.mutate({ id: p.id, price: s.price_eur })}>
                                      Use this price
                                    </button>
                                  ) : (
                                    <small>your price</small>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="na-caption">Prices reported by shoppers to Open Food Facts' Open Prices, for the pack this barcode identifies.</p>
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        ground="na-white"
        title="Add a food"
        side={
          <>
            <form
              className="na-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!query.trim()) return;
                lookup.reset();
                search.mutate();
              }}
            >
              <label>
                Search Open Food Facts
                <input className="na-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Greek yogurt" />
              </label>
              <button type="submit" className="na-ink-btn" disabled={!query.trim() || search.isPending}>
                {search.isPending ? "Searching…" : "Search"}
              </button>
            </form>
            <form
              className="na-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (BARCODE.test(code)) findBarcode(code);
              }}
            >
              <label>
                Or a barcode
                <input className="na-input num" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="3017620422003" />
              </label>
              <div className="na-row">
                <button type="submit" className="na-ink-btn" disabled={!BARCODE.test(code) || lookup.isPending}>
                  {lookup.isPending ? "Looking up…" : "Look up"}
                </button>
                {scanOk ? (
                  <button type="button" className="na-text-btn" onClick={() => setScanning(true)}>Scan with the camera</button>
                ) : null}
              </div>
            </form>
            {scanning ? (
              <Scanner
                onClose={() => setScanning(false)}
                onCode={(c) => {
                  setScanning(false);
                  setCode(c);
                  findBarcode(c);
                }}
              />
            ) : null}
          </>
        }
      >
        <ul className="na-rows">
          {results.map((r) => (
            <li key={r.barcode}>
              <span>
                {r.name}
                <small className="num">
                  {r.brand ? `${r.brand} · ` : ""}
                  {r.protein_per_100g != null ? `${r.protein_per_100g.toFixed(1)} g protein` : "protein unknown"} per 100 g
                </small>
              </span>
              <button type="button" className="na-ink-btn" disabled={add.isPending} onClick={() => add.mutate(r)}>Add</button>
            </li>
          ))}
          {search.data && search.data.results.length === 0 ? <li>Nothing found for that search.</li> : null}
          {!search.data && !lookup.data ? <li>Search by name or barcode to add a food from the Open Food Facts database.</li> : null}
        </ul>
      </Section>

      <Section
        ground="np-receipt-sec"
        title="Next week's shop"
        side={<p className="np-note">Everything you logged in the last seven days, rounded up to the packs you'd buy. Eat the same next week and this is your list.</p>}
      >
        <div className="np-receipts">
          <Receipt
            title="Shopping list"
            lines={(shop?.items ?? []).map((i) => ({
              key: i.product_id,
              name: i.name,
              qty: i.packs && i.pack_size_g ? `${i.packs} × ${round(i.pack_size_g)} g` : `${round(i.grams)} g`,
              amount: i.cost_eur,
            }))}
            empty="Log a few meals and your list appears here."
            total={shop?.total_eur}
            note={
              shop?.unpriced
                ? `${shop.unpriced} ${shop.unpriced === 1 ? "food has" : "foods have"} no price or pack size yet, so the total leaves ${shop.unpriced === 1 ? "it" : "them"} out.`
                : "From your last seven days of meals."
            }
          />
        </div>
      </Section>
    </>
  );
}
