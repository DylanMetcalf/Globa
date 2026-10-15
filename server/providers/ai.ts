import { z } from 'zod';
import {
  ACTIVITY_TAGS, ENV_TAGS, FOOD_TAGS, LIFESTYLE_TAGS, PRACTICAL_TAGS, SETTLEMENT_TYPES, STAY_DURATIONS,
} from '../../shared/types';
import { fetchJson, ProviderError } from '../http';

/** Provider interface: swap models/vendors here without touching routes or the UI. */
export interface AiProvider {
  id: string;
  model: string;
  complete(req: { system: string; user: string; maxTokens?: number }): Promise<string>;
}

export function getAiProvider(env = process.env): AiProvider | null {
  const which = (env.AI_PROVIDER ?? (env.ANTHROPIC_API_KEY ? 'anthropic' : env.OPENAI_API_KEY ? 'openai' : '')).toLowerCase();
  if (which === 'anthropic' && env.ANTHROPIC_API_KEY) {
    const model = env.AI_MODEL ?? 'claude-sonnet-5-5';
    return {
      id: 'anthropic', model,
      async complete({ system, user, maxTokens = 2000 }) {
        const r = await fetchJson<{ content: { type: string; text?: string }[] }>(`${env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com'}/v1/messages`, {
          method: 'POST', timeoutMs: 60000,
          headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
        });
        return r.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
      },
    };
  }
  if ((which === 'openai' || which === 'openai-compatible') && env.OPENAI_API_KEY) {
    const model = env.AI_MODEL ?? 'gpt-4o-mini';
    return {
      id: 'openai-compatible', model,
      async complete({ system, user, maxTokens = 2000 }) {
        const r = await fetchJson<{ choices: { message: { content: string } }[] }>(`${env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'}/chat/completions`, {
          method: 'POST', timeoutMs: 60000,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
          body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
        });
        return r.choices[0]?.message?.content ?? '';
      },
    };
  }
  return null;
}

/** Extract the first JSON object from a model reply (models sometimes wrap it in prose or fences). */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new ProviderError('The model did not return JSON.', 502);
  try { return JSON.parse(text.slice(start, end + 1)); } catch { throw new ProviderError('The model returned malformed JSON.', 502); }
}

const only = <T extends readonly string[]>(vals: T) => z.array(z.string()).catch([]).transform((a) => a.filter((x): x is T[number] => (vals as readonly string[]).includes(x)));

export const criteriaFromAi = z.object({
  env: only(ENV_TAGS), settlement: only(SETTLEMENT_TYPES), lifestyle: only(LIFESTYLE_TAGS), practical: only(PRACTICAL_TAGS),
  activities: only(ACTIVITY_TAGS), food: only(FOOD_TAGS),
  stay: z.enum(STAY_DURATIONS).optional().catch(undefined),
  months: z.array(z.number().int().min(1).max(12)).catch([]),
  crowds: z.enum(['any', 'low']).catch('any'),
  popularity: z.enum(['any', 'hidden', 'popular']).catch('any'),
  remoteness: z.enum(['any', 'remote', 'connected']).catch('any'),
  maxCost: z.number().min(1).max(5).optional().catch(undefined),
  nearPlaceName: z.string().optional().catch(undefined),
  followUps: z.array(z.string()).catch([]).transform((a) => a.slice(0, 4)),
});

export const INTERPRET_SYSTEM = `You convert a traveller's request into structured search criteria for a travel app.
Reply with ONE JSON object and nothing else. Keys: env, settlement, lifestyle, practical, activities, food (arrays), stay, months (1-12), crowds, popularity, remoteness, maxCost (1-5), nearPlaceName, followUps (<=3 short questions).
Allowed values:
env: ${ENV_TAGS.join(', ')}
settlement: ${SETTLEMENT_TYPES.join(', ')}
lifestyle: ${LIFESTYLE_TAGS.join(', ')}
practical: ${PRACTICAL_TAGS.join(', ')}
activities: ${ACTIVITY_TAGS.join(', ')}
food: ${FOOD_TAGS.join(', ')}
stay: ${STAY_DURATIONS.join(', ')}
crowds: any|low; popularity: any|hidden|popular; remoteness: any|remote|connected.
Use only listed values. Omit what the request does not imply. Do not invent places.`;

