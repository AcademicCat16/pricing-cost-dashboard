import { useMemo, useRef, useState } from "react";
import { ArrowRight, Database, Download, Globe, HardDrive, RotateCcw, Upload, Wallet, Target, Scale, TrendingUp, Boxes } from "lucide-react";
import { useStore, exportConfig, validateState } from "../lib/store.tsx";
import { compute } from "../lib/finance.ts";
import { DEFAULT_WEBSITE, RESEARCH_DATE, REC, VENTURE_FACTS } from "../data/venture.ts";
import { Button, GLOSSARY, Kpi, Panel, PanelTitle, Pill, SectionHeader, inputCls, num, pct, usd, usd0 } from "../components/ui.tsx";
import { download } from "../lib/report.ts";
import type { SectionId } from "../App.tsx";

const STEPS: { id: SectionId; title: string; body: string }[] = [
  { id: "costs", title: "Review every cost", body: "Adjust sliders, switch costs on or off, add your own." },
  { id: "products", title: "Set price & expected sales", body: "Edit the product, add student scenarios or tiers." },
  { id: "breakeven", title: "Check break-even", body: "See where revenue covers all costs." },
  { id: "scenarios", title: "Compare scenarios", body: "Lean, Typical, Expansion and your own." },
  { id: "competition", title: "Compare competitors", body: "Position your price against researched prices." },
  { id: "review", title: "Evaluate & confirm", body: "Get the review, revise or confirm, download the report." },
];

