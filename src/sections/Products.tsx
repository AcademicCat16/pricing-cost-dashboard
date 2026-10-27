import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Copy, Package, Plus, Trash2, X, BarChart3, Settings2 } from "lucide-react";
import { useStore } from "../lib/store.tsx";
import { compute, variableCostBreakdown, inventoryUnitCost } from "../lib/finance.ts";
import type { PricingModel, Product } from "../lib/types.ts";
import { REC } from "../data/venture.ts";
import { Button, CostSlider, GLOSSARY, InfoTip, NumberField, Panel, PanelTitle, Pill, SectionHeader, Segmented, TooltipBox, inputCls, num, pct, usd, usd0 } from "../components/ui.tsx";

const MODEL_LABEL: Record<PricingModel, string> = { one_time: "One-time purchase (per unit)", monthly: "Monthly subscription", annual: "Annual subscription", service: "Service fee" };
const QTY_LABEL: Record<PricingModel, string> = { one_time: "Expected units sold per year", monthly: "Average active subscribers", annual: "Subscribers per year", service: "Services sold per year" };

export const Products = () => {
  const { state, dispatch } = useStore();
  const m = state.model;
  const r = useMemo(() => compute(m), [m]);

  const addProduct = (copyOf?: Product) => {
    const id = `p-${Date.now().toString(36)}`;
    const base: Product = copyOf
      ? { ...copyOf, id, name: `${copyOf.name} — tier ${m.products.length + 1}`, studentScenario: true, features: [...copyOf.features], addOns: copyOf.addOns.map((a) => ({ ...a })), quantity: Math.round(copyOf.quantity / 2), initialInventory: 0 }
      : { id, name: `New product ${m.products.length + 1}`, description: "Student scenario — describe this option.", model: "one_time", price: 25, quantity: 100, directUnitCost: 5, initialInventory: 0, features: [], addOns: [], studentScenario: true, volumeEvidence: "" };
    dispatch({ type: "addProduct", product: base });
  };

  const chartData = r.products.map((p) => ({ name: p.name.length > 22 ? p.name.slice(0, 21) + "…" : p.name, Price: p.price, "Unit cost": p.vcPerUnit, "Contribution / unit": p.cmPerUnit, Revenue: p.revenue, "Allocated profit": p.allocatedProfit }));

  return (
    <div>
      <SectionHeader eyebrow="03 · Products & Pricing" title="Products, prices and expected sales"
        subtitle={<>The research documents one product: the travel jewelry organizer. You can add hypothetical products or pricing tiers to explore; they are labelled <Pill tone="venture">Student scenario</Pill>. Expected sales are your assumption, not a verified forecast.</>}
        right={<div className="flex gap-2"><Button onClick={() => addProduct(m.products[0])} testid="add-tier"><Copy size={14} />Copy as tier</Button><Button tone="primary" onClick={() => addProduct()} testid="add-product"><Plus size={15} />Add product</Button></div>} />

      <div className="grid gap-4 2xl:grid-cols-2">
        {m.products.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Panel className="p-5">
          <PanelTitle icon={<Settings2 size={16} />} title="Shared settings" />
          <label className="flex items-center justify-between gap-3 text-sm text-mist-300">
            <span className="flex items-center gap-1">Average units per order <InfoTip text="Per-order costs (postage, mailer, card fixed fee) are divided by this. 1.0 means every order contains one organizer." /></span>
            <NumberField className="w-24" value={m.settings.unitsPerOrder} min={1} max={10} step={0.1} onChange={(v) => dispatch({ type: "settings", patch: { unitsPerOrder: Math.max(1, v) } })} label="Units per order" testid="units-per-order" />
          </label>
          <div className="mt-4 text-sm text-mist-300">
            <div className="mb-2 flex items-center gap-1">Allocate shared overhead by <InfoTip text="Only affects product-level profit in reports. Total profit always uses the combined costs once, without double counting." /></div>
            <Segmented label="Allocation method" value={m.settings.allocation} onChange={(v) => dispatch({ type: "settings", patch: { allocation: v } })} options={[{ value: "revenue", label: "Revenue share" }, { value: "units", label: "Unit share" }]} />
          </div>
          {m.products.length > 1 && (
            <p className="mt-4 rounded-xl bg-amber-300/[0.06] p-3 text-xs leading-relaxed text-amber-100/90 ring-1 ring-amber-300/20">
              Multi-product break-even uses your expected sales mix ({r.products.map((p) => `${p.name}: ${pct(r.revenue ? p.revenue / r.revenue : 0, 0)} of revenue`).join("; ")}). Changing the mix changes break-even.
            </p>
          )}
        </Panel>

        <Panel className="p-5">
          <PanelTitle icon={<BarChart3 size={16} />} title="E · Product-level comparison" hint="Per-unit economics and annual results at expected sales; shared overhead allocated by the selected method." />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} width={48} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={({ active, payload, label }) => active && payload?.length ? <TooltipBox><div className="mb-1 font-semibold text-mist-100">{label}</div>{payload.map((x) => <div key={String(x.name)} className="text-mist-300">{x.name}: <span className="font-mono">{usd(Number(x.value))}</span></div>)}</TooltipBox> : null} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Price" fill="#7c8cff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Unit cost" fill="#fb7185" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Contribution / unit" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="text-mist-400"><tr>{["Product", "Price", "Unit cost", "Contribution", "Expected units", "Revenue", "Allocated profit"].map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/5 font-mono text-mist-200">
                {r.products.map((p) => <tr key={p.id}><td className="py-1.5 pr-3 font-sans">{p.name}</td><td className="pr-3">{usd(p.price)}</td><td className="pr-3">{usd(p.vcPerUnit)}</td><td className={`pr-3 ${p.cmPerUnit <= 0 ? "text-rose-300" : ""}`}>{usd(p.cmPerUnit)}</td><td className="pr-3">{num(p.units)}</td><td className="pr-3">{usd0(p.revenue)}</td><td className={`pr-3 ${p.allocatedProfit < 0 ? "text-rose-300" : "text-emerald-300"}`}>{usd0(p.allocatedProfit)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
};

const ProductCard = ({ p, index }: { p: Product; index: number }) => {
  const { state, dispatch } = useStore();
  const m = state.model;
  const set = (patch: Partial<Product>) => dispatch({ type: "product", id: p.id, patch });
  const r = useMemo(() => compute(m), [m]);
  const pr = r.products.find((x) => x.id === p.id)!;
  const lines = variableCostBreakdown(m, p);
  const [feat, setFeat] = useState("");
  const priceMax = Math.max(120, Math.ceil(p.price * 1.6));
  const unit = p.model === "monthly" ? "/month" : p.model === "annual" ? "/year" : p.model === "service" ? "/service" : "/unit";

  return (
    <Panel className="relative overflow-hidden p-5" >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-500/10 blur-3xl" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent-500/30 to-emerald-400/20 text-accent-400 ring-1 ring-white/10"><Package size={20} /></div>
          <div className="min-w-0 flex-1">
            <input aria-label="Product name" className="w-full bg-transparent text-base font-semibold text-mist-100 outline-none focus:ring-0" value={p.name} onChange={(e) => set({ name: e.target.value })} data-testid={`product-name-${index}`} />
            <div className="mt-1 flex flex-wrap gap-1.5">
              {p.studentScenario ? <Pill tone="venture">Student scenario</Pill> : <Pill tone="good">From research</Pill>}
              <Pill>{MODEL_LABEL[p.model]}</Pill>
            </div>
          </div>
        </div>
        {m.products.length > 1 && <Button tone="ghost" className="text-xs text-rose-300" onClick={() => { if (confirm(`Remove “${p.name}”?`)) dispatch({ type: "removeProduct", id: p.id }); }} testid={`remove-product-${index}`}><Trash2 size={13} />Remove</Button>}
      </div>
      <textarea aria-label="Product description" rows={2} className={`${inputCls} mt-3 text-[13px]`} value={p.description} onChange={(e) => set({ description: e.target.value })} />

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-mist-400"><span>Selling price {unit}</span><span className="text-[11px] text-teal-300">Research range {usd0(REC.tentative_range_min)}–{usd0(REC.tentative_range_max)}</span></div>
          <div className="mb-2 text-4xl font-semibold tracking-tight text-mist-100 tabular-nums" data-testid={`price-display-${index}`}>{usd(p.price)}</div>
          <CostSlider value={p.price} onChange={(v) => set({ price: v })} min={0} max={priceMax} step={0.5} label={`${p.name} price`} format={(n) => usd(n, n % 1 ? 2 : 0)}
            benchmark={p.model === "one_time" ? { amount: (REC.tentative_range_min + REC.tentative_range_max) / 2, kind: "researched", label: `Midpoint of the Mission 1 preliminary range (${usd0(REC.tentative_range_min)}–${usd0(REC.tentative_range_max)}); a research suggestion, not a requirement.` } : undefined} testid={`price-slider-${index}`} />
          <NumberField className="mt-2" value={p.price} min={0} onChange={(v) => set({ price: v })} prefix="$" label={`${p.name} exact price`} testid={`price-input-${index}`} />
        </div>
        <div>
          <div className="mb-1 text-xs text-mist-400">{QTY_LABEL[p.model]}</div>
          <div className="mb-2 text-4xl font-semibold tracking-tight text-mist-100 tabular-nums">{num(p.quantity)}</div>
          <CostSlider value={p.quantity} onChange={(v) => set({ quantity: Math.round(v) })} min={0} max={Math.max(5000, p.quantity)} step={10} label={`${p.name} expected quantity`} format={(n) => num(n)} testid={`qty-slider-${index}`} />
          <NumberField className="mt-2" value={p.quantity} min={0} step={1} onChange={(v) => set({ quantity: Math.round(v) })} label={`${p.name} exact quantity`} testid={`qty-input-${index}`} />
          <label className="mt-2 block text-[11px] text-mist-400">Where does this number come from? <span className="text-amber-200/80">(required for a credible review)</span>
            <textarea rows={2} className={`${inputCls} mt-1 text-xs`} placeholder="e.g., waitlist sign-ups, pre-orders, a small ad test, competitor review counts…" value={p.volumeEvidence} onChange={(e) => set({ volumeEvidence: e.target.value })} data-testid={`volume-evidence-${index}`} />
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-mist-400">Pricing model
          <select className={`${inputCls} mt-1`} value={p.model} onChange={(e) => set({ model: e.target.value as PricingModel })} data-testid={`model-${index}`}>
            <option value="one_time">One-time purchase (matches research)</option><option value="monthly">Monthly subscription (exploration)</option><option value="annual">Annual subscription (exploration)</option><option value="service">Service fee (exploration)</option>
          </select>
        </label>
        <label className="text-xs text-mist-400"><span className="flex items-center gap-1">Product-specific unit cost <InfoTip text="Extra variable cost for this product only, added to the cost-structure items that apply to it." /></span><NumberField className="mt-1" value={p.directUnitCost} min={0} prefix="$" onChange={(v) => set({ directUnitCost: v })} label={`${p.name} product-specific unit cost`} testid={`direct-cost-${index}`} /></label>
        <label className="text-xs text-mist-400"><span className="flex items-center gap-1">Initial inventory (units) <InfoTip text={`Stock bought before launch at ${usd(inventoryUnitCost(m, p))} landed cost per unit. Counted in startup cash, not in yearly expenses.`} /></span><NumberField className="mt-1" value={p.initialInventory} min={0} step={1} onChange={(v) => set({ initialInventory: Math.round(v) })} label={`${p.name} initial inventory`} /></label>
      </div>
      {p.model !== "one_time" && <p className="mt-2 rounded-lg bg-amber-300/[0.06] p-2 text-[11px] text-amber-100/90">Subscription and service models are for exploration. Prices are per {p.model === "monthly" ? "month" : p.model === "annual" ? "year" : "service"}, and revenue is converted to a yearly total. Researched competitor prices are one-time purchases, so they are not compared with this product.</p>}

      {/* economics */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Mini label="Variable cost / unit" value={usd(pr.vcPerUnit)} tip={GLOSSARY.variable} />
        <Mini label="Contribution / unit" value={usd(pr.cmPerUnit)} bad={pr.cmPerUnit <= 0} tip={GLOSSARY.cm} />
        <Mini label="Contribution ratio" value={pct(pr.cmRatio)} tip={GLOSSARY.cmRatio} />
        <Mini label="Break-even units" value={pr.breakEvenUnits != null ? num(Math.ceil(pr.breakEvenUnits)) : "Not achievable"} bad={pr.breakEvenUnits == null} tip={GLOSSARY.breakEven} />
      </div>
      {pr.cmPerUnit <= 0 && <p className="mt-2 rounded-lg bg-rose-400/10 p-2 text-xs text-rose-200 ring-1 ring-rose-400/20" data-testid="negative-cm-warning">Price does not cover the variable cost per unit. Under constant costs, selling more increases the loss, so break-even cannot be reached by selling more.</p>}
      <details className="mt-3 rounded-xl bg-ink-950/40 p-3 text-xs ring-1 ring-white/5">
        <summary className="cursor-pointer text-mist-300">Variable cost breakdown ({lines.length} items)</summary>
        <table className="mt-2 w-full"><tbody className="divide-y divide-white/5">
          {lines.map((l) => <tr key={l.id}><td className="py-1 text-mist-400">{l.name}</td><td className="py-1 text-right font-mono text-mist-200">{usd(l.perUnit)}</td></tr>)}
          <tr><td className="py-1 font-medium text-mist-200">Total per unit</td><td className="py-1 text-right font-mono text-mist-100">{usd(pr.vcPerUnit)}</td></tr>
        </tbody></table>
        <p className="mt-2 text-mist-400">Change which costs apply to this product under Cost Structure → Details & edit → “Applies to”.</p>
      </details>

      {/* customer-facing features & add-ons */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs text-mist-400">Customer-facing features <span className="text-mist-400/70">(concept features — untested)</span></div>
          <div className="flex flex-wrap gap-1.5">
            {p.features.map((f, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white/5 py-0.5 pl-2.5 pr-1 text-[11px] text-mist-200 ring-1 ring-white/10">{f}<button aria-label={`Remove feature ${f}`} onClick={() => set({ features: p.features.filter((_, j) => j !== i) })} className="rounded-full p-0.5 text-mist-400 hover:text-rose-300"><X size={11} /></button></span>)}
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (feat.trim()) { set({ features: [...p.features, feat.trim()] }); setFeat(""); } }}>
            <input className={inputCls} placeholder="Add a feature" value={feat} onChange={(e) => setFeat(e.target.value)} aria-label="New feature" /><Button type="submit">Add</Button>
          </form>
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-1 text-xs text-mist-400">Optional add-ons <InfoTip text="Shown in the report as optional extras. Add-on revenue is not included in the financial model; the research suggests testing a personalization add-on using Mark & Graham's $17 monogram fee as a reference." /></div>
          {p.addOns.map((a, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_90px_auto] gap-2">
              <input className={inputCls} value={a.name} aria-label="Add-on name" onChange={(e) => set({ addOns: p.addOns.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <NumberField value={a.price} min={0} prefix="$" label="Add-on price" onChange={(v) => set({ addOns: p.addOns.map((x, j) => (j === i ? { ...x, price: v } : x)) })} />
              <button aria-label="Remove add-on" className="text-mist-400 hover:text-rose-300" onClick={() => set({ addOns: p.addOns.filter((_, j) => j !== i) })}><X size={14} /></button>
            </div>
          ))}
          <Button className="text-xs" onClick={() => set({ addOns: [...p.addOns, { name: "Personalization (monogram)", price: 12, description: "Student scenario — optional extra" }] })}><Plus size={13} />Add an add-on</Button>
        </div>
      </div>
    </Panel>
  );
};

const Mini = ({ label, value, bad, tip }: { label: string; value: string; bad?: boolean; tip?: string }) => (
  <div className="rounded-xl bg-ink-950/50 p-2.5 ring-1 ring-white/5">
    <div className="flex items-center gap-1 text-[10px] text-mist-400">{label}{tip && <InfoTip text={tip} />}</div>
    <div className={`mt-0.5 font-mono text-sm ${bad ? "text-rose-300" : "text-mist-100"}`}>{value}</div>
  </div>
);
