import type {
  ActivityTag, Climate, Criteria, EnvTag, FoodTag, LifestyleTag, Match, Place, PracticalTag, SettlementType, StayDuration,
} from '../../shared/types';
import { haversineKm } from './geo';
import {
  ACTIVITY_LABELS, CLIMATE_LABELS, ENV_LABELS, FOOD_LABELS, LIFESTYLE_LABELS, MONTHS, PRACTICAL_LABELS, REASON_LABELS, SETTLEMENT_LABELS, STAY_LABELS,
} from './labels';

export function emptyCriteria(text = ''): Criteria {
  return {
    text, env: [], settlement: [], lifestyle: [], practical: [], activities: [], food: [], stayTypes: [], months: [], climate: [],
    crowds: 'any', popularity: 'any', remoteness: 'any', kind: 'any',
  };
}

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ *
 *  Demo-mode natural-language interpreter (deterministic).
 *  When an AI provider is configured the server returns a Criteria
 *  object instead; the ranking below is the same either way.
 * ------------------------------------------------------------------ */

const addTo = <T,>(arr: T[], ...v: T[]) => { for (const x of v) if (!arr.includes(x)) arr.push(x); };

const ENV_RULES: [RegExp, EnvTag[]][] = [
  [/\b(mountain|mountains|alps|alpine|peaks?|ridge)\b/, ['mountains']],
  [/\blakes?\b/, ['lakes']],
  [/\brivers?\b/, ['rivers']],
  [/\b(forest|forests|woods|woodland|jungle)\b/, ['forests']],
  [/\bwaterfalls?\b/, ['waterfalls']],
  [/\b(glaciers?|ice caps?)\b/, ['glaciers']],
  [/\b(desert|dunes?)\b/, ['deserts']],
  [/\b(canyons?|gorges?)\b/, ['canyons']],
  [/\bcaves?\b/, ['caves']],
  [/\b(volcano|volcanoes|volcanic)\b/, ['volcanoes']],
  [/\bislands?\b/, ['islands']],
  [/\b(beach|beaches|seaside|coast|coastal|ocean)\b/, ['beaches']],
  [/\b(wetlands?|lagoons?)\b/, ['wetlands']],
  [/\b(geolog\w*|rock formations?|surreal|otherworldly|alien|unusual (natural )?landscapes?|unusual natural)\b/, ['geology', 'phenomena']],
  [/\b(wildlife|whales?|penguins?|animals?|safari)\b/, ['wildlife']],
  [/\b(aurora|northern lights|natural phenomen\w*|phenomena)\b/, ['phenomena']],
];

const LIFESTYLE_RULES: [RegExp, LifestyleTag[]][] = [
  [/\b(quiet|peaceful|calm|tranquil|serene)\b/, ['quiet']],
  [/\b(social|lively|vibrant|buzzing)\b/, ['social']],
  [/\b(romantic|couples?|honeymoon)\b/, ['romantic']],
  [/\badventur\w*\b/, ['adventurous']],
  [/\b(remote|isolated|off grid|secluded)\b(?! work)/, ['remote']],
  [/\bwalkable\b/, ['walkable']],
  [/\b(creative|artsy|arts)\b/, ['creative']],
  [/\bcultur\w*\b/, ['cultural']],
  [/\b(outdoors?|nature)\b/, ['outdoors']],
  [/\b(slow living|slow pace|unhurried|relax\w*)\b/, ['slow-living']],
  [/\b(work remotely|remote work\w*|digital nomad\w*|work from|work friendly)\b/, ['work-focused']],
];

const PRACTICAL_RULES: [RegExp, PracticalTag[]][] = [
  [/\b(wi ?fi|internet|broadband|connectivity|connected)\b/, ['wifi']],
  [/\b(mobile signal|mobile coverage|cell)\b/, ['mobile']],
  [/\bcoworking\b/, ['coworking']],
  [/\b(town nearby|nearby town|near a town|town close)\b/, ['nearby-town']],
  [/\b(hospital|healthcare|doctor)\b/, ['healthcare']],
  [/\b(public transport|train|transit)\b/, ['public-transport']],
  [/\b(no car|car free|without a car)\b/, ['car-free']],
  [/\bairport\b/, ['airport']],
  [/\b(groceries|supermarket)\b/, ['groceries']],
];

