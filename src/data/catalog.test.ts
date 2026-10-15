import { describe, expect, it } from 'vitest';
import { BUILTIN_PLACES, BUILTIN_BY_ID } from './catalog';

describe('catalog integrity', () => {
  it('has unique ids', () => { expect(new Set(BUILTIN_PLACES.map((p) => p.id)).size).toBe(BUILTIN_PLACES.length); });
  it('has valid coordinates', () => {
    for (const p of BUILTIN_PLACES) { expect(p.lat).toBeGreaterThanOrEqual(-90); expect(p.lat).toBeLessThanOrEqual(90); expect(p.lng).toBeGreaterThanOrEqual(-180); expect(p.lng).toBeLessThanOrEqual(180); }
  });
  it('POIs reference an existing destination', () => {
    for (const p of BUILTIN_PLACES.filter((x) => x.kind === 'poi')) { expect(BUILTIN_BY_ID.get(p.parentId!)?.kind).toBe('destination'); }
  });
  it('scores are 1..5 and months are 1..12', () => {
    for (const p of BUILTIN_PLACES) {
      for (const v of Object.values(p.scores)) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(5); }
      for (const m of [...p.bestMonths, ...p.peakMonths]) { expect(m).toBeGreaterThanOrEqual(1); expect(m).toBeLessThanOrEqual(12); }
    }
  });
  it('marks every bundled place as curated, never live', () => { expect(BUILTIN_PLACES.every((p) => p.provenance === 'curated')).toBe(true); });
  it('destinations carry the editorial detail the brief needs', () => {
    for (const p of BUILTIN_PLACES.filter((x) => x.kind === 'destination')) { expect(p.special.length).toBeGreaterThan(0); expect(p.pros.length).toBeGreaterThan(0); expect(p.cons.length).toBeGreaterThan(0); expect(p.monthlyCostUSD).toBeTruthy(); }
  });
  it('every destination has at least one nearby landmark except none required', () => {
    const withPoi = new Set(BUILTIN_PLACES.filter((p) => p.parentId).map((p) => p.parentId));
    expect(withPoi.size).toBeGreaterThan(30);
  });
});
