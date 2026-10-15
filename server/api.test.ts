// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from './index';
import { extractJson, criteriaFromAi } from './providers/ai';

let server: Server; let base = '';
beforeAll(async () => {
  delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENAI_API_KEY;
  await new Promise<void>((res) => { server = createApp().listen(0, () => res()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((res) => server.close(() => res())));

describe('API', () => {
  it('reports demo mode honestly when no AI key is set', async () => {
    const s: any = await (await fetch(`${base}/api/status`)).json();
    expect(s.ai.state).toBe('demo');
    const accommodation = s.integrations.find((i: any) => i.id === 'accommodation');
    expect(accommodation.state).not.toBe('live');
  });
  it('AI routes return 501 (not fake answers) without a provider', async () => {
    const r = await fetch(`${base}/api/ai/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], context: {} }) });
    expect(r.status).toBe(501);
    expect(((await r.json()) as any).error).toMatch(/demonstration mode/i);
  });
  it('validates input', async () => {
    expect((await fetch(`${base}/api/geocode?q=a`)).status).toBe(400);
    expect((await fetch(`${base}/api/weather?lat=999&lng=0`)).status).toBe(400);
    expect((await fetch(`${base}/api/nearby?lat=1&lng=1&category=bogus`)).status).toBe(400);
  });
  it('serves map config with attribution', async () => {
    const c: any = await (await fetch(`${base}/api/map-config`)).json();
    expect(c.tileUrl).toContain('{z}'); expect(c.attribution).toMatch(/OpenStreetMap|©/);
  });
  it('404s unknown API routes as JSON', async () => { const r = await fetch(`${base}/api/nope`); expect(r.status).toBe(404); expect(((await r.json()) as any).error).toBeTruthy(); });
});

describe('AI output validation', () => {
  it('extracts JSON from fenced prose', () => { expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 }); });
  it('throws on non-JSON', () => { expect(() => extractJson('no json')).toThrow(); });
  it('drops unknown tags from model criteria', () => {
    const c = criteriaFromAi.parse({ env: ['mountains', 'lava-lamps'], lifestyle: ['quiet', 'rowdy'], stay: 'forever', months: [1, 13] });
    expect(c.env).toEqual(['mountains']); expect(c.lifestyle).toEqual(['quiet']); expect(c.stay).toBeUndefined(); expect(c.months).toEqual([]);
  });
});
