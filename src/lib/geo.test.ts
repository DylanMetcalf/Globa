import { describe, expect, it } from 'vitest';
import { countryAt, haversineKm, loadCountries } from './geo';
import { BUILTIN_PLACES } from '../data/catalog';

describe('geo', () => {
  it('computes great-circle distance', () => {
    const d = haversineKm({ lat: 51.5072, lng: -0.1276 }, { lat: 48.8566, lng: 2.3522 });
    expect(d).toBeGreaterThan(330); expect(d).toBeLessThan(350);
  });
  it('places Cape Town and Kyoto in the right country polygons', async () => {
    const fs = await loadCountries();
    expect(countryAt(fs, -33.9249, 18.4241)?.properties.name).toBe('South Africa');
    expect(countryAt(fs, 35.0116, 135.7681)?.properties.name).toBe('Japan');
  });
  it('catalogue coordinates fall inside the stated country for most places', async () => {
    const fs = await loadCountries();
    const mismatches = BUILTIN_PLACES.filter((p) => { const f = countryAt(fs, p.lat, p.lng); return f && !f.properties.name.toLowerCase().includes(p.country.slice(0, 4).toLowerCase()) && !['United Kingdom', 'Türkiye', 'Czechia'].includes(p.country); });
    // names differ between datasets (e.g. "United States of America"); we only require that coordinates are not wildly wrong
    expect(mismatches.length).toBeLessThan(6);
  });
});
