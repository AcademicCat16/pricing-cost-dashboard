import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronDown, Filter, Layers, Plus, RotateCcw, Search, Trash2, Wallet, X } from "lucide-react";
import { useStore } from "../lib/store.tsx";
import { compute, costByCategory, billingUnits, annualFixedAmount, annualAmortisation } from "../lib/finance.ts";
import type { Basis, Behavior, Evidence, Expense, Frequency, ScenarioKey } from "../lib/types.ts";
import { CATEGORIES } from "../data/costs.ts";
import { SCENARIO_META } from "../data/venture.ts";
import { Button, CostSlider, EVIDENCE_TEXT, EmptyState, EvidenceBadge, ExternalLink, GLOSSARY, InfoTip, NumberField, Panel, PanelTitle, Pill, SectionHeader, Segmented, Toggle, TooltipBox, inputCls, usd, usd0, pct } from "../components/ui.tsx";

const CAT_COLORS: Record<string, string> = {
  "Production & Inventory": "#7c8cff", Logistics: "#38bdf8", Technology: "#2dd4bf", "Marketing & Sales": "#f472b6",
  "Labor & Personnel": "#facc15", "Facilities & Property": "#fb923c", "Administration & Compliance": "#a78bfa", Other: "#94a3b8",
};
export const catColor = (c: string) => CAT_COLORS[c] ?? CAT_COLORS.Other;

type TypeFilter = "all" | "variable" | "fixed" | "startup";