export const explainResult = z.object({
  items: z.array(z.object({ id: z.string(), why: z.string(), caveat: z.string().optional().catch(undefined) })).catch([]),
  followUps: z.array(z.string()).catch([]).transform((a) => a.slice(0, 4)),
});

export const EXPLAIN_SYSTEM = `You are GLOBA's travel research writer. You are given a user's request and CANDIDATE places retrieved from the app's catalogue.
Rules: reason ONLY from the candidates' provided fields. Do not add facts, prices, ratings, opening hours, or businesses that are not in the data. Fields marked curated/estimate are editorial estimates, say so when relying on them. Keep each "why" to 1-2 sentences, specific to the request, and mention one honest caveat when the data suggests one.
Reply with ONE JSON object: {"items":[{"id":"<candidate id>","why":"...","caveat":"..."}],"followUps":["..."]}. Use only candidate ids, in best-first order, at most 5.`;

export const chatResult = z.object({
  answer: z.string(),
  placeIds: z.array(z.string()).catch([]),
  followUps: z.array(z.string()).catch([]).transform((a) => a.slice(0, 4)),
  caveats: z.array(z.string()).catch([]),
});

export const CHAT_SYSTEM = `You are GLOBA's travel assistant for Dylan and Nicole, two remote workers who live in different places for weeks or months.
You are given CONTEXT (places from the app, the user's saved places, itineraries, and any live data with source URLs). Rules:
- Ground every factual claim in CONTEXT. If the context does not contain it, say you don't have it and suggest how to check.
- Never invent businesses, listings, prices, ratings, opening hours, visa rules or bookings.
- Distinguish: [curated] editorial data, [estimate], [live] with source, [user] notes. Label estimates as estimates.
- For visa/residency: do not advise; point to official government sources.
- Be warm, concise and specific. Reply with ONE JSON object: {"answer":"markdown-light text","placeIds":["ids from CONTEXT you recommend"],"followUps":["..."],"caveats":["..."]}.`;

export const itineraryResult = z.object({
  name: z.string().catch('Draft itinerary'),
  notes: z.string().catch(''),
  assumptions: z.array(z.string()).catch([]),
  stays: z.array(z.object({ placeId: z.string().optional(), title: z.string(), days: z.number().catch(7), notes: z.string().catch('') })).catch([]),
  days: z.array(z.object({
    label: z.string(), stayIndex: z.number().catch(0),
    stops: z.array(z.object({
      kind: z.enum(['place', 'food', 'coffee', 'activity', 'transport', 'rest', 'work', 'accommodation', 'note']).catch('place'),
      title: z.string(), placeId: z.string().optional(), startTime: z.string().catch(''), durationMin: z.number().catch(90), notes: z.string().catch(''),
    })).catch([]),
  })).catch([]),
});

export const ITINERARY_SYSTEM = `You draft travel itineraries for a couple who often work remotely.
You get the REQUEST and CANDIDATE places (with ids and coordinates). Rules:
- Reference places ONLY by candidate id. For meals, coffee or work blocks that are not a candidate, leave placeId empty and write a generic title (e.g. "Lunch — local café"); NEVER name a specific business.
- Times and durations are suggestions. Do not claim reservations, prices or availability.
- Respect pace (relaxed ~2 stops/day, balanced ~3, packed ~4), group nearby places on the same day, and include rest/work blocks when relevant.
- For stays over ~3 weeks, plan only a typical week per stay.
- List assumptions plainly.
Reply with ONE JSON object: {"name","notes","assumptions":[],"stays":[{"placeId","title","days","notes"}],"days":[{"label","stayIndex","stops":[{"kind","title","placeId","startTime":"HH:MM","durationMin","notes"}]}]}.`;
