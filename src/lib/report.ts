/**
 * Pricing Decision Report (DOCX) and machine-readable handoff (JSON).
 * Both are generated from the SAME confirmed snapshot (State.confirmation), never from live inputs.
 */
import { compute, annualFixedAmount, annualAmortisation, billingUnits } from "./finance.ts";
import type { Model, Expense, Product } from "./types.ts";
import type { Confirmation } from "./store.tsx";
import { applyScenario, SCENARIO_META, VENTURE_FACTS, RESEARCH_DATE } from "../data/venture.ts";
import { comparePrice, isComparableProduct, reps, priceType, COMP, REP_MEDIAN } from "./competition.ts";
import { CRITERIA } from "./evaluate.ts";

export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
export const billingLabel = (p: Product) => ({ one_time: "one-time purchase, per unit", monthly: "per month (subscription)", annual: "per year (subscription)", service: "per service" })[p.model];
export const freqLabel = (e: Expense) =>
  e.behavior === "startup" ? (e.capital?.includeInBreakEven ? `one-time (amortised over ${e.capital.years} yr)` : "one-time")
    : e.behavior === "fixed" ? (e.frequency ?? "") : e.basis === "per_unit" ? "per unit" : e.basis === "per_order" ? "per order" : "% of revenue";
export const amountLabel = (e: Expense) => (e.basis === "pct_revenue" ? `${num(e.amount, 2)}%` : usd(e.amount));
const fact = (label: string) => VENTURE_FACTS.find((f) => f.label === label)?.value ?? "";

/** Scenario results for the confirmed model: operating presets and volume scenarios. */
export const scenarioResults = (m: Model) => {
  const presets = (["lean", "typical", "expansion"] as const).map((k) => {
    const r = compute({ ...m, expenses: applyScenario(m.expenses, k) });
    return { scenario: SCENARIO_META[k].label, fixedCosts: r.fixedTotal, variableCostPerUnit: r.single?.vcPerUnit ?? null, breakEvenUnits: r.single?.breakEvenUnits ?? null, breakEvenRevenue: r.breakEvenRevenue, revenue: r.revenue, profit: r.profit };
  });
  const vs = m.settings.volumeScenarios;
  const volumes = ([["Conservative", vs.conservative], ["Base", vs.base], ["Optimistic", vs.optimistic]] as const).map(([label, f]) => {
    const r = compute(m, { volumeFactor: f });
    return { scenario: label, volumeFactor: f, units: r.products.reduce((s, p) => s + p.units, 0), revenue: r.revenue, totalCosts: r.totalCosts, profit: r.profit };
  });
  return { presets, volumes };
};

