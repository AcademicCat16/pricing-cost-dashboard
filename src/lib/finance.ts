/**
 * Financial engine. Pure functions; time horizon = one operating year (12 months).
 *
 *   Contribution margin per unit = Price − Variable cost per unit
 *   Break-even units             = Fixed costs ÷ Contribution margin per unit   (single product)
 *   Operating profit             = Revenue − Variable costs − Fixed costs
 *
 * Multiple products: break-even uses the expected sales mix (by revenue). Changing the mix changes the result.
 * Startup (one-time) costs are NOT operating expenses. They appear separately as startup cash, except
 * capital items the student chooses to amortise, whose annual amortisation is added to fixed costs.
 */
import type { Expense, Model, Product, Frequency } from "./types.ts";

/** Margins smaller than this (floating-point noise) are treated as zero. */
export const EPS = 1e-9;

export const PERIODS: Record<Frequency, number> = { monthly: 12, quarterly: 4, annual: 1 };

/** Billing units per year for a product (monthly subscriptions bill 12 times a year). */
export const billingUnits = (p: Product) => Math.max(0, p.quantity) * (p.model === "monthly" ? 12 : 1);

const applies = (e: Expense, p: Product) => e.appliesTo === "all" || e.appliesTo.includes(p.id);

export const annualFixedAmount = (e: Expense) => (e.behavior === "fixed" && e.frequency ? e.amount * PERIODS[e.frequency] : 0);
export const annualAmortisation = (e: Expense) =>
  e.behavior === "startup" && e.capital && e.capital.includeInBreakEven && e.capital.years > 0 ? e.amount / e.capital.years : 0;

export interface VariableLine { id: string; name: string; perUnit: number }

/** Variable cost per billing unit for a product, with the line-by-line breakdown. */
export const variableCostBreakdown = (m: Model, p: Product, priceOverride?: number): VariableLine[] => {
  const price = priceOverride ?? p.price;
  const upo = m.settings.unitsPerOrder > 0 ? m.settings.unitsPerOrder : 1;
  const lines: VariableLine[] = [];
  for (const e of m.expenses) {
    if (!e.enabled || e.behavior !== "variable" || !applies(e, p)) continue;
    const perUnit = e.basis === "per_order" ? e.amount / upo : e.basis === "pct_revenue" ? (e.amount / 100) * price : e.amount;
    lines.push({ id: e.id, name: e.name, perUnit });
  }
  if (p.directUnitCost) lines.push({ id: `${p.id}-direct`, name: "Product-specific unit cost", perUnit: p.directUnitCost });
  return lines;
};
export const variableCostPerUnit = (m: Model, p: Product, priceOverride?: number) =>
  variableCostBreakdown(m, p, priceOverride).reduce((s, l) => s + l.perUnit, 0);

/** Landed cost per unit of inventory (manufacturing, duty, freight, packaging, product-specific cost). */
export const inventoryUnitCost = (m: Model, p: Product) =>
  m.expenses.filter((e) => e.enabled && e.behavior === "variable" && e.inventoriable && e.basis === "per_unit" && applies(e, p)).reduce((s, e) => s + e.amount, 0) + p.directUnitCost;

export interface ProductResult {
  id: string; name: string; price: number; units: number; revenue: number;
  vcPerUnit: number; variableCosts: number; cmPerUnit: number; cmRatio: number | null; contribution: number;
  specificFixed: number; allocatedShared: number; allocatedProfit: number;
  breakEvenUnits: number | null; // at the expected sales mix
}

export interface Results {
  products: ProductResult[];
  revenue: number;
  variableCosts: number;
  contribution: number;
  fixedOperating: number; // recurring fixed costs
  amortisation: number; // capital items amortised into the operating year
  fixedTotal: number; // fixed costs used in break-even (fixedOperating + amortisation)
  sharedFixed: number;
  totalCosts: number;
  profit: number;
  cmRatio: number | null; // weighted, at the expected mix
  breakEvenRevenue: number | null; // null = not achievable under current assumptions
  breakEvenAchievable: boolean;
  marginOfSafety: number | null; // share of expected revenue above break-even
  startupOneTime: number;
  initialInventory: number;
  startupCash: number;
  /** Single-product shortcut values (first product) */
  single: { price: number; vcPerUnit: number; cmPerUnit: number; breakEvenUnits: number | null } | null;
}

export interface WhatIf { price?: number; priceFor?: string; volumeFactor?: number; vcFactor?: number; fixedFactor?: number; units?: Record<string, number> }

