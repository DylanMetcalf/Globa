import type { Place, PlaceId } from '../../shared/types';
import { destinations } from './destinations';
import { pointsOfInterest } from './pois';

/** The bundled, curated catalog. Custom places (from live geocoding) live in the user's store. */
export const BUILTIN_PLACES: Place[] = [...destinations, ...pointsOfInterest];
export const BUILTIN_BY_ID: Map<PlaceId, Place> = new Map(BUILTIN_PLACES.map((p) => [p.id, p]));

export function nearbyPois(parentId: PlaceId): Place[] {
  return pointsOfInterest.filter((p) => p.parentId === parentId);
}

export const FEATURED_QUERIES = [
  'Find a quiet mountain town where we could live for three months',
  'Show me unusual natural landscapes near Cape Town',
  'Find a forest cabin with reliable Wi-Fi and a town nearby',
  'Find surreal places that are beautiful but not overrun with tourists',
  'Where could we live for six months with a reasonable budget and good hiking?',
  'Find a place where we can work remotely and explore nature on weekends',
];
