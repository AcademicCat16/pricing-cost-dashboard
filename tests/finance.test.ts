/**
 * Independent math checks. Expected values were worked out by hand from the formulas
 * (not by calling the engine). Run: node tests/finance.test.ts   (Node 22.6+ strips TypeScript types)
 */
import assert from "node:assert/strict";
import { compute, fingerprint } from "../src/lib/finance.ts";
import { defaultModel, applyScenario } from "../src/data/venture.ts";
import { evaluate } from "../src/lib/evaluate.ts";
import { comparePrice } from "../src/lib/competition.ts";
import type { Expense, Model, Product } from "../src/lib/types.ts";

let passed = 0;
const near = (a: number | null, b: number, label: string, tol = 0.005) => {
  assert.ok(a != null && Math.abs(a - b) <= tol, `${label}: expected ${b}, got ${a}`);
  passed++;
};
const ok = (cond: boolean, label: string) => { assert.ok(cond, label); passed++; };

const exp = (o: Partial<Expense> & Pick<Expense, "id" | "behavior" | "amount">): Expense => ({
  name: o.id, category: "Test", description: "", why: "", appliesTo: "all", allocation: "shared", enabled: true,
  evidence: "Illustrative", assumptions: "", range: { min: 0, max: 100, step: 1 }, ...o,
});
const prod = (o: Partial<Product> & Pick<Product, "id" | "price" | "quantity">): Product => ({
  name: o.id, description: "", model: "one_time", directUnitCost: 0, initialInventory: 0, features: [], addOns: [], studentScenario: false, volumeEvidence: "", ...o,
});
const settings = { unitsPerOrder: 1, allocation: "revenue" as const, horizon: "annual" as const, volumeScenarios: { conservative: 0.5, base: 1, optimistic: 1.5 }, activeScenario: "custom" as const };

// ---------- Case A: single product ----------
const A: Model = {
  settings,
  products: [prod({ id: "P1", price: 40, quantity: 100, initialInventory: 50 })],
  expenses: [
    exp({ id: "unit", behavior: "variable", basis: "per_unit", amount: 10, inventoriable: true }),
    exp({ id: "order", behavior: "variable", basis: "per_order", amount: 5 }),
    exp({ id: "pct", behavior: "variable", basis: "pct_revenue", amount: 5 }),
    exp({ id: "rent", behavior: "fixed", frequency: "monthly", amount: 100 }),
    exp({ id: "fee", behavior: "fixed", frequency: "annual", amount: 300 }),
    exp({ id: "tool", behavior: "startup", amount: 900, capital: { years: 3, includeInBreakEven: true } }),
    exp({ id: "setup", behavior: "startup", amount: 600 }),
    exp({ id: "off", behavior: "fixed", frequency: "monthly", amount: 999, enabled: false }),
  ],
};
let r = compute(A);
near(r.single!.vcPerUnit, 17, "A: variable cost per unit = 10 + 5 + 5%×40");
near(r.single!.cmPerUnit, 23, "A: contribution margin per unit = 40 − 17");
near(r.fixedOperating, 1500, "A: fixed operating = 100×12 + 300 (disabled cost excluded)");
near(r.amortisation, 300, "A: amortisation = 900 ÷ 3");
near(r.fixedTotal, 1800, "A: fixed costs used in break-even");
near(r.single!.breakEvenUnits, 1800 / 23, "A: break-even units = 1800 ÷ 23 = 78.26");
near(r.breakEvenRevenue, 1800 / (23 / 40), "A: break-even revenue = 3130.43");
near(r.revenue, 4000, "A: revenue = 40 × 100");
near(r.profit, 500, "A: profit = 4000 − 1700 − 1800");
near(r.marginOfSafety, (4000 - 1800 / (23 / 40)) / 4000, "A: margin of safety = 21.74%");
near(r.startupOneTime, 1500, "A: startup one-time = 900 + 600 (full capital cost counted as cash)");
near(r.initialInventory, 500, "A: initial inventory = 50 × $10 inventoriable unit cost");

// ---------- Case B: zero and negative contribution ----------
r = compute({ ...A, products: [prod({ id: "P1", price: 15, quantity: 100 })] });
ok(r.single!.cmPerUnit < 0 && r.single!.breakEvenUnits === null && !r.breakEvenAchievable && r.breakEvenRevenue === null, "B: negative margin → no finite break-even");
// price where CM is exactly 0: p − (15 + 0.05p) = 0 → p = 15.789473...
r = compute({ ...A, products: [prod({ id: "P1", price: 15 / 0.95, quantity: 100 })] });
ok(Math.abs(r.single!.cmPerUnit) < 1e-9 && r.single!.breakEvenUnits === null && !r.breakEvenAchievable, "B: zero margin → no finite break-even");
const evB = evaluate({ ...A, products: [prod({ id: "P1", price: 15, quantity: 100, volumeEvidence: "pre-orders from waitlist" })] });
ok(evB.classification === "Financially unsustainable under current assumptions", "B: review classifies negative margin as unsustainable");