const ACTIVITY_RULES: [RegExp, ActivityTag[]][] = [
  [/\b(hik\w*|trek\w*|trails?)\b/, ['hiking']],
  [/\bsurf\w*\b/, ['surfing']],
  [/\b(ski\w*|snowboard\w*|snow)\b/, ['skiing']],
  [/\b(div\w*|snorkel\w*)\b/, ['diving']],
  [/\bclimb\w*\b/, ['climbing']],
  [/\b(cycl\w*|biking|mountain bik\w*)\b/, ['cycling']],
  [/\bkayak\w*\b/, ['kayaking']],
  [/\b(stargaz\w*|dark sky|dark skies|stars)\b/, ['stargazing']],
  [/\bphotograph\w*\b/, ['photography']],
  [/\b(spa|wellness|yoga)\b/, ['wellness']],
  [/\bwhale\w*\b/, ['whale-watching']],
  [/\b(aurora|northern lights)\b/, ['aurora']],
  [/\b(history|historic|heritage)\b/, ['heritage']],
];

const FOOD_RULES: [RegExp, FoodTag[]][] = [
  [/\bstreet food\b/, ['street-food']],
  [/\bseafood\b/, ['seafood']],
  [/\bwine\w*\b/, ['wine']],
  [/\bcoffee\b/, ['coffee']],
  [/\bfarm to table\b/, ['farm-to-table']],
  [/\bfine dining\b/, ['fine-dining']],
  [/\bmarkets?\b/, ['markets']],
  [/\b(vegetarian|vegan)\b/, ['vegetarian-friendly']],
];

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, a: 1 };

function parseStay(t: string): StayDuration | undefined {
  if (/\b(weekend|long weekend)\b/.test(t)) return 'weekend';
  const m = t.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a)\s*(?:-\s*)?(week|weeks|month|months|year|years)\b/);
  if (m) {
    const n = /\d/.test(m[1]) ? Number(m[1]) : NUM_WORDS[m[1]];
    const unit = m[2];
    if (unit.startsWith('year')) return 'year';
    if (unit.startsWith('week')) return n <= 2 ? 'week' : 'month';
    if (n <= 1) return 'month';
    if (n <= 3) return 'three-months';
    if (n <= 8) return 'six-months';
    return 'year';
  }
  if (/\ba year\b|\bone year\b|\b12 months\b/.test(t)) return 'year';
  return undefined;
}

const SYMBOL_CCY: Record<string, string> = { '$': 'USD', '£': 'GBP', '€': 'EUR', r: 'ZAR' };

function parseBudget(raw: string): Criteria['budget'] | undefined {
  const m = raw.match(/([$£€]|\bR)\s?(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:\/|per|a|each)?\s*(day|daily|week|weekly|month|monthly|mo)?/i);
  if (!m) return undefined;
  let amount = Number(m[2].replace(/,/g, ''));
  if (m[3]) amount *= 1000;
  const p = (m[4] ?? 'month').toLowerCase();
  const period = p.startsWith('d') ? 'day' : p.startsWith('w') ? 'week' : 'month';
  return { amount, currency: SYMBOL_CCY[m[1].toLowerCase()] ?? SYMBOL_CCY[m[1]] ?? 'USD', period };
}

function parseMonths(t: string): number[] {
  const out: number[] = [];
  const names = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  names.forEach((n, i) => { if (new RegExp(`\\b(in|during|for|around|by) ${n}\\b`).test(t)) out.push(i + 1); });
  return out;
}

export interface NamedArea { label: string; norm: string; lat: number; lng: number; kind: 'place' | 'country'; countryCode?: string }

/** Pick the longest known place/country name appearing in the text. */
export function findArea(text: string, areas: NamedArea[]): NamedArea | undefined {
  const t = ` ${norm(text)} `;
  let best: NamedArea | undefined;
  for (const a of areas) {
    if (t.includes(` ${a.norm} `) && (!best || a.norm.length > best.norm.length)) best = a;
  }
  return best;
}

