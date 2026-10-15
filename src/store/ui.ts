import { create } from 'zustand';
import type { ApiStatus, Criteria, GeocodeHit, Match, Place } from '../../shared/types';
import { api } from '../services/api';
import { buildAreas, emptyCriteria, hasStructure, interpretQuery, rankPlaces, searchPlaces } from '../lib/discovery';
import { BUILTIN_PLACES } from '../data/catalog';
import { featureCentroid, loadCountries } from '../lib/geo';
import { useStore } from './index';
import { uid } from '../lib/ids';

export type LayerKey = 'saved' | 'planned' | 'visited' | 'activated' | 'discover';
export interface Toast { id: string; text: string; kind?: 'default' | 'achievement'; action?: { label: string; run: () => void } }
export interface FocusRequest { lat: number; lng: number; alt?: number; nonce: number; celebrate?: boolean }

export interface SearchState {
  query: string;
  status: 'idle' | 'loading' | 'done';
  criteria: Criteria | null;
  direct: Place[];
  matches: Match[];
  explain: Record<string, { why: string; caveat?: string }>;
  followUps: string[];
  mode: 'demo' | 'ai';
  notes: string[];
  geo: GeocodeHit[];
  geoState: 'idle' | 'loading' | 'done' | 'unavailable';
  unknownArea?: string;
  /** the query asked for businesses (restaurants, stays…) near a known place → hand off to Suggest More */
  business?: { cat: string; label: string; placeId: string; placeName: string };
}
const BUSINESS: [RegExp, string, string][] = [
  [/\b(restaurants?|dinner|lunch|where to eat|places to eat|brunch)\b/, 'restaurants', 'restaurants'], [/\b(coffee|cafes?|cafés?)\b/, 'coffee', 'coffee shops'], [/\b(takeaway|take away|takeout)\b/, 'takeaway', 'takeaway'],
  [/\b(hotels?|accommodation|airbnb|guesthouses?|apartments?|where to stay|places to stay|villas?)\b/, 'accommodation', 'places to stay'], [/\b(markets?)\b/, 'markets', 'local markets'],
  [/\b(coworking|work friendly|work-friendly)\b/, 'work', 'work-friendly spaces'], [/\b(viewpoints?|lookouts?)\b/, 'viewpoints', 'scenic viewpoints'], [/\b(pharmacy|doctor|hospital|supermarket)\b/, 'practical', 'practical services'],
];
const idleSearch: SearchState = { query: '', status: 'idle', criteria: null, direct: [], matches: [], explain: {}, followUps: [], mode: 'demo', notes: [], geo: [], geoState: 'idle' };

interface UiState {
  search: SearchState;
  runSearch: (query: string) => Promise<void>;
  rerank: (criteria: Criteria) => void;
  clearSearch: () => void;

  toasts: Toast[];
  toast: (text: string, opts?: Partial<Omit<Toast, 'id' | 'text'>> & { ms?: number }) => void;
  dismissToast: (id: string) => void;

  status: ApiStatus | null;
  statusState: 'idle' | 'loading' | 'ready' | 'offline';
  loadStatus: () => Promise<void>;

  fx: { toUSD: Record<string, number>; date: string } | null;
  fxState: 'idle' | 'loading' | 'ready' | 'unavailable';
  loadFx: () => Promise<void>;

  /** Explore stage state lives here so it survives navigating to a brief and back. */
  mode: 'globe' | 'map';
  setMode: (m: 'globe' | 'map') => void;
  selectedId?: string;
  select: (id?: string) => void;
  selectedCountry?: string;
  selectCountry: (name?: string) => void;
  layers: Record<LayerKey, boolean>;
  toggleLayer: (k: LayerKey) => void;
  criteria: Criteria;
  setCriteria: (c: Criteria) => void;
  focus?: FocusRequest;
  requestFocus: (f: Omit<FocusRequest, 'nonce'>) => void;
  /** Place to celebrate on the globe right after the game (lit pulse). */
  celebrateId?: string;
  setCelebrate: (id?: string) => void;

