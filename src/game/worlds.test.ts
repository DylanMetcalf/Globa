import { describe, expect, it } from 'vitest';
import { BUILTIN_PLACES } from '../data/catalog';
import { ALL_THEMES, PALETTES, themeFor, BUILDERS } from './worlds';

const of = (id: string) => { const p = BUILTIN_PLACES.find((x) => x.id === id)!; return themeFor({ motif: p.art.motif, env: p.env, climate: p.climate, countryCode: p.countryCode, lat: p.lat, lng: p.lng }); };

describe('world themes', () => {
  it('has a palette and builder for every theme, including seven continents', () => {
    for (const t of ALL_THEMES) { expect(PALETTES[t]).toBeTruthy(); expect(typeof BUILDERS[t]).toBe('function'); }
    for (const c of ['savanna', 'asia', 'europe', 'northamerica', 'southamerica', 'oceania', 'antarctica']) expect(ALL_THEMES).toContain(c);
  });
  it('strong landscapes win over the continent', () => {
    expect(of('swakopmund')).toBe('desert');
    expect(of('chiang-mai')).toBe('rainforest');
    expect(of('queenstown')).toBe('alpine');
    expect(of('vik')).toBe('volcano');
    expect(of('ponta-delgada')).toBe('volcano');
    expect(of('byron-bay')).toBe('rainforest');
  });
  it('otherwise the continent decides', () => {
    expect(of('cape-town')).toBe('savanna');
    expect(of('kyoto')).toBe('asia');
    expect(of('lisbon')).toBe('europe');
    expect(of('canmore')).toBe('alpine');
    expect(of('cusco')).toBe('southamerica');
    expect(of('london')).toBe('europe');
  });
  it('falls back sensibly from coordinates for unknown countries', () => {
    const t = (lat: number, lng: number) => themeFor({ motif: 'mountain', env: [], climate: 'temperate', countryCode: 'XX', lat, lng });
    expect(t(-80, 0)).toBe('antarctica'); expect(t(40, -100)).toBe('northamerica'); expect(t(-15, -60)).toBe('southamerica'); expect(t(-30, 140)).toBe('oceania'); expect(t(35, 100)).toBe('asia'); expect(t(0, 20)).toBe('savanna');
  });
});