export function buildAreas(places: Place[], countries: { name: string; lat: number; lng: number }[] = []): NamedArea[] {
  const areas: NamedArea[] = [];
  const seenCountry = new Set<string>();
  for (const p of places) {
    if (p.kind !== 'destination') continue;
    areas.push({ label: p.name, norm: norm(p.name.replace(/\(.*?\)/g, '')), lat: p.lat, lng: p.lng, kind: 'place' });
    if (!seenCountry.has(p.countryCode)) {
      seenCountry.add(p.countryCode);
      areas.push({ label: p.country, norm: norm(p.country), lat: p.lat, lng: p.lng, kind: 'country', countryCode: p.countryCode });
    }
  }
  for (const c of countries) areas.push({ label: c.name, norm: norm(c.name), lat: c.lat, lng: c.lng, kind: 'country' });
  return areas;
}

export function interpretQuery(raw: string, areas: NamedArea[] = []): Criteria {
  const c = emptyCriteria(raw);
  const t = norm(raw);

  const area = findArea(raw, areas);
  if (area) {
    if (area.kind === 'country' && area.countryCode) {
      c.countryCode = area.countryCode;
    } else if (area.kind === 'place' && /\b(near|around|close to|outside|nearby|within|surrounding)\b/.test(t)) {
      c.near = { lat: area.lat, lng: area.lng, radiusKm: 450, label: area.label };
    }
  }
  // remove the area name so "cape town" doesn't trigger beach/etc.
  const tt = area ? t.replace(area.norm, ' ') : t;

  for (const [re, tags] of ENV_RULES) if (re.test(tt)) addTo(c.env, ...tags);
  for (const [re, tags] of LIFESTYLE_RULES) if (re.test(tt)) addTo(c.lifestyle, ...tags);
  for (const [re, tags] of PRACTICAL_RULES) if (re.test(tt)) addTo(c.practical, ...tags);
  for (const [re, tags] of ACTIVITY_RULES) if (re.test(tt)) addTo(c.activities, ...tags);
  for (const [re, tags] of FOOD_RULES) if (re.test(tt)) addTo(c.food, ...tags);

  if (/\bwork remotely|remote work|digital nomad|work from\b/.test(tt)) { addTo(c.practical, 'wifi'); addTo(c.lifestyle, 'work-focused'); }
  if (/\bwi ?fi\b/.test(tt) || /\binternet\b/.test(tt)) addTo(c.practical, 'wifi');
  if (/\bmountain town\b/.test(tt)) addTo(c.settlement, 'mountain-retreat', 'small-town', 'village');
  else if (/\b(small town|town)\b/.test(tt) && !/\bnearby town|town nearby\b/.test(tt)) addTo(c.settlement, 'small-town', 'village', 'coastal-town', 'mountain-retreat');
  if (/\bvillage\b/.test(tt)) addTo(c.settlement, 'village');
  if (/\bisland\b/.test(tt)) addTo(c.settlement, 'island');
  if (/\bcoastal town\b/.test(tt)) addTo(c.settlement, 'coastal-town');
  if (/\bcabin\b/.test(tt)) { addTo(c.stayTypes, 'cabin'); addTo(c.settlement, 'mountain-retreat', 'village', 'small-town', 'remote'); }
  if (/\b(countryside|rural)\b/.test(tt)) addTo(c.settlement, 'countryside', 'rural', 'village');
  if (/\bcity\b/.test(tt)) addTo(c.settlement, 'major-city');
  if (/\bvilla\b/.test(tt)) addTo(c.stayTypes, 'villa');

  c.stay = parseStay(tt);
  c.budget = parseBudget(raw);
  c.months = parseMonths(tt);
  if (/\b(reasonable|moderate|mid range)\b.*\b(budget|cost|price)|\b(budget|cost)\b.*\b(reasonable|moderate)\b/.test(tt)) c.maxCost = 3;
  if (/\b(cheap|affordable|inexpensive|low cost|budget friendly|on a budget)\b/.test(tt)) c.maxCost = 2;
  if (/\b(warm|hot|sunny)\b/.test(tt)) addTo(c.climate, 'tropical', 'warm-dry', 'mediterranean');
  if (/\b(cold|snowy|snow)\b/.test(tt)) addTo(c.climate, 'alpine', 'subarctic', 'cool');
  if (/\bmild\b/.test(tt)) addTo(c.climate, 'temperate', 'mediterranean');
  if (/\b(not overrun|few tourists|uncrowded|crowd free|off the beaten|hidden|undiscovered|lesser known|not touristy|quiet)\b/.test(tt)) c.crowds = 'low';
  if (/\b(hidden|undiscovered|lesser known|off the beaten|not touristy|not overrun)\b/.test(tt)) c.popularity = 'hidden';
  if (/\b(remote|secluded|isolated|off grid)\b(?! work)/.test(tt)) c.remoteness = 'remote';

  // Long-stay phrasing → ranks towns/cities, not single landmarks.
  if (c.stay && c.stay !== 'weekend' && c.stay !== 'week') c.kind = 'destination';
  if (/\b(live|living|base|stay)\b/.test(tt) && c.stay) c.kind = 'destination';
  if (c.near && !c.stay) c.kind = 'any';
  return c;
}

