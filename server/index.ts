import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { ApiStatus, IntegrationStatus } from '../shared/types';
import { ProviderError } from './http';
import {
  CHAT_SYSTEM, EXPLAIN_SYSTEM, INTERPRET_SYSTEM, ITINERARY_SYSTEM, chatResult, criteriaFromAi, explainResult, extractJson, getAiProvider, itineraryResult,
} from './providers/ai';
import { getAccommodationProvider, getRoutingProvider } from './providers/registry';
import { NEARBY_CATEGORIES, fx, geocode, nearby, unsplashImage, weather, wikiSearchTitle, wikiSummary } from './providers/data';

try { process.loadEnvFile?.(); } catch { /* no .env: fine, demo mode */ }

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  // Minimal per-IP rate limit for expensive routes (AI + external lookups).
  const hits = new Map<string, { n: number; t: number }>();
  const limit = (max: number) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const k = `${req.ip}:${req.path.split('/')[2]}`;
    const now = Date.now();
    const h = hits.get(k);
    if (!h || now - h.t > 60_000) hits.set(k, { n: 1, t: now });
    else if (++h.n > max) return void res.status(429).json({ error: 'Too many requests. Please slow down a little.' });
    next();
  };

  const wrap = (fn: (req: express.Request, res: express.Response) => Promise<unknown>) => (req: express.Request, res: express.Response) => {
    fn(req, res).then((data) => { if (!res.headersSent) res.json(data); }).catch((e: unknown) => {
      const status = e instanceof ProviderError ? e.status : e instanceof z.ZodError ? 400 : 500;
      if (!(e instanceof ProviderError)) console.error('[api]', e instanceof Error ? e.message : e);
      res.status(status).json({ error: e instanceof Error ? e.message : 'Unexpected error' });
    });
  };

  const needAi = () => {
    const ai = getAiProvider();
    if (!ai) throw new ProviderError('No AI provider is configured on the server. The app is running in demonstration mode.', 501);
    return ai;
  };

  app.get('/api/status', (_req, res) => {
    const ai = getAiProvider();
    const e = process.env;
    const integrations: IntegrationStatus[] = [
      { id: 'ai', label: 'AI model', state: ai ? 'live' : 'demo', detail: ai ? `${ai.id} · ${ai.model}` : 'Demonstration mode: deterministic keyword interpretation and local ranking.', env: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'AI_PROVIDER', 'AI_MODEL'] },
      { id: 'geocode', label: 'Place lookup (worldwide cities & towns)', state: 'live', detail: 'Open-Meteo geocoding (no key). Used for places outside the curated catalogue.' },
      { id: 'weather', label: 'Weather', state: 'live', detail: 'Open-Meteo forecast (no key).' },
      { id: 'images', label: 'Images & summaries', state: 'live', detail: e.UNSPLASH_ACCESS_KEY ? 'Wikipedia + Unsplash.' : 'Wikipedia (no key). Add UNSPLASH_ACCESS_KEY for more photography.', env: ['UNSPLASH_ACCESS_KEY'] },
      { id: 'nearby', label: 'Nearby businesses (Suggest More)', state: 'live', detail: 'OpenStreetMap via Overpass (no key, best-effort; coverage varies by area).' },
      { id: 'fx', label: 'Currency conversion', state: 'live', detail: 'Frankfurter (no key).' },
      { id: 'tiles', label: 'Map tiles', state: 'live', detail: e.MAP_TILE_URL ? 'Custom tile provider.' : 'OpenStreetMap standard tiles (light use only). Configure MAP_TILE_URL for production.', env: ['MAP_TILE_URL', 'MAP_TILE_ATTRIBUTION'] },
      { id: 'accommodation', label: 'Accommodation listings', state: getAccommodationProvider().configured ? 'live' : 'demo', detail: getAccommodationProvider().configured ? `Provider: ${getAccommodationProvider().id}` : 'No listing provider is connected. GLOBA shows search links and OpenStreetMap-listed places, never invented properties.', env: ['ACCOMMODATION_API_KEY'] },
      { id: 'routing', label: 'Routing & travel times', state: getRoutingProvider().configured ? 'live' : 'demo', detail: getRoutingProvider().configured ? `Provider: ${getRoutingProvider().id}` : 'Not connected. Straight-line distances are shown and labelled as such.', env: ['ROUTING_API_KEY'] },
    ];
    const status: ApiStatus = { version: '0.1.0', ai: { provider: ai?.id ?? 'none', model: ai?.model ?? '', state: ai ? 'live' : 'demo' }, integrations, serverTime: new Date().toISOString() };
    res.json(status);
  });

  app.get('/api/map-config', (_req, res) => {
    const e = process.env;
    const key = e.MAP_TILE_KEY ? `${e.MAP_TILE_URL?.includes('?') ? '&' : '?'}key=${encodeURIComponent(e.MAP_TILE_KEY)}` : '';
    res.json({
      tileUrl: e.MAP_TILE_URL ? e.MAP_TILE_URL + key : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: e.MAP_TILE_ATTRIBUTION ?? '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      custom: Boolean(e.MAP_TILE_URL),
    });
  });

  /* ---- AI ---- */
  app.post('/api/ai/interpret', limit(30), wrap(async (req) => {
    const { query } = z.object({ query: z.string().min(2).max(500) }).parse(req.body);
    const out = await needAi().complete({ system: INTERPRET_SYSTEM, user: query, maxTokens: 600 });
    return { criteria: criteriaFromAi.parse(extractJson(out)) };
  }));

  app.post('/api/ai/explain', limit(30), wrap(async (req) => {
    const body = z.object({ query: z.string().max(500), candidates: z.array(z.object({ id: z.string() }).passthrough()).max(12) }).parse(req.body);
    const ai = needAi();
    const out = await ai.complete({ system: EXPLAIN_SYSTEM, user: JSON.stringify({ request: body.query, candidates: body.candidates }), maxTokens: 1500 });
    const parsed = explainResult.parse(extractJson(out));
    const ids = new Set(body.candidates.map((c) => c.id));
    return { items: parsed.items.filter((i) => ids.has(i.id)).slice(0, 5), followUps: parsed.followUps, model: ai.model };
  }));

  app.post('/api/ai/chat', limit(20), wrap(async (req) => {
    const body = z.object({
      messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).min(1).max(12),
      context: z.unknown(),
    }).parse(req.body);
    const ai = needAi();
    const transcript = body.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const out = await ai.complete({ system: CHAT_SYSTEM, user: `CONTEXT:\n${JSON.stringify(body.context).slice(0, 24000)}\n\nCONVERSATION:\n${transcript}`, maxTokens: 1500 });
    const parsed = chatResult.safeParse(extractJson(out));
    if (!parsed.success) throw new ProviderError('The model reply could not be validated.');
    return { ...parsed.data, model: ai.model };
  }));

  app.post('/api/ai/itinerary', limit(10), wrap(async (req) => {
    const body = z.object({ request: z.unknown(), candidates: z.array(z.object({ id: z.string() }).passthrough()).max(60) }).parse(req.body);
    const ai = needAi();
    const out = await ai.complete({ system: ITINERARY_SYSTEM, user: JSON.stringify({ request: body.request, candidates: body.candidates }), maxTokens: 4000 });
    const parsed = itineraryResult.parse(extractJson(out));
    const ids = new Set(body.candidates.map((c) => c.id));
    const clean = {
      ...parsed,
      stays: parsed.stays.map((s) => ({ ...s, placeId: s.placeId && ids.has(s.placeId) ? s.placeId : undefined })),
      days: parsed.days.map((d) => ({ ...d, stops: d.stops.map((s) => ({ ...s, placeId: s.placeId && ids.has(s.placeId) ? s.placeId : undefined })) })),
    };
    return { itinerary: clean, model: ai.model };
  }));

  /* ---- Data providers ---- */
  app.get('/api/geocode', limit(40), wrap(async (req) => {
    const { q } = z.object({ q: z.string().min(2).max(100) }).parse(req.query);
    return { results: await geocode(q), source: { label: 'Open-Meteo Geocoding', url: 'https://open-meteo.com/en/docs/geocoding-api' } };
  }));
  app.get('/api/weather', limit(40), wrap(async (req) => {
    const q = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) }).parse(req.query);
    return { weather: await weather(q.lat, q.lng), source: { label: 'Open-Meteo', url: 'https://open-meteo.com/' } };
  }));
  app.get('/api/image', limit(60), wrap(async (req) => {
    const q = z.object({ title: z.string().max(120).optional(), q: z.string().max(120).optional() }).parse(req.query);
    const unsplash = q.q ? await unsplashImage(q.q).catch(() => undefined) : undefined;
    let wiki: Awaited<ReturnType<typeof wikiSummary>> | undefined;
    try {
      wiki = await wikiSummary(q.title ?? q.q ?? '');
    } catch {
      const t = q.q ? await wikiSearchTitle(q.q).catch(() => undefined) : undefined;
      if (t) wiki = await wikiSummary(t).catch(() => undefined);
    }
    if (!unsplash && !wiki?.image && q.q) {
      // The page exists but has no lead image: try the best search match for the place name instead.
      const t = await wikiSearchTitle(q.q).catch(() => undefined);
      if (t && t !== wiki?.title) { const alt = await wikiSummary(t).catch(() => undefined); if (alt?.image) wiki = { ...alt, extract: wiki?.extract ?? alt.extract, title: wiki?.title ?? alt.title, url: wiki?.url ?? alt.url }; }
    }
    if (!unsplash && !wiki?.image) throw new ProviderError('No image found.', 404);
    return { image: unsplash ?? wiki?.image, summary: wiki ? { text: wiki.extract, title: wiki.title, url: wiki.url } : undefined };
  }));
  app.get('/api/nearby', limit(30), wrap(async (req) => {
    const q = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180), category: z.string(), radius: z.coerce.number().min(500).max(30000).default(5000) }).parse(req.query);
    if (!NEARBY_CATEGORIES.includes(q.category)) throw new ProviderError('Unknown category.', 400);
    return { results: await nearby(q.lat, q.lng, q.category, q.radius), source: { label: 'OpenStreetMap contributors (Overpass API)', url: 'https://www.openstreetmap.org/copyright' }, checkedAt: new Date().toISOString() };
  }));
  app.get('/api/accommodation', limit(30), wrap(async (req) => {
    const q = z.object({ name: z.string().max(120), country: z.string().max(80).default(''), lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180), checkIn: z.string().optional(), checkOut: z.string().optional() }).parse(req.query);
    return getAccommodationProvider().search(q);
  }));
  app.get('/api/route', limit(30), wrap(async (req) => {
    const q = z.object({ fromLat: z.coerce.number(), fromLng: z.coerce.number(), toLat: z.coerce.number(), toLng: z.coerce.number(), mode: z.enum(['drive', 'walk', 'transit', 'bike']).default('drive') }).parse(req.query);
    return getRoutingProvider().route({ from: { lat: q.fromLat, lng: q.fromLng }, to: { lat: q.toLat, lng: q.toLng }, mode: q.mode });
  }));
  app.get('/api/fx', limit(30), wrap(async () => ({ fx: await fx('USD'), source: { label: 'Frankfurter (ECB reference rates)', url: 'https://frankfurter.dev' } })));

  app.use('/api', (_req, res) => void res.status(404).json({ error: 'Not found' }));

  // Production: serve the built client.
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  return app;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 8787);
  createApp().listen(port, '0.0.0.0', () => console.log(`GLOBA API listening on http://localhost:${port}${existsSync(path.resolve('dist')) ? ' (serving ./dist)' : ''}`));
}
