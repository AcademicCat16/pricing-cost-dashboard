/**
 * Pricing Decision Review. Transparent, rule-based checks on the student's model; no predictions.
 * Thresholds are teaching thresholds used in this laboratory, not industry standards.
 * The classification describes modeled risk under the student's assumptions; it does not predict business failure.
 */
import { compute, fingerprint, variableCostBreakdown, annualFixedAmount, annualAmortisation, billingUnits, EPS } from "./finance.ts";
import type { Model, Expense } from "./types.ts";
import { comparePrice, isComparableProduct, REP_MEDIAN, COMP } from "./competition.ts";

export type Severity = "critical" | "high" | "moderate" | "info" | "strength";
export type Area = "Financial" | "Competitive" | "Evidence";
export interface Finding { id: string; area: Area; severity: Severity; title: string; detail: string }
export interface Recommendation { text: string; why: string }
export type Classification = "Lower modeled risk" | "Moderate modeled risk" | "High modeled risk" | "Financially unsustainable under current assumptions";

export interface Evaluation {
  at: string;
  fingerprint: string;
  classification: Classification;
  classificationReason: string;
  evidenceConfidence: "Low" | "Medium" | "High";
  evidenceReason: string;
  findings: Finding[];
  recommendations: Recommendation[];
  summary: { price: string; financial: string[]; competitive: string[]; strengths: string[]; missing: string[] };
  metrics: Record<string, number | string | null>;
  majorWarnings: string[]; // must be acknowledged before confirming
}

export const CRITERIA: { label: Classification; rule: string }[] = [
  { label: "Financially unsustainable under current assumptions", rule: "A product with expected sales is priced at or below its variable cost per unit, or the combined contribution margin is zero or negative. More sales would increase the loss." },
  { label: "High modeled risk", rule: "Expected sales are below break-even (an operating loss), or the combined contribution margin is below 20% of revenue, or the price is above every researched competitor offer." },
  { label: "Moderate modeled risk", rule: "Profitable at expected sales, but the margin of safety is under 25%, or profit turns into a loss with 20% lower sales or 10% higher variable costs, or the price is a premium position resting on untested differentiation." },
  { label: "Lower modeled risk", rule: "Profitable with a margin of safety of at least 25%, profit survives both stress tests, and the price sits within the researched market." },
];

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd0 = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const ESSENTIAL: { group: string; label: string; ids: string[] }[] = [
  { group: "manufacturing", label: "product manufacturing", ids: ["V01"] },
  { group: "shipping", label: "outbound shipping or fulfillment", ids: ["V06", "V11", "V12"] },
  { group: "payments", label: "payment processing or marketplace fees", ids: ["V07", "V10"] },
  { group: "storefront", label: "a sales channel (store platform or marketplace plan)", ids: ["F01", "F15"] },
  { group: "insurance", label: "business / product liability insurance", ids: ["F07"] },
  { group: "packaging", label: "packaging", ids: ["V04"] },
];

/** Annual amount attributable to an expense at expected volume (for evidence weighting). */
const annualOf = (m: Model, e: Expense) => {
  if (!e.enabled) return 0;
  if (e.behavior === "fixed") return annualFixedAmount(e);
  if (e.behavior === "startup") return annualAmortisation(e);
  const upo = m.settings.unitsPerOrder || 1;
  return m.products.reduce((s, p) => {
    if (!(e.appliesTo === "all" || e.appliesTo.includes(p.id))) return s;
    const per = e.basis === "per_order" ? e.amount / upo : e.basis === "pct_revenue" ? (e.amount / 100) * p.price : e.amount;
    return s + per * billingUnits(p);
  }, 0);
};

