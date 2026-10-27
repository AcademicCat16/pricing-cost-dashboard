import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, LineChart as LineIcon, Sigma, TrendingUp } from "lucide-react";
import { useStore } from "../lib/store.tsx";
import { compute } from "../lib/finance.ts";
import { REC } from "../data/venture.ts";
import { CostSlider, GLOSSARY, InfoTip, Kpi, Panel, PanelTitle, SectionHeader, TooltipBox, num, pct, usd, usd0 } from "../components/ui.tsx";

export const BreakEven = () => {
  const { state } = useStore();
  const m = state.model;
  const r = useMemo(() => compute(m), [m]);
  const totalUnits = r.products.reduce((s, p) => s + p.units, 0);
  // mix-weighted per-unit revenue and variable cost (equals price / VC for a single product)
  const revPerUnit = totalUnits > 0 ? r.revenue / totalUnits : r.products[0]?.price ?? 0;
  const vcPerUnit = totalUnits > 0 ? r.variableCosts / totalUnits : r.products[0]?.vcPerUnit ?? 0;
  const beUnits = r.breakEvenAchievable && revPerUnit - vcPerUnit > 0 ? r.fixedTotal / (revPerUnit - vcPerUnit) : null;
  const suggestedMax = Math.max(100, Math.ceil(Math.max((beUnits ?? 0) * 1.6, totalUnits * 1.6, 200) / 100) * 100);
  const [maxQ, setMaxQ] = useState<number | null>(null);
  const qMax = maxQ ?? suggestedMax;

  const data = useMemo(() => {
    const steps = 60;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const q = (qMax / steps) * i;
      const rev = revPerUnit * q, cost = r.fixedTotal + vcPerUnit * q;
      return { q: Math.round(q), revenue: rev, cost, profitBand: rev >= cost ? [cost, rev] : [rev, rev], lossBand: cost > rev ? [rev, cost] : [cost, cost] };
    });
  }, [qMax, revPerUnit, vcPerUnit, r.fixedTotal]);

  const multi = m.products.length > 1;
  const s = r.single;

  return (
    <div>
      <SectionHeader eyebrow="04 · Break-Even Analysis" title="When does revenue cover every cost?"
        subtitle={<>One operating year. Startup costs are separate (only amortised capital items are included). Results assume constant costs per unit and your expected sales; they are not forecasts.</>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Fixed costs / year" value={usd0(r.fixedTotal)} tip={GLOSSARY.fixed} />
        <Kpi label={multi ? "Avg variable cost / unit" : "Variable cost / unit"} value={usd(vcPerUnit)} tip={GLOSSARY.variable} />
        <Kpi label={multi ? "Avg revenue / unit" : "Selling price"} value={usd(revPerUnit)} />
        <Kpi label="Contribution / unit" value={usd(revPerUnit - vcPerUnit)} tip={GLOSSARY.cm} tone={revPerUnit - vcPerUnit <= 0 ? "bad" : undefined} sub={`${pct(r.cmRatio)} of revenue`} />
        <Kpi label="Break-even units" value={beUnits != null ? num(Math.ceil(beUnits)) : "Not achievable"} tip={GLOSSARY.breakEven} tone={beUnits == null ? "bad" : undefined} sub={multi ? "at your sales mix" : beUnits != null ? `exact ${num(beUnits, 1)} → round up` : undefined} />
        <Kpi label="Break-even revenue" value={r.breakEvenRevenue != null ? usd0(r.breakEvenRevenue) : "—"} tip={GLOSSARY.breakEven} />
        <Kpi label="Expected revenue" value={usd0(r.revenue)} sub={`${num(totalUnits)} units (your assumption)`} />
        <Kpi label="Expected total costs" value={usd0(r.totalCosts)} sub={`${usd0(r.variableCosts)} variable + ${usd0(r.fixedTotal)} fixed`} />
        <Kpi label="Operating profit / loss" value={usd0(r.profit)} tone={r.profit >= 0 ? "good" : "bad"} />
        <Kpi label="Margin of safety" value={r.marginOfSafety != null ? pct(r.marginOfSafety) : "—"} tip={GLOSSARY.mos} tone={r.marginOfSafety != null && r.marginOfSafety < 0 ? "bad" : undefined} sub={r.marginOfSafety != null && r.marginOfSafety < 0 ? "expected sales are below break-even" : undefined} />
        <Kpi label="Startup cash (separate)" value={usd0(r.startupCash)} tip={GLOSSARY.startup} />
        <Kpi label="Units to cover startup cash too" value={beUnits != null && revPerUnit - vcPerUnit > 0 ? num(Math.ceil((r.fixedOperating + r.startupOneTime) / (revPerUnit - vcPerUnit))) : "—"} sub="recurring fixed costs + all one-time startup costs (no double counting of amortisation)" />
      </div>

      {!r.breakEvenAchievable && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-400/30 bg-rose-400/[0.07] p-4 text-sm text-rose-100" data-testid="no-breakeven">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-300" />
          <div><span className="font-semibold">Break-even cannot be achieved by selling more.</span> The contribution margin is zero or negative: each sale costs at least as much as it brings in. Under constant per-unit costs, extra sales only add to the loss. Raise the price or lower variable costs.</div>
        </div>
      )}

      <Panel className="mt-4 p-5">
        <PanelTitle icon={<LineIcon size={16} />} title="A · Break-even chart" hint={multi ? "Units are total units at your expected sales mix." : "Revenue line vs total cost line (fixed + variable)."}
          right={<div className="w-56"><div className="mb-1 text-[11px] text-mist-400">Show up to {num(qMax)} units</div><CostSlider value={qMax} onChange={(v) => setMaxQ(Math.max(50, Math.round(v)))} min={50} max={Math.max(10000, suggestedMax)} step={50} label="Maximum units shown" format={(n) => num(n)} testid="be-range" /></div>} />
        <div className="h-[360px]" role="img" aria-label={`Break-even chart. ${beUnits != null ? `Break-even at ${Math.ceil(beUnits)} units.` : "No break-even."}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="q" type="number" domain={[0, qMax]} tickFormatter={(v) => num(v)} tickLine={false} axisLine={false} label={{ value: "Units sold per year", position: "insideBottom", offset: -4, fill: "#8b93a7", fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} width={52} />
              <Area dataKey="profitBand" stroke="none" fill="#34d399" fillOpacity={0.18} isAnimationActive={false} name="Profit region" />
              <Area dataKey="lossBand" stroke="none" fill="#fb7185" fillOpacity={0.16} isAnimationActive={false} name="Loss region" />
              <Line dataKey="revenue" stroke="#7c8cff" strokeWidth={2.5} dot={false} name="Revenue" isAnimationActive={false} />
              <Line dataKey="cost" stroke="#fb7185" strokeWidth={2.5} dot={false} name="Total costs" isAnimationActive={false} />
              <ReferenceLine y={r.fixedTotal} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: `Fixed ${usd0(r.fixedTotal)}`, fill: "#fbbf24", fontSize: 11, position: "insideTopLeft" }} />
              {totalUnits > 0 && totalUnits <= qMax && <ReferenceLine x={totalUnits} stroke="#facc15" strokeDasharray="3 3" label={{ value: `Expected ${num(totalUnits)}`, fill: "#facc15", fontSize: 11, position: "top" }} />}
              {beUnits != null && beUnits <= qMax && <ReferenceDot x={beUnits} y={revPerUnit * beUnits} r={7} fill="#e9ecf2" stroke="#0b0d12" strokeWidth={2} label={{ value: `Break-even ${num(Math.ceil(beUnits))}`, fill: "#e9ecf2", fontSize: 12, position: "left" }} />}
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                const p = d.revenue - d.cost;
                return <TooltipBox><div className="mb-1 font-semibold text-mist-100">{num(Number(label))} units</div><div className="text-mist-300">Revenue <span className="font-mono">{usd0(d.revenue)}</span></div><div className="text-mist-300">Total costs <span className="font-mono">{usd0(d.cost)}</span></div><div className={p >= 0 ? "text-emerald-300" : "text-rose-300"}>{p >= 0 ? "Profit" : "Loss"} <span className="font-mono">{usd0(Math.abs(p))}</span></div></TooltipBox>;
              }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-mist-400">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-[#7c8cff]" />Revenue</span><span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-[#fb7185]" />Total costs</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm bg-emerald-400/25" />Profit region</span><span className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm bg-rose-400/25" />Loss region</span>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Panel className="p-5">
          <PanelTitle icon={<Sigma size={16} />} title="The formulas with your numbers" />
          {s ? (
            <div className="space-y-3 font-mono text-[13px] text-mist-200">
              <Formula label="Contribution margin per unit" expr={`${usd(s.price)} − ${usd(s.vcPerUnit)}`} result={usd(s.cmPerUnit)} />
              <Formula label="Break-even units" expr={s.cmPerUnit > 0 ? `${usd0(r.fixedTotal)} ÷ ${usd(s.cmPerUnit)}` : "fixed costs ÷ (zero or negative margin)"} result={s.breakEvenUnits != null ? `${num(s.breakEvenUnits, 1)} → ${num(Math.ceil(s.breakEvenUnits))} units` : "not defined"} />
              <Formula label="Operating profit" expr={`${usd0(r.revenue)} − ${usd0(r.variableCosts)} − ${usd0(r.fixedTotal)}`} result={usd0(r.profit)} />
              <p className="font-sans text-[11px] leading-relaxed text-mist-400">Break-even units are rounded up because you cannot sell part of a unit. Money values are rounded for display only; calculations use full precision.</p>
            </div>
          ) : (
            <div className="space-y-3 text-[13px] text-mist-300">
              <Formula label="Weighted contribution ratio" expr={`${usd0(r.contribution)} ÷ ${usd0(r.revenue)}`} result={pct(r.cmRatio)} />
              <Formula label="Break-even revenue" expr={`${usd0(r.fixedTotal)} ÷ ${pct(r.cmRatio)}`} result={r.breakEvenRevenue != null ? usd0(r.breakEvenRevenue) : "not defined"} />
              <p className="text-[11px] text-mist-400">Multi-product break-even assumes your expected sales mix stays the same. A different mix gives a different break-even.</p>
            </div>
          )}
        </Panel>
        <PriceSensitivity />
      </div>
    </div>
  );
};

const Formula = ({ label, expr, result }: { label: string; expr: string; result: string }) => (
  <div className="rounded-xl bg-ink-950/50 p-3 ring-1 ring-white/5">
    <div className="mb-1 font-sans text-[11px] text-mist-400">{label}</div>
    <div className="flex flex-wrap items-center gap-2"><span className="text-mist-300">{expr}</span><span className="text-mist-400">=</span><span className="font-semibold text-mist-100">{result}</span></div>
  </div>
);

const PriceSensitivity = () => {
  const { state } = useStore();
  const m = state.model;
  const [pid, setPid] = useState(m.products[0].id);
  const p = m.products.find((x) => x.id === pid) ?? m.products[0];
  const top = Math.max(120, Math.ceil(p.price * 2));
  const data = useMemo(() => Array.from({ length: 61 }, (_, i) => {
    const price = (top / 60) * i;
    return { price, profit: compute(m, { price, priceFor: p.id }).profit };
  }), [m, p.id, top]);
  let bePrice: number | null = null;
  for (let i = 1; i < data.length; i++) if (data[i - 1].profit < 0 && data[i].profit >= 0) { const a = data[i - 1], b = data[i]; bePrice = a.price + ((0 - a.profit) / (b.profit - a.profit)) * (b.price - a.price); break; }
  const cur = compute(m).profit;
  return (
    <Panel className="p-5">
      <PanelTitle icon={<TrendingUp size={16} />} title="C · Price and profit sensitivity" hint="Operating profit at different prices, holding sales volume constant at your assumption. In reality, volume may change with price."
        right={m.products.length > 1 ? <select aria-label="Product" value={p.id} onChange={(e) => setPid(e.target.value)} className="rounded-lg bg-ink-950/60 px-2.5 py-1.5 text-xs text-mist-100 ring-1 ring-white/10">{m.products.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select> : undefined} />
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 26, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="price" type="number" domain={[0, top]} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} width={52} />
            {p.model === "one_time" && <ReferenceArea x1={REC.tentative_range_min} x2={REC.tentative_range_max} fill="#2dd4bf" fillOpacity={0.1} label={{ value: "Research range", fill: "#5eead4", fontSize: 10, position: "insideBottom" }} />}
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.35)" />
            <ReferenceLine x={p.price} stroke="#facc15" strokeDasharray="3 3" label={{ value: `Your price ${usd(p.price)}`, fill: "#facc15", fontSize: 11, position: "top" }} />
            <Line dataKey="profit" stroke="#34d399" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Tooltip content={({ active, payload }) => active && payload?.length ? <TooltipBox><div className="font-semibold text-mist-100">Price {usd((payload[0].payload as { price: number }).price)}</div><div className="text-mist-300">Profit <span className="font-mono">{usd0(Number(payload[0].value))}</span></div></TooltipBox> : null} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-ink-950/50 p-2.5 ring-1 ring-white/5"><span className="text-mist-400">Profit at your price</span><div className={`font-mono text-sm ${cur >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{usd0(cur)}</div></div>
        <div className="rounded-lg bg-ink-950/50 p-2.5 ring-1 ring-white/5"><span className="flex items-center gap-1 text-mist-400">Break-even price at this volume <InfoTip text="The price at which profit is zero if sales volume stayed exactly at your assumption." /></span><div className="font-mono text-sm text-mist-100" data-testid="be-price">{bePrice != null ? usd(bePrice) : data[0].profit >= 0 ? "profitable at all prices shown" : "above the range shown"}</div></div>
      </div>
    </Panel>
  );
};
