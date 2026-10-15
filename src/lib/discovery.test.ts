import { describe, expect, it } from 'vitest';
import { BUILTIN_PLACES } from '../data/catalog';
import { buildAreas, emptyCriteria, hasStructure, interpretQuery, nameSearch, rankPlaces, searchPlaces } from './discovery';

const areas = buildAreas(BUILTIN_PLACES);

describe('interpretQuery (demo mode)', () => {
  it('reads a long-stay mountain request', () => {
    const c = interpretQuery('Find a quiet mountain town where we could live for three months', areas);
    expect(c.env).toContain('mountains');
    expect(c.lifestyle).toContain('quiet');
    expect(c.stay).toBe('three-months');
    expect(c.kind).toBe('destination');
  });
  it('understands "near Cape Town"', () => {
    const c = interpretQuery('Show me unusual natural landscapes near Cape Town', areas);
    expect(c.near?.label).toBe('Cape Town');
    expect(c.env).toEqual(expect.arrayContaining(['geology']));
  });
  it('parses budgets with symbols and periods', () => {
    const c = interpretQuery('somewhere to live for £1,800 a month', areas);
    expect(c.budget).toEqual({ amount: 1800, currency: 'GBP', period: 'month' });
  });
  it('parses remote-work and Wi-Fi needs', () => {
    const c = interpretQuery('Find a place where we can work remotely and explore nature on weekends', areas);
    expect(c.practical).toContain('wifi');
    expect(c.lifestyle).toContain('work-focused');
    expect(c.lifestyle).toContain('outdoors');
  });
  it('detects low-crowd phrasing', () => {
    expect(interpretQuery('beautiful but not overrun with tourists', areas).crowds).toBe('low');
  });
  it('returns an empty structure for plain names', () => { expect(hasStructure(interpretQuery('Lisbon'))).toBe(false); });
});

describe('rankPlaces', () => {
  it('ranks near-Cape-Town landmarks and includes Cederberg', () => {
    const out = searchPlaces(BUILTIN_PLACES, 'Show me unusual natural landscapes near Cape Town', areas);
    const ids = out.ranked.map((m) => m.place.id);
    expect(ids).toContain('cederberg');
    expect(out.ranked.every((m) => m.place.countryCode === 'ZA')).toBe(true);
  });
  it('returns explanations for every match and never an empty reason list', () => {
    const c = interpretQuery('quiet mountain town for six months with good hiking', areas);
    const ms = rankPlaces(BUILTIN_PLACES, c);
    expect(ms.length).toBeGreaterThan(0);
    for (const m of ms) expect(m.reasons.length).toBeGreaterThan(0);
  });
  it('does not compare budgets without a rate for a foreign currency', () => {
    const c = { ...emptyCriteria(), budget: { amount: 2000, currency: 'ZAR', period: 'month' as const }, kind: 'destination' as const, env: ['mountains' as const] };
    const ms = rankPlaces(BUILTIN_PLACES, c);
    expect(ms[0].gaps.join(' ')).toMatch(/no live ZAR rate/);
  });
  it('applies budgets when a USD rate exists', () => {
    const c = { ...emptyCriteria(), budget: { amount: 1500, currency: 'USD', period: 'month' as const }, kind: 'destination' as const };
    const ms = rankPlaces(BUILTIN_PLACES, c);
    const cheap = ms.find((m) => m.place.id === 'kazbegi')!;
    const dear = ms.find((m) => m.place.id === 'london');
    expect(cheap.score).toBeGreaterThan(dear?.score ?? 0);
  });
  it('filters by country', () => {
    const ms = rankPlaces(BUILTIN_PLACES, { ...emptyCriteria(), countryCode: 'PT', env: ['islands'] });
    expect(ms.length).toBeGreaterThan(0);
    expect(ms.every((m) => m.place.countryCode === 'PT')).toBe(true);
  });
});

describe('nameSearch', () => {
  it('finds by name prefix and country', () => {
    expect(nameSearch(BUILTIN_PLACES, 'cape')[0].name).toMatch(/Cape/);
    expect(nameSearch(BUILTIN_PLACES, 'iceland').length).toBeGreaterThanOrEqual(2);
  });
  it('is accent-insensitive', () => { expect(nameSearch(BUILTIN_PLACES, 'reykjavik')[0]?.id).toBe('reykjavik'); });
});
