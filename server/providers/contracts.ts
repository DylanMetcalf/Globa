/**
 * Provider contracts. Each major integration has one interface; routes depend only on these.
 * To connect a real service: implement the interface, return it from the matching `get*Provider()` in registry.ts
 * when its env vars are present. Nothing else (routes, UI) needs to change.
 * No provider may return invented data — if it can't answer, it reports `unavailable`.
 */
import type { GeocodeHit, NearbyBusiness, WeatherSnapshot, LiveImage } from '../../shared/types';

export interface SearchLink { label: string; url: string }

export interface AccommodationListing {
  id: string;
  name: string;
  url: string;
  lat?: number;
  lng?: number;
  imageUrl?: string;
  /** Only set when the provider supplied it; never estimated. */
  priceText?: string;
  rating?: number;
  summary?: string;
  checkedAt: string;
}

export interface AccommodationQuery { name: string; country: string; lat: number; lng: number; checkIn?: string; checkOut?: string; guests?: number }
export interface AccommodationResult { state: 'live' | 'unavailable'; provider: string; listings: AccommodationListing[]; searchLinks: SearchLink[]; message?: string }
export interface AccommodationProvider { id: string; configured: boolean; search(q: AccommodationQuery): Promise<AccommodationResult> }

export interface RouteQuery { from: { lat: number; lng: number }; to: { lat: number; lng: number }; mode: 'drive' | 'walk' | 'transit' | 'bike' }
export interface RouteResult { state: 'live' | 'unavailable'; provider: string; distanceKm?: number; durationMin?: number; straightLineKm: number; message?: string }
export interface RoutingProvider { id: string; configured: boolean; route(q: RouteQuery): Promise<RouteResult> }

export interface GeocodeProvider { id: string; geocode(q: string): Promise<GeocodeHit[]> }
export interface WeatherProvider { id: string; forecast(lat: number, lng: number): Promise<WeatherSnapshot> }
export interface PlacesProvider { id: string; nearby(lat: number, lng: number, category: string, radiusM: number): Promise<NearbyBusiness[]> }
export interface ImageProvider { id: string; find(query: string): Promise<LiveImage | undefined> }
