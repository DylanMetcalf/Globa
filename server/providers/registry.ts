import type { AccommodationProvider, AccommodationQuery, AccommodationResult, RouteQuery, RouteResult, RoutingProvider, SearchLink } from './contracts';

const rad = (d: number) => (d * Math.PI) / 180;
export function straightLineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function accommodationSearchLinks(q: AccommodationQuery): SearchLink[] {
  const place = encodeURIComponent(`${q.name}, ${q.country}`);
  return [
    { label: 'Airbnb search', url: `https://www.airbnb.com/s/${place}/homes` },
    { label: 'Booking.com search', url: `https://www.booking.com/searchresults.html?ss=${place}` },
    { label: 'Maps: places to stay', url: `https://www.google.com/maps/search/${encodeURIComponent(`accommodation in ${q.name}, ${q.country}`)}` },
  ];
}

/** Default: no listing source is connected. Provides honest search links, never fabricated listings. */
const nullAccommodation: AccommodationProvider = {
  id: 'none', configured: false,
  async search(q): Promise<AccommodationResult> {
    return { state: 'unavailable', provider: 'none', listings: [], searchLinks: accommodationSearchLinks(q), message: 'No accommodation listings provider is configured. Set ACCOMMODATION_API_KEY and implement a provider in server/providers/registry.ts.' };
  },
};

/** Extension point: return a real provider when its credentials exist. */
export function getAccommodationProvider(env = process.env): AccommodationProvider {
  // Example (not implemented — requires a partner API such as a hotel/rental aggregator):
  // if (env.ACCOMMODATION_API_KEY && env.ACCOMMODATION_PROVIDER === 'xyz') return new XyzAccommodation(env.ACCOMMODATION_API_KEY);
  void env;
  return nullAccommodation;
}

const nullRouting: RoutingProvider = {
  id: 'none', configured: false,
  async route(q: RouteQuery): Promise<RouteResult> {
    return { state: 'unavailable', provider: 'none', straightLineKm: straightLineKm(q.from, q.to), message: 'No routing provider is configured; only the straight-line distance is known.' };
  },
};
export function getRoutingProvider(env = process.env): RoutingProvider {
  void env; // e.g. OpenRouteService / Mapbox / Google Directions when ROUTING_API_KEY is present
  return nullRouting;
}
