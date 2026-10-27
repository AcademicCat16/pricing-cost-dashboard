/** Word report builder, loaded on demand (the docx library is large). */
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, HeadingLevel, Packer, PageNumber, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import { compute } from "./finance.ts";
import type { Expense } from "./types.ts";
import type { Confirmation } from "./store.tsx";
import { RESEARCH_DATE } from "../data/venture.ts";
import { COMP, REP_MEDIAN } from "./competition.ts";
import { CRITERIA } from "./evaluate.ts";
import { buildDecisionData, scenarioResults, billingLabel, usd, num, freqLabel, amountLabel } from "./report.ts";

// ---------------- DOCX ----------------
const BRAND = "1F2A44", ACCENT = "4F5BD5", GREY = "6B7280", LIGHT = "EEF0FB";
const P = (text: string, opts: { bold?: boolean; color?: string; size?: number; italics?: boolean; spacing?: number } = {}) =>
  new Paragraph({ spacing: { after: opts.spacing ?? 120 }, children: [new TextRun({ text, bold: opts.bold, color: opts.color, size: opts.size, italics: opts.italics })] });
const H1 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 }, children: [new TextRun({ text: t, color: BRAND, bold: true })] });
const H2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [new TextRun({ text: t, color: ACCENT, bold: true })] });
const Bullet = (t: string) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(t)] });
const link = (url: string, text?: string) => new Paragraph({ spacing: { after: 80 }, children: [new ExternalHyperlink({ link: url, children: [new TextRun({ text: text ?? url, style: "Hyperlink" })] })] });
const cell = (content: string | Paragraph, header = false, width?: number) =>
  new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: LIGHT } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [typeof content === "string" ? new Paragraph({ children: [new TextRun({ text: content, bold: header, size: 18 })] }) : content],
  });
const table = (head: string[], rows: (string | Paragraph)[][], widths?: number[]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, true, widths?.[i])) }), ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, false, widths?.[i])) }))],
  });
const border = { style: BorderStyle.SINGLE, size: 4, color: "D5D8E3" };
const kv = (rows: [string, string][]) => table(["Item", "Detail"], rows, [28, 72]);

