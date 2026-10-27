/**
 * Application state with browser persistence (localStorage).
 * Work survives navigation and page reloads in the same browser; it is lost if browser data is cleared
 * or on another device — use Export to back it up.
 */
import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import type { Expense, Model, Product, ScenarioKey, Settings } from "./types.ts";
import { DEFAULT_WEBSITE, applyScenario, defaultModel, suggestedOf } from "../data/venture.ts";
import { fingerprint, hashString } from "./finance.ts";
import type { Evaluation } from "./evaluate.ts";

export interface SavedScenario { id: string; name: string; savedAt: string; model: Model }
export interface Website { repositoryUrl: string; liveUrl: string }
export interface Confirmation {
  confirmedAt: string;
  fingerprint: string; // inputs at confirmation (model + website)
  model: Model;
  website: Website;
  evaluation: Evaluation;
  justification: string;
  acknowledgedWarnings: string[];
}
export interface State {
  version: 1;
  model: Model;
  website: Website;
  saved: SavedScenario[];
  evaluation: Evaluation | null;
  confirmation: Confirmation | null;
  justificationDraft: string;
}

const KEY = "venture-pricing-laboratory:v1";
const initial = (): State => ({
  version: 1, model: defaultModel(), website: { repositoryUrl: DEFAULT_WEBSITE.repositoryUrl, liveUrl: DEFAULT_WEBSITE.liveUrl },
  saved: [], evaluation: null, confirmation: null, justificationDraft: "",
});

type Action =
  | { type: "expense"; id: string; patch: Partial<Expense> }
  | { type: "addExpense"; expense: Expense }
  | { type: "deleteExpense"; id: string }
  | { type: "restoreExpense"; id: string }
  | { type: "product"; id: string; patch: Partial<Product> }
  | { type: "addProduct"; product: Product }
  | { type: "removeProduct"; id: string }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "preset"; key: ScenarioKey }
  | { type: "saveScenario"; name: string }
  | { type: "loadScenario"; id: string }
  | { type: "deleteScenario"; id: string }
  | { type: "website"; patch: Partial<Website> }
  | { type: "evaluation"; evaluation: Evaluation }
  | { type: "confirm"; confirmation: Confirmation }
  | { type: "draft"; text: string }
  | { type: "import"; state: State }
  | { type: "reset" };

const setModel = (s: State, model: Model): State => ({ ...s, model });

const reducer = (s: State, a: Action): State => {
  const m = s.model;
  switch (a.type) {
    case "expense":
      return setModel(s, {
        ...m,
        settings: { ...m.settings, activeScenario: "custom" },
        expenses: m.expenses.map((e) => {
          if (e.id !== a.id) return e;
          const next = { ...e, ...a.patch };
          // A value the student changes becomes "Student-Entered"; returning to the suggested value restores its label.
          if (a.patch.amount !== undefined && e.original && !e.custom) next.evidence = Math.abs(next.amount - e.original.amount) < 1e-9 ? e.original.evidence : "Student-Entered";
          return next;
        }),
      });
    case "addExpense": return setModel(s, { ...m, expenses: [...m.expenses, a.expense], settings: { ...m.settings, activeScenario: "custom" } });
    case "deleteExpense": return setModel(s, { ...m, expenses: m.expenses.filter((e) => !(e.id === a.id && e.custom)) });
    case "restoreExpense": {
      const sug = suggestedOf(a.id);
      if (!sug) return s;
      return setModel(s, { ...m, expenses: m.expenses.map((e) => (e.id === a.id ? { ...sug, original: { ...sug.original! } } : e)) });
    }
    case "product": return setModel(s, { ...m, products: m.products.map((p) => (p.id === a.id ? { ...p, ...a.patch } : p)) });
    case "addProduct": return setModel(s, { ...m, products: [...m.products, a.product] });
    case "removeProduct":
      if (m.products.length <= 1) return s;
      return setModel(s, {
        ...m,
        products: m.products.filter((p) => p.id !== a.id),
        expenses: m.expenses.map((e) => ({
          ...e,
          appliesTo: e.appliesTo === "all" ? "all" : e.appliesTo.filter((x) => x !== a.id),
          allocation: e.allocation === a.id ? "shared" : e.allocation,
        })),
      });
    case "settings": return setModel(s, { ...m, settings: { ...m.settings, ...a.patch } });
    case "preset": return setModel(s, { ...m, expenses: applyScenario(m.expenses, a.key), settings: { ...m.settings, activeScenario: a.key } });
    case "saveScenario":
      return { ...s, saved: [...s.saved, { id: `sc-${Date.now()}`, name: a.name, savedAt: new Date().toISOString(), model: structuredClone(m) }] };
    case "loadScenario": {
      const sc = s.saved.find((x) => x.id === a.id);
      return sc ? setModel(s, { ...structuredClone(sc.model), settings: { ...sc.model.settings, activeScenario: "custom" } }) : s;
    }
    case "deleteScenario": return { ...s, saved: s.saved.filter((x) => x.id !== a.id) };
    case "website": return { ...s, website: { ...s.website, ...a.patch } };
    case "evaluation": return { ...s, evaluation: a.evaluation };
    case "confirm": return { ...s, confirmation: a.confirmation };
    case "draft": return { ...s, justificationDraft: a.text };
    case "import": return a.state;
    case "reset": return initial();
  }
};

const load = (): State => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial();
    const s = JSON.parse(raw) as State;
    return validateState(s) ? s : initial();
  } catch { return initial(); }
};

export const validateState = (s: unknown): s is State => {
  const x = s as State;
  return !!x && x.version === 1 && !!x.model && Array.isArray(x.model.expenses) && Array.isArray(x.model.products) && x.model.products.length > 0 && !!x.model.settings && !!x.website;
};

/** Fingerprint of everything that feeds the decision (financial inputs + website URLs). */
export const decisionFingerprint = (s: Pick<State, "model" | "website">) => `${fingerprint(s.model)}${hashString(`${s.website.repositoryUrl}|${s.website.liveUrl}`)}`;

interface Ctx {
  state: State;
  dispatch: React.Dispatch<Action>;
  evaluationCurrent: boolean;
  confirmationCurrent: boolean;
  storageOk: boolean;
}
const StoreCtx = createContext<Ctx | null>(null);
let storageOk = true;

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; } catch { storageOk = false; }
  }, [state]);
  const value = useMemo<Ctx>(() => {
    const fp = fingerprint(state.model);
    return {
      state, dispatch, storageOk,
      evaluationCurrent: !!state.evaluation && state.evaluation.fingerprint === fp,
      confirmationCurrent: !!state.confirmation && state.confirmation.fingerprint === decisionFingerprint(state),
    };
  }, [state]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
};

export const useStore = () => {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
};

export const exportConfig = (s: State) => JSON.stringify({ ...s, exportedAt: new Date().toISOString(), app: "venture-pricing-laboratory" }, null, 2);
