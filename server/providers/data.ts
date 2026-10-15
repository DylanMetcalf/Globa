import type { FxRates, GeocodeHit, LiveImage, NearbyBusiness, WeatherSnapshot } from '../../shared/types';
import { cached, fetchJson, ProviderError } from '../http';

/* ---------------- Geocoding (Open-Meteo, keyless) ---------------- */
export async function geocode(q: string): Promise<GeocodeHit[]> {
  const url = `${process.env.GEOCODE_URL ?? 'https://geocoding-api.open-meteo.com/v1/search'}?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
  const r = await cached(`geo:${q.toLowerCase()}`, 10 * 60_000, () => fetchJson<{ results?: any[] }>(url));
  return (r.results ?? [])
    .filter((x) => typeof x.latitude === 'number' && typeof x.longitude === 'number' && x.name)
    .map((x): GeocodeHit => ({
      id: String(x.id), name: x.name, country: x.country ?? '', countryCode: (x.country_code ?? '').toUpperCase(), region: x.admin1 ?? '',
      lat: x.latitude, lng: x.longitude, population: x.population, featureCode: x.feature_code,
    }));
}

/* ---------------- Weather (Open-Meteo, keyless) ---------------- */
export async function weather(lat: number, lng: number): Promise<WeatherSnapshot> {
  const key = `wx:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const url = `${process.env.WEATHER_URL ?? 'https://api.open-meteo.com/v1/forecast'}?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7&timezone=auto`;
  const r = await cached(key, 30 * 60_000, () => fetchJson<any>(url));
  if (!r?.current || !r?.daily?.time) throw new ProviderError('Unexpected weather response.');
  return {
    tempC: r.current.temperature_2m, windKph: r.current.wind_speed_10m, code: r.current.weather_code,
    daily: r.daily.time.map((d: string, i: number) => ({ date: d, maxC: r.daily.temperature_2m_max[i], minC: r.daily.temperature_2m_min[i], precipMm: r.daily.precipitation_sum[i] })),
    checkedAt: new Date().toISOString(),
  };
}

/* ---------------- Images + summaries (Wikipedia, keyless; Unsplash optional) ---------------- */
export interface WikiSummary { title: string; extract: string; url: string; image?: LiveImage }

export async function wikiSummary(title: string): Promise<WikiSummary> {
  const t = title.replace(/ /g, '_');
  const base = process.env.WIKI_URL ?? 'https://en.wikipedia.org';
  const r = await cached(`wiki:${t}`, 24 * 3600_000, () => fetchJson<any>(`${base}/api/rest_v1/page/summary/${encodeURIComponent(t)}`));
  if (!r?.title || !r?.extract) throw new ProviderError('No summary found.', 404);
  const page = r.content_urls?.desktop?.page ?? `${base}/wiki/${encodeURIComponent(t)}`;
  const img = r.originalimage?.source ?? r.thumbnail?.source;
  return {
    title: r.title, extract: r.extract, url: page,
    image: img ? { url: (r.thumbnail?.source ?? img).replace(/\/\d+px-/, '/960px-'), credit: 'Wikipedia / Wikimedia Commons', creditUrl: page, license: 'See the article’s image page for author and licence' } : undefined,
  };
}

export async function wikiSearchTitle(q: string): Promise<string | undefined> {
  const base = process.env.WIKI_URL ?? 'https://en.wikipedia.org';
  const r = await cached(`wikisearch:${q}`, 24 * 3600_000, () => fetchJson<{ pages?: { title: string }[] }>(`${base}/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=1`));
  return r.pages?.[0]?.title;
}