export const compute = (m: Model, w: WhatIf = {}): Results => {
  const vf = w.volumeFactor ?? 1, cf = w.vcFactor ?? 1, ff = w.fixedFactor ?? 1;
  const fixedOperating = m.expenses.filter((e) => e.enabled).reduce((s, e) => s + annualFixedAmount(e), 0) * ff;
  const amortisation = m.expenses.filter((e) => e.enabled).reduce((s, e) => s + annualAmortisation(e), 0) * ff;
  const fixedTotal = fixedOperating + amortisation;
  const specificFixedOf = (pid: string) =>
    m.expenses.filter((e) => e.enabled && e.allocation === pid).reduce((s, e) => s + annualFixedAmount(e) + annualAmortisation(e), 0) * ff;
  const sharedFixed = fixedTotal - m.products.reduce((s, p) => s + specificFixedOf(p.id), 0);

  const rows = m.products.map((p) => {
    const price = w.price != null && (w.priceFor == null || w.priceFor === p.id) ? w.price : p.price;
    const units = (w.units?.[p.id] ?? billingUnits(p)) * vf;
    const vcPerUnit = variableCostPerUnit(m, p, price) * cf;
    const revenue = price * units;
    const cmPerUnit = price - vcPerUnit;
    return { p, price, units, vcPerUnit, revenue, cmPerUnit, variableCosts: vcPerUnit * units, contribution: cmPerUnit * units };
  });

  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const variableCosts = rows.reduce((s, r) => s + r.variableCosts, 0);
  const contribution = revenue - variableCosts;
  const profit = contribution - fixedTotal;

  // Weighted CM ratio at the expected mix. With zero expected sales, fall back to an equal mix of products.
  let cmRatio: number | null = revenue > 0 ? contribution / revenue : null;
  if (revenue === 0 && rows.length) {
    const avgPrice = rows.reduce((s, r) => s + r.price, 0) / rows.length;
    const avgCm = rows.reduce((s, r) => s + r.cmPerUnit, 0) / rows.length;
    cmRatio = avgPrice > 0 ? avgCm / avgPrice : null;
  }
  const breakEvenAchievable = cmRatio != null && cmRatio > EPS;
  const breakEvenRevenue = breakEvenAchievable ? fixedTotal / (cmRatio as number) : null;
  const revShare = (r: (typeof rows)[number]) => (revenue > 0 ? r.revenue / revenue : 1 / rows.length);
  const unitShare = (r: (typeof rows)[number]) => {
    const tu = rows.reduce((s, x) => s + x.units, 0);
    return tu > 0 ? r.units / tu : 1 / rows.length;
  };

  const products: ProductResult[] = rows.map((r) => {
    const share = m.settings.allocation === "units" ? unitShare(r) : revShare(r);
    const specificFixed = specificFixedOf(r.p.id);
    const allocatedShared = sharedFixed * share;
    return {
      id: r.p.id, name: r.p.name, price: r.price, units: r.units, revenue: r.revenue,
      vcPerUnit: r.vcPerUnit, variableCosts: r.variableCosts, cmPerUnit: r.cmPerUnit,
      cmRatio: r.price > 0 ? r.cmPerUnit / r.price : null, contribution: r.contribution,
      specificFixed, allocatedShared, allocatedProfit: r.contribution - specificFixed - allocatedShared,
      breakEvenUnits: breakEvenRevenue != null && r.price > 0 ? (breakEvenRevenue * revShare(r)) / r.price : null,
    };
  });

  const startupOneTime = m.expenses.filter((e) => e.enabled && e.behavior === "startup").reduce((s, e) => s + e.amount, 0);
  const initialInventory = m.products.reduce((s, p) => s + Math.max(0, p.initialInventory) * inventoryUnitCost(m, p), 0);

  const first = rows[0];
  const single = m.products.length === 1 && first
    ? { price: first.price, vcPerUnit: first.vcPerUnit, cmPerUnit: first.cmPerUnit, breakEvenUnits: first.cmPerUnit > EPS ? fixedTotal / first.cmPerUnit : null }
    : null;

  return {
    products, revenue, variableCosts, contribution, fixedOperating, amortisation, fixedTotal, sharedFixed,
    totalCosts: variableCosts + fixedTotal, profit, cmRatio, breakEvenRevenue, breakEvenAchievable,
    marginOfSafety: breakEvenRevenue != null && revenue > 0 ? (revenue - breakEvenRevenue) / revenue : null,
    startupOneTime, initialInventory, startupCash: startupOneTime + initialInventory, single,
  };
};

/** Annual cost by category at expected volume (fixed + variable + amortisation). */
export const costByCategory = (m: Model) => {
  const out = new Map<string, { category: string; total: number; items: { id: string; name: string; total: number; behavior: string }[] }>();
  const add = (cat: string, id: string, name: string, total: number, behavior: string) => {
    if (total <= 0) return;
    const c = out.get(cat) ?? { category: cat, total: 0, items: [] };
    c.total += total; c.items.push({ id, name, total, behavior }); out.set(cat, c);
  };
  const upo = m.settings.unitsPerOrder > 0 ? m.settings.unitsPerOrder : 1;
  for (const e of m.expenses) {
    if (!e.enabled) continue;
    if (e.behavior === "fixed") add(e.category, e.id, e.name, annualFixedAmount(e), "fixed");
    else if (e.behavior === "startup") add(e.category, e.id, e.name, annualAmortisation(e), "amortised");
    else {
      const total = m.products.filter((p) => applies(e, p)).reduce((s, p) => {
        const u = billingUnits(p);
        const per = e.basis === "per_order" ? e.amount / upo : e.basis === "pct_revenue" ? (e.amount / 100) * p.price : e.amount;
        return s + per * u;
      }, 0);
      add(e.category, e.id, e.name, total, "variable");
    }
  }
  for (const p of m.products) if (p.directUnitCost) add("Production & Inventory", `${p.id}-direct`, `${p.name}: product-specific cost`, p.directUnitCost * billingUnits(p), "variable");
  return [...out.values()].sort((a, b) => b.total - a.total);
};

/** Stable fingerprint of the inputs, used to detect stale evaluations and confirmations. */
export const fingerprint = (m: Model) => {
  const s = JSON.stringify({ e: m.expenses.map(({ original: _o, scenarios: _s, ...rest }) => rest), p: m.products, u: m.settings.unitsPerOrder, a: m.settings.allocation, v: m.settings.volumeScenarios });
  return hashString(s);
};

/** FNV-1a 32-bit hash as 8 hex characters. */
export const hashString = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