/* ------------------------------------------------------------------ *
 *  Ranking
 * ------------------------------------------------------------------ */

const STAY_RANK: Record<StayDuration, number> = { weekend: 0, week: 1, month: 2, 'three-months': 3, 'six-months': 4, year: 5, flexible: 2 };

export interface RankOptions {
  /** Rates for converting a criteria budget into USD (1 unit of key = x USD). Omit if unavailable. */
  toUSD?: Record<string, number>;
}

export function hasStructure(c: Criteria): boolean {
  return Boolean(
    c.env.length || c.settlement.length || c.lifestyle.length || c.practical.length || c.activities.length || c.food.length ||
      c.stayTypes.length || c.stay || c.budget || c.months.length || c.climate.length || c.crowds !== 'any' || c.popularity !== 'any' ||
      c.remoteness !== 'any' || c.kind !== 'any' || c.countryCode || c.near || c.maxCost,
  );
}

export function monthlyBudgetUSD(b: NonNullable<Criteria['budget']>, toUSD?: Record<string, number>): number | undefined {
  const rate = b.currency === 'USD' ? 1 : toUSD?.[b.currency];
  if (rate === undefined) return undefined;
  const usd = b.amount * rate;
  return b.period === 'day' ? usd * 30 : b.period === 'week' ? usd * 4.33 : usd;
}

