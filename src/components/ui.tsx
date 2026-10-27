import { useState } from "react";
import type { ReactNode } from "react";
import { BadgeCheck, CircleDashed, ExternalLink as ExtIcon, FlaskConical, Info, PencilLine } from "lucide-react";
import type { Benchmark, Evidence } from "../lib/types.ts";

export const usd = (n: number, d = 2) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: d, maximumFractionDigits: d });
export const usd0 = (n: number) => usd(n, 0);
export const pct = (n: number | null, d = 1) => (n == null ? "—" : `${(n * 100).toFixed(d)}%`);
export const num = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });

export const Panel = ({ children, className = "", hover = false }: { children: ReactNode; className?: string; hover?: boolean }) => (
  <div className={`panel ${hover ? "panel-hover" : ""} ${className}`}>{children}</div>
);

export const SectionHeader = ({ eyebrow, title, subtitle, right }: { eyebrow: string; title: string; subtitle?: ReactNode; right?: ReactNode }) => (
  <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-400">{eyebrow}</div>
      <h2 className="text-2xl font-semibold tracking-tight text-mist-100 md:text-[28px]">{title}</h2>
      {subtitle && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mist-400">{subtitle}</p>}
    </div>
    {right}
  </div>
);

export const PanelTitle = ({ icon, title, hint, right }: { icon?: ReactNode; title: ReactNode; hint?: ReactNode; right?: ReactNode }) => (
  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
    <div className="flex items-start gap-2.5">
      {icon && <span className="mt-0.5 text-accent-400">{icon}</span>}
      <div>
        <h3 className="text-[15px] font-semibold text-mist-100">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-mist-400">{hint}</p>}
      </div>
    </div>
    {right}
  </div>
);

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "accent" | "rec" | "venture";
const TONES: Record<Tone, string> = {
  neutral: "bg-white/5 text-mist-300 ring-white/10",
  good: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25",
  warn: "bg-amber-400/10 text-amber-300 ring-amber-400/25",
  bad: "bg-rose-400/10 text-rose-300 ring-rose-400/25",
  info: "bg-sky-400/10 text-sky-300 ring-sky-400/25",
  accent: "bg-accent-500/12 text-accent-400 ring-accent-500/30",
  rec: "bg-teal-400/10 text-teal-300 ring-teal-400/30",
  venture: "bg-yellow-400/12 text-yellow-300 ring-yellow-400/35",
};
export const Pill = ({ children, tone = "neutral", title }: { children: ReactNode; tone?: Tone; title?: string }) => (
  <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONES[tone]}`}>{children}</span>
);

export const EVIDENCE_TEXT: Record<Evidence, string> = {
  Researched: "Supported by a relevant, identifiable source (see link and date checked).",
  Estimated: "A reasoned approximation based on the stated assumptions.",
  Illustrative: "A teaching placeholder without verified industry support. Replace it with a quote or your own research.",
  "Student-Entered": "A value you changed. Its original evidence label is kept in the details.",
};
export const EvidenceBadge = ({ e }: { e: Evidence }) => {
  const map: Record<Evidence, { tone: Tone; icon: ReactNode }> = {
    Researched: { tone: "good", icon: <BadgeCheck size={12} /> },
    Estimated: { tone: "info", icon: <FlaskConical size={12} /> },
    Illustrative: { tone: "warn", icon: <CircleDashed size={12} /> },
    "Student-Entered": { tone: "venture", icon: <PencilLine size={12} /> },
  };
  return <span title={EVIDENCE_TEXT[e]}><Pill tone={map[e].tone}>{map[e].icon}{e}</Pill></span>;
};

/** Hover / focus tooltip explaining a concept. */
export const InfoTip = ({ text, label = "More information" }: { text: ReactNode; label?: string }) => (
  <span className="group relative inline-flex align-middle">
    <button type="button" aria-label={label} className="rounded-full p-0.5 text-mist-400 hover:text-accent-400 focus:text-accent-400"><Info size={13} /></button>
    <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-ink-850 p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-mist-200 opacity-0 shadow-2xl transition group-hover:opacity-100 group-focus-within:opacity-100">{text}</span>
  </span>
);

export const GLOSSARY = {
  fixed: "Fixed costs stay the same whatever you sell in the year (e.g., software subscriptions, insurance, ad budget).",
  variable: "Variable costs rise with every unit or order sold (e.g., manufacturing, postage, card fees).",
  cm: "Contribution margin = price − variable cost per unit. It is what each sale contributes toward fixed costs and then profit.",
  cmRatio: "Contribution margin ratio = contribution ÷ revenue: the share of each sales dollar left after variable costs.",
  breakEven: "Break-even = the sales level where revenue exactly covers variable and fixed costs (profit = $0). Break-even units = fixed costs ÷ contribution margin per unit.",
  mos: "Margin of safety = how far expected sales can fall before reaching break-even, as a share of expected revenue.",
  startup: "Startup costs are one-time cash needs before launch. They are not yearly operating expenses, so they are reported separately from break-even (except capital items you choose to amortise).",
  amortise: "Amortising spreads a long-lived purchase (like tooling) over the years it is used, so only a share counts in each year's fixed costs.",
};

export const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${checked ? "bg-accent-500" : "bg-ink-500"}`}>
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
  </button>
);

