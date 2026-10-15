import { geoCentroid, geoContains, geoBounds } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Place } from '../../shared/types';

export interface CountryProps { name: string }
export type CountryFeature = Feature<Geometry, CountryProps> & { id?: string | number };

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle (straight-line) distance. This is NOT a travel distance. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

let cache: Promise<CountryFeature[]> | null = null;

/** Lazily loads country polygons (bundled Natural Earth data via world-atlas — works offline). */
export function loadCountries(): Promise<CountryFeature[]> {
  if (!cache) {
    cache = Promise.all([import('topojson-client'), import('world-atlas/countries-110m.json')]).then(([topo, data]) => {
      const t = (data as any).default ?? data;
      const fc = topo.feature(t, t.objects.countries) as unknown as FeatureCollection<Geometry, CountryProps>;
      return fc.features.filter((f) => f.properties?.name !== 'Antarctica') as CountryFeature[];
    });
  }
  return cache;
}

export function countryAt(features: CountryFeature[], lat: number, lng: number): CountryFeature | undefined {
  return features.find((f) => geoContains(f as any, [lng, lat]));
}

export function featureCentroid(f: CountryFeature): { lat: number; lng: number } {
  const [lng, lat] = geoCentroid(f as any);
  return { lat, lng };
}

/** Approximate angular size, used to choose a fly-to altitude for a country. */
export function featureSpan(f: CountryFeature): number {
  const [[w, s], [e, n]] = geoBounds(f as any);
  const dLng = e >= w ? e - w : e + 360 - w;
  return Math.max(dLng, n - s);
}

export function featureKey(f: CountryFeature): string {
  return String(f.id ?? f.properties?.name);
}

export function placeCountryKey(features: CountryFeature[], p: Place): string | undefined {
  const f = countryAt(features, p.lat, p.lng);
  return f ? featureKey(f) : undefined;
}

export function formatDistance(km: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    const mi = km * 0.621371;
    return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
  }
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Equirectangular projection to 0..1 for the locator mini-map. */
export function project(lat: number, lng: number): { x: number; y: number } {
  return { x: (lng + 180) / 360, y: (90 - lat) / 180 };
}
