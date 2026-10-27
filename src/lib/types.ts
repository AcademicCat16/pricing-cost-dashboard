/** Shared types for the cost model. Pure data — no UI. */

export type Evidence = "Researched" | "Estimated" | "Illustrative" | "Student-Entered";
export type Behavior = "fixed" | "variable" | "startup";
/** How a variable cost scales: per unit sold, per order shipped, or a % of revenue. */
export type Basis = "per_unit" | "per_order" | "pct_revenue";
export type Frequency = "monthly" | "quarterly" | "annual";
export type PricingModel = "one_time" | "monthly" | "annual" | "service";
export type ScenarioKey = "lean" | "typical" | "expansion";

export interface Benchmark {
  amount: number;
  kind: "researched" | "illustrative";
  label: string; // what the marker means, e.g. "USPS commercial price, ≤15.99 oz (mid-range)"
}

export interface Expense {
  id: string;
  name: string;
  category: string;
  description: string;
  why: string; // why this cost is relevant to this venture
  behavior: Behavior;
  amount: number; // dollars, or percent for pct_revenue (e.g. 2.9)
  basis?: Basis; // variable only
  frequency?: Frequency; // fixed only
  appliesTo: "all" | string[]; // variable: which products it applies to
  allocation: "shared" | string; // fixed: shared overhead or a product id
  inventoriable?: boolean; // variable unit cost that is part of the landed cost of stock
  capital?: { years: number; includeInBreakEven: boolean }; // startup items that can be amortised
  enabled: boolean;
  evidence: Evidence;
  sourceUrl?: string;
  sourceLabel?: string;
  dateChecked?: string;
  assumptions: string;
  benchmark?: Benchmark;
  range: { min: number; max: number; step: number };
  custom?: boolean;
  essential?: string; // essential-cost group, used by the review engine
  scenarios?: Partial<Record<ScenarioKey, number | null>>; // preset amounts; null = disabled in that preset
  original?: { amount: number; enabled: boolean; evidence: Evidence; description: string; assumptions: string; frequency?: Frequency; behavior: Behavior; basis?: Basis };
}

export interface AddOn { name: string; price: number; description: string }

export interface Product {
  id: string;
  name: string;
  description: string;
  model: PricingModel;
  price: number; // per billing unit
  quantity: number; // units per year (one_time/service), or average active subscribers (monthly/annual)
  directUnitCost: number; // extra product-specific variable cost per billing unit
  initialInventory: number; // units bought before launch (physical products)
  features: string[]; // customer-facing
  addOns: AddOn[];
  studentScenario: boolean;
  volumeEvidence: string; // how the student justifies the expected quantity
}

export interface Settings {
  unitsPerOrder: number; // average units per shipped order
  allocation: "revenue" | "units"; // how shared overhead is allocated in product-level reports
  horizon: "annual";
  volumeScenarios: { conservative: number; base: number; optimistic: number }; // multipliers of expected volume
  activeScenario: ScenarioKey | "custom";
}

export interface Model {
  expenses: Expense[];
  products: Product[];
  settings: Settings;
}