  assistantOpen: boolean;
  setAssistantOpen: (v: boolean) => void;
}

let nonce = 0;

export const useUi = create<UiState>((set, get) => ({
  toasts: [],
  toast: (text, opts) => {
    const id = uid('toast');
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind: opts?.kind, action: opts?.action }] }));
    setTimeout(() => get().dismissToast(id), opts?.ms ?? 4600);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  status: null,
  statusState: 'idle',
  loadStatus: async () => {
    if (get().statusState === 'loading' || get().statusState === 'ready') return;
    set({ statusState: 'loading' });
    try { set({ status: await api.status(), statusState: 'ready' }); } catch { set({ statusState: 'offline' }); }
  },

  fx: null,
  fxState: 'idle',
  loadFx: async () => {
    if (get().fxState !== 'idle') return;
    set({ fxState: 'loading' });
    try {
      const r = await api.fx();
      const toUSD: Record<string, number> = {};
      for (const [k, v] of Object.entries(r.fx.rates)) if (v > 0) toUSD[k] = 1 / v;
      set({ fx: { toUSD, date: r.fx.date }, fxState: 'ready' });
    } catch { set({ fxState: 'unavailable' }); }
  },

  mode: 'globe',
  setMode: (mode) => set({ mode }),
  select: (selectedId) => set({ selectedId, selectedCountry: selectedId ? undefined : get().selectedCountry }),
  selectCountry: (selectedCountry) => set({ selectedCountry, selectedId: selectedCountry ? undefined : get().selectedId }),
  layers: { saved: true, planned: true, visited: true, activated: true, discover: true },
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  criteria: emptyCriteria(),
  setCriteria: (criteria) => set({ criteria }),
  requestFocus: (f) => set({ focus: { ...f, nonce: ++nonce } }),
  celebrateId: undefined,
  setCelebrate: (celebrateId) => set({ celebrateId }),

  assistantOpen: false,
  setAssistantOpen: (assistantOpen) => set({ assistantOpen }),

  search: idleSearch,
  clearSearch: () => set({ search: idleSearch, criteria: emptyCriteria() }),
  rerank: (criteria) => {
    const places = allPlaces();
    const toUSD = get().fx?.toUSD;
    const matches = hasStructure(criteria) ? rankPlaces(places, criteria, { toUSD }) : [];
    set((s) => ({ criteria, search: { ...s.search, criteria, matches, direct: [], status: 'done' } }));
  },
  runSearch: async (query) => {
    const q = query.trim();
    if (q.length < 2) return;
    set({ search: { ...idleSearch, query: q, status: 'loading', geoState: 'loading' } });
    if (get().fxState === 'idle') void get().loadFx();
    const places = allPlaces();
    const countries = await loadCountries().then((fs) => fs.map((f) => ({ name: f.properties.name, ...featureCentroid(f) }))).catch(() => []);
    const areas = buildAreas(places, countries);
    const notes: string[] = [];
    let criteria = interpretQuery(q, areas);
    let mode: 'demo' | 'ai' = 'demo';
    const aiLive = get().status?.ai.state === 'live';
    const words = q.split(/\s+/).length;
    if (aiLive && words >= 3) {
      try {
        const r = (await api.ai.interpret(q)).criteria;
        mode = 'ai';
        criteria = {
          ...criteria,
          env: r.env ?? criteria.env, settlement: r.settlement ?? criteria.settlement, lifestyle: r.lifestyle ?? criteria.lifestyle,
          practical: r.practical ?? criteria.practical, activities: r.activities ?? criteria.activities, food: r.food ?? criteria.food,
          stay: r.stay ?? criteria.stay, months: r.months?.length ? r.months : criteria.months,
          crowds: r.crowds && r.crowds !== 'any' ? r.crowds : criteria.crowds, popularity: r.popularity && r.popularity !== 'any' ? r.popularity : criteria.popularity,
          remoteness: r.remoteness && r.remoteness !== 'any' ? r.remoteness : criteria.remoteness, maxCost: r.maxCost ?? criteria.maxCost,
        };
        if (criteria.stay && criteria.stay !== 'weekend' && criteria.stay !== 'week') criteria.kind = 'destination';
      } catch (e) {
        notes.push(`AI interpretation was unavailable (${(e as Error).message}); used demo interpretation instead.`);
      }
    }
    const toUSD = get().fx?.toUSD;
    const outcome = searchPlaces(places, q, areas, { toUSD }, criteria);
    let unknownArea: string | undefined;
    const a = areas.find((x) => x.kind === 'country' && !x.countryCode && outcome.criteria.countryCode === undefined && ` ${q.toLowerCase()} `.includes(` ${x.label.toLowerCase()} `));
    if (a) unknownArea = a.label;
    let business: SearchState['business'];
    const bm = BUSINESS.find(([re]) => re.test(q.toLowerCase()));
    if (bm) {
      const nq = q.toLowerCase();
      const dest = places.filter((p) => p.kind === 'destination').sort((a, b) => b.name.length - a.name.length).find((p) => nq.includes(p.name.toLowerCase().replace(/\s*\(.*\)/, '')));
      if (dest) business = { cat: bm[1], label: bm[2], placeId: dest.id, placeName: dest.name.replace(/\s*\(.*\)/, '') };
    }
    set((s) => ({ criteria: outcome.criteria, search: { ...s.search, criteria: outcome.criteria, direct: outcome.direct, matches: outcome.ranked, mode, notes, status: 'done', unknownArea, business } }));

    // Retrieve-then-synthesise: ask the AI to explain the retrieved candidates only.
    if (mode === 'ai' && outcome.ranked.length) {
      const cands = outcome.ranked.slice(0, 8).map((m) => ({ id: m.place.id, name: m.place.name, country: m.place.country, region: m.place.region, summary: m.place.summary, env: m.place.env, lifestyle: m.place.lifestyle, scores: m.place.scores, monthlyCostUSD_estimate: m.place.monthlyCostUSD, idealStay: m.place.idealStay, bestMonths: m.place.bestMonths, matchedBecause: m.reasons, gaps: m.gaps, provenance: m.place.provenance }));
      api.ai.explain(q, cands).then((r) => {
        const explain = Object.fromEntries(r.items.map((i) => [i.id, { why: i.why, caveat: i.caveat }]));
        const order = r.items.map((i) => i.id);
        set((s) => {
          if (s.search.query !== q) return s;
          const reordered = [...s.search.matches].sort((a, b) => { const ia = order.indexOf(a.place.id); const ib = order.indexOf(b.place.id); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
          return { search: { ...s.search, explain, followUps: r.followUps, matches: order.length ? reordered : s.search.matches } };
        });
      }).catch((e: Error) => set((s) => ({ search: { ...s.search, notes: [...s.search.notes, `AI explanations unavailable: ${e.message}`] } })));
    }

    // Worldwide lookup of towns/cities beyond the curated catalogue (live, labelled).
    if (words <= 4 && !hasStructure(outcome.criteria)) {
      api.geocode(q).then((r) => {
        const known = new Set(outcome.direct.map((d) => d.name.toLowerCase()));
        set((s) => (s.search.query === q ? { search: { ...s.search, geo: r.results.filter((g) => !known.has(g.name.toLowerCase())), geoState: 'done' } } : s));
      }).catch(() => set((s) => (s.search.query === q ? { search: { ...s.search, geoState: 'unavailable' } } : s)));
    } else set((s) => ({ search: { ...s.search, geoState: 'idle' } }));
  },
}));

function allPlaces(): Place[] {
  return [...BUILTIN_PLACES, ...Object.values(useStore.getState().customPlaces)];
}
