# Pricing & Cost Laboratory — Jewelry / Journey (Mission 3)

An interactive financial laboratory for **Jewelry / Journey** (working concept name), a travel jewelry organizer venture. You can explore every cost of running the business, set prices and expected sales, check break-even and scenarios, compare prices with the researched competitors, evaluate the decision, and then **confirm** it and download a **Pricing Decision Report** (Word) plus a **structured JSON handoff** for Mission 4.

**Live laboratory:** https://academiccat16.github.io/venture-pricing-laboratory/

Everything runs in the browser. There is no backend, login, API key or paid service.

> This is an educational planning tool. All figures are assumptions for one operating year, not forecasts. Competitor prices are the Mission 1 research snapshot (2026-10-27), not live prices. The laboratory never confirms a decision on the student's behalf.

## Sections

1. **Business Overview:** venture facts, each marked *Confirmed*, *Derived* or *Assumption*; live KPIs; the original website URLs (editable); save, export and import.
2. **Cost Structure:** 37 venture-specific costs (variable, fixed and startup):
   - **Controls:** sliders with ranges suited to each cost type, a benchmark marker with a tooltip, numeric input, on/off toggles, full editing, restore, and add/delete for your own costs.
   - **Views:** a category donut (Chart B) and an evidence-mix bar.
3. **Products & Pricing:** price and expected-sales sliders, a rationale for the sales number, pricing model, product-specific cost, initial inventory, customer-facing features, add-ons, extra products or tiers (labelled *Student scenario*), and the shared-overhead allocation setting. Includes **Chart E**, the product comparison.
4. **Break-Even Analysis:**
   - **Results:** KPI cards and the formulas with your numbers, plus a clear message when break-even cannot be reached.
   - **Chart A:** break-even, with profit and loss regions and an adjustable quantity range.
   - **Chart C:** price sensitivity, with volume held constant (stated on the chart).
5. **Financial Scenarios:** a comparison of Lean, Typical and Expansion (presets change costs only; demand is not assumed to rise with spending), saved custom scenarios, and **Chart D**, the volume scenarios (student-defined, not probabilities).
6. **Competitive Position:** your price against every researched offer:
   - which competitors are cheaper, similar (±10%) or more expensive
   - the medians, the preliminary range and the closest products
   - promotional, verification and stock flags
   - competitive attractiveness explained separately from financial viability
7. **Pricing Decision Review:** **Evaluate My Pricing Decision** → classification and evidence confidence → written evaluation → **Revise** or **Confirm** (major warnings must be acknowledged, and a written justification is required) → **Download My Pricing Decision Report** and `Pricing_Decision_Data.json`.

## Cost model (venture-specific)

The model assumes a concept-stage, founder-run, online physical product: contract-manufactured, imported, and shipped by the seller from home. It deliberately excludes commercial rent, employees and land at launch. Amazon fees are included but switched off, as an alternative channel. Expansion adds a 3PL (third-party fulfillment warehouse), storage and part-time support.

| Evidence | Meaning | Examples |
|---|---|---|
| **Researched** | An identifiable source supports the figure (URL and date checked, 2026-10-27) | Shopify Basic $29/mo (yearly billing) and 2.9% + 30¢; Stripe 2.9% + 30¢; USPS Ground Advantage commercial $7.33–$8.95 (under 1 lb); Uline mailers $0.20; Insureon general liability $45/mo (customer median); QuickBooks $38/mo; Klaviyo free plan; BLS customer service wage $21.53/h; USPTO $350 per class; GS1 GTIN $30; Texas LLC $300; California $800 franchise tax; Amazon 15% referral fee and $39.99 plan; packaging $0.20–$1.50 |
| **Estimated** | A reasoned approximation with stated assumptions | Manufacturing $6.50 (benchmarked against simpler rolls at $2.68–$3.98); import duty 17.6% base rate; returns allowance 4% (founder's review sample: 7 of 80 reported faulty snaps); durability testing; samples; tooling (amortised over 3 years) |
| **Illustrative** | A teaching placeholder; verify it | Inbound freight, ad budget, founder pay, creator gifting, design, photography, storage, store apps |
| **Student-Entered** | Any value you change | — |

**Typical model at $34 and 600 units:**

| Measure | Value |
|---|---|
| Variable cost | $20.25 per unit |
| Contribution | $13.75 per unit (40.5%) |
| Fixed costs | $13,671 per year |
| Break-even | 994 units |
| Operating result | −$5,418 |
| Startup cash | $8,180 |

Shipping is the largest variable cost. These figures are verified by independent tests.

## Calculations

- Contribution margin per unit = price − variable cost per unit.
- Break-even units = fixed costs ÷ contribution margin per unit, rounded up.
- Operating profit = revenue − variable costs − fixed costs.
- Multiple products: break-even revenue = fixed costs ÷ the weighted contribution ratio at the expected sales mix. Shared overhead is allocated by revenue or unit share for product-level reports only, and is never double counted.
- Subscriptions are normalised to yearly revenue.
- A zero or negative margin means break-even is not achievable, and no misleading finite number is shown.
- Startup costs are kept separate. Capital items can be amortised into fixed costs.

## Review rules (transparent)

| Classification | Rule |
|---|---|
| Financially unsustainable under current assumptions | Price ≤ variable cost for a product with sales, or the combined margin is ≤ 0 |
| High modeled risk | An operating loss at expected sales, or a margin under 20%, or a price above every researched offer |
| Moderate modeled risk | Profitable, but the margin of safety is under 25%, or profit fails a stress test (−20% sales or +10% variable cost), or the price is a premium position resting on untested differentiation |
| Lower modeled risk | None of the above |

The thresholds are teaching rules, not industry standards, and the classifications do not predict business failure. Evidence confidence (how much of the cost model is researched, whether essential costs are missing, and whether the sales number has a rationale) is reported separately.

## Exports

- **Pricing_Decision_Report.docx:** a genuine Word document with 10 sections, generated in the browser with the `docx` library.
- **Pricing_Decision_Data.json:** the same confirmed snapshot in machine-readable form. Only `products[].customerFacing` is meant for public website display; all other fields are internal planning data.
- **Pricing_Lab_Configuration.json:** a backup of your work (Export / Import on the Overview page).

Both decision files come from the same confirmed snapshot. If any input changes after confirming, you must evaluate and confirm again before you can download.

## Persistence

Work is saved automatically in this browser (localStorage). It is lost if browser data is cleared or on another device, so use **Export** to keep a backup.

## Development

```bash
npm install
npm run dev            # development server
npm run build          # production build (dist/)
npm run preview        # http://localhost:4174/venture-pricing-laboratory/
npm run test:unit      # 48 independent math checks (Node 22.6+)
npm run test:e2e       # 71 browser checks incl. DOCX/JSON validation (needs the preview server, Chrome/Edge, Python + python-docx)
npm run deploy         # build + publish to the gh-pages branch
```

The stack is React 19, TypeScript, Vite 8, Tailwind CSS 4, Recharts 3, lucide-react and docx. The Mission 1 research file `src/data/competitor_data.json` is a byte-identical copy of the original.
