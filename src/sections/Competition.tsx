import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, Equal, Scale, Swords, Wallet } from "lucide-react";
import { useStore } from "../lib/store.tsx";
import { compute } from "../lib/finance.ts";
import { COMP, REP_MEDIAN, comparableOffers, comparePrice, isComparableProduct, nameOf, priceType } from "../lib/competition.ts";
import { REC, RESEARCH_DATE } from "../data/venture.ts";
import { CostSlider, EmptyState, ExternalLink, NumberField, Panel, PanelTitle, Pill, SectionHeader, TooltipBox, num, pct, usd, usd0 } from "../components/ui.tsx";

const COLORS: Record<string, string> = { C01: "#FB923C", C02: "#60A5FA", C03: "#F472B6", C04: "#A78BFA", C05: "#34D399" };

export const Competition = () => {
  const { state, dispatch } = useStore();
  const m = state.model;
  const eligible = m.products.filter(isComparableProduct);
  const [pid, setPid] = useState(eligible[0]?.id ?? "");
  const p = eligible.find((x) => x.id === pid) ?? eligible[0];
  const r = useMemo(() => compute(m), [m]);
  if (!p) return (
    <div>
      <SectionHeader eyebrow="06 · Competitive Position" title="Your price against researched competitors" />
      <EmptyState title="No comparable product" body="Researched competitors sell one-time purchases. Set at least one product to the one-time pricing model to compare it." />
    </div>
  );
  const cp = comparePrice(p.price);
  const pr = r.products.find((x) => x.id === p.id)!;
  const data = [...comparableOffers].sort((a, b) => a.current_price - b.current_price).map((o) => ({
    label: `${nameOf(o.competitor_id)} · ${o.product_name.replace(nameOf(o.competitor_id), "").replace(/^\s*/, "").slice(0, 28)}`,
    price: o.current_price, cid: o.competitor_id, rep: o.is_representative, promo: priceType(o) === "Promotional", partial: o.verification_status !== "Verified", oos: /out of stock/i.test(o.availability ?? "") && !/some/i.test(o.availability ?? ""),
    full: o.product_name, verification: o.verification_status, availability: o.availability ?? "Not checked",
  }));

  return (
    <div>
      <SectionHeader eyebrow="06 · Competitive Position" title="Your price against researched competitors"
        subtitle={<>Comparable products only: one-time, per-unit USD prices for travel jewelry organizers. Competitor comparisons show how attractive a price looks next to alternatives. They do not establish what customers will pay.</>}
        right={eligible.length > 1 ? <label className="text-xs text-mist-400">Product evaluated <select value={p.id} onChange={(e) => setPid(e.target.value)} className="ml-2 rounded-lg bg-ink-950/60 px-2.5 py-1.5 text-xs text-mist-100 ring-1 ring-white/10" data-testid="comp-product">{eligible.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label> : undefined} />

      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4 text-sm text-amber-50/90">
        <CalendarClock size={18} className="mt-0.5 shrink-0 text-amber-300" />
        <div><span className="font-semibold">Research snapshot from {RESEARCH_DATE}, not live prices.</span> Several prices were promotional, two were only partially verified, and Monos was out of stock on that date.</div>
      </div>

      <Panel className="p-5">
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <div>
            <div className="text-xs text-mist-400">Your price for</div>
            <div className="text-sm font-medium text-mist-200">{p.name}</div>
            <div className="mt-1 text-5xl font-semibold tracking-tight text-yellow-300 tabular-nums" data-testid="comp-price">{usd(p.price)}</div>
            <div className="mt-3"><CostSlider value={p.price} onChange={(v) => dispatch({ type: "product", id: p.id, patch: { price: v } })} min={0} max={120} step={0.5} label="Price" format={(n) => usd(n, 0)} testid="comp-slider" /></div>
            <NumberField className="mt-2" value={p.price} min={0} prefix="$" onChange={(v) => dispatch({ type: "product", id: p.id, patch: { price: v } })} label="Exact price" />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Count n={cp.cheaper.length} label="Cheaper" icon={<ArrowDown size={13} />} tone="text-sky-300" testid="comp-cheaper" />
              <Count n={cp.similar.length} label="Similar ±10%" icon={<Equal size={13} />} tone="text-teal-300" testid="comp-similar" />
              <Count n={cp.pricier.length} label="Pricier" icon={<ArrowUp size={13} />} tone="text-violet-300" testid="comp-pricier" />
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <Row label="vs representative median" value={`${cp.vsMedian >= 0 ? "+" : "−"}${usd(Math.abs(cp.vsMedian))} (median ${usd(REP_MEDIAN)})`} />
              <Row label="vs direct-competitor median" value={`${p.price - cp.directMedian >= 0 ? "+" : "−"}${usd(Math.abs(p.price - cp.directMedian))} (median ${usd(cp.directMedian)})`} />
              <Row label="Preliminary range" value={cp.inRange ? `Inside ${usd0(REC.tentative_range_min)}–${usd0(REC.tentative_range_max)}` : `${usd(Math.abs(cp.rangeGap))} ${cp.rangeGap < 0 ? "below" : "above"} ${usd0(REC.tentative_range_min)}–${usd0(REC.tentative_range_max)}`} tone={cp.inRange ? "text-teal-300" : "text-amber-300"} />
            </div>
          </div>
          <div>
            <PanelTitle icon={<Swords size={16} />} title="All researched comparable offers" hint="Representative products are outlined; promotional prices are striped; the teal band is the preliminary range; the yellow line is your price." />
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 22, right: 30, left: 4, bottom: 4 }}>
                  <defs><pattern id="promo" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" fill="rgba(255,255,255,0.35)" /></pattern></defs>
                  <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" domain={[0, Math.max(110, Math.ceil(p.price + 10))]} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" width={230} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <ReferenceArea x1={REC.tentative_range_min} x2={REC.tentative_range_max} fill="#2dd4bf" fillOpacity={0.12} />
                  <ReferenceLine x={REP_MEDIAN} stroke="#98a4ff" strokeDasharray="4 4" label={{ value: `Rep. median ${usd0(REP_MEDIAN)}`, fill: "#98a4ff", fontSize: 10, position: "top" }} />
                  <ReferenceLine x={p.price} stroke="#facc15" strokeWidth={2.5} label={{ value: `You ${usd(p.price)}`, fill: "#facc15", fontSize: 11, position: "insideBottomRight" }} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof data)[number];
                    return <TooltipBox><div className="font-semibold text-mist-100">{d.full}</div><div className="mt-1 font-mono text-mist-100">{usd(d.price)} · you are {p.price - d.price >= 0 ? `${usd(p.price - d.price)} higher` : `${usd(d.price - p.price)} lower`}</div><div className="mt-1 text-mist-400">{d.promo ? "Promotional" : "Listed/regular"} · {d.verification} · {d.availability}</div></TooltipBox>;
                  }} />
                  <Bar dataKey="price" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                    {data.map((d, i) => <Cell key={i} fill={d.promo ? "url(#promo)" : COLORS[d.cid]} stroke={COLORS[d.cid]} strokeWidth={d.rep ? 2.5 : d.promo ? 1.5 : 0} fillOpacity={d.oos ? 0.45 : 0.9} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel className="p-5">
          <PanelTitle title="Representative competitors" hint="One most-comparable product per competitor (Mission 1)." />
          <div className="space-y-2">
            {cp.rows.map((x) => (
              <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-ink-950/40 px-3 py-2.5 ring-1 ring-white/5" data-testid={`comp-row-${x.id}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-mist-100"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[x.id] }} />{x.name}
                    <Pill tone={x.classification === "Direct" ? "accent" : "warn"}>{x.classification}</Pill>
                    {x.promo && <Pill tone="info">Promotional</Pill>}
                    {x.verification !== "Verified" && <Pill tone="warn">{x.verification}</Pill>}
                    {/out of stock/i.test(x.availability ?? "") && <Pill tone="bad">Out of stock</Pill>}
                  </div>
                  <div className="truncate text-[11px] text-mist-400">{x.product} · {x.positioning}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-mist-100">{usd(x.price)}</div>
                  <div className={`text-[11px] ${x.rel === "cheaper" ? "text-sky-300" : x.rel === "similar" ? "text-teal-300" : "text-violet-300"}`}>{x.rel === "cheaper" ? "cheaper than you" : x.rel === "similar" ? "similar price" : "more expensive"} · {x.diff >= 0 ? "+" : "−"}{usd(Math.abs(x.diff))}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="mb-2 text-xs font-medium text-mist-400">Closest researched products to your price</div>
            <div className="space-y-1.5">{cp.closest.map((c) => <div key={c.id} className="flex items-center justify-between rounded-lg bg-ink-950/30 px-3 py-2 text-xs"><span className="text-mist-300">{c.product}{c.promo ? " (promo)" : ""}{c.verification !== "Verified" ? " (partially verified)" : ""}</span><span className="font-mono text-mist-200">{usd(c.price)} <span className="text-mist-400">({c.diff >= 0 ? "+" : "−"}{usd(Math.abs(c.diff))})</span></span></div>)}</div>
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelTitle icon={<Scale size={16} />} title="Competitive attractiveness vs financial viability" hint="Two different questions, both based on your current inputs." />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-sky-400/[0.06] p-4 ring-1 ring-sky-400/20">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-sky-200"><Swords size={15} />Competitive attractiveness</div>
              <p className="text-[13px] leading-relaxed text-mist-300">
                At {usd(p.price)}, {cp.cheaper.length} representative competitor{cp.cheaper.length === 1 ? " is" : "s are"} cheaper and {cp.pricier.length} {cp.pricier.length === 1 ? "is" : "are"} more expensive{cp.similar.length ? `; ${cp.similar.map((x) => x.name).join(", ")} ${cp.similar.length === 1 ? "is" : "are"} similarly priced` : ""}.
                {cp.premium ? " This is above the representative median, where competitors rely on brand, materials, gifting and personalization." : " This is at or below the representative median."}
                {cp.aboveAll && " No researched offer is priced higher."}{cp.belowAll && " No researched offer is priced lower."}
              </p>
            </div>
            <div className={`rounded-2xl p-4 ring-1 ${pr.cmPerUnit > 0 && r.profit >= 0 ? "bg-emerald-400/[0.06] ring-emerald-400/20" : "bg-rose-400/[0.06] ring-rose-400/20"}`}>
              <div className={`mb-2 flex items-center gap-2 text-sm font-semibold ${pr.cmPerUnit > 0 && r.profit >= 0 ? "text-emerald-200" : "text-rose-200"}`}><Wallet size={15} />Financial viability</div>
              <p className="text-[13px] leading-relaxed text-mist-300">
                Each sale contributes {usd(pr.cmPerUnit)} ({pct(pr.cmRatio)}) after variable costs of {usd(pr.vcPerUnit)}.
                {pr.breakEvenUnits != null ? ` Break-even is about ${num(Math.ceil(pr.breakEvenUnits))} units against your assumed ${num(pr.units)}, giving an operating ${r.profit >= 0 ? "profit" : "loss"} of ${usd0(Math.abs(r.profit))}.` : " The price does not cover variable cost, so selling more cannot reach break-even."}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-ink-950/40 p-3 text-xs leading-relaxed text-mist-400 ring-1 ring-white/5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-300" />
            A low price is not automatically a good strategy (it may not cover costs), and a high price is not automatically a bad one (it can work if differentiation is proven). Competitor prices alone do not show willingness to pay. The research notes the venture's differentiation is not yet tested.
          </div>
          <div className="mt-3 text-[11px] text-mist-400">Sources: {Array.from(new Set(COMP.pricing_offers.map((o) => o.source_url))).map((u, i) => <span key={u}>{i > 0 && " · "}<ExternalLink href={u} /></span>)}</div>
        </Panel>
      </div>
    </div>
  );
};

const Count = ({ n, label, icon, tone, testid }: { n: number; label: string; icon: React.ReactNode; tone: string; testid: string }) => (
  <div className="rounded-xl bg-ink-950/50 p-2.5 ring-1 ring-white/5"><div className={`text-2xl font-semibold ${tone}`} data-testid={testid}>{n}</div><div className="flex items-center justify-center gap-1 text-[10px] text-mist-400">{icon}{label}</div></div>
);
const Row = ({ label, value, tone = "text-mist-200" }: { label: string; value: string; tone?: string }) => (
  <div className="flex justify-between gap-2 rounded-lg bg-ink-950/40 px-2.5 py-1.5"><span className="text-mist-400">{label}</span><span className={`text-right font-mono ${tone}`}>{value}</span></div>
);