export const buildDocx = async (c: Confirmation): Promise<Blob> => {
  const d = buildDecisionData(c);
  const m = c.model, r = compute(m), sc = scenarioResults(m), ev = c.evaluation;
  const res = d.financialAssumptions.results;
  const ops = m.expenses.filter((e) => e.enabled && e.behavior !== "startup");
  const startup = m.expenses.filter((e) => e.enabled && e.behavior === "startup");
  const rec = d.competitivePosition.preliminaryRange;

  const children: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "PRICING DECISION REPORT", bold: true, color: ACCENT, size: 20 })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: d.venture.name, bold: true, color: BRAND, size: 48 })] }),
    P(`Mission 3 — Pricing & Cost Laboratory · Confirmed ${new Date(c.confirmedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}`, { color: GREY }),
    P(`Overall modeled risk: ${ev.classification} · Evidence confidence: ${ev.evidenceConfidence}`, { bold: true }),
    P("All amounts in US dollars. Financial results cover one operating year (12 months); startup costs are reported separately. Figures are student assumptions, not forecasts.", { italics: true, color: GREY, size: 18 }),

    H1("1. Venture Overview"),
    kv([["Venture name", d.venture.name], ["Founder", d.venture.founder], ["Business concept", d.venture.concept], ["Products / services", m.products.map((p) => p.name).join("; ")], ["Target customers", d.venture.targetCustomers], ["Value proposition", d.venture.valueProposition], ["Development status", d.venture.developmentStatus]]),

    H1("2. Website Information"),
    P("The original venture website that should receive the pricing page in Mission 4:"),
    table(["Item", "URL"], [["Original website repository", link(d.website.repositoryUrl)], ["Original live website", link(d.website.liveUrl)]], [32, 68]),

    H1("3. Final Pricing Decision"),
    ...m.products.flatMap((p) => [
      H2(p.name + (p.studentScenario ? " (student scenario)" : "")),
      kv([
        ["Description", p.description], ["Selected price", usd(p.price)], ["Currency", "USD"], ["Billing / pricing unit", billingLabel(p)],
        ["Included features", p.features.length ? p.features.join("; ") : "None listed"],
        ["Optional add-ons", p.addOns.length ? p.addOns.map((a) => `${a.name} (${usd(a.price)})${a.description ? ` — ${a.description}` : ""}`).join("; ") : "None"],
      ]),
    ]),
    H2("Student's pricing justification"),
    P(c.justification),

    H1("4. Cost Assumptions"),
    P("Active operating costs (included in break-even):", { bold: true }),
    table(["Expense", "Amount", "Frequency", "Class", "Evidence", "Assumptions & source"],
      ops.map((e) => [e.name, amountLabel(e), freqLabel(e), e.behavior === "fixed" ? `Fixed (${e.allocation === "shared" ? "shared" : "product"})` : "Variable", e.evidence, srcPara(e)]), [20, 10, 11, 10, 11, 38]),
    P(""),
    P("Startup costs (one-time cash requirement, shown separately):", { bold: true }),
    table(["Expense", "Amount", "Treatment", "Evidence", "Assumptions & source"],
      [...startup.map((e) => [e.name, usd(e.amount), freqLabel(e), e.evidence, srcPara(e)]),
        ["Initial inventory (cash, not an expense)", usd(r.initialInventory), "one-time", "Calculated", m.products.map((p) => `${p.name}: ${num(p.initialInventory)} units`).join("; ")]], [24, 11, 18, 11, 36]),

    H1("5. Financial Results"),
    P("Time horizon: one operating year. Constant per-unit costs and the stated sales quantities are assumed. Sales volume is a student assumption and is not linked to price or spending.", { italics: true, color: GREY, size: 18 }),
    kv([
      ["Expected revenue", usd(res.revenue)], ["Variable costs", usd(res.variableCosts)], ["Contribution", usd(res.contribution)],
      ["Contribution margin ratio", res.contributionMarginRatio != null ? `${(res.contributionMarginRatio * 100).toFixed(1)}%` : "n/a"],
      ["Fixed operating costs", usd(res.fixedOperatingCosts)], ["Amortisation of capital items", usd(res.amortisation)], ["Fixed costs used in break-even", usd(res.fixedCostsInBreakEven)],
      ["Operating profit / (loss)", usd(res.operatingProfit)],
      ["Break-even revenue", res.breakEvenRevenue != null ? usd(res.breakEvenRevenue) : "Not achievable: contribution margin is zero or negative"],
      ["Margin of safety", res.marginOfSafety != null ? `${(res.marginOfSafety * 100).toFixed(1)}%` : "n/a"],
      ["Startup cash requirement", `${usd(res.startupCash)} (one-time costs ${usd(res.startupOneTimeCosts)} + initial inventory ${usd(res.initialInventory)})`],
    ]),
    P(""),
    table(["Product", "Price", "Variable cost / unit", "Contribution / unit", "Expected units", "Revenue", "Break-even units", "Allocated profit"],
      r.products.map((p) => [p.name, usd(p.price), usd(p.vcPerUnit), usd(p.cmPerUnit), num(p.units), usd(p.revenue), p.breakEvenUnits != null ? num(Math.ceil(p.breakEvenUnits)) : "Not achievable", usd(p.allocatedProfit)])),
    P(`Formulas: contribution margin per unit = price − variable cost per unit; break-even units = fixed costs ÷ contribution margin per unit${m.products.length > 1 ? " (multi-product: break-even revenue = fixed costs ÷ weighted contribution ratio at the expected sales mix; a different mix gives a different result)" : ""}; operating profit = revenue − variable costs − fixed costs. Shared overhead allocated by ${m.settings.allocation === "units" ? "unit" : "revenue"} share for product-level profit only.`, { size: 18, color: GREY }),
    H2("Operating scenarios (same prices and volumes; costs from each preset)"),
    table(["Scenario", "Fixed costs", "Variable cost / unit", "Break-even units", "Revenue", "Operating profit"],
      sc.presets.map((s) => [s.scenario, usd(s.fixedCosts), s.variableCostPerUnit != null ? usd(s.variableCostPerUnit) : "multi-product", s.breakEvenUnits != null ? num(Math.ceil(s.breakEvenUnits)) : s.breakEvenRevenue != null ? `${usd(s.breakEvenRevenue)} revenue` : "Not achievable", usd(s.revenue), usd(s.profit)])),
    H2("Sales volume scenarios (student-defined assumptions, not probabilities)"),
    table(["Scenario", "Volume factor", "Units", "Revenue", "Total costs", "Operating profit"],
      sc.volumes.map((v) => [v.scenario, `${Math.round(v.volumeFactor * 100)}%`, num(v.units), usd(v.revenue), usd(v.totalCosts), usd(v.profit)])),

    H1("6. Competitive Positioning"),
    P(`Competitor prices observed on ${RESEARCH_DATE} (research snapshot, not live prices). Representative median: ${usd(REP_MEDIAN)}. Preliminary recommended range: ${usd(rec.min)}–${usd(rec.max)} (${rec.status}).`),
    table(["Competitor", "Type", "Positioning", "Representative product", "Price", "Price type", "Verification"],
      d.competitivePosition.representativeCompetitors.map((x) => [x.name, x.classification, x.positioning, x.product, usd(x.price), x.priceType, x.verification])),
    ...d.competitivePosition.comparisons.flatMap((cp) => [
      H2(`${cp.product}: ${usd(cp.price)}`),
      Bullet(`Cheaper competitors: ${cp.cheaperCompetitors.join(", ") || "none"}`),
      Bullet(`Similarly priced (±10%): ${cp.similarCompetitors.join(", ") || "none"}`),
      Bullet(`More expensive competitors: ${cp.moreExpensiveCompetitors.join(", ") || "none"}`),
      Bullet(`Difference from representative median: ${cp.differenceFromRepresentativeMedian >= 0 ? "+" : "−"}${usd(Math.abs(cp.differenceFromRepresentativeMedian))}`),
      Bullet(`Within preliminary range: ${cp.withinPreliminaryRange ? "Yes" : "No"}`),
      Bullet(`Closest researched products: ${cp.closestProducts.map((x) => `${x.product} (${usd(x.price)})`).join("; ")}`),
    ]),
    P("Competitive attractiveness (how the price compares with alternatives) is different from financial viability (whether the price covers costs under these assumptions). Competitor prices alone do not establish customer willingness to pay.", { italics: true, color: GREY, size: 18 }),

    H1("7. Pricing Decision Review"),
    kv([["Overall classification", ev.classification], ["Reason", ev.classificationReason], ["Evidence confidence", `${ev.evidenceConfidence} — ${ev.evidenceReason}`], ["Evaluated", new Date(ev.at).toLocaleString("en-US")]]),
    H2("Classification criteria"),
    ...CRITERIA.map((x) => Bullet(`${x.label}: ${x.rule}`)),
    H2("Financial risks"), ...listOrNone(ev.findings.filter((x) => x.area === "Financial" && x.severity !== "strength").map((x) => `[${x.severity}] ${x.title} — ${x.detail}`)),
    H2("Competitive risks"), ...listOrNone(ev.findings.filter((x) => x.area === "Competitive" && x.severity !== "strength").map((x) => `[${x.severity}] ${x.title} — ${x.detail}`)),
    H2("Evidence limitations"), ...listOrNone(ev.findings.filter((x) => x.area === "Evidence").map((x) => `[${x.severity}] ${x.title} — ${x.detail}`)),
    H2("Strengths"), ...listOrNone(ev.findings.filter((x) => x.severity === "strength").map((x) => `${x.title} — ${x.detail}`)),
    H2("Recommendations"), ...listOrNone(ev.recommendations.map((x) => `${x.text} Why: ${x.why}`)),
    H2("Warnings acknowledged by the student"), ...listOrNone(c.acknowledgedWarnings),

    H1("8. Student Decision Statement"),
    P("Why have you selected this price, and how do you justify it based on your costs, competitors, and value proposition?", { italics: true, color: GREY }),
    P(c.justification),

    H1("9. Sources and Limitations"),
    H2("Cost benchmark sources (checked 2026-10-27)"),
    ...uniqueSources(m.expenses.filter((e) => e.enabled && e.sourceUrl)).map((s) => link(s.url, `${s.label} — ${s.url}`)),
    H2("Competitor sources (Mission 1)"),
    ...Array.from(new Set(COMP.pricing_offers.map((o) => o.source_url))).map((u) => link(u)),
    H2("Modeling limitations"),
    ...d.limitations.map(Bullet),

    H1("10. Confirmation Record"),
    kv([
      ["Confirmation date", new Date(c.confirmedAt).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })],
      ["Final selected prices", m.products.map((p) => `${p.name}: ${usd(p.price)} ${billingLabel(p)}`).join("; ")],
      ["Evaluation status", "Evaluated — current at confirmation"],
      ["Confirmation status", "Confirmed by student"],
      ["Acknowledged warnings", c.acknowledgedWarnings.length ? `${c.acknowledgedWarnings.length} acknowledged (listed in Section 7)` : "None required"],
      ["Snapshot ID", c.fingerprint],
    ]),
  ];

  const doc = new Document({
    creator: "Mission 3 Pricing & Cost Laboratory",
    title: `Pricing Decision Report — ${d.venture.name}`,
    description: "Confirmed pricing decision, cost assumptions, financial results and review.",
    styles: {
      default: { document: { run: { font: "Calibri", size: 21 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, color: BRAND }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0, keepNext: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 25, bold: true, color: ACCENT }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1, keepNext: true } },
      ],
      characterStyles: [
        { id: "Hyperlink", name: "Hyperlink", basedOn: "DefaultParagraphFont", run: { color: "2F54EB", underline: { type: "single" } } },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${d.venture.name} · Pricing Decision Report · Page `, color: GREY, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: GREY, size: 16 })] })] }) },
      children,
    }],
  });
  return Packer.toBlob(doc);
};

const srcPara = (e: Expense) => {
  const runs: (TextRun | ExternalHyperlink)[] = [new TextRun({ text: e.assumptions, size: 16 })];
  if (e.sourceUrl) runs.push(new TextRun({ text: " Source: ", size: 16, bold: true }), new ExternalHyperlink({ link: e.sourceUrl, children: [new TextRun({ text: e.sourceLabel ?? e.sourceUrl, style: "Hyperlink", size: 16 })] }));
  return new Paragraph({ children: runs });
};
const listOrNone = (items: string[]) => (items.length ? items.map(Bullet) : [P("None identified.", { color: GREY })]);
const uniqueSources = (es: Expense[]) => {
  const seen = new Map<string, string>();
  es.forEach((e) => { if (e.sourceUrl && !seen.has(e.sourceUrl)) seen.set(e.sourceUrl, e.sourceLabel ?? e.sourceUrl); });
  return [...seen].map(([url, label]) => ({ url, label }));
};