/** Structured export (Pricing_Decision_Data.json). */
export const buildDecisionData = (c: Confirmation) => {
  const m = c.model, r = compute(m), sc = scenarioResults(m);
  const active = m.expenses.filter((e) => e.enabled);
  return {
    schema: "venture-pricing-decision/v1",
    generatedFrom: "Mission 3 Pricing & Cost Laboratory — confirmed decision snapshot",
    publicDisplayNote: "Only products[].customerFacing is intended for public website display. All other fields are internal planning data.",
    confirmation: {
      confirmedAt: c.confirmedAt, evaluatedAt: c.evaluation.at, evaluationStatus: "Evaluated — current at confirmation",
      confirmationStatus: "Confirmed by student", snapshotFingerprint: c.fingerprint, acknowledgedWarnings: c.acknowledgedWarnings,
    },
    venture: {
      name: fact("Venture name"), founder: fact("Founder"), concept: fact("Business concept"), targetCustomers: fact("Target customers"),
      valueProposition: fact("Value proposition"), geographicMarket: fact("Geographic market"), developmentStatus: fact("Development status"),
    },
    website: { repositoryUrl: c.website.repositoryUrl, liveUrl: c.website.liveUrl },
    products: m.products.map((p) => ({
      id: p.id, name: p.name, description: p.description, pricingModel: p.model, billingUnit: billingLabel(p), price: p.price, currency: "USD",
      studentScenario: p.studentScenario,
      customerFacing: {
        displayName: p.name, displayPrice: usd(p.price), billingLabel: billingLabel(p), shortDescription: p.description,
        features: p.features, addOns: p.addOns.map((a) => ({ name: a.name, displayPrice: usd(a.price), price: a.price, description: a.description })),
      },
    })),
    finalPrices: m.products.map((p) => ({ product: p.name, price: p.price, currency: "USD", billingUnit: billingLabel(p) })),
    studentJustification: c.justification,
    financialAssumptions: {
      timeHorizon: "One operating year (12 months). Startup costs shown separately.",
      unitsPerOrder: m.settings.unitsPerOrder, sharedCostAllocation: m.settings.allocation,
      expectedSales: m.products.map((p) => ({ product: p.name, quantity: p.quantity, billingUnitsPerYear: billingUnits(p), rationale: p.volumeEvidence || "(none entered)", note: "Student assumption, not a verified forecast" })),
      operatingExpenses: active.filter((e) => e.behavior !== "startup").map(expenseJson),
      startupCosts: active.filter((e) => e.behavior === "startup").map(expenseJson),
      results: {
        revenue: r.revenue, variableCosts: r.variableCosts, fixedOperatingCosts: r.fixedOperating, amortisation: r.amortisation, fixedCostsInBreakEven: r.fixedTotal,
        contribution: r.contribution, contributionMarginRatio: r.cmRatio, operatingProfit: r.profit, breakEvenAchievable: r.breakEvenAchievable,
        breakEvenRevenue: r.breakEvenRevenue, marginOfSafety: r.marginOfSafety, startupOneTimeCosts: r.startupOneTime, initialInventory: r.initialInventory, startupCash: r.startupCash,
        products: r.products.map((p) => ({ product: p.name, price: p.price, variableCostPerUnit: p.vcPerUnit, contributionPerUnit: p.cmPerUnit, units: p.units, revenue: p.revenue, breakEvenUnits: p.breakEvenUnits, allocatedProfit: p.allocatedProfit })),
      },
      operatingScenarios: sc.presets, volumeScenarios: sc.volumes,
    },
    competitivePosition: {
      researchDate: RESEARCH_DATE, note: "Competitor prices are a research snapshot, not live prices.",
      preliminaryRange: { min: COMP.preliminary_pricing_recommendation.tentative_range_min, max: COMP.preliminary_pricing_recommendation.tentative_range_max, currency: "USD", status: COMP.preliminary_pricing_recommendation.status },
      representativeMedian: REP_MEDIAN,
      representativeCompetitors: reps.map(({ c, o }) => ({ name: c.name, classification: c.classification, positioning: c.positioning, product: o.product_name, price: o.current_price, priceType: priceType(o), verification: o.verification_status, availability: o.availability ?? "Not checked", source: o.source_url })),
      comparisons: m.products.filter(isComparableProduct).map((p) => { const cp = comparePrice(p.price); return { product: p.name, price: p.price, cheaperCompetitors: cp.cheaper.map((x) => x.name), similarCompetitors: cp.similar.map((x) => x.name), moreExpensiveCompetitors: cp.pricier.map((x) => x.name), differenceFromRepresentativeMedian: cp.vsMedian, withinPreliminaryRange: cp.inRange, closestProducts: cp.closest }; }),
    },
    riskFindings: {
      classification: c.evaluation.classification, classificationReason: c.evaluation.classificationReason,
      evidenceConfidence: c.evaluation.evidenceConfidence, evidenceReason: c.evaluation.evidenceReason,
      criteria: CRITERIA, findings: c.evaluation.findings, recommendations: c.evaluation.recommendations,
    },
    limitations: [
      "Costs, prices and sales volumes are student assumptions for one operating year; constant per-unit costs are assumed.",
      "Sales volume is not linked to price, advertising or other spending in this model.",
      "Competitor prices were observed once on " + RESEARCH_DATE + " and may have changed.",
      "Evidence labels: Researched (identifiable source), Estimated (reasoned approximation), Illustrative (teaching placeholder), Student-Entered (changed by the student).",
      ...COMP.research_limitations,
    ],
  };
};

const expenseJson = (e: Expense) => ({
  id: e.id, name: e.name, category: e.category, classification: e.behavior, basis: e.basis ?? null, frequency: freqLabel(e), amount: e.amount,
  unit: e.basis === "pct_revenue" ? "percent of revenue" : "USD", annualAmount: e.behavior === "fixed" ? annualFixedAmount(e) : e.behavior === "startup" ? annualAmortisation(e) || null : null,
  appliesTo: e.appliesTo, allocation: e.allocation, evidence: e.evidence, source: e.sourceUrl ?? null, sourceLabel: e.sourceLabel ?? null, dateChecked: e.dateChecked ?? null,
  assumptions: e.assumptions, custom: !!e.custom,
});

export const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