export const Costs = () => {
  const { state, dispatch } = useStore();
  const m = state.model;
  const r = useMemo(() => compute(m), [m]);
  const cats = useMemo(() => costByCategory(m), [m]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [ev, setEv] = useState<Evidence | "all">("all");
  const [showOff, setShowOff] = useState(true);
  const [adding, setAdding] = useState(false);

  const list = m.expenses.filter((e) =>
    (cat === "all" || e.category === cat) && (type === "all" || e.behavior === type) && (ev === "all" || e.evidence === ev) && (showOff || e.enabled) &&
    (!q.trim() || `${e.name} ${e.description} ${e.category}`.toLowerCase().includes(q.trim().toLowerCase())));
  const operating = list.filter((e) => e.behavior !== "startup");
  const startup = list.filter((e) => e.behavior === "startup");

  // evidence mix by annual amount at expected volume
  const mix = useMemo(() => {
    const amounts: Record<Evidence, number> = { Researched: 0, Estimated: 0, Illustrative: 0, "Student-Entered": 0 };
    for (const c of cats) for (const it of c.items) {
      const e = m.expenses.find((x) => x.id === it.id);
      if (e) amounts[e.evidence] += it.total;
    }
    const tot = Object.values(amounts).reduce((a, b) => a + b, 0) || 1;
    return (Object.keys(amounts) as Evidence[]).map((k) => ({ k, share: amounts[k] / tot }));
  }, [cats, m.expenses]);
  const mixColor: Record<Evidence, string> = { Researched: "#34d399", Estimated: "#38bdf8", Illustrative: "#fbbf24", "Student-Entered": "#facc15" };
  const totalCats = cats.reduce((s, c) => s + c.total, 0);
  const active = m.settings.activeScenario;

  return (
    <div>
      <SectionHeader eyebrow="02 · Cost Structure" title="Every cost of running Jewelry / Journey"
        subtitle={<>Costs chosen for a concept-stage online product business: contract manufacturing, importing, shipping from home, online store. No office, warehouse or employees are assumed at launch. Drag any slider and every result updates. <span className="text-mist-300">Startup costs are kept separate from yearly operating costs.</span></>}
        right={
          <div className="flex flex-col items-start gap-1.5 lg:items-end">
            <span className="text-[11px] text-mist-400">Operating scenario preset</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SCENARIO_META) as ScenarioKey[]).map((k) => (
                <button key={k} data-testid={`preset-${k}`} onClick={() => { if (active === k || confirm(`Apply the ${SCENARIO_META[k].label} preset? Suggested cost amounts will be replaced (your custom expenses are kept).`)) dispatch({ type: "preset", key: k }); }}
                  aria-pressed={active === k} title={SCENARIO_META[k].summary}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition ${active === k ? "bg-accent-500/20 text-accent-400 ring-accent-500/40" : "text-mist-300 ring-white/10 hover:bg-white/5"}`}>{SCENARIO_META[k].label}</button>
              ))}
              {active === "custom" && <Pill tone="venture">Custom edits</Pill>}
            </div>
          </div>
        } />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Panel className="p-5">
          <PanelTitle icon={<Layers size={16} />} title="B · Annual cost breakdown by category" hint="Fixed costs + variable costs at your expected sales + amortisation. Click a slice or row to filter the cost list." />
          <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
            <div className="relative h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={cats} dataKey="total" nameKey="category" innerRadius={62} outerRadius={100} paddingAngle={2} stroke="none" animationDuration={400}
                    onClick={(d) => setCat((d as unknown as { category: string }).category === cat ? "all" : (d as unknown as { category: string }).category)} cursor="pointer">
                    {cats.map((c) => <Cell key={c.category} fill={catColor(c.category)} fillOpacity={cat === "all" || cat === c.category ? 0.95 : 0.25} />)}
                  </Pie>
                  <Tooltip content={({ active: a, payload }) => {
                    if (!a || !payload?.length) return null;
                    const c = payload[0].payload as (typeof cats)[number];
                    return <TooltipBox><div className="mb-1 font-semibold text-mist-100">{c.category} · {usd0(c.total)}</div>{c.items.sort((x, y) => y.total - x.total).slice(0, 6).map((i) => <div key={i.id} className="text-mist-300">{i.name}: <span className="font-mono">{usd0(i.total)}</span></div>)}</TooltipBox>;
                  }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div><div className="text-[11px] text-mist-400">Annual costs</div><div className="font-mono text-lg font-semibold text-mist-100">{usd0(totalCats)}</div></div>
              </div>
            </div>
            <div className="space-y-1.5">
              {cats.map((c) => (
                <button key={c.category} onClick={() => setCat(cat === c.category ? "all" : c.category)} aria-pressed={cat === c.category}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${cat === c.category ? "bg-white/10" : "hover:bg-white/5"}`}>
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: catColor(c.category) }} />
                  <span className="flex-1 text-mist-200">{c.category}</span>
                  <span className="font-mono text-mist-300">{usd0(c.total)}</span>
                  <span className="w-12 text-right font-mono text-mist-400">{pct(c.total / (totalCats || 1), 0)}</span>
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelTitle title="Cost model summary" hint="One operating year (12 months)" />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Fixed costs / year" tip={GLOSSARY.fixed} value={usd0(r.fixedTotal)} sub={r.amortisation ? `incl. ${usd0(r.amortisation)} amortisation` : "recurring"} />
            <Stat label="Variable cost / unit" tip={GLOSSARY.variable} value={r.single ? usd(r.single.vcPerUnit) : "per product"} sub="at your selling price" />
            <Stat label="Startup one-time costs" tip={GLOSSARY.startup} value={usd0(r.startupOneTime)} sub="not in break-even (except amortisation)" />
            <Stat label="Initial inventory" value={usd0(r.initialInventory)} sub="cash needed for first stock" />
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-1 text-xs text-mist-400">Evidence behind the annual cost model <InfoTip text="Share of modeled annual costs (at expected volume) by evidence label. Illustrative and estimated values should be verified with quotes or research." /></div>
            <div className="flex h-3 overflow-hidden rounded-full bg-ink-600" role="img" aria-label={mix.map((x) => `${x.k} ${pct(x.share, 0)}`).join(", ")}>
              {mix.map((x) => <div key={x.k} style={{ width: `${x.share * 100}%`, background: mixColor[x.k] }} title={`${x.k}: ${pct(x.share, 0)}`} />)}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-mist-400">
              {mix.map((x) => <span key={x.k} className="flex items-center gap-1.5" title={EVIDENCE_TEXT[x.k]}><span className="h-2 w-2 rounded-full" style={{ background: mixColor[x.k] }} />{x.k} {pct(x.share, 0)}</span>)}
            </div>
          </div>
        </Panel>
      </div>

      {/* filters */}
      <Panel className="mt-4 flex flex-col gap-3 p-4 xl:flex-row xl:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search costs</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search costs…" className={`${inputCls} py-2 pl-9`} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={14} className="text-mist-400" />
          <Segmented<TypeFilter> label="Cost type" value={type} onChange={setType} options={[{ value: "all", label: "All" }, { value: "variable", label: "Variable" }, { value: "fixed", label: "Fixed" }, { value: "startup", label: "Startup" }]} />
          <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg bg-ink-950/60 px-2.5 py-1.5 text-xs text-mist-100 ring-1 ring-white/10">
            <option value="all">All categories</option>{[...new Set([...CATEGORIES, ...m.expenses.map((e) => e.category)])].map((c) => <option key={c}>{c}</option>)}
          </select>
          <select aria-label="Evidence" value={ev} onChange={(e) => setEv(e.target.value as Evidence | "all")} className="rounded-lg bg-ink-950/60 px-2.5 py-1.5 text-xs text-mist-100 ring-1 ring-white/10">
            <option value="all">All evidence</option><option>Researched</option><option>Estimated</option><option>Illustrative</option><option>Student-Entered</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-mist-400"><input type="checkbox" className="accent-indigo-400" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} />Show switched-off</label>
          <Button tone="primary" onClick={() => setAdding(true)} testid="add-expense"><Plus size={15} />Add expense</Button>
        </div>
      </Panel>
      {adding && <AddExpense onClose={() => setAdding(false)} />}

      <div className="mt-2 text-xs text-mist-400" aria-live="polite">{list.length} of {m.expenses.length} costs shown · {m.expenses.filter((e) => e.enabled).length} switched on</div>

      <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wider text-mist-300">Operating costs <span className="font-normal normal-case text-mist-400">— included in break-even</span></h3>
      {operating.length === 0 ? <EmptyState title="No operating costs match" body="Clear the filters to see all costs." /> : (
        <div className="grid gap-3 lg:grid-cols-2">{operating.map((e) => <ExpenseCard key={e.id} e={e} />)}</div>
      )}

      <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-mist-300"><Wallet size={15} />Startup costs <span className="font-normal normal-case text-mist-400">— one-time cash needed before launch, shown separately</span><InfoTip text={GLOSSARY.startup} /></h3>
      {startup.length === 0 ? <EmptyState title="No startup costs match" body="Clear the filters to see all startup costs." /> : (
        <div className="grid gap-3 lg:grid-cols-2">{startup.map((e) => <ExpenseCard key={e.id} e={e} />)}</div>
      )}
    </div>
  );
};