export const evaluate = (m: Model, today = new Date()): Evaluation => {
  const r = compute(m);
  const f: Finding[] = [];
  const recs: Recommendation[] = [];
  const add = (x: Finding) => f.push(x);
  const main = m.products[0];
  const sold = m.products.filter((p) => p.quantity > 0);

  // ---------------- Financial ----------------
  const underwater = r.products.filter((p) => p.units > 0 && p.cmPerUnit <= EPS);
  for (const p of r.products) {
    if (p.cmPerUnit <= EPS) add({ id: `F-vc-${p.id}`, area: "Financial", severity: p.units > 0 ? "critical" : "high", title: `${p.name}: price does not cover variable cost`, detail: `Price ${usd(p.price)} vs variable cost ${usd(p.vcPerUnit)} per unit (contribution ${usd(p.cmPerUnit)}). Each additional sale increases the loss, so break-even cannot be reached by selling more under constant costs.` });
  }
  const cm = r.cmRatio;
  if (cm != null && r.breakEvenAchievable) {
    if (cm < 0.2) add({ id: "F-cm", area: "Financial", severity: "high", title: "Thin contribution margin", detail: `Only ${pct(cm)} of each sales dollar is left after variable costs (teaching threshold: under 20% = high risk).` });
    else if (cm < 0.35) add({ id: "F-cm", area: "Financial", severity: "moderate", title: "Moderate contribution margin", detail: `${pct(cm)} of revenue remains after variable costs (teaching thresholds: 20–35% moderate, 35%+ comfortable).` });
    else add({ id: "F-cm", area: "Financial", severity: "strength", title: "Healthy contribution margin", detail: `${pct(cm)} of each sales dollar contributes to fixed costs and profit.` });
  }
  if (r.breakEvenAchievable && r.breakEvenRevenue != null) {
    const beUnits = r.single?.breakEvenUnits ?? null;
    const beText = beUnits != null ? `${Math.ceil(beUnits).toLocaleString()} units (${usd0(r.breakEvenRevenue)} revenue)` : `${usd0(r.breakEvenRevenue)} of revenue at the current sales mix`;
    if (r.profit < 0) add({ id: "F-be", area: "Financial", severity: "high", title: "Expected sales are below break-even", detail: `Break-even requires ${beText}; expected sales produce ${usd0(r.revenue)} revenue and an operating loss of ${usd0(-r.profit)} for the year.` });
    else if ((r.marginOfSafety ?? 0) < 0.25) add({ id: "F-be", area: "Financial", severity: "moderate", title: "Small margin of safety", detail: `Profitable (${usd0(r.profit)}), but sales could fall only ${pct(r.marginOfSafety ?? 0)} before reaching break-even (${beText}).` });
    else add({ id: "F-be", area: "Financial", severity: "strength", title: "Comfortable margin of safety", detail: `Expected sales exceed break-even (${beText}) by ${pct(r.marginOfSafety ?? 0)}; operating profit ${usd0(r.profit)}.` });
  }
  const burden = r.revenue > 0 ? r.fixedTotal / r.revenue : null;
  if (burden != null && burden > 0.4) add({ id: "F-fixed", area: "Financial", severity: burden > 0.6 ? "high" : "moderate", title: "Heavy fixed-cost burden", detail: `Fixed costs of ${usd0(r.fixedTotal)} equal ${pct(burden)} of expected revenue.` });
  const lowVol = compute(m, { volumeFactor: 0.8 }).profit;
  const highVc = compute(m, { vcFactor: 1.1 }).profit;
  const fragile = r.profit > 0 && (lowVol < 0 || highVc < 0);
  if (fragile) add({ id: "F-stress", area: "Financial", severity: "moderate", title: "Profit is sensitive to small changes", detail: `With 20% lower sales profit becomes ${usd0(lowVol)}; with 10% higher variable costs it becomes ${usd0(highVc)}.` });
  else if (r.profit > 0) add({ id: "F-stress", area: "Financial", severity: "strength", title: "Profit survives the stress tests", detail: `20% lower sales: ${usd0(lowVol)}; 10% higher variable costs: ${usd0(highVc)}.` });

  let biggestLine: { name: string; perUnit: number } | null = null;
  if (main) {
    const lines = variableCostBreakdown(m, main);
    const vc = lines.reduce((s, l) => s + l.perUnit, 0);
    biggestLine = [...lines].sort((a, b) => b.perUnit - a.perUnit)[0] ?? null;
    if (biggestLine && vc > 0) add({ id: "F-vcmix", area: "Financial", severity: "info", title: "Largest variable cost", detail: `${biggestLine.name} is ${usd(biggestLine.perUnit)} of the ${usd(vc)} variable cost per unit (${pct(biggestLine.perUnit / vc)}).` });
  }
  add({ id: "F-startup", area: "Financial", severity: "info", title: "Startup cash required (separate from break-even)", detail: `${usd0(r.startupOneTime)} in one-time costs plus ${usd0(r.initialInventory)} of initial inventory = ${usd0(r.startupCash)} before the first sale.${r.profit > 0 ? ` At the modeled profit this takes about ${(r.startupCash / r.profit).toFixed(1)} years to recover.` : " The model shows no operating profit to recover it."}` });

  // ---------------- Competitive ----------------
  const cp = main && isComparableProduct(main) ? comparePrice(main.price) : null;
  const rec = COMP.preliminary_pricing_recommendation;
  if (cp && main) {
    if (cp.inRange) add({ id: "C-range", area: "Competitive", severity: "strength", title: "Within the preliminary research range", detail: `${usd(main.price)} is inside the Mission 1 range of ${usd0(rec.tentative_range_min)}–${usd0(rec.tentative_range_max)}.` });
    else add({ id: "C-range", area: "Competitive", severity: Math.abs(cp.rangeGap) > 10 ? "moderate" : "info", title: `${cp.rangeGap < 0 ? "Below" : "Above"} the preliminary research range`, detail: `${usd(Math.abs(cp.rangeGap))} ${cp.rangeGap < 0 ? "below" : "above"} the ${usd0(rec.tentative_range_min)}–${usd0(rec.tentative_range_max)} range from Mission 1.` });
    add({ id: "C-pos", area: "Competitive", severity: "info", title: "Position against representative competitors", detail: `Cheaper than you: ${cp.cheaper.map((x) => `${x.name} ${usd(x.price)}`).join(", ") || "none"}. Similar (±10%): ${cp.similar.map((x) => `${x.name} ${usd(x.price)}`).join(", ") || "none"}. More expensive: ${cp.pricier.map((x) => `${x.name} ${usd(x.price)}`).join(", ") || "none"}. ${cp.vsMedian >= 0 ? usd(cp.vsMedian) + " above" : usd(-cp.vsMedian) + " below"} the representative median (${usd(REP_MEDIAN)}).` });
    if (cp.aboveAll) add({ id: "C-above", area: "Competitive", severity: "high", title: "Priced above every researched competitor offer", detail: `No researched organizer is priced above ${usd(main.price)}, including premium brands Mark & Graham ($99) and Monos ($95).` });
    else if (cp.premium) add({ id: "C-premium", area: "Competitive", severity: "moderate", title: "Premium position rests on untested differentiation", detail: `Above the representative median (${usd(REP_MEDIAN)}), where competitors rely on brand, materials, gifting and personalization. The venture's differentiators (whole-chain support, tested closures) are not yet proven, and the research judged pricing at or above BÉIS ($48) unlikely to be supported for an unknown brand.` });
    if (cp.belowAll) add({ id: "C-below", area: "Competitive", severity: "moderate", title: "Priced below every researched offer", detail: `${usd(main.price)} is below even BAGSMART's clearance price ($9.99). The research argues the venture offers more than the necklace-only Lolalet ($18.99).` });
  } else if (main) add({ id: "C-na", area: "Competitive", severity: "info", title: "No directly comparable competitor pricing unit", detail: `${main.name} uses a ${main.model} model; researched competitor prices are one-time purchases, so they are not compared directly.` });

  // ---------------- Evidence ----------------
  const weighted = m.expenses.map((e) => ({ e, amt: annualOf(m, e) })).filter((x) => x.amt > 0);
  const total = weighted.reduce((s, x) => s + x.amt, 0) || 1;
  const share = (ev: string[]) => weighted.filter((x) => ev.includes(x.e.evidence)).reduce((s, x) => s + x.amt, 0) / total;
  const researchedShare = share(["Researched"]);
  const illustrativeShare = share(["Illustrative"]);
  const top = [...weighted].sort((a, b) => b.amt - a.amt).slice(0, 5);
  const topUnsourced = top.filter((x) => x.e.evidence === "Illustrative" || x.e.evidence === "Student-Entered");
  add({ id: "E-share", area: "Evidence", severity: illustrativeShare > 0.4 ? "high" : illustrativeShare > 0.2 ? "moderate" : "info", title: "How much of the cost model is evidenced", detail: `${pct(researchedShare)} of modeled annual costs come from researched figures; ${pct(illustrativeShare)} from illustrative placeholders. Largest unsourced costs: ${topUnsourced.map((x) => `${x.e.name} (${usd0(x.amt)})`).join(", ") || "none among the five largest"}.` });
  const missing = ESSENTIAL.filter((g) => !g.ids.some((id) => m.expenses.find((e) => e.id === id)?.enabled));
  if (missing.length) add({ id: "E-missing", area: "Evidence", severity: "high", title: "Essential costs are switched off", detail: `No enabled cost for: ${missing.map((g) => g.label).join("; ")}. Results may understate true costs.` });
  const unsupportedVolume = sold.filter((p) => p.volumeEvidence.trim().length < 15);
  add({ id: "E-volume", area: "Evidence", severity: unsupportedVolume.length ? "high" : "moderate", title: "Expected sales volume is an assumption", detail: unsupportedVolume.length ? `No rationale entered for the expected quantity of ${unsupportedVolume.map((p) => p.name).join(", ")}. Break-even and profit depend heavily on this number.` : "You entered a rationale for expected sales, but it is still an unverified assumption, not a forecast." });
  const days = Math.max(0, Math.round((today.getTime() - new Date(COMP.metadata.date_compiled + "T00:00:00").getTime()) / 86400000));
  add({ id: "E-age", area: "Evidence", severity: days > 90 ? "moderate" : "info", title: "Competitor prices are a snapshot", detail: `Observed on ${COMP.metadata.date_compiled} (${days} day${days === 1 ? "" : "s"} ago). Several were promotional; prices may have changed.` });
  add({ id: "E-claims", area: "Evidence", severity: "moderate", title: "Product performance is untested", detail: "The venture is at concept stage: materials, dimensions and closure durability are still being tested, so differentiation claims are not yet proven." });
  const custom = m.expenses.filter((e) => e.custom && e.enabled && !e.sourceUrl);
  if (custom.length) add({ id: "E-custom", area: "Evidence", severity: "info", title: "Custom expenses without sources", detail: custom.map((e) => e.name).join(", ") });

  // ---------------- Classification ----------------
  const comb = r.cmRatio ?? 0;
  let classification: Classification; let reason: string;
  if (underwater.length || (sold.length > 0 && !r.breakEvenAchievable)) {
    classification = "Financially unsustainable under current assumptions";
    reason = underwater.length ? `${underwater.map((p) => p.name).join(", ")} is priced at or below variable cost.` : "Combined contribution margin is zero or negative.";
  } else if (r.profit < 0 || comb < 0.2 || f.some((x) => x.id === "C-above")) {
    classification = "High modeled risk";
    reason = r.profit < 0 ? "Expected sales are below break-even, producing an operating loss." : comb < 0.2 ? "Contribution margin is below 20%." : "Price is above every researched competitor offer.";
  } else if ((r.marginOfSafety ?? 0) < 0.25 || fragile || f.some((x) => x.id === "C-premium" || x.id === "C-below")) {
    classification = "Moderate modeled risk";
    reason = (r.marginOfSafety ?? 0) < 0.25 ? "Margin of safety is under 25%." : fragile ? "Profit turns negative under a stress test." : "Price position needs differentiation that is not yet proven.";
  } else {
    classification = "Lower modeled risk";
    reason = "Profitable with a healthy margin of safety, resilient to stress tests, within the researched market.";
  }
  const evidenceConfidence = researchedShare >= 0.6 && !missing.length && !unsupportedVolume.length ? "High" : researchedShare >= 0.35 && !missing.length ? "Medium" : "Low";
  const evidenceReason = `${pct(researchedShare)} of modeled costs researched${missing.length ? "; essential costs missing" : ""}${unsupportedVolume.length ? "; sales volume has no rationale" : ""}. Evidence confidence describes the quality of the inputs, not the financial result.`;

  // ---------------- Recommendations (each with its reason) ----------------
  if (underwater.length) recs.push({ text: `Raise the price of ${underwater[0].name} above ${usd(underwater[0].vcPerUnit)} or cut its variable costs.`, why: "Below variable cost, every sale loses money, so no sales volume can reach break-even." });
  if (r.profit < 0 && r.breakEvenAchievable && r.single?.breakEvenUnits != null && main)
    recs.push({ text: `Compare the ${Math.ceil(r.single.breakEvenUnits).toLocaleString()}-unit break-even with your ${main.quantity.toLocaleString()}-unit sales assumption, and decide which lever to test first: price, variable costs, or fixed costs.`, why: `The model currently loses ${usd0(-r.profit)} a year. Closing the gap needs higher contribution per unit or lower fixed costs; more spending alone is not assumed to raise sales.` });
  if (biggestLine && main && biggestLine.perUnit / Math.max(1, variableCostBreakdown(m, main).reduce((s, l) => s + l.perUnit, 0)) > 0.3)
    recs.push({ text: `Investigate ways to reduce “${biggestLine.name}” (${usd(biggestLine.perUnit)} per unit), for example by negotiating rates, offering free shipping only above an order threshold, or charging shipping separately.`, why: "It is the single largest variable cost, so small changes to it move the contribution margin the most." });
  if (f.some((x) => x.id === "C-premium" || x.id === "C-above")) recs.push({ text: "Before committing to a premium price, run the durability test and create side-by-side demo content against a basic pouch.", why: `The research says ${rec.value_proposition_to_justify.toLowerCase()} would be needed to justify a price above budget options.` });
  if (cp && !cp.inRange && !cp.premium && !cp.belowAll) recs.push({ text: `Explain why your price differs from the ${usd0(rec.tentative_range_min)}–${usd0(rec.tentative_range_max)} preliminary range in your decision statement.`, why: "The preliminary range reflects the competitor research; departing from it is allowed but should be justified by costs or value." });
  if (unsupportedVolume.length) recs.push({ text: "Write down where your expected sales number comes from (pre-orders, a waitlist, a small ad test, or comparable sellers' review counts).", why: "Break-even and profit depend directly on this number, and it is currently unsupported." });
  if (topUnsourced.length) recs.push({ text: `Get real quotes for ${topUnsourced.slice(0, 2).map((x) => x.e.name.toLowerCase()).join(" and ")}.`, why: "These are among the largest costs in the model and are illustrative placeholders or student entries." });
  if (m.expenses.find((e) => e.id === "V01")?.evidence !== "Researched") recs.push({ text: "Request manufacturer quotes for the finished organizer at your intended order quantity.", why: "Manufacturing cost is estimated from simpler comparable products; it is the foundation of the unit cost." });
  if (missing.length) recs.push({ text: `Re-enable or replace the missing essential cost(s): ${missing.map((g) => g.label).join(", ")}.`, why: "Leaving out a necessary cost makes break-even look easier than it is." });
  if (r.startupCash > 0) recs.push({ text: `Plan financing for about ${usd0(r.startupCash)} of startup cash (one-time costs + initial inventory).`, why: "Startup cash is needed before the first sale and is not covered by the break-even calculation." });

  const majorWarnings = f.filter((x) => x.severity === "critical" || x.severity === "high").map((x) => `${x.title} — ${x.detail}`);
  const sev = (s: Severity) => f.filter((x) => x.severity === s);

  return {
    at: today.toISOString(),
    fingerprint: fingerprint(m),
    classification, classificationReason: reason,
    evidenceConfidence, evidenceReason,
    findings: f, recommendations: recs,
    summary: {
      price: main ? `${main.name}: ${usd(main.price)} per ${main.model === "monthly" ? "month" : main.model === "annual" ? "year" : "unit"}` : "No product",
      financial: f.filter((x) => x.area === "Financial" && x.severity !== "strength").map((x) => `${x.title}: ${x.detail}`),
      competitive: f.filter((x) => x.area === "Competitive" && x.severity !== "strength").map((x) => `${x.title}: ${x.detail}`),
      strengths: sev("strength").map((x) => `${x.title}: ${x.detail}`),
      missing: f.filter((x) => x.area === "Evidence" && x.severity !== "info").map((x) => `${x.title}: ${x.detail}`),
    },
    metrics: {
      revenue: r.revenue, variableCosts: r.variableCosts, fixedCosts: r.fixedTotal, profit: r.profit,
      cmRatio: r.cmRatio, breakEvenRevenue: r.breakEvenRevenue, breakEvenUnits: r.single?.breakEvenUnits ?? null,
      marginOfSafety: r.marginOfSafety, profitLowVolume: lowVol, profitHighVariableCost: highVc,
      researchedCostShare: researchedShare, illustrativeCostShare: illustrativeShare, startupCash: r.startupCash,
    },
    majorWarnings,
  };
};
