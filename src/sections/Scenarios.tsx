import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, FolderOpen, Save, Table2, Trash2 } from "lucide-react";
import { useStore } from "../lib/store.tsx";
import { compute } from "../lib/finance.ts";
import { applyScenario, SCENARIO_META } from "../data/venture.ts";
import type { Model, ScenarioKey } from "../lib/types.ts";
import { Button, NumberField, Panel, PanelTitle, Pill, SectionHeader, TooltipBox, inputCls, num, usd, usd0 } from "../components/ui.tsx";

const row = (label: string, m: Model, tag?: string) => {
  const r = compute(m);
  const p = m.products[0];
  return { label, tag, fixed: r.fixedTotal, vc: r.single?.vcPerUnit ?? null, price: p?.price ?? 0, be: r.single?.breakEvenUnits ?? null, beRev: r.breakEvenRevenue, units: r.products.reduce((s, x) => s + x.units, 0), revenue: r.revenue, profit: r.profit, multi: m.products.length > 1 };
};

export const Scenarios = () => {
  const { state, dispatch } = useStore();
  const m = state.model;
  const [name, setName] = useState("");
  const rows = useMemo(() => [
    row("Your current model", m, m.settings.activeScenario === "custom" ? "custom edits" : SCENARIO_META[m.settings.activeScenario].label),
    ...(Object.keys(SCENARIO_META) as ScenarioKey[]).map((k) => row(SCENARIO_META[k].label, { ...m, expenses: applyScenario(m.expenses, k) }, "preset costs")),
    ...state.saved.map((s) => row(s.name, s.model, "saved")),
  ], [m, state.saved]);

  const vs = m.settings.volumeScenarios;
  const volumeData = (["conservative", "base", "optimistic"] as const).map((k) => {
    const r = compute(m, { volumeFactor: vs[k] });
    return { name: k[0].toUpperCase() + k.slice(1), factor: vs[k], units: r.products.reduce((s, p) => s + p.units, 0), Revenue: r.revenue, "Total costs": r.totalCosts, Profit: r.profit };
  });

  return (
    <div>
      <SectionHeader eyebrow="05 · Financial Scenarios" title="Compare operating models and sales assumptions"
        subtitle={<>Presets change <span className="text-mist-200">costs only</span>. They keep your prices and expected sales, because higher spending is not assumed to create more demand. Scenarios are illustrations, not predictions.</>} />

      <Panel className="p-5">
        <PanelTitle icon={<Table2 size={16} />} title="Operating scenario comparison" hint="Each preset applied to your current products, prices and expected sales. Apply a preset under Cost Structure to edit it." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]" data-testid="scenario-table">
            <thead className="text-xs text-mist-400"><tr>{["Scenario", "Total fixed costs", "Variable cost / unit", "Selected price", "Break-even units", "Assumed sales", "Revenue", "Operating profit", ""].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((x, i) => (
                <tr key={x.label + i} className={i === 0 ? "bg-accent-500/[0.06]" : "hover:bg-white/[0.02]"}>
                  <td className="px-3 py-3"><div className="font-medium text-mist-100">{x.label}</div>{x.tag && <div className="mt-0.5"><Pill tone={i === 0 ? "accent" : x.tag === "saved" ? "venture" : "neutral"}>{x.tag}</Pill></div>}</td>
                  <td className="px-3 py-3 font-mono text-mist-200">{usd0(x.fixed)}</td>
                  <td className="px-3 py-3 font-mono text-mist-200">{x.vc != null ? usd(x.vc) : "multi-product"}</td>
                  <td className="px-3 py-3 font-mono text-mist-200">{usd(x.price)}</td>
                  <td className="px-3 py-3 font-mono text-mist-200">{x.be != null ? num(Math.ceil(x.be)) : x.beRev != null ? `${usd0(x.beRev)} rev.` : <span className="font-sans text-rose-300">Not achievable</span>}</td>
                  <td className="px-3 py-3 font-mono text-mist-200">{num(x.units)}</td>
                  <td className="px-3 py-3 font-mono text-mist-200">{usd0(x.revenue)}</td>
                  <td className={`px-3 py-3 font-mono font-semibold ${x.profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{usd0(x.profit)}</td>
                  <td className="px-3 py-3 text-right">
                    {i >= 1 && i <= 3 && <Button tone="ghost" className="!px-2 !py-1 text-xs" onClick={() => { const k = (Object.keys(SCENARIO_META) as ScenarioKey[])[i - 1]; if (confirm(`Apply ${SCENARIO_META[k].label} costs to your model?`)) dispatch({ type: "preset", key: k }); }}>Apply</Button>}
                    {i > 3 && <span className="inline-flex gap-1">
                      <Button tone="ghost" className="!px-2 !py-1 text-xs" onClick={() => { if (confirm(`Load “${x.label}”? Your current model will be replaced.`)) dispatch({ type: "loadScenario", id: state.saved[i - 4].id }); }}><FolderOpen size={12} />Load</Button>
                      <Button tone="ghost" className="!px-2 !py-1 text-xs text-rose-300" onClick={() => dispatch({ type: "deleteScenario", id: state.saved[i - 4].id })}><Trash2 size={12} /></Button>
                    </span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="mt-4 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { dispatch({ type: "saveScenario", name: name.trim() }); setName(""); } }}>
          <input className={`${inputCls} max-w-xs`} placeholder="Name this scenario (e.g., Free shipping over $50)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Scenario name" data-testid="scenario-name" />
          <Button type="submit" tone="primary" disabled={!name.trim()} testid="save-scenario"><Save size={14} />Save current model as a scenario</Button>
        </form>
        <p className="mt-3 text-xs text-mist-400">{(Object.keys(SCENARIO_META) as ScenarioKey[]).map((k) => `${SCENARIO_META[k].label}: ${SCENARIO_META[k].summary}`).join("  ·  ")}</p>
      </Panel>

      <Panel className="mt-4 p-5">
        <PanelTitle icon={<BarChart3 size={16} />} title="D · Sales volume scenarios" hint="Your own volume assumptions applied to the current model. They are not probability-weighted forecasts." />
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="space-y-3">
            {(["conservative", "base", "optimistic"] as const).map((k) => (
              <label key={k} className="flex items-center justify-between gap-3 text-sm capitalize text-mist-300">
                {k}
                <NumberField className="w-28" value={Math.round(vs[k] * 100)} min={0} max={1000} step={5} suffix="%" onChange={(v) => dispatch({ type: "settings", patch: { volumeScenarios: { ...vs, [k]: v / 100 } } })} label={`${k} volume as % of expected`} testid={`vol-${k}`} />
              </label>
            ))}
            <p className="text-xs text-mist-400">Percent of your expected sales ({num(m.products.reduce((s, p) => s + p.quantity, 0))} units).</p>
            <table className="w-full text-xs"><tbody className="divide-y divide-white/5">
              {volumeData.map((v) => <tr key={v.name}><td className="py-1.5 text-mist-300">{v.name}</td><td className="py-1.5 text-right font-mono text-mist-400">{num(v.units)} u</td><td className={`py-1.5 text-right font-mono ${v.Profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{usd0(v.Profit)}</td></tr>)}
            </tbody></table>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} width={52} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={({ active, payload, label }) => active && payload?.length ? <TooltipBox><div className="mb-1 font-semibold text-mist-100">{label} ({num((payload[0].payload as { units: number }).units)} units)</div>{payload.map((x) => <div key={String(x.name)} className="text-mist-300">{x.name}: <span className="font-mono">{usd0(Number(x.value))}</span></div>)}</TooltipBox> : null} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Revenue" fill="#7c8cff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Total costs" fill="#fb7185" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Panel>
    </div>
  );
};
