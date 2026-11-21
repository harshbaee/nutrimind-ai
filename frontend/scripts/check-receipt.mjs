// Self-check for the preview page's receipt maths. Run: node scripts/check-receipt.mjs
import assert from "node:assert/strict";
import { DEFAULT_BASKET, FOODS, quantity, receipts } from "../src/components/preview/data.ts";

const { before, after, saving } = receipts(DEFAULT_BASKET);
// 1 kg chicken + 500 g mince + 20 eggs + 1 kg Greek yogurt + 500 g whey + 3 cans of tuna
assert.equal(before.cost.toFixed(2), "42.50");
// 500 g chicken + 250 g mince + 671 g lentils + 20 eggs + 500 g yogurt + 1,938 g quark + 250 g whey + 3 cans of tuna
assert.ok(Math.abs(after.cost - 33.012) < 0.005, `after.cost was ${after.cost}`);
assert.ok(Math.abs(before.protein - after.protein) < 1e-9, "swaps must keep protein the same");
assert.ok(Math.abs(before.protein - 1059.3) < 0.05, `protein was ${before.protein}`);
assert.ok(saving > 0);

// Foods with no swap (eggs, tuna, quark, lentils) cost the same on both receipts.
const plain = receipts({ chicken: 0, beef: 0, eggs: 1, yogurt: 0, whey: 0, tuna: 2, quark: 1, lentils: 1 });
assert.equal(plain.saving, 0);
assert.equal(plain.after.lines.length, 4);
assert.equal(quantity(plain.after.lines.find((l) => l.id === "tuna")), "2 cans");
assert.equal(quantity(plain.after.lines.find((l) => l.id === "eggs")), "10 eggs");

// An empty basket is an empty receipt, not an error.
const none = receipts(Object.fromEntries(FOODS.map((f) => [f.id, 0])));
assert.equal(none.before.lines.length, 0);
assert.equal(none.saving, 0);

console.log(`receipt ok: €${before.cost.toFixed(2)} -> €${after.cost.toFixed(2)}, protein ${before.protein.toFixed(1)} g both`);
