// The foods people buy most for protein, at typical European supermarket prices (examples, not live prices).
export type FoodId = "chicken" | "beef" | "eggs" | "yogurt" | "whey" | "tuna" | "quark" | "lentils";
export type Food = { id: FoodId; name: string; pack: string; packG: number; priceEur: number; proteinPer100g: number; unit?: { g: number; name: string } };

export const FOODS: Food[] = [
  { id: "chicken", name: "Chicken breast", pack: "1 kg pack", packG: 1000, priceEur: 8.99, proteinPer100g: 23 },
  { id: "beef", name: "Minced beef", pack: "500 g pack", packG: 500, priceEur: 4.49, proteinPer100g: 20 },
  { id: "eggs", name: "Eggs", pack: "box of 10", packG: 600, priceEur: 2.99, proteinPer100g: 12.6, unit: { g: 60, name: "eggs" } },
  { id: "yogurt", name: "Greek yogurt", pack: "500 g tub", packG: 500, priceEur: 2.49, proteinPer100g: 9 },
  { id: "whey", name: "Whey protein", pack: "500 g bag", packG: 500, priceEur: 12.99, proteinPer100g: 75 },
  { id: "tuna", name: "Tuna in water", pack: "145 g can, drained", packG: 145, priceEur: 1.69, proteinPer100g: 26, unit: { g: 145, name: "cans" } },
  { id: "quark", name: "Low-fat quark", pack: "500 g tub", packG: 500, priceEur: 0.99, proteinPer100g: 12 },
  { id: "lentils", name: "Red lentils", pack: "500 g bag", packG: 500, priceEur: 1.79, proteinPer100g: 24.6 },
];

const byId = Object.fromEntries(FOODS.map((f) => [f.id, f])) as Record<FoodId, Food>;

// Half the protein of each pricier food moves to a cheaper food people already use the same way:
// lentils stretch chicken and mince, quark replaces Greek yogurt and shakes.
export const SWAPS: Partial<Record<FoodId, FoodId>> = { chicken: "lentils", beef: "lentils", yogurt: "quark", whey: "quark" };
export const SWAP_SHARE = 0.5;

export type Basket = Record<FoodId, number>; // packs per week
export const DEFAULT_BASKET: Basket = { chicken: 1, beef: 1, eggs: 2, yogurt: 2, whey: 1, tuna: 3, quark: 0, lentils: 0 };

export type Line = { id: FoodId; name: string; grams: number; cost: number; protein: number; swapped: boolean };
export type Receipt = { lines: Line[]; cost: number; protein: number };

const costOf = (f: Food, grams: number) => (f.priceEur / f.packG) * grams;
const proteinOf = (f: Food, grams: number) => (f.proteinPer100g / 100) * grams;

function receipt(grams: Map<FoodId, { g: number; swapped: boolean }>): Receipt {
  const lines = [...grams]
    .filter(([, v]) => v.g > 0)
    .map(([id, v]) => {
      const f = byId[id];
      return { id, name: f.name, grams: v.g, cost: costOf(f, v.g), protein: proteinOf(f, v.g), swapped: v.swapped };
    });
  return { lines, cost: lines.reduce((s, l) => s + l.cost, 0), protein: lines.reduce((s, l) => s + l.protein, 0) };
}

export function receipts(basket: Basket) {
  const usual = new Map<FoodId, { g: number; swapped: boolean }>();
  const better = new Map<FoodId, { g: number; swapped: boolean }>();
  const add = (m: typeof better, id: FoodId, g: number, swapped: boolean) => {
    const prev = m.get(id);
    m.set(id, { g: (prev?.g ?? 0) + g, swapped: swapped || !!prev?.swapped });
  };
  for (const f of FOODS) {
    const g = basket[f.id] * f.packG;
    if (!g) continue;
    add(usual, f.id, g, false);
    const target = SWAPS[f.id];
    if (!target) {
      add(better, f.id, g, false);
      continue;
    }
    const movedProtein = proteinOf(f, g) * SWAP_SHARE;
    add(better, f.id, g * (1 - SWAP_SHARE), false);
    add(better, target, (movedProtein / byId[target].proteinPer100g) * 100, true);
  }
  const before = receipt(usual);
  const after = receipt(better);
  return { before, after, saving: before.cost - after.cost };
}

