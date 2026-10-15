// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http, { type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from './index';

/** A fake OpenAI-compatible endpoint so the real provider code path (HTTP, parsing, validation) is exercised without any key. */
let fake: Server; let api: Server; let base = '';
let reply = '{}';
beforeAll(async () => {
  fake = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => (body += c));
    req.on('end', () => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: reply } }] })); });
  });
  await new Promise<void>((r) => fake.listen(0, r));
  process.env.AI_PROVIDER = 'openai'; process.env.OPENAI_API_KEY = 'test-key'; process.env.AI_MODEL = 'fake-model';
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
  await new Promise<void>((r) => { api = createApp().listen(0, () => r()); });
  base = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});
afterAll(async () => {
  delete process.env.AI_PROVIDER; delete process.env.OPENAI_API_KEY; delete process.env.OPENAI_BASE_URL; delete process.env.AI_MODEL;
  await Promise.all([new Promise((r) => fake.close(r)), new Promise((r) => api.close(r))]);
});
const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('AI provider path', () => {
  it('status reports live AI with the configured model', async () => {
    const s: any = await (await fetch(`${base}/api/status`)).json();
    expect(s.ai).toMatchObject({ state: 'live', provider: 'openai-compatible', model: 'fake-model' });
  });
  it('interpret validates and filters model output', async () => {
    reply = 'Here you go: {"env":["mountains","dragons"],"lifestyle":["quiet"],"stay":"three-months","followUps":["Any budget?"]}';
    const r: any = await (await post('/api/ai/interpret', { query: 'quiet mountain town for 3 months' })).json();
    expect(r.criteria.env).toEqual(['mountains']);
    expect(r.criteria.stay).toBe('three-months');
  });
  it('explain only keeps ids that were actually retrieved (no invented places)', async () => {
    reply = JSON.stringify({ items: [{ id: 'canmore', why: 'Mountains and quiet.' }, { id: 'atlantis', why: 'Made up' }], followUps: ['Compare with Wānaka?'] });
    const r: any = await (await post('/api/ai/explain', { query: 'q', candidates: [{ id: 'canmore' }, { id: 'wanaka' }] })).json();
    expect(r.items.map((i: any) => i.id)).toEqual(['canmore']);
  });
  it('chat returns a structured answer', async () => {
    reply = JSON.stringify({ answer: 'Try Wānaka.', placeIds: ['wanaka'], followUps: [], caveats: ['Curated data'] });
    const r: any = await (await post('/api/ai/chat', { messages: [{ role: 'user', content: 'hi' }], context: { saved: [] } })).json();
    expect(r.answer).toBe('Try Wānaka.'); expect(r.model).toBe('fake-model');
  });
  it('itinerary strips unknown place ids', async () => {
    reply = JSON.stringify({ name: 'Trip', stays: [{ placeId: 'lisbon', title: 'Lisbon', days: 3 }], days: [{ label: 'Day 1', stayIndex: 0, stops: [{ kind: 'place', title: 'Sintra', placeId: 'sintra', startTime: '10:00', durationMin: 180 }, { kind: 'food', title: 'Restaurant X', placeId: 'osm-fake' }] }] });
    const r: any = await (await post('/api/ai/itinerary', { request: {}, candidates: [{ id: 'lisbon' }, { id: 'sintra' }] })).json();
    expect(r.itinerary.days[0].stops[0].placeId).toBe('sintra');
    expect(r.itinerary.days[0].stops[1].placeId).toBeUndefined();
  });
  it('a malformed model reply becomes a clean error, not a crash', async () => {
    reply = 'sorry, no json';
    const r = await post('/api/ai/interpret', { query: 'anything at all' });
    expect(r.status).toBe(502);
  });
});