export const Overview = ({ go }: { go: (id: SectionId) => void }) => {
  const { state, dispatch, storageOk } = useStore();
  const r = useMemo(() => compute(state.model), [state.model]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const main = state.model.products[0];

  const onImport = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (!validateState(data)) throw new Error("not a laboratory configuration");
      dispatch({ type: "import", state: data });
      setMsg(`Imported “${f.name}”.`);
    } catch (e) { setMsg(`Import failed: ${(e as Error).message}.`); }
  };

  return (
    <div>
      <SectionHeader eyebrow="01 · Business Overview" title="Jewelry / Journey — Pricing & Cost Laboratory"
        subtitle="Build a cost model for the travel jewelry organizer, test prices against costs and the researched competitors, then evaluate and confirm your pricing decision. All numbers update instantly." />

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-6">
        <Kpi label="Selling price" value={main ? usd(main.price) : "—"} icon={<Target size={16} />} sub="starting value = midpoint of the Mission 1 range; choose your own" />
        <Kpi label="Variable cost / unit" value={r.single ? usd(r.single.vcPerUnit) : "multi"} icon={<Boxes size={16} />} tip={GLOSSARY.variable} />
        <Kpi label="Contribution / unit" value={r.single ? usd(r.single.cmPerUnit) : pct(r.cmRatio)} icon={<Scale size={16} />} tip={GLOSSARY.cm} tone={r.single && r.single.cmPerUnit <= 0 ? "bad" : undefined} sub={`${pct(r.cmRatio)} of price`} />
        <Kpi label="Break-even" value={r.single?.breakEvenUnits != null ? `${num(Math.ceil(r.single.breakEvenUnits))} units` : r.breakEvenRevenue != null ? usd0(r.breakEvenRevenue) : "Not achievable"} icon={<TrendingUp size={16} />} tip={GLOSSARY.breakEven} tone={r.breakEvenAchievable ? undefined : "bad"} sub={r.breakEvenRevenue != null ? `${usd0(r.breakEvenRevenue)} revenue / year` : "price must exceed variable cost"} />
        <Kpi label="Operating profit" value={usd0(r.profit)} icon={<TrendingUp size={16} />} tone={r.profit >= 0 ? "good" : "bad"} sub={`at ${num(main?.quantity ?? 0)} units / year (your assumption)`} />
        <Kpi label="Startup cash" value={usd0(r.startupCash)} icon={<Wallet size={16} />} tip={GLOSSARY.startup} sub={`${usd0(r.startupOneTime)} one-time + ${usd0(r.initialInventory)} inventory`} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Panel className="p-5 xl:col-span-2">
          <PanelTitle icon={<Database size={16} />} title="What we know about the venture" hint={`From the Mission 1 research (${RESEARCH_DATE}) and the concept website. Assumptions are labelled.`} />
          <div className="divide-y divide-white/5">
            {VENTURE_FACTS.map((f) => (
              <div key={f.label} className="grid gap-1 py-3 md:grid-cols-[180px_1fr]">
                <div className="flex items-start gap-2 text-xs font-medium text-mist-400">{f.label}</div>
                <div>
                  <div className="text-[13px] leading-relaxed text-mist-200">{f.value}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Pill tone={f.status === "Confirmed" ? "good" : f.status === "Derived" ? "info" : "warn"}>{f.status}</Pill>
                    <span className="text-[11px] text-mist-400">{f.source}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <PanelTitle title="How to use the laboratory" hint="Work through the steps; your changes are kept as you navigate." />
            <ol className="space-y-2">
              {STEPS.map((s, i) => (
                <li key={s.id}>
                  <button onClick={() => go(s.id)} className="group flex w-full items-start gap-3 rounded-xl bg-ink-950/40 p-3 text-left ring-1 ring-white/5 transition hover:ring-accent-500/30">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-500/15 font-mono text-[11px] text-accent-400">{i + 1}</span>
                    <span className="flex-1"><span className="block text-sm font-medium text-mist-100">{s.title}</span><span className="text-xs text-mist-400">{s.body}</span></span>
                    <ArrowRight size={15} className="mt-1 text-mist-400 transition group-hover:translate-x-0.5 group-hover:text-accent-400" />
                  </button>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel className="p-5">
            <PanelTitle icon={<Globe size={16} />} title="Original venture website" hint="Included in the report so Mission 4 knows which site gets the pricing page. This mission does not modify it." />
            <label className="mb-3 block text-xs text-mist-400">Repository URL
              <input className={`${inputCls} mt-1 font-mono text-xs`} value={state.website.repositoryUrl} onChange={(e) => dispatch({ type: "website", patch: { repositoryUrl: e.target.value } })} data-testid="website-repo" />
            </label>
            <label className="block text-xs text-mist-400">Live website URL
              <input className={`${inputCls} mt-1 font-mono text-xs`} value={state.website.liveUrl} onChange={(e) => dispatch({ type: "website", patch: { liveUrl: e.target.value } })} data-testid="website-live" />
            </label>
            <p className="mt-2 text-[11px] leading-relaxed text-amber-200/80">{DEFAULT_WEBSITE.note}</p>
          </Panel>

          <Panel className="p-5">
            <PanelTitle icon={<HardDrive size={16} />} title="Saving your work" />
            <p className="text-xs leading-relaxed text-mist-400">
              Your work is saved automatically in this browser{storageOk ? "" : " (storage is currently unavailable)"}. It is lost if you clear browser data or switch devices, so export a backup.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => download(new Blob([exportConfig(state)], { type: "application/json" }), "Pricing_Lab_Configuration.json")} testid="export-config"><Download size={14} />Export</Button>
              <Button onClick={() => fileRef.current?.click()}><Upload size={14} />Import</Button>
              <Button tone="ghost" onClick={() => { if (confirm("Reset the laboratory to the original suggested values? Your current work will be replaced.")) dispatch({ type: "reset" }); }}><RotateCcw size={14} />Reset</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="import-config" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
            </div>
            {msg && <p className="mt-2 text-xs text-mist-300" role="status">{msg}</p>}
          </Panel>
        </div>
      </div>

      <Panel className="mt-4 p-5">
        <PanelTitle title="Research starting point" hint="Preliminary — subject to the cost and demand analysis you do here." />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-teal-400/[0.06] p-4 ring-1 ring-teal-400/20">
            <div className="text-xs text-teal-300">Mission 1 preliminary range</div>
            <div className="mt-1 text-2xl font-semibold text-mist-100">{usd0(REC.tentative_range_min)}–{usd0(REC.tentative_range_max)}</div>
            <div className="mt-1 text-xs text-mist-400">{REC.position}</div>
          </div>
          <div className="rounded-xl bg-ink-950/40 p-4 ring-1 ring-white/5 md:col-span-2">
            <div className="mb-1 text-xs text-mist-400">Value proposition the research says would be needed</div>
            <p className="text-[13px] leading-relaxed text-mist-300">{REC.value_proposition_to_justify}</p>
          </div>
        </div>
      </Panel>
    </div>
  );
};