// ---------- Case C: two products, shared overhead, sales mix ----------
const C: Model = {
  ...A,
  expenses: A.expenses.map((e) => (e.id === "unit" ? { ...e, appliesTo: ["P1"] } : e)),
  products: [prod({ id: "P1", price: 40, quantity: 100 }), prod({ id: "P2", price: 20, quantity: 50, directUnitCost: 2 })],
};
r = compute(C);
near(r.products[1].vcPerUnit, 8, "C: P2 variable cost = 5 + 5%×20 + 2 direct (P1-only cost excluded)");
near(r.revenue, 5000, "C: revenue = 4000 + 1000");
near(r.contribution, 2900, "C: contribution = 2300 + 600");
near(r.profit, 1100, "C: profit = 2900 − 1800 (overhead counted once)");
near(r.cmRatio, 0.58, "C: weighted CM ratio = 2900 ÷ 5000");
near(r.breakEvenRevenue, 1800 / 0.58, "C: break-even revenue at the expected mix");
near(r.products[0].breakEvenUnits, (1800 / 0.58) * 0.8 / 40, "C: P1 break-even units (80% revenue share)");
near(r.products[1].breakEvenUnits, (1800 / 0.58) * 0.2 / 20, "C: P2 break-even units (20% revenue share)");
near(r.products[0].allocatedShared, 1440, "C: P1 allocated overhead = 80% × 1800");
near(r.products[0].allocatedProfit + r.products[1].allocatedProfit, r.profit, "C: product profits sum to total profit (no double counting)");
r = compute({ ...C, settings: { ...settings, allocation: "units" } });
near(r.products[0].allocatedShared, 1800 * (100 / 150), "C: unit-based allocation = 2/3 of overhead to P1");
near(r.profit, 1100, "C: allocation method does not change total profit");

// ---------- Case D: subscription normalisation ----------
r = compute({ ...A, expenses: [], products: [prod({ id: "S", price: 10, quantity: 20, model: "monthly" })] });
near(r.revenue, 2400, "D: monthly subscription revenue = $10 × 20 subscribers × 12 months");
r = compute({ ...A, expenses: [], products: [prod({ id: "S", price: 100, quantity: 20, model: "annual" })] });
near(r.revenue, 2000, "D: annual subscription revenue = $100 × 20 subscribers");

// ---------- Case E: the default (Typical) Jewelry / Journey model, hand-computed ----------
const T = defaultModel();
r = compute(T);
const vc = 6.5 + 1.15 + 0.9 + 0.85 + (0.2 + 8.0 + 0.3) + 0.069 * 34;
near(r.single!.vcPerUnit, vc, "E: Typical variable cost per unit = 9.40 + 8.50 + 6.9%×34 = 20.246");
const fixed = 29 * 12 + 20 + 20 * 12 + 0 + 300 * 12 + 100 * 12 + 45 * 12 + 38 * 12 + 400 + 500 * 12 + 25 * 12 + 300;
near(r.fixedOperating, fixed, "E: Typical fixed operating costs = 13,404");
near(r.fixedTotal, fixed + 800 / 3, "E: plus tooling amortisation 266.67");
near(r.single!.breakEvenUnits, (fixed + 800 / 3) / (34 - vc), "E: Typical break-even ≈ 994 units");
near(r.profit, 600 * (34 - vc) - (fixed + 800 / 3), "E: Typical profit at 600 units ≈ −5,418.27");
near(r.startupOneTime, 300 + 750 + 500 + 350 + 30 + 400 + 350 + 800 + 0, "E: Typical startup one-time = 3,480");
near(r.initialInventory, 500 * 9.4, "E: initial inventory = 500 × 9.40");
ok(T.expenses.filter((e) => ["V10", "V11", "V12", "F11", "F12", "F15", "F16"].includes(e.id)).every((e) => !e.enabled), "E: Expansion-only and Amazon costs are off in Typical");

// ---------- Case F: presets ----------
const lean = { ...T, expenses: applyScenario(T.expenses, "lean") };
const leanFixed = 29 * 12 + 20 + 0 + 0 + 150 * 12 + 0 + 45 * 12 + 0 + 0 + 0 + 0 + 150;
near(compute(lean).fixedTotal, leanFixed, "F: Lean fixed costs = 2,858 (no tooling)");
const ex = { ...T, expenses: applyScenario(T.expenses, "expansion") };
ok(ex.expenses.find((e) => e.id === "F11")!.enabled && ex.expenses.find((e) => e.id === "V12")!.enabled, "F: Expansion enables contractor and 3PL");
ok(fingerprint(T) !== fingerprint(lean), "F: fingerprint changes when inputs change");
ok(fingerprint(T) === fingerprint(defaultModel()), "F: fingerprint is stable for identical inputs");

// ---------- Case G: competitor comparison ----------
const c34 = comparePrice(34);
ok(c34.cheaper.map((x) => x.name).join() === "Lolalet,BAGSMART" && c34.pricier.length === 3 && c34.inRange, "G: $34 → 2 cheaper, 3 pricier, inside $29–$39");
near(c34.vsMedian, -14, "G: $34 is $14 below the $48 representative median");
const c48 = comparePrice(48);
ok(c48.similar.map((x) => x.name).join() === "BÉIS", "G: $48 → BÉIS similarly priced");
ok(comparePrice(120).aboveAll && comparePrice(5).belowAll, "G: above/below all researched offers detected");

// ---------- Case H: review engine on the default model ----------
const ev = evaluate(T);
ok(ev.classification === "High modeled risk", `H: Typical default (loss at 600 units) → High modeled risk (got ${ev.classification})`);
ok(ev.majorWarnings.length > 0 && ev.findings.some((x) => x.id === "E-volume" && x.severity === "high"), "H: unsupported volume flagged");
const profitable = evaluate({ ...lean, products: [{ ...lean.products[0], quantity: 900, volumeEvidence: "waitlist of 300 sign-ups and pre-orders" }] });
ok(["Lower modeled risk", "Moderate modeled risk"].includes(profitable.classification), `H: Lean at 900 units is profitable → lower/moderate (got ${profitable.classification})`);

console.log(`\n${passed} math checks passed`);