export function rankPlaces(places: Place[], c: Criteria, opts: RankOptions = {}): Match[] {
  const out: Match[] = [];
  for (const p of places) {
    if (c.kind !== 'any' && p.kind !== c.kind) continue;
    if (c.countryCode && p.countryCode !== c.countryCode) continue;
    const reasons: string[] = [];
    const gaps: string[] = [];
    let got = 0;
    let max = 0;
    const dim = (weight: number, frac: number) => { max += weight; got += weight * frac; };

    if (c.near) {
      const d = haversineKm(p, c.near);
      if (d > c.near.radiusKm) continue;
      dim(2, 1 - (d / c.near.radiusKm) * 0.6);
      reasons.push(`About ${Math.round(d)} km from ${c.near.label} in a straight line`);
    }
    if (c.env.length) {
      const hit = c.env.filter((e) => p.env.includes(e));
      dim(3, hit.length / c.env.length);
      if (hit.length) reasons.push(`Features ${hit.map((e) => ENV_LABELS[e].toLowerCase()).join(', ')}`);
      const miss = c.env.filter((e) => !p.env.includes(e));
      if (miss.length) gaps.push(`No ${miss.map((e) => ENV_LABELS[e].toLowerCase()).join(' / ')} in our data`);
    }
    if (c.settlement.length) {
      const ok = p.settlement && c.settlement.includes(p.settlement);
      dim(2, ok ? 1 : 0);
      if (ok) reasons.push(`${SETTLEMENT_LABELS[p.settlement!]} setting`);
      else if (p.settlement) gaps.push(`Is a ${SETTLEMENT_LABELS[p.settlement].toLowerCase()}`);
    }
    if (c.lifestyle.length) {
      const hit = c.lifestyle.filter((l) => p.lifestyle.includes(l));
      dim(2, hit.length / c.lifestyle.length);
      if (hit.length) reasons.push(`Feels ${hit.map((l) => LIFESTYLE_LABELS[l].toLowerCase()).join(', ')}`);
      const miss = c.lifestyle.filter((l) => !p.lifestyle.includes(l));
      if (miss.length && p.kind === 'destination') gaps.push(`Not especially ${miss.map((l) => LIFESTYLE_LABELS[l].toLowerCase()).join(' / ')}`);
    }
    if (c.practical.length) {
      const hit = c.practical.filter((x) => (x === 'wifi' ? p.practical.includes('wifi') && p.scores.internet >= 3 : p.practical.includes(x)));
      dim(2, hit.length / c.practical.length);
      if (hit.length) {
        reasons.push(`${hit.map((x) => PRACTICAL_LABELS[x]).join(', ')}${hit.includes('wifi') ? ` (internet rated ${p.scores.internet}/5, curated)` : ''}`);
      }
      const miss = c.practical.filter((x) => !hit.includes(x));
      if (miss.length && p.kind === 'destination') gaps.push(`Weaker on ${miss.map((x) => PRACTICAL_LABELS[x].toLowerCase()).join(', ')}`);
    }
    if (c.activities.length) {
      const hit = c.activities.filter((a) => p.activities.includes(a));
      dim(2, hit.length / c.activities.length);
      if (hit.length) reasons.push(`Good for ${hit.map((a) => ACTIVITY_LABELS[a].toLowerCase()).join(', ')}`);
    }
    if (c.food.length) {
      const hit = c.food.filter((f) => p.food.includes(f));
      dim(1, hit.length / c.food.length);
      if (hit.length) reasons.push(`Food scene: ${hit.map((f) => FOOD_LABELS[f].toLowerCase()).join(', ')}`);
    }
    if (c.stayTypes.length) {
      const hit = c.stayTypes.filter((s) => p.stayTypes.includes(s));
      dim(1, hit.length / c.stayTypes.length);
      if (hit.length) reasons.push(`${hit.join(', ')} stays are typical`);
    }
    if (c.stay && c.stay !== 'flexible') {
      const fits = p.idealStay.includes(c.stay) ? 1 : p.idealStay.some((s) => Math.abs(STAY_RANK[s] - STAY_RANK[c.stay!]) <= 1) ? 0.5 : 0;
      dim(2, fits);
      if (fits === 1) reasons.push(`Suits a stay of ${STAY_LABELS[c.stay].toLowerCase()}`);
      else if (fits === 0 && p.kind === 'destination') gaps.push(`Better for ${p.idealStay.map((s) => STAY_LABELS[s].toLowerCase()).join(' / ')}`);
    }
    if (c.budget) {
      const monthly = monthlyBudgetUSD(c.budget, opts.toUSD);
      if (monthly === undefined) {
        gaps.push(`Budget not compared: no live ${c.budget.currency} rate available`);
      } else if (p.monthlyCostUSD) {
        const [lo, hi] = p.monthlyCostUSD;
        const frac = monthly >= hi ? 1 : monthly >= lo ? 0.6 : 0;
        dim(2, frac);
        if (frac === 1) reasons.push(`Estimated cost for two ($${lo.toLocaleString()}–$${hi.toLocaleString()}/mo) fits your budget`);
        else if (frac > 0) reasons.push(`Lower end of the cost estimate fits your budget`);
        else gaps.push(`Estimated cost (from $${lo.toLocaleString()}/mo) is above your budget`);
      }
    }
    if (c.maxCost) {
      const ok = p.scores.cost <= c.maxCost;
      dim(1.5, ok ? 1 : 0);
      if (ok) reasons.push(`Cost level ${p.scores.cost}/5 (relative, curated)`);
      else if (p.kind === 'destination') gaps.push(`Cost level ${p.scores.cost}/5`);
    }
    if (c.months.length) {
      const hit = c.months.filter((m) => p.bestMonths.includes(m));
      dim(1.5, hit.length / c.months.length);
      if (hit.length) reasons.push(`${hit.map((m) => MONTHS[m - 1]).join(', ')} is a good time to be there`);
      else gaps.push(`Not at its best in ${c.months.map((m) => MONTHS[m - 1]).join(', ')}`);
    }
    if (c.climate.length) {
      const ok = c.climate.includes(p.climate);
      dim(1, ok ? 1 : 0);
      if (ok) reasons.push(`${CLIMATE_LABELS[p.climate]} climate`);
    }
    if (c.crowds === 'low') {
      const ok = p.scores.crowds <= 3;
      dim(1.5, ok ? (p.scores.crowds <= 2 ? 1 : 0.6) : 0);
      if (ok) reasons.push(`Crowds rated ${p.scores.crowds}/5 (curated)`);
      else gaps.push('Can be crowded in peak periods');
    }
    if (c.popularity !== 'any') {
      const ok = c.popularity === 'hidden' ? p.scores.popularity <= 3 : p.scores.popularity >= 4;
      dim(1.5, ok ? 1 : 0);
      if (ok) reasons.push(c.popularity === 'hidden' ? 'Less of a headline destination' : 'A well-known destination');
    }
    if (c.remoteness !== 'any') {
      const ok = c.remoteness === 'remote' ? p.scores.remoteness >= 4 : p.scores.remoteness <= 2;
      dim(1.5, ok ? 1 : 0);
      if (ok) reasons.push(c.remoteness === 'remote' ? 'Genuinely remote' : 'Well connected');
    }
    if (c.countryCode) { max += 0; }

    let score = max === 0 ? 0.5 : got / max;
    const q = norm(c.text);
    if (q && norm(`${p.name} ${p.region} ${p.country}`).includes(q) && q.length > 2) score = Math.min(1, score + 0.3);
    if (max > 0 && got === 0) continue;
    if (max > 0 && score < 0.25) continue;
    if (p.kind === 'poi' && !c.near && !c.env.length && !c.activities.length && c.kind !== 'poi') continue;
    if (!reasons.length) reasons.push(REASON_LABELS[p.primaryReason]);
    out.push({ place: p, score, reasons, gaps });
  }
  // POIs rank slightly behind destinations unless the query is about landscapes/nearby.
  out.sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name));
  return out;
}