export function quantity(line: Line) {
  const f = byId[line.id];
  if (f.unit) return `${Math.round(line.grams / f.unit.g)} ${f.unit.name}`;
  return line.grams >= 1000 ? `${(line.grams / 1000).toFixed(line.grams % 1000 ? 2 : 0)} kg` : `${Math.round(line.grams)} g`;
}

export type Photo = { file: string; w: number; h: number; alt: string };

// Files live in public/media/1920 and public/media/3840 under the same name.
export const PHOTOS = {
  mastA: { file: "etalage-de-fruits-sur-un-marche-francais.jpg", w: 3840, h: 2880, alt: "Fruit stacked on a French market stall" },
  mastB: { file: "erdbeerschalen-viktualienmarkt-munchen.jpg", w: 3840, h: 2560, alt: "Punnets of strawberries at the Viktualienmarkt in Munich" },
  mastC: { file: "apples-in-basket-2018-g1.jpg", w: 3840, h: 3339, alt: "Red apples in a wicker basket" },
  mastD: { file: "sweet-cherries-in-basket-2018-g1.jpg", w: 3840, h: 3606, alt: "Sweet cherries in a wicker basket" },
  mastE: { file: "flensburgs-sudermarkt-mit-dem-wochenmarkt-bild-007.jpg", w: 3840, h: 2560, alt: "Shoppers at the weekly market on Südermarkt square in Flensburg" },
  howA: { file: "gesundes-leben-002-2014-03-19.jpg", w: 3840, h: 2971, alt: "A stallholder and shoppers at a fruit stall at the market in Santanyí, Mallorca" },
  howB: { file: "bart-kaas-albert-cuypmarkt-amsterdam.jpg", w: 3840, h: 2550, alt: "A cheese stall at the Albert Cuyp market in Amsterdam" },
  howC: { file: "2012-am-wiener-naschmarkt-4.jpg", w: 3840, h: 2550, alt: "Shoppers at a fruit and vegetable stall at the Naschmarkt in Vienna" },
  benefits: { file: "winterswijk-nl-wochenmarkt-2016-4144.jpg", w: 3840, h: 2560, alt: "Flat peaches priced at €2.50 a kilo at the weekly market in Winterswijk" },
} satisfies Record<string, Photo>;

export const CREDITS = [
  { title: "Etalage de fruits sur un marché français", by: "BienheureuxAnonyme", licence: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/w/index.php?curid=97306179" },
  { title: "Erdbeerschalen Viktualienmarkt München", by: "Thomas Wolf, www.foto-tw.de", licence: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/w/index.php?curid=30653459" },
  { title: "Apples in basket 2018 G1", by: "George Chernilevsky", licence: "public domain", page: "https://commons.wikimedia.org/wiki/File:Apples_in_basket_2018_G1.jpg" },
  { title: "Sweet cherries in basket 2018 G1", by: "George Chernilevsky", licence: "public domain", page: "https://commons.wikimedia.org/wiki/File:Sweet_cherries_in_basket_2018_G1.jpg" },
  { title: "Flensburgs Südermarkt mit dem Wochenmarkt", by: "Sönke Rahn", licence: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/w/index.php?curid=31271109" },
  { title: "2012 am Wiener Naschmarkt 4", by: "Böhringer Friedrich", licence: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/w/index.php?curid=23004986" },
  { title: "Bart Kaas, Albert Cuypmarkt Amsterdam", by: "Eric Molina", licence: "CC BY 2.0", page: "https://commons.wikimedia.org/w/index.php?curid=74349911" },
  { title: "Gesundes Leben 002 (market in Santanyí)", by: "Friedrich Haag", licence: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Gesundes_Leben_002_2014_03_19.jpg" },
  { title: "Winterswijk (NL), Wochenmarkt, 2016", by: "Dietmar Rabich", licence: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Winterswijk_(NL),_Wochenmarkt_--_2016_--_4144.jpg" },
];