export async function unsplashImage(query: string): Promise<LiveImage | undefined> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return undefined;
  const r = await cached(`unsplash:${query}`, 24 * 3600_000, () =>
    fetchJson<{ results?: any[] }>(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, { headers: { Authorization: `Client-ID ${key}` } }),
  );
  const p = r.results?.[0];
  if (!p) return undefined;
  return { url: p.urls?.regular, credit: `${p.user?.name ?? 'Photographer'} on Unsplash`, creditUrl: `${p.links?.html ?? 'https://unsplash.com'}?utm_source=globa&utm_medium=referral`, license: 'Unsplash License' };
}

/* ---------------- Nearby businesses (OpenStreetMap via Overpass, keyless) ---------------- */
const OVERPASS: Record<string, string[]> = {
  restaurants: ['"amenity"="restaurant"'],
  coffee: ['"amenity"="cafe"'],
  takeaway: ['"amenity"="fast_food"', '"amenity"="restaurant"]["takeaway"~"yes|only"'],
  markets: ['"amenity"="marketplace"', '"shop"="farm"', '"shop"="deli"'],
  coworking: ['"amenity"="coworking_space"', '"office"="coworking"'],
  practical: ['"amenity"="pharmacy"', '"amenity"="clinic"', '"amenity"="hospital"', '"shop"="supermarket"'],
  viewpoints: ['"tourism"="viewpoint"'],
  accommodation: ['"tourism"="guest_house"', '"tourism"="apartment"', '"tourism"="chalet"', '"tourism"="hotel"', '"tourism"="hostel"'],
  nature: ['"natural"~"peak|waterfall|hot_spring|beach|cave_entrance"', '"leisure"="nature_reserve"'],
  activities: ['"tourism"~"attraction|museum|gallery"', '"leisure"~"water_park|climbing|swimming_pool"'],
};
export const NEARBY_CATEGORIES = Object.keys(OVERPASS);

export async function nearby(lat: number, lng: number, category: string, radiusM = 5000): Promise<NearbyBusiness[]> {
  const filters = OVERPASS[category];
  if (!filters) throw new ProviderError('Unknown category.', 400);
  const body = filters.map((f) => ['node', 'way'].map((t) => `${t}[${f}]["name"](around:${radiusM},${lat},${lng});`).join('')).join('');
  const q = `[out:json][timeout:15];(${body});out center 60;`;
  const url = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
  const r = await cached(`op:${category}:${lat.toFixed(3)},${lng.toFixed(3)}:${radiusM}`, 6 * 3600_000, () =>
    fetchJson<{ elements?: any[] }>(url, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'content-type': 'application/x-www-form-urlencoded' }, timeoutMs: 18000 }),
  );
  return (r.elements ?? [])
    .map((e): NearbyBusiness | null => {
      const la = e.lat ?? e.center?.lat; const lo = e.lon ?? e.center?.lon;
      if (typeof la !== 'number' || typeof lo !== 'number' || !e.tags?.name) return null;
      return {
        id: `osm-${e.type}-${e.id}`, name: e.tags.name, category: e.tags.amenity ?? e.tags.tourism ?? e.tags.natural ?? e.tags.leisure ?? e.tags.shop ?? category,
        lat: la, lng: lo, tags: pickTags(e.tags), sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      };
    })
    .filter((x): x is NearbyBusiness => !!x);
}
const pickTags = (t: Record<string, string>) => Object.fromEntries(['cuisine', 'opening_hours', 'website', 'phone', 'wheelchair', 'internet_access', 'outdoor_seating'].filter((k) => t[k]).map((k) => [k, t[k]]));

/* ---------------- Currency (Frankfurter, keyless) ---------------- */
export async function fx(base = 'USD'): Promise<FxRates> {
  const url = `${process.env.FX_URL ?? 'https://api.frankfurter.dev/v1/latest'}?base=${encodeURIComponent(base)}`;
  const r = await cached(`fx:${base}`, 6 * 3600_000, () => fetchJson<any>(url));
  if (!r?.rates) throw new ProviderError('Unexpected FX response.');
  return { base: r.base ?? base, date: r.date, rates: { ...r.rates, [base]: 1 } };
}