export const ExternalLink = ({ href, children, className = "" }: { href: string; children?: ReactNode; className?: string }) => {
  let host = href;
  try { host = new URL(href).hostname.replace(/^www\./, ""); } catch { /* keep raw */ }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-accent-400 underline-offset-2 hover:underline ${className}`}>
      {children ?? host}<ExtIcon size={11} aria-hidden /><span className="sr-only">(opens in a new tab)</span>
    </a>
  );
};

export const Kpi = ({ label, value, sub, icon, tip, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tip?: string; tone?: "good" | "bad" | "neutral" }) => (
  <Panel hover className="relative overflow-hidden p-4">
    <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent-500/10 blur-2xl" />
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1 text-xs font-medium text-mist-400">{label}{tip && <InfoTip text={tip} label={`About ${label}`} />}</span>
      {icon && <span className="text-mist-400">{icon}</span>}
    </div>
    <div className={`mt-2 text-[24px] font-semibold tracking-tight tabular-nums ${tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-mist-100"}`}>{value}</div>
    {sub && <div className="mt-1 text-[11px] leading-snug text-mist-400">{sub}</div>}
  </Panel>
);

export const Segmented = <T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) => (
  <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-xl bg-ink-950/60 p-1 ring-1 ring-white/5">
    {options.map((o) => (
      <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${value === o.value ? "bg-ink-600 text-mist-100 shadow" : "text-mist-400 hover:text-mist-200"}`}>{o.label}</button>
    ))}
  </div>
);

export const inputCls = "w-full rounded-lg bg-ink-950/70 px-2.5 py-1.5 text-sm text-mist-100 ring-1 ring-white/10 outline-none placeholder:text-mist-400 focus:ring-accent-500/60";

/** Number input that tolerates partial typing and commits valid values. */
export const NumberField = ({ value, onChange, min, max, step, label, prefix, suffix, testid, className = "" }:
  { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string; prefix?: string; suffix?: string; testid?: string; className?: string }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  return (
    <span className={`flex items-center rounded-lg bg-ink-950/70 ring-1 ring-white/10 focus-within:ring-accent-500/60 ${className}`}>
      {prefix && <span className="pl-2 text-xs text-mist-400">{prefix}</span>}
      <input type="number" inputMode="decimal" aria-label={label} data-testid={testid} step={step ?? "any"} min={min} max={max}
        value={draft ?? String(Math.round(value * 100) / 100)}
        onChange={(e) => { setDraft(e.target.value); const v = parseFloat(e.target.value); if (!Number.isNaN(v) && v >= (min ?? -Infinity) && v <= (max ?? Infinity)) onChange(v); }}
        onBlur={() => { if (draft != null) { const v = parseFloat(draft); if (!Number.isNaN(v)) onChange(clamp(v)); } setDraft(null); }}
        className="w-full min-w-0 bg-transparent px-2 py-1.5 font-mono text-sm text-mist-100 outline-none" />
      {suffix && <span className="pr-2 text-xs text-mist-400">{suffix}</span>}
    </span>
  );
};

/** Slider with an adaptive range, a benchmark marker and its explanation. */
export const CostSlider = ({ value, onChange, min, max, step, benchmark, disabled, label, format, sourceLabel, testid }:
  { value: number; onChange: (v: number) => void; min: number; max: number; step: number; benchmark?: Benchmark; disabled?: boolean; label: string; format: (n: number) => string; sourceLabel?: string; testid?: string }) => {
  const hi = Math.max(max, value, benchmark?.amount ?? 0);
  const pos = (v: number) => ((Math.min(hi, Math.max(min, v)) - min) / (hi - min || 1)) * 100;
  return (
    <div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-[9px] top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink-600">
          <div className="h-full rounded-full bg-gradient-to-r from-accent-500/60 to-accent-400" style={{ width: `${pos(value)}%` }} />
          {benchmark && (
            <span className="group pointer-events-auto absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos(benchmark.amount)}%` }}>
              <span tabIndex={0} aria-label={`${benchmark.kind === "researched" ? "Benchmark" : "Illustrative reference"} ${format(benchmark.amount)}: ${benchmark.label}`}
                className={`block h-4 w-4 rotate-45 rounded-[3px] ring-2 ring-ink-900 ${benchmark.kind === "researched" ? "bg-teal-300" : "border border-dashed border-mist-300 bg-ink-700"}`} />
              <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-60 -translate-x-1/2 rounded-xl border border-white/10 bg-ink-850 p-2.5 text-[11px] leading-relaxed text-mist-200 opacity-0 shadow-2xl transition group-hover:opacity-100 group-focus-within:opacity-100">
                <span className="block font-semibold text-mist-100">{benchmark.kind === "researched" ? "Research benchmark" : "Illustrative reference (not a verified benchmark)"}: {format(benchmark.amount)}</span>
                {benchmark.label}{sourceLabel && <span className="mt-1 block text-mist-400">Source: {sourceLabel}</span>}
              </span>
            </span>
          )}
        </div>
        <input type="range" className="cost-slider" min={min} max={hi} step={step} value={Math.min(hi, Math.max(min, value))} disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))} aria-label={label} aria-valuetext={format(value)} data-testid={testid} />
      </div>
      <div className="mt-0.5 flex justify-between font-mono text-[10px] text-mist-400"><span>{format(min)}</span><span>{format(hi)}</span></div>
    </div>
  );
};

