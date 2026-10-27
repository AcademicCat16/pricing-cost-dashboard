import { useEffect, useMemo, useState } from "react";
import { Building2, Calculator, ClipboardCheck, Layers, LineChart, Menu, Package, Swords, X, FlaskRound } from "lucide-react";
import { StoreProvider, useStore } from "./lib/store.tsx";
import { compute } from "./lib/finance.ts";
import { usd, usd0, num } from "./components/ui.tsx";
import { Overview } from "./sections/Overview.tsx";
import { Costs } from "./sections/Costs.tsx";
import { Products } from "./sections/Products.tsx";
import { BreakEven } from "./sections/BreakEven.tsx";
import { Scenarios } from "./sections/Scenarios.tsx";
import { Competition } from "./sections/Competition.tsx";
import { Review } from "./sections/Review.tsx";

export const NAV = [
  { id: "overview", label: "Business Overview", icon: Building2 },
  { id: "costs", label: "Cost Structure", icon: Layers },
  { id: "products", label: "Products & Pricing", icon: Package },
  { id: "breakeven", label: "Break-Even Analysis", icon: LineChart },
  { id: "scenarios", label: "Financial Scenarios", icon: Calculator },
  { id: "competition", label: "Competitive Position", icon: Swords },
  { id: "review", label: "Pricing Decision Review", icon: ClipboardCheck },
] as const;
export type SectionId = (typeof NAV)[number]["id"];

const fromHash = (): SectionId => (NAV.find((n) => n.id === window.location.hash.replace(/^#\/?/, ""))?.id ?? "overview") as SectionId;

const Shell = () => {
  const { state, evaluationCurrent, confirmationCurrent } = useStore();
  const [section, setSection] = useState<SectionId>(fromHash);
  const [menu, setMenu] = useState(false);
  useEffect(() => { const h = () => setSection(fromHash()); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  const go = (id: SectionId) => {
    if (fromHash() !== id) window.location.hash = id;
    setSection(id); setMenu(false); window.scrollTo({ top: 0 });
    requestAnimationFrame(() => document.getElementById("main-heading")?.focus({ preventScroll: true }));
  };
  const r = useMemo(() => compute(state.model), [state.model]);
  const main = state.model.products[0];
  const current = NAV.find((n) => n.id === section)!;
  const evalStatus = !state.evaluation ? { t: "Not evaluated", c: "bg-white/5 text-mist-300" } : evaluationCurrent ? { t: "Evaluation current", c: "bg-emerald-400/10 text-emerald-300" } : { t: "Evaluation outdated", c: "bg-amber-400/10 text-amber-300" };
  const confStatus = !state.confirmation ? null : confirmationCurrent ? { t: "Decision confirmed", c: "bg-emerald-400/10 text-emerald-300" } : { t: "Confirmation outdated", c: "bg-amber-400/10 text-amber-300" };

  return (
    <div className="min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-white/5 bg-ink-950/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`} aria-label="Laboratory navigation">
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent-500 to-emerald-400 shadow-lg shadow-accent-500/20"><FlaskRound size={18} className="text-ink-950" /></div>
          <div className="leading-tight"><div className="text-sm font-semibold text-mist-100">Pricing & Cost Lab</div><div className="text-[11px] text-mist-400">Mission 3</div></div>
          <button className="ml-auto rounded-lg p-1.5 text-mist-400 hover:bg-white/5 lg:hidden" onClick={() => setMenu(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((n, i) => {
            const active = n.id === section; const Icon = n.icon;
            const highlight = n.id === "review";
            return (
              <button key={n.id} onClick={() => go(n.id)} aria-current={active ? "page" : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${active ? "bg-gradient-to-r from-accent-500/18 to-transparent text-mist-100 ring-1 ring-inset ring-accent-500/25" : "text-mist-400 hover:bg-white/[0.04] hover:text-mist-200"} ${highlight && !active ? "mt-3 ring-1 ring-inset ring-emerald-400/20" : ""}`}>
                <span className={`grid h-7 w-7 place-items-center rounded-lg ${active ? "bg-accent-500/20 text-accent-400" : highlight ? "bg-emerald-400/10 text-emerald-300" : "bg-white/[0.03] text-mist-400"}`}><Icon size={15} /></span>
                <span className="flex-1">{n.label}</span><span className="font-mono text-[10px] text-mist-400/60">0{i + 1}</span>
              </button>
            );
          })}
        </nav>
        <div className="absolute inset-x-3 bottom-3 space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px] text-mist-400">
          <div className="flex items-center justify-between"><span>Annual revenue</span><span className="font-mono text-mist-200">{usd0(r.revenue)}</span></div>
          <div className="flex items-center justify-between"><span>Operating profit</span><span className={`font-mono ${r.profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{usd0(r.profit)}</span></div>
          <div className="flex items-center justify-between"><span>Startup cash</span><span className="font-mono text-mist-200">{usd0(r.startupCash)}</span></div>
        </div>
      </aside>
      {menu && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMenu(false)} aria-hidden />}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/5 bg-ink-900/85 backdrop-blur-xl">
          <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 md:px-8">
            <button className="rounded-lg p-2 text-mist-300 hover:bg-white/5 lg:hidden" onClick={() => setMenu(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-medium uppercase tracking-[0.16em] text-mist-400">Jewelry / Journey</div>
              <div className="truncate text-[15px] font-semibold text-mist-100">Pricing & Cost Laboratory <span className="hidden text-mist-400 sm:inline">/ {current.label}</span></div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2 text-xs" data-testid="header-kpis">
              <span className="rounded-full bg-white/5 px-3 py-1 text-mist-300 ring-1 ring-white/10">Price <span className="font-mono text-mist-100">{main ? usd(main.price) : "—"}</span></span>
              <span className="hidden rounded-full bg-white/5 px-3 py-1 text-mist-300 ring-1 ring-white/10 md:inline">Break-even <span className="font-mono text-mist-100">{r.single?.breakEvenUnits != null ? `${num(Math.ceil(r.single.breakEvenUnits))} units` : r.breakEvenRevenue != null ? usd0(r.breakEvenRevenue) : "not achievable"}</span></span>
              <span className={`rounded-full px-3 py-1 ring-1 ring-white/10 ${evalStatus.c}`}>{evalStatus.t}</span>
              {confStatus && <span className={`hidden rounded-full px-3 py-1 ring-1 ring-white/10 sm:inline ${confStatus.c}`}>{confStatus.t}</span>}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-8 md:px-8">
          <h1 id="main-heading" tabIndex={-1} className="sr-only">{current.label}</h1>
          <div key={section} className="fade-in">
            {section === "overview" && <Overview go={go} />}
            {section === "costs" && <Costs />}
            {section === "products" && <Products />}
            {section === "breakeven" && <BreakEven />}
            {section === "scenarios" && <Scenarios />}
            {section === "competition" && <Competition />}
            {section === "review" && <Review go={go} />}
          </div>
          <footer className="mt-16 border-t border-white/5 pt-6 text-xs text-mist-400">
            Educational planning tool. Figures are assumptions for one operating year, not forecasts. Competitor prices are a research snapshot from 2026-10-27. All calculations run in your browser.
          </footer>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}
