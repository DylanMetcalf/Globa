import type { GeocodeHit, Place } from '../../shared/types';

/** Turn a live geocoding hit into a minimal Place. We know a name, country and coordinates — nothing more — and the UI says so. */
export function makeCustomPlace(h: GeocodeHit): Place {
  return {
    id: `geo-${h.id}`, name: h.name, kind: 'destination', country: h.country, countryCode: h.countryCode, region: h.region,
    lat: h.lat, lng: h.lng,
    tagline: `${[h.region, h.country].filter(Boolean).join(', ')}`,
    summary: 'Added from a live place lookup. GLOBA has no curated brief for this place yet — the sections below show only what can be retrieved live.',
    env: [], lifestyle: [], practical: [], activities: [], food: [], stayTypes: [],
    primaryReason: 'landscapes', secondaryReasons: [],
    scores: { crowds: 3, popularity: 3, internet: 3, walkability: 3, remoteness: 3, cost: 3 },
    climate: 'temperate', climateNote: '', bestMonths: [], peakMonths: [], idealStay: ['flexible'],
    special: [], localLife: [], pros: [], cons: [], research: [],
    art: { hue: (Math.abs(Math.round(h.lat * 3 + h.lng)) * 7) % 360, motif: Math.abs(h.lat) > 55 ? 'aurora' : Math.abs(h.lat) < 20 ? 'coast' : 'mountain' },
    provenance: 'live', custom: true,
  };
}
