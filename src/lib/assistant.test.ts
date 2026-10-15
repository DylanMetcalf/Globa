import { describe, expect, it } from 'vitest';
import { BUILTIN_PLACES } from '../data/catalog';
import { demoReply } from './assistant';

const ctx = (over = {}) => ({ places: BUILTIN_PLACES, saved: [], itineraries: [], ...over });

describe('demo assistant', () => {
  it('compares two named places using catalogue data only', () => {
    const r = demoReply('Compare Lisbon and Chiang Mai for remote work', ctx());
    expect(r.placeIds).toEqual(expect.arrayContaining(['lisbon', 'chiang-mai']));
    expect(r.text).toMatch(/Internet/);
    expect(r.caveats.join(' ')).toMatch(/not live-verified/);
  });
  it('refuses to name restaurants from memory and points at Suggest More', () => {
    const r = demoReply('Find the best restaurants in Lisbon', ctx());
    expect(r.text).toMatch(/Suggest More/);
    expect(r.links?.[0].to).toMatch(/#sm-title/);
  });
  it('asks the user to save places before ranking them', () => {
    const r = demoReply('Which of our saved places would be best for a three-month stay?', ctx());
    expect(r.text).toMatch(/haven’t saved/);
  });
  it('ranks saved destinations when there are some', () => {
    const saved = ['lisbon', 'kazbegi'].map((id) => ({ placeId: id, addedBy: 'dylan', savedAt: '2026-01-01T00:00:00Z', status: 'saved' as const, notes: '', tags: [], priority: 'medium' as const }));
    const r = demoReply('Which of our saved places would be best for a three-month stay?', ctx({ saved }));
    expect(r.placeIds.length).toBe(2);
  });
  it('finds similar places', () => {
    const r = demoReply('Find five places like this one', ctx({ current: BUILTIN_PLACES.find((p) => p.id === 'queenstown') }));
    expect(r.placeIds.length).toBeGreaterThan(0);
    expect(r.placeIds).not.toContain('queenstown');
  });
});
