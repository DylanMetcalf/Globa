import type { SourceRef } from '../shared/types';

const UA = 'GLOBA/0.1 (personal travel planner; contact: set GLOBA_CONTACT in .env)';

export class ProviderError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

interface FetchOpts { timeoutMs?: number; headers?: Record<string, string>; method?: string; body?: string }

/** fetch with timeout, UA, status checking and JSON parsing. All provider calls go through here. */
export async function fetchJson<T = unknown>(url: string, opts: FetchOpts = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 9000);
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET', body: opts.body, signal: ctrl.signal,
      headers: { 'User-Agent': process.env.GLOBA_CONTACT ? `${UA.replace('set GLOBA_CONTACT in .env', process.env.GLOBA_CONTACT)}` : UA, Accept: 'application/json', ...opts.headers },
    });
    if (res.status === 429) throw new ProviderError('The provider is rate limiting requests. Try again shortly.', 429);
    if (!res.ok) throw new ProviderError(`Provider responded ${res.status}`, 502);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if ((e as Error).name === 'AbortError') throw new ProviderError('The provider timed out.', 504);
    throw new ProviderError(`Provider unreachable (${(e as Error).message})`, 502);
  } finally {
    clearTimeout(timer);
  }
}

/** Small TTL cache: keeps us polite to free public APIs. */
const store = new Map<string, { at: number; v: unknown }>();
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const v = await fn();
  store.set(key, { at: Date.now(), v });
  if (store.size > 500) store.delete(store.keys().next().value as string);
  return v;
}

export const src = (label: string, url: string, provenance: SourceRef['provenance'] = 'live'): SourceRef => ({
  label, url, provenance, checkedAt: new Date().toISOString(),
});
