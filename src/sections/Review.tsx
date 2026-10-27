import { useMemo, useState } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, ClipboardCheck, Download, FileJson, FileText, Info, Lightbulb, PencilLine, RefreshCw, ShieldCheck, Sparkles, Star } from "lucide-react";
import { useStore, decisionFingerprint } from "../lib/store.tsx";
import type { Confirmation } from "../lib/store.tsx";
import { evaluate, CRITERIA } from "../lib/evaluate.ts";
import type { Evaluation, Finding, Severity } from "../lib/evaluate.ts";
import { buildDecisionData, download, billingLabel } from "../lib/report.ts";
import { Button, Panel, PanelTitle, Pill, SectionHeader, inputCls, usd } from "../components/ui.tsx";
import type { SectionId } from "../App.tsx";

const MIN_JUSTIFICATION = 120;

/** Vertical page scroll only. scrollIntoView would also scroll clipped (overflow-hidden) panels sideways. */
const scrollToId = (id: string) => setTimeout(() => {
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: "smooth" });
}, 50);

const CLASS_STYLE: Record<Evaluation["classification"], { ring: string; text: string; icon: React.ReactNode }> = {
  "Lower modeled risk": { ring: "bg-emerald-400/10 ring-emerald-400/40", text: "text-emerald-200", icon: <ShieldCheck size={26} /> },
  "Moderate modeled risk": { ring: "bg-amber-400/10 ring-amber-400/40", text: "text-amber-200", icon: <AlertTriangle size={26} /> },
  "High modeled risk": { ring: "bg-orange-500/10 ring-orange-400/40", text: "text-orange-200", icon: <AlertOctagon size={26} /> },
  "Financially unsustainable under current assumptions": { ring: "bg-rose-500/12 ring-rose-400/50", text: "text-rose-200", icon: <AlertOctagon size={26} /> },
};
const SEV: Record<Severity, { label: string; cls: string; icon: React.ReactNode }> = {
  critical: { label: "Critical", cls: "text-rose-300", icon: <AlertOctagon size={14} /> },
  high: { label: "High", cls: "text-orange-300", icon: <AlertTriangle size={14} /> },
  moderate: { label: "Moderate", cls: "text-amber-300", icon: <AlertTriangle size={14} /> },
  info: { label: "Note", cls: "text-sky-300", icon: <Info size={14} /> },
  strength: { label: "Strength", cls: "text-emerald-300", icon: <Star size={14} /> },
};