export const EmptyState = ({ title, body, action }: { title: string; body: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
    <div className="mb-3 rounded-full bg-white/5 p-3 text-mist-400"><CircleDashed size={22} /></div>
    <div className="text-sm font-semibold text-mist-200">{title}</div>
    <p className="mt-1 max-w-sm text-sm text-mist-400">{body}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const TooltipBox = ({ children }: { children: ReactNode }) => (
  <div className="max-w-xs rounded-xl border border-white/10 bg-ink-850/95 p-3 text-xs shadow-2xl backdrop-blur">{children}</div>
);

export const Button = ({ children, onClick, tone = "default", disabled, testid, type = "button", className = "" }:
  { children: ReactNode; onClick?: () => void; tone?: "default" | "primary" | "danger" | "success" | "ghost"; disabled?: boolean; testid?: string; type?: "button" | "submit"; className?: string }) => {
  const t = {
    default: "bg-white/5 text-mist-200 ring-1 ring-white/10 hover:bg-white/10",
    primary: "bg-accent-500 text-ink-950 hover:bg-accent-400",
    danger: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/25",
    success: "bg-emerald-400 text-ink-950 hover:bg-emerald-300",
    ghost: "text-mist-400 hover:bg-white/5 hover:text-mist-200",
  }[tone];
  return (
    <button type={type} onClick={onClick} disabled={disabled} data-testid={testid}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${t} ${className}`}>{children}</button>
  );
};
