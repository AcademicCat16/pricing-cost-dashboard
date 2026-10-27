/** Competitor comparison using the Mission 1 research snapshot (not live prices). */
import raw from "../data/competitor_data.json" with { type: "json" };
import type { Product } from "./types.ts";

export const COMP = raw;
export type Offer = (typeof raw.pricing_offers)[number];
export const competitors = raw.competitors;
export const comparableOffers = raw.pricing_offers.filter((o) => o.include_in_case_comparison);
export const repOf = (cid: string) => raw.pricing_offers.find((o) => o.competitor_id === cid && o.is_representative)!;
export const reps = competitors.map((c) => ({ c, o: repOf(c.competitor_id) }));
const sorted = (v: number[]) => [...v].sort((a, b) => a - b);
const medianOf = (v: number[]) => { const s = sorted(v); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const REP_MEDIAN = medianOf(reps.map((r) => r.o.current_price));
export const ALL_MEDIAN = medianOf(comparableOffers.map((o) => o.current_price));
export const priceType = (o: Offer) => (o.promotional_price != null ? "Promotional" : o.regular_price != null ? "Regular" : "Listed");
export const nameOf = (cid: string) => competitors.find((c) => c.competitor_id === cid)!.name;

/** Competitor prices are one-time, per-unit USD. Only one-time products are compared. */
export const isComparableProduct = (p: Product) => p.model === "one_time";

export type Rel = "cheaper" | "similar" | "pricier";
export const SIMILAR_BAND = 0.1; // ±10% of the competitor's price counts as "similarly priced"

export const comparePrice = (price: number) => {
  const rows = reps.map(({ c, o }) => {
    const cp = o.current_price;
    const rel: Rel = Math.abs(price - cp) / cp <= SIMILAR_BAND ? "similar" : cp < price ? "cheaper" : "pricier";
    return { id: c.competitor_id, name: c.name, classification: c.classification, positioning: c.positioning, price: cp, product: o.product_name, promo: priceType(o) === "Promotional", verification: o.verification_status, availability: o.availability, diff: price - cp, rel };
  }).sort((a, b) => a.price - b.price);
  const closest = [...comparableOffers].sort((a, b) => Math.abs(a.current_price - price) - Math.abs(b.current_price - price)).slice(0, 3)
    .map((o) => ({ id: o.offer_id, name: nameOf(o.competitor_id), product: o.product_name, price: o.current_price, diff: price - o.current_price, promo: priceType(o) === "Promotional", verification: o.verification_status }));
  const direct = rows.filter((r) => r.classification === "Direct");
  return {
    rows, closest,
    cheaper: rows.filter((r) => r.rel === "cheaper"), similar: rows.filter((r) => r.rel === "similar"), pricier: rows.filter((r) => r.rel === "pricier"),
    vsMedian: price - REP_MEDIAN,
    directMedian: medianOf(direct.map((r) => r.price)),
    inRange: price >= raw.preliminary_pricing_recommendation.tentative_range_min && price <= raw.preliminary_pricing_recommendation.tentative_range_max,
    rangeGap: price < raw.preliminary_pricing_recommendation.tentative_range_min ? price - raw.preliminary_pricing_recommendation.tentative_range_min
      : price > raw.preliminary_pricing_recommendation.tentative_range_max ? price - raw.preliminary_pricing_recommendation.tentative_range_max : 0,
    belowAll: price < Math.min(...comparableOffers.map((o) => o.current_price)),
    aboveAll: price > Math.max(...comparableOffers.map((o) => o.current_price)),
    premium: price > REP_MEDIAN,
  };
};