/** Cheap, forgiving name search for autocomplete and direct lookups. */
export function nameSearch(places: Place[], q: string, limit = 8): Place[] {
  const nq = norm(q);
  if (!nq) return [];
  const toks = nq.split(' ');
  const scored: { p: Place; s: number }[] = [];
  for (const p of places) {
    const name = norm(p.name);
    const hay = norm(`${p.name} ${p.region} ${p.country}`);
    let s = 0;
    if (name === nq) s = 100;
    else if (name.startsWith(nq)) s = 80;
    else if (name.split(' ').some((w) => w.startsWith(toks[0])) && toks.every((t) => hay.includes(t))) s = 60;
    else if (toks.every((t) => hay.includes(t))) s = 40;
    if (s) scored.push({ p, s: s + (p.kind === 'destination' ? 5 : 0) });
  }
  return scored.sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name)).slice(0, limit).map((x) => x.p);
}

export interface SearchOutcome {
  criteria: Criteria;
  direct: Place[];
  ranked: Match[];
  structured: boolean;
}

export function searchPlaces(places: Place[], query: string, areas: NamedArea[], opts: RankOptions = {}, criteriaOverride?: Criteria): SearchOutcome {
  const criteria = criteriaOverride ?? interpretQuery(query, areas);
  const structured = hasStructure(criteria);
  const toks = norm(query).split(' ').filter(Boolean);
  const direct = toks.length <= 4 && !structured ? nameSearch(places, query, 8) : toks.length <= 3 ? nameSearch(places, query, 5) : [];
  const ranked = structured ? rankPlaces(places, criteria, opts) : [];
  return { criteria, direct, ranked, structured };
}

/* Filter-panel helpers ------------------------------------------------ */

export interface Chip { key: string; label: string; remove: (c: Criteria) => Criteria }