const Stat = ({ label, value, sub, tip }: { label: string; value: string; sub?: string; tip?: string }) => (
  <div className="rounded-xl bg-ink-950/50 p-3 ring-1 ring-white/5">
    <div className="flex items-center gap-1 text-[11px] text-mist-400">{label}{tip && <InfoTip text={tip} />}</div>
    <div className="mt-1 font-mono text-lg text-mist-100">{value}</div>
    {sub && <div className="text-[10px] text-mist-400">{sub}</div>}
  </div>
);

const behaviorLabel = (e: Expense) =>
  e.behavior === "startup" ? "Startup · one-time" : e.behavior === "fixed" ? `Fixed · ${e.frequency}` : `Variable · ${e.basis === "per_unit" ? "per unit" : e.basis === "per_order" ? "per order" : "% of revenue"}`;

const ExpenseCard = ({ e }: { e: Expense }) => {
  const { state, dispatch } = useStore();
  const m = state.model;
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Expense>) => dispatch({ type: "expense", id: e.id, patch });
  const isPct = e.basis === "pct_revenue";
  const fmt = (n: number) => (isPct ? `${n.toFixed(n < 10 ? 2 : 1)}%` : n >= 100 ? usd0(n) : usd(n));
  const units = m.products.filter((p) => e.appliesTo === "all" || e.appliesTo.includes(p.id)).reduce((s, p) => s + billingUnits(p), 0);
  const upo = m.settings.unitsPerOrder || 1;
  const annual = e.behavior === "fixed" ? annualFixedAmount(e) : e.behavior === "startup" ? annualAmortisation(e)
    : m.products.filter((p) => e.appliesTo === "all" || e.appliesTo.includes(p.id)).reduce((s, p) => s + (e.basis === "per_order" ? e.amount / upo : isPct ? (e.amount / 100) * p.price : e.amount) * billingUnits(p), 0);
  const changed = !e.custom && e.original && (Math.abs(e.original.amount - e.amount) > 1e-9 || e.original.enabled !== e.enabled || e.original.description !== e.description || e.original.assumptions !== e.assumptions || e.original.frequency !== e.frequency || e.original.behavior !== e.behavior || e.original.basis !== e.basis);

  return (
    <Panel className={`relative overflow-hidden p-4 transition ${e.enabled ? "" : "opacity-60"}`}>
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: catColor(e.category) }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-mist-400">{e.id}</span>
            <h4 className="text-[14px] font-semibold text-mist-100">{e.name}</h4>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <EvidenceBadge e={e.evidence} />
            <Pill>{behaviorLabel(e)}</Pill>
            <Pill>{e.category}</Pill>
            {e.custom && <Pill tone="venture">Your expense</Pill>}
            {e.capital?.includeInBreakEven && <Pill tone="accent">Amortised {e.capital.years} yr</Pill>}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-mist-400">{e.enabled ? "On" : "Off"}<Toggle checked={e.enabled} onChange={(v) => set({ enabled: v })} label={`Include ${e.name}`} /></div>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-mist-400">{e.description}</p>

      <div className="mt-3 grid items-center gap-3 sm:grid-cols-[1fr_130px]">
        <CostSlider value={e.amount} onChange={(v) => set({ amount: v })} min={e.range.min} max={e.range.max} step={e.range.step} benchmark={e.benchmark} disabled={!e.enabled} label={`${e.name} amount`} format={fmt} sourceLabel={e.sourceLabel} testid={`slider-${e.id}`} />
        <NumberField value={e.amount} onChange={(v) => set({ amount: v })} min={0} label={`${e.name} exact amount`} prefix={isPct ? undefined : "$"} suffix={isPct ? "%" : e.behavior === "fixed" ? `/${e.frequency === "monthly" ? "mo" : e.frequency === "quarterly" ? "qtr" : "yr"}` : e.basis === "per_order" ? "/order" : e.basis === "per_unit" ? "/unit" : undefined} testid={`amount-${e.id}`} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="text-mist-400">
          {e.behavior === "startup" ? <>One-time <span className="font-mono text-mist-200">{usd0(e.amount)}</span>{e.capital?.includeInBreakEven ? <> · <span className="font-mono text-mist-200">{usd0(annual)}</span>/yr in fixed costs</> : null}</>
            : e.behavior === "fixed" ? <>≈ <span className="font-mono text-mist-200">{usd0(annual)}</span> per year</>
            : <>≈ <span className="font-mono text-mist-200">{usd0(annual)}</span> per year at {units.toLocaleString()} units</>}
        </span>
        {e.benchmark && <span className="text-mist-400">{e.benchmark.kind === "researched" ? "◆ Benchmark" : "◇ Illustrative ref."}: <span className="font-mono text-mist-300">{fmt(e.benchmark.amount)}</span></span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2.5">
        <div className="text-[11px]">{e.sourceUrl ? <ExternalLink href={e.sourceUrl}>{e.sourceLabel ? e.sourceLabel.split(" — ")[0] : "Source"}</ExternalLink> : <span className="text-mist-400">No source{e.evidence === "Illustrative" ? " — illustrative placeholder" : ""}</span>}{e.dateChecked && <span className="ml-1.5 text-mist-400">· checked {e.dateChecked}</span>}</div>
        <div className="flex items-center gap-1">
          {changed && <Button tone="ghost" className="!px-2 !py-1 text-xs" onClick={() => dispatch({ type: "restoreExpense", id: e.id })}><RotateCcw size={12} />Restore</Button>}
          {e.custom && <Button tone="ghost" className="!px-2 !py-1 text-xs text-rose-300" onClick={() => { if (confirm(`Delete “${e.name}”?`)) dispatch({ type: "deleteExpense", id: e.id }); }} testid={`delete-${e.id}`}><Trash2 size={12} />Delete</Button>}
          <Button tone="ghost" className="!px-2 !py-1 text-xs" onClick={() => setOpen(!open)}>{open ? "Close" : "Details & edit"}<ChevronDown size={12} className={`transition ${open ? "rotate-180" : ""}`} /></Button>
        </div>
      </div>

      {open && (
        <div className="fade-in mt-3 space-y-3 rounded-xl bg-ink-950/40 p-3 ring-1 ring-white/5">
          <p className="text-xs text-mist-400"><span className="text-mist-300">Why it's included: </span>{e.why}</p>
          {e.sourceLabel && <p className="text-xs text-mist-400"><span className="text-mist-300">Source: </span>{e.sourceLabel}</p>}
          {e.original && e.evidence === "Student-Entered" && <p className="text-xs text-mist-400"><span className="text-mist-300">Original suggestion: </span>{fmt(e.original.amount)} ({e.original.evidence})</p>}
          <label className="block text-xs text-mist-400">Description<textarea rows={2} className={`${inputCls} mt-1`} value={e.description} onChange={(x) => set({ description: x.target.value })} /></label>
          <label className="block text-xs text-mist-400">Assumptions<textarea rows={3} className={`${inputCls} mt-1`} value={e.assumptions} onChange={(x) => set({ assumptions: x.target.value })} /></label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-mist-400">Classification
              <select className={`${inputCls} mt-1`} value={e.behavior} onChange={(x) => {
                const b = x.target.value as Behavior;
                set(b === "fixed" ? { behavior: b, frequency: e.frequency ?? "monthly", basis: undefined } : b === "variable" ? { behavior: b, basis: e.basis ?? "per_unit", frequency: undefined } : { behavior: b, basis: undefined, frequency: undefined });
              }}>
                <option value="fixed">Fixed</option><option value="variable">Variable</option><option value="startup">Startup (one-time)</option>
              </select>
            </label>
            {e.behavior === "fixed" && (
              <label className="text-xs text-mist-400">Frequency
                <select className={`${inputCls} mt-1`} value={e.frequency} onChange={(x) => set({ frequency: x.target.value as Frequency })}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select>
              </label>
            )}
            {e.behavior === "variable" && (
              <label className="text-xs text-mist-400">Scales with
                <select className={`${inputCls} mt-1`} value={e.basis} onChange={(x) => set({ basis: x.target.value as Basis })}><option value="per_unit">Each unit</option><option value="per_order">Each order</option><option value="pct_revenue">% of revenue</option></select>
              </label>
            )}
            {e.behavior === "fixed" && (
              <label className="text-xs text-mist-400">Belongs to
                <select className={`${inputCls} mt-1`} value={e.allocation} onChange={(x) => set({ allocation: x.target.value })}>
                  <option value="shared">Shared business overhead</option>{m.products.map((p) => <option key={p.id} value={p.id}>{p.name} only</option>)}
                </select>
              </label>
            )}
            {e.behavior === "startup" && (
              <label className="flex items-center gap-2 text-xs text-mist-400 sm:col-span-2">
                <input type="checkbox" className="accent-indigo-400" checked={!!e.capital?.includeInBreakEven} onChange={(x) => set({ capital: { years: e.capital?.years ?? 3, includeInBreakEven: x.target.checked } })} />
                Amortise in break-even over
                <NumberField className="w-20" value={e.capital?.years ?? 3} min={1} max={20} step={1} onChange={(v) => set({ capital: { years: Math.max(1, Math.round(v)), includeInBreakEven: !!e.capital?.includeInBreakEven } })} label="Amortisation years" />
                years <InfoTip text={GLOSSARY.amortise} />
              </label>
            )}
          </div>
          {e.behavior === "variable" && m.products.length > 0 && (
            <fieldset className="text-xs text-mist-400">
              <legend className="mb-1">Applies to</legend>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1.5"><input type="radio" name={`ap-${e.id}`} className="accent-indigo-400" checked={e.appliesTo === "all"} onChange={() => set({ appliesTo: "all" })} />All products</label>
                {m.products.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5"><input type="checkbox" className="accent-indigo-400" checked={e.appliesTo !== "all" && e.appliesTo.includes(p.id)}
                    onChange={(x) => { const cur = e.appliesTo === "all" ? [] : e.appliesTo; set({ appliesTo: x.target.checked ? [...cur, p.id] : cur.filter((id) => id !== p.id) }); }} />{p.name}</label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}
    </Panel>
  );
};

const AddExpense = ({ onClose }: { onClose: () => void }) => {
  const { dispatch } = useStore();
  const [f, setF] = useState({ name: "", category: "Marketing & Sales", behavior: "fixed" as Behavior, basis: "per_unit" as Basis, frequency: "monthly" as Frequency, amount: 0, description: "", assumptions: "", sourceUrl: "" });
  const valid = f.name.trim().length > 1 && f.amount >= 0;
  const save = () => {
    const id = `X${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const isPct = f.behavior === "variable" && f.basis === "pct_revenue";
    const max = isPct ? Math.max(30, f.amount * 2) : Math.max(50, Math.ceil(f.amount * 3));
    const e: Expense = {
      id, name: f.name.trim(), category: f.category, description: f.description || "Student-added expense.", why: "Added by the student.",
      behavior: f.behavior, amount: f.amount, basis: f.behavior === "variable" ? f.basis : undefined, frequency: f.behavior === "fixed" ? f.frequency : undefined,
      appliesTo: "all", allocation: "shared", enabled: true, evidence: "Student-Entered", sourceUrl: f.sourceUrl.trim() || undefined, sourceLabel: f.sourceUrl.trim() || undefined,
      assumptions: f.assumptions || "Entered by the student.", range: { min: 0, max, step: isPct ? 0.1 : max > 1000 ? 10 : max > 100 ? 1 : 0.05 }, custom: true,
    };
    dispatch({ type: "addExpense", expense: e });
    onClose();
  };
  return (
    <Panel className="fade-in mt-3 p-5 ring-1 ring-accent-500/30">
      <PanelTitle icon={<Plus size={16} />} title="Add your own expense" hint="It is labelled Student-Entered. Add a source link if you have one." right={<button onClick={onClose} aria-label="Close" className="text-mist-400 hover:text-mist-200"><X size={16} /></button>} />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs text-mist-400">Name<input className={`${inputCls} mt-1`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="new-expense-name" /></label>
        <label className="text-xs text-mist-400">Category<select className={`${inputCls} mt-1`} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}<option>Other</option></select></label>
        <label className="text-xs text-mist-400">Classification<select className={`${inputCls} mt-1`} value={f.behavior} onChange={(e) => setF({ ...f, behavior: e.target.value as Behavior })} data-testid="new-expense-behavior"><option value="fixed">Fixed</option><option value="variable">Variable</option><option value="startup">Startup (one-time)</option></select></label>
        {f.behavior === "fixed" && <label className="text-xs text-mist-400">Frequency<select className={`${inputCls} mt-1`} value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value as Frequency })}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select></label>}
        {f.behavior === "variable" && <label className="text-xs text-mist-400">Scales with<select className={`${inputCls} mt-1`} value={f.basis} onChange={(e) => setF({ ...f, basis: e.target.value as Basis })}><option value="per_unit">Each unit</option><option value="per_order">Each order</option><option value="pct_revenue">% of revenue</option></select></label>}
        <label className="text-xs text-mist-400">Amount {f.behavior === "variable" && f.basis === "pct_revenue" ? "(%)" : "($)"}<NumberField className="mt-1" value={f.amount} min={0} onChange={(v) => setF({ ...f, amount: v })} label="New expense amount" testid="new-expense-amount" /></label>
        <label className="text-xs text-mist-400 md:col-span-2">Description<input className={`${inputCls} mt-1`} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <label className="text-xs text-mist-400">Source URL (optional)<input className={`${inputCls} mt-1`} value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} placeholder="https://" /></label>
        <label className="text-xs text-mist-400 md:col-span-3">Assumptions<input className={`${inputCls} mt-1`} value={f.assumptions} onChange={(e) => setF({ ...f, assumptions: e.target.value })} /></label>
      </div>
      <div className="mt-4 flex gap-2"><Button tone="primary" onClick={save} disabled={!valid} testid="save-expense">Add expense</Button><Button tone="ghost" onClick={onClose}>Cancel</Button></div>
    </Panel>
  );
};
