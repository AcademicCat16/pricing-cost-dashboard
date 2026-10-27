/**
 * Venture profile assembled from the Mission 1 research (competitor_data.json, workbook, report)
 * and the original concept website. Each field records whether it is confirmed or an assumption.
 */
import raw from "./competitor_data.json" with { type: "json" };
import { DEFAULT_EXPENSES, PRIMARY_ID } from "./costs.ts";
import type { Expense, Model, Product, ScenarioKey } from "../lib/types.ts";

const V = raw.venture;
export const RESEARCH_DATE = raw.metadata.date_compiled;
export const REC = raw.preliminary_pricing_recommendation;

export type Fact = { label: string; value: string; status: "Confirmed" | "Assumption" | "Derived"; source: string };

export const VENTURE_FACTS: Fact[] = [
  { label: "Venture name", value: V.venture_name, status: "Confirmed", source: "Mission 1 research" },
  { label: "Founder", value: V.founder, status: "Confirmed", source: "Mission 1 research" },
  { label: "Business concept", value: V.business_concept, status: "Confirmed", source: "Mission 1 research" },
  { label: "Product", value: V.primary_product, status: "Confirmed", source: "Mission 1 research (concept description)" },
  { label: "Target customers", value: V.target_customers, status: "Confirmed", source: "Mission 1 research" },
  { label: "Value proposition", value: V.value_proposition, status: "Confirmed", source: "Mission 1 research" },
  { label: "Revenue model", value: "One-time purchase per unit (matches every researched competitor).", status: "Derived", source: "Mission 1 pricing data: all offers are one-time USD purchases" },
  { label: "Geographic market", value: V.geographic_market, status: "Confirmed", source: "Mission 1 research" },
  { label: "Distribution channels", value: "Owned online store assumed as the main channel; Amazon modelled as an optional alternative (off by default).", status: "Assumption", source: V.distribution_channels },
  { label: "Operations", value: "Founder-run from home; contract manufacturing (likely imported); seller ships orders by USPS. No office, warehouse or employees at launch.", status: "Assumption", source: "Inferred from concept stage; not stated in the research" },
  { label: "Development status", value: V.status_notes, status: "Confirmed", source: "Mission 1 research / concept website" },
  { label: "Competitive environment", value: V.competitive_environment, status: "Confirmed", source: "Mission 1 research" },
];

/** Original venture website (for Mission 4). The live URL is from the research; the repository was located on GitHub. */
export const DEFAULT_WEBSITE = {
  repositoryUrl: "https://github.com/sarahbielski/Creative-Website",
  liveUrl: "https://sarahbielski.github.io/Creative-Website/",
  note: "Live URL from the Mission 1 research (verified reachable 2026-10-27). Repository located on GitHub (public, verified 2026-10-27). Please confirm both before Mission 4.",
};

export const DEFAULT_PRODUCT: Product = {
  id: PRIMARY_ID,
  name: "Jewelry / Journey Travel Jewelry Organizer",
  description: "Book-style travel jewelry organizer with separate necklace lanes (snap-close loops repeated along each chain), a pendant pocket, bracelet storage, protected earring sections, and a hoops & bangles page.",
  model: "one_time",
  price: (REC.tentative_range_min + REC.tentative_range_max) / 2, // starting point: midpoint of the preliminary range
  quantity: 600,
  directUnitCost: 0,
  initialInventory: 500,
  features: [...V.relevant_features],
  addOns: [],
  studentScenario: false,
  volumeEvidence: "",
};

export const SCENARIO_META: Record<ScenarioKey, { label: string; summary: string }> = {
  lean: { label: "Lean Startup", summary: "Founder unpaid, stock hardware, free tools, small ad budget, home storage." },
  typical: { label: "Typical Operation", summary: "Reference model: modest founder pay, custom tooling, standard software, steady ad budget." },
  expansion: { label: "Expansion", summary: "Larger operation: 3PL fulfillment and storage, part-time support, higher marketing, bigger platform plan." },
};

/** Applies a preset's amounts/enabled flags to the suggested expenses (custom expenses are kept unchanged). */
export const applyScenario = (expenses: Expense[], key: ScenarioKey): Expense[] =>
  expenses.map((e) => {
    if (e.custom || !e.scenarios || !(key in e.scenarios)) return e;
    const v = e.scenarios[key];
    const base = DEFAULT_EXPENSES.find((d) => d.id === e.id)!;
    return v == null
      ? { ...e, enabled: false, amount: base.amount, evidence: base.evidence }
      : { ...e, enabled: true, amount: v, evidence: base.evidence };
  });

const typicalExpenses = applyScenario(DEFAULT_EXPENSES, "typical").map((e) => ({
  ...e,
  original: { ...e.original!, amount: e.amount, enabled: e.enabled },
}));

export const defaultModel = (): Model => ({
  expenses: typicalExpenses.map((e) => ({ ...e, original: { ...e.original! } })),
  products: [{ ...DEFAULT_PRODUCT, features: [...DEFAULT_PRODUCT.features] }],
  settings: {
    unitsPerOrder: 1,
    allocation: "revenue",
    horizon: "annual",
    volumeScenarios: { conservative: 0.5, base: 1, optimistic: 1.5 },
    activeScenario: "typical",
  },
});

/** Suggested value of an expense under the Typical preset (used for "restore"). */
export const suggestedOf = (id: string) => typicalExpenses.find((e) => e.id === id);