export function criteriaChips(c: Criteria): Chip[] {
  const chips: Chip[] = [];
  const arr = <K extends keyof Criteria>(key: K, labels: (v: any) => string) => {
    for (const v of c[key] as any[]) chips.push({ key: `${key}:${v}`, label: labels(v), remove: (x) => ({ ...x, [key]: (x[key] as any[]).filter((y) => y !== v) }) });
  };
  arr('env', (v: EnvTag) => ENV_LABELS[v]);
  arr('settlement', (v: SettlementType) => SETTLEMENT_LABELS[v]);
  arr('lifestyle', (v: LifestyleTag) => LIFESTYLE_LABELS[v]);
  arr('practical', (v: PracticalTag) => PRACTICAL_LABELS[v]);
  arr('activities', (v: ActivityTag) => ACTIVITY_LABELS[v]);
  arr('food', (v: FoodTag) => FOOD_LABELS[v]);
  arr('stayTypes', (v: string) => `Stay: ${v}`);
  arr('climate', (v: Climate) => CLIMATE_LABELS[v]);
  arr('months', (v: number) => `Month: ${MONTHS[v - 1]}`);
  if (c.stay) chips.push({ key: 'stay', label: `Stay: ${STAY_LABELS[c.stay]}`, remove: (x) => ({ ...x, stay: undefined }) });
  if (c.budget) chips.push({ key: 'budget', label: `Budget ≤ ${c.budget.amount.toLocaleString()} ${c.budget.currency}/${c.budget.period}`, remove: (x) => ({ ...x, budget: undefined }) });
  if (c.maxCost) chips.push({ key: 'maxCost', label: `Cost level ≤ ${c.maxCost}/5`, remove: (x) => ({ ...x, maxCost: undefined }) });
  if (c.crowds === 'low') chips.push({ key: 'crowds', label: 'Fewer crowds', remove: (x) => ({ ...x, crowds: 'any' }) });
  if (c.popularity !== 'any') chips.push({ key: 'popularity', label: c.popularity === 'hidden' ? 'Hidden gems' : 'Popular', remove: (x) => ({ ...x, popularity: 'any' }) });
  if (c.remoteness !== 'any') chips.push({ key: 'remoteness', label: c.remoteness === 'remote' ? 'Remote' : 'Well connected', remove: (x) => ({ ...x, remoteness: 'any' }) });
  if (c.kind !== 'any') chips.push({ key: 'kind', label: c.kind === 'destination' ? 'Places to stay' : 'Landmarks', remove: (x) => ({ ...x, kind: 'any' }) });
  if (c.near) chips.push({ key: 'near', label: `Near ${c.near.label}`, remove: (x) => ({ ...x, near: undefined }) });
  if (c.countryCode) chips.push({ key: 'country', label: `Country: ${c.countryCode}`, remove: (x) => ({ ...x, countryCode: undefined }) });
  return chips;
}

export function criteriaIsEmpty(c: Criteria): boolean {
  return !hasStructure(c);
}

/** Lightweight, always-offline “why” sentence for a Match. */
export function explainMatch(m: Match): string {
  const lead = m.reasons.slice(0, 3).join('; ');
  const gap = m.gaps[0] ? ` Worth checking: ${m.gaps[0].toLowerCase()}.` : '';
  return `${lead}.${gap}`;
}

/** Turn a profile's saved preferences into search criteria (used for "Picked for you"). */
export function criteriaFromPrefs(p: import('../../shared/types').Preferences): Criteria {
  const c = emptyCriteria();
  c.env = [...p.interests];
  c.climate = [...p.climate];
  if (p.stay !== 'flexible') c.stay = p.stay;
  if (p.budget && p.budget.amount > 0) c.budget = p.budget;
  if (p.remoteWork.needsWifi) c.practical.push('wifi');
  if (p.remoteWork.needsCoworking) c.practical.push('coworking');
  if (p.crowds === 'low') c.crowds = 'low';
  c.kind = 'destination';
  return c;
}

export const prefsAreEmpty = (p: import('../../shared/types').Preferences) =>
  !p.interests.length && !p.climate.length && p.stay === 'flexible' && !(p.budget && p.budget.amount > 0) && !p.remoteWork.needsWifi && !p.remoteWork.needsCoworking && p.crowds === 'any';
