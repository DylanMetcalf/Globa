import type {
  ApiStatus, Criteria, FxRates, GeocodeHit, LiveImage, NearbyBusiness, WeatherSnapshot,
} from '../../shared/types';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function call<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 20000);
  try {
    const res = await fetch(path, { ...init, signal: init?.signal ?? ctrl.signal, headers: { 'content-type': 'application/json', ...init?.headers } });
    const text = await res.text();
    let json: any = undefined;
    try { json = text ? JSON.parse(text) : undefined; } catch { /* html fallback etc. */ }
    if (!res.ok) throw new ApiError(json?.error ?? `Request failed (${res.status})`, res.status);
    if (json === undefined) throw new ApiError('The server returned an unexpected response.', res.status);
    return json as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') throw new ApiError('The request timed out.', 504);
    throw new ApiError('Could not reach the GLOBA server.', 0);
  } finally {
    clearTimeout(t);
  }
}

const qs = (o: Record<string, string | number | undefined>) =>
  Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');

export type AiCriteria = Partial<Pick<Criteria, 'env' | 'settlement' | 'lifestyle' | 'practical' | 'activities' | 'food' | 'stay' | 'months' | 'crowds' | 'popularity' | 'remoteness' | 'maxCost'>> & { nearPlaceName?: string; followUps: string[] };

export interface ChatReply { answer: string; placeIds: string[]; followUps: string[]; caveats: string[]; model: string }

export const api = {
  status: () => call<ApiStatus>('/api/status', { timeoutMs: 6000 }),
  mapConfig: () => call<{ tileUrl: string; attribution: string; custom: boolean }>('/api/map-config', { timeoutMs: 6000 }),
  geocode: (q: string, signal?: AbortSignal) => call<{ results: GeocodeHit[]; source: { label: string; url: string } }>(`/api/geocode?${qs({ q })}`, { signal }),
  weather: (lat: number, lng: number) => call<{ weather: WeatherSnapshot; source: { label: string; url: string } }>(`/api/weather?${qs({ lat, lng })}`),
  image: (title?: string, q?: string) => call<{ image: LiveImage; summary?: { text: string; title: string; url: string } }>(`/api/image?${qs({ title, q })}`),
  nearby: (lat: number, lng: number, category: string, radius?: number) =>
    call<{ results: NearbyBusiness[]; source: { label: string; url: string }; checkedAt: string }>(`/api/nearby?${qs({ lat, lng, category, radius })}`, { timeoutMs: 30000 }),
  accommodation: (name: string, country: string, lat: number, lng: number) =>
    call<{ state: 'live' | 'unavailable'; provider: string; listings: { id: string; name: string; url: string; imageUrl?: string; priceText?: string; rating?: number; summary?: string; checkedAt: string }[]; searchLinks: { label: string; url: string }[]; message?: string }>(`/api/accommodation?${qs({ name, country, lat, lng })}`),
  fx: () => call<{ fx: FxRates; source: { label: string; url: string } }>('/api/fx'),
  ai: {
    interpret: (query: string) => call<{ criteria: AiCriteria }>('/api/ai/interpret', { method: 'POST', body: JSON.stringify({ query }), timeoutMs: 60000 }),
    explain: (query: string, candidates: unknown[]) =>
      call<{ items: { id: string; why: string; caveat?: string }[]; followUps: string[]; model: string }>('/api/ai/explain', { method: 'POST', body: JSON.stringify({ query, candidates }), timeoutMs: 60000 }),
    chat: (messages: { role: 'user' | 'assistant'; content: string }[], context: unknown) =>
      call<ChatReply>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ messages, context }), timeoutMs: 60000 }),
    itinerary: (request: unknown, candidates: unknown[]) =>
      call<{ itinerary: any; model: string }>('/api/ai/itinerary', { method: 'POST', body: JSON.stringify({ request, candidates }), timeoutMs: 90000 }),
  },
};