export const Review = ({ go }: { go: (id: SectionId) => void }) => {
  const { state, dispatch, evaluationCurrent, confirmationCurrent } = useStore();
  const ev = state.evaluation;
  const [confirming, setConfirming] = useState(false);
  const [acks, setAcks] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [dlMsg, setDlMsg] = useState<string | null>(null);
  const j = state.justificationDraft;

  const runEvaluation = () => {
    dispatch({ type: "evaluation", evaluation: evaluate(state.model) });
    setConfirming(false); setAcks({});
    scrollToId("evaluation-result");
  };
  const warnings = ev?.majorWarnings ?? [];
  const allAcked = warnings.every((_, i) => acks[i]);
  const canConfirm = !!ev && evaluationCurrent && allAcked && j.trim().length >= MIN_JUSTIFICATION;

  const confirmDecision = () => {
    if (!ev || !canConfirm) return;
    const c: Confirmation = {
      confirmedAt: new Date().toISOString(), fingerprint: decisionFingerprint(state), model: structuredClone(state.model), website: { ...state.website },
      evaluation: ev, justification: j.trim(), acknowledgedWarnings: [...warnings],
    };
    dispatch({ type: "confirm", confirmation: c });
    setConfirming(false);
    scrollToId("confirmation-result");
  };

  const downloadDocx = async () => {
    if (!state.confirmation || !confirmationCurrent) return;
    setBusy(true); setDlMsg(null);
    try { const { buildDocx } = await import("../lib/reportDocx.ts"); download(await buildDocx(state.confirmation), "Pricing_Decision_Report.docx"); setDlMsg("Pricing_Decision_Report.docx downloaded."); }
    catch (e) { setDlMsg(`Report generation failed: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };
  const downloadJson = () => {
    if (!state.confirmation || !confirmationCurrent) return;
    download(new Blob([JSON.stringify(buildDecisionData(state.confirmation), null, 2)], { type: "application/json" }), "Pricing_Decision_Data.json");
    setDlMsg("Pricing_Decision_Data.json downloaded.");
  };

  const byArea = useMemo(() => (ev ? (["Financial", "Competitive", "Evidence"] as const).map((a) => ({ a, items: ev.findings.filter((f) => f.area === a) })) : []), [ev]);
  const main = state.model.products[0];

  return (
    <div>
      <SectionHeader eyebrow="07 · Pricing Decision Review" title="Pricing Decision Review"
        subtitle="A transparent check of your current model against the stated rules and the documented research. It flags risks; it does not predict whether the business will succeed. You decide whether to revise or confirm." />

      <Panel className="relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-300">Your current decision</div>
            <div className="mt-1 text-3xl font-semibold text-mist-100">{state.model.products.map((p) => `${usd(p.price)}`).join(" · ")}</div>
            <div className="mt-1 text-sm text-mist-400">{state.model.products.map((p) => `${p.name} (${billingLabel(p)})`).join("; ")}</div>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <button onClick={runEvaluation} data-testid="evaluate"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 px-6 py-3.5 text-base font-semibold text-ink-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110">
              <ClipboardCheck size={20} />{ev ? "Evaluate My Pricing Decision Again" : "Evaluate My Pricing Decision"}
            </button>
            {ev && !evaluationCurrent && <span className="flex items-center gap-1.5 text-xs text-amber-300" data-testid="evaluation-outdated"><RefreshCw size={12} />Your inputs changed since the last evaluation. Evaluate again before confirming.</span>}
            {ev && evaluationCurrent && <span className="text-xs text-emerald-300">Evaluation is current ({new Date(ev.at).toLocaleTimeString()}).</span>}
          </div>
        </div>
      </Panel>

      {ev && (
        <div id="evaluation-result" className={`mt-4 scroll-mt-24 space-y-4 ${evaluationCurrent ? "" : "opacity-60"}`}>
          <div className="grid gap-4 xl:grid-cols-3">
            <div className={`rounded-2xl p-5 ring-1 xl:col-span-2 ${CLASS_STYLE[ev.classification].ring}`} data-testid="classification">
              <div className={`flex items-start gap-3 ${CLASS_STYLE[ev.classification].text}`}>
                {CLASS_STYLE[ev.classification].icon}
                <div>
                  <div className="text-xs uppercase tracking-wider opacity-80">Overall modeled risk</div>
                  <div className="text-2xl font-semibold" data-testid="classification-label">{ev.classification}</div>
                  <div className="mt-1 text-sm text-mist-200">{ev.classificationReason}</div>
                </div>
              </div>
              <details className="mt-4 text-xs text-mist-300">
                <summary className="cursor-pointer font-medium">How the classification is decided</summary>
                <ul className="mt-2 space-y-1.5">{CRITERIA.map((c) => <li key={c.label} className={c.label === ev.classification ? "text-mist-100" : ""}><span className="font-semibold">{c.label}:</span> {c.rule}</li>)}</ul>
                <p className="mt-2 text-mist-400">Thresholds (20% margin, 25% margin of safety, −20% sales / +10% variable cost stress tests) are teaching rules used in this lab, not industry standards. The classification does not predict the probability of business failure.</p>
              </details>
            </div>
            <div className="panel p-5" data-testid="evidence-confidence">
              <div className="text-xs uppercase tracking-wider text-mist-400">Evidence confidence</div>
              <div className={`mt-1 text-2xl font-semibold ${ev.evidenceConfidence === "High" ? "text-emerald-300" : ev.evidenceConfidence === "Medium" ? "text-amber-300" : "text-orange-300"}`}>{ev.evidenceConfidence}</div>
              <p className="mt-1 text-xs leading-relaxed text-mist-400">{ev.evidenceReason}</p>
              <p className="mt-2 text-[11px] text-mist-400">Uncertainty from missing evidence is reported here, separately from financial problems.</p>
            </div>
          </div>

          <Panel className="p-5">
            <PanelTitle icon={<FileText size={16} />} title="Written evaluation" hint="Generated from your inputs and the documented research." />
            <div className="grid gap-4 lg:grid-cols-2">
              <Block n={1} title="Proposed selling price"><p>{ev.summary.price}{main && main.model === "one_time" ? ` (research range ${usd(29)}–${usd(39)}).` : "."}</p></Block>
              <Block n={2} title="Financial findings"><List items={ev.findings.filter((f) => f.area === "Financial")} /></Block>
              <Block n={3} title="Competitive positioning"><List items={ev.findings.filter((f) => f.area === "Competitive")} /></Block>
              <Block n={4} title="Key risks"><List items={ev.findings.filter((f) => f.severity === "critical" || f.severity === "high" || f.severity === "moderate")} empty="No high or moderate risks under the stated rules." /></Block>
              <Block n={5} title="Strengths of the pricing strategy"><List items={ev.findings.filter((f) => f.severity === "strength")} empty="No strengths met the stated thresholds yet." /></Block>
              <Block n={6} title="Missing evidence"><List items={ev.findings.filter((f) => f.area === "Evidence")} /></Block>
            </div>
            <div className="mt-4">
              <Block n={7} title="Practical recommendations">
                <ol className="space-y-2.5" data-testid="recommendations">
                  {ev.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2.5"><Lightbulb size={15} className="mt-0.5 shrink-0 text-yellow-300" /><span><span className="text-mist-100">{r.text}</span><span className="block text-xs text-mist-400">Why: {r.why}</span></span></li>
                  ))}
                </ol>
              </Block>
            </div>
          </Panel>

          <details className="panel p-5 text-sm">
            <summary className="cursor-pointer font-semibold text-mist-100">All findings by area ({ev.findings.length})</summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {byArea.map(({ a, items }) => <div key={a}><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-mist-400">{a}</div><List items={items} /></div>)}
            </div>
          </details>

          {/* Revise or confirm */}
          <Panel className="p-6">
            <PanelTitle title="What would you like to do?" hint="Confirming is allowed even with warnings; you decide. Major warnings must be acknowledged and your reasoning recorded." />
            <div className="flex flex-wrap gap-3">
              <Button className="!px-5 !py-3 text-base" onClick={() => go("products")} testid="revise"><PencilLine size={17} />Revise My Pricing</Button>
              <Button tone="success" className="!px-5 !py-3 text-base" onClick={() => setConfirming(true)} disabled={!evaluationCurrent} testid="open-confirm"><CheckCircle2 size={17} />Confirm My Pricing Decision</Button>
            </div>
            {!evaluationCurrent && <p className="mt-2 text-xs text-amber-300">Evaluate again first: your inputs changed after this evaluation.</p>}

            {confirming && evaluationCurrent && (
              <div className="fade-in mt-5 space-y-4 rounded-2xl bg-ink-950/50 p-5 ring-1 ring-white/10">
                {warnings.length > 0 && (
                  <div>
                    <div className="mb-2 text-sm font-semibold text-orange-200">Review and acknowledge the major warnings ({warnings.length})</div>
                    <div className="space-y-2">
                      {warnings.map((w, i) => (
                        <label key={i} className="flex items-start gap-2.5 rounded-xl bg-orange-500/[0.06] p-3 text-[13px] text-mist-200 ring-1 ring-orange-400/20">
                          <input type="checkbox" className="mt-0.5 accent-orange-400" checked={!!acks[i]} onChange={(e) => setAcks({ ...acks, [i]: e.target.checked })} data-testid={`ack-${i}`} />
                          <span>I have reviewed this warning: {w}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <label className="block">
                  <span className="text-sm font-semibold text-mist-100">Why have you selected this price, and how do you justify it based on your costs, competitors, and value proposition?</span>
                  <textarea rows={6} className={`${inputCls} mt-2 text-sm leading-relaxed`} value={j} onChange={(e) => dispatch({ type: "draft", text: e.target.value })} data-testid="justification"
                    placeholder="Explain your reasoning in your own words: which costs matter most, how the price compares with competitors, and what value would justify it…" />
                  <span className={`mt-1 block text-xs ${j.trim().length >= MIN_JUSTIFICATION ? "text-emerald-300" : "text-mist-400"}`}>{j.trim().length} / {MIN_JUSTIFICATION} characters minimum</span>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button tone="success" onClick={confirmDecision} disabled={!canConfirm} testid="confirm-decision"><CheckCircle2 size={16} />Confirm and create my decision snapshot</Button>
                  <Button tone="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
                  {!allAcked && <span className="text-xs text-orange-300">Acknowledge every warning to continue.</span>}
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}

      {state.confirmation && (
        <Panel className="mt-4 scroll-mt-24 p-6" >
          <div id="confirmation-result" className="scroll-mt-24" />
          {confirmationCurrent ? (
            <div data-testid="confirmed">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"><Sparkles size={22} /></div>
                <div>
                  <div className="text-lg font-semibold text-mist-100">Pricing decision confirmed</div>
                  <div className="text-sm text-mist-400">{new Date(state.confirmation.confirmedAt).toLocaleString()} · {state.confirmation.evaluation.classification} · snapshot {state.confirmation.fingerprint.slice(0, 8)}</div>
                  <div className="mt-1 text-sm text-mist-200">{state.confirmation.model.products.map((p) => `${p.name}: ${usd(p.price)} ${billingLabel(p)}`).join(" · ")}</div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={downloadDocx} disabled={busy} data-testid="download-docx"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-accent-500 to-sky-400 px-6 py-3.5 text-base font-semibold text-ink-950 shadow-lg shadow-accent-500/20 transition hover:brightness-110 disabled:opacity-50">
                  <Download size={19} />{busy ? "Generating…" : "Download My Pricing Decision Report"}
                </button>
                <Button className="!px-5 !py-3" onClick={downloadJson} testid="download-json"><FileJson size={17} />Download Pricing_Decision_Data.json</Button>
              </div>
              {dlMsg && <p className="mt-2 text-sm text-mist-300" role="status">{dlMsg}</p>}
              <p className="mt-3 text-xs text-mist-400">Both files are generated in your browser from the same confirmed snapshot. The Word report is for people; the JSON file is the structured handoff for Mission 4. Only the product “customerFacing” fields are meant for public display.</p>
            </div>
          ) : (
            <div className="flex items-start gap-3 text-amber-200" data-testid="confirmation-outdated">
              <RefreshCw size={20} className="mt-0.5 shrink-0" />
              <div><div className="font-semibold">Your inputs changed after you confirmed.</div><div className="text-sm text-mist-300">Evaluate and confirm again to download an updated report. The previous confirmation ({new Date(state.confirmation.confirmedAt).toLocaleString()}) is kept until you replace it.</div></div>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
};

const Block = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="rounded-xl bg-ink-950/40 p-4 text-[13px] leading-relaxed text-mist-300 ring-1 ring-white/5">
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-mist-100"><span className="grid h-5 w-5 place-items-center rounded-full bg-accent-500/20 font-mono text-[10px] text-accent-400">{n}</span>{title}</div>
    {children}
  </div>
);
const List = ({ items, empty = "None." }: { items: Finding[]; empty?: string }) =>
  items.length === 0 ? <p className="text-mist-400">{empty}</p> : (
    <ul className="space-y-2">{items.map((f) => (
      <li key={f.id} className="flex gap-2"><span className={`mt-0.5 ${SEV[f.severity].cls}`}>{SEV[f.severity].icon}</span><span><span className="font-medium text-mist-100">{f.title}</span> <Pill tone={f.severity === "strength" ? "good" : f.severity === "info" ? "info" : f.severity === "moderate" ? "warn" : "bad"}>{SEV[f.severity].label}</Pill><span className="block text-mist-400">{f.detail}</span></span></li>
    ))}</ul>
  );
