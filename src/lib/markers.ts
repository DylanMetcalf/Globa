import type { Match, Place, PlaceId, SavedPlace, Activation } from '../../shared/types';
import { haversineKm } from './geo';

export type MarkerState = 'activated' | 'visited' | 'planned' | 'saved' | 'match' | 'discover';

export interface MarkerDatum {
  id: PlaceId;
  lat: number;
  lng: number;
  name: string;
  state: MarkerState;
  /** also lit up in the mini-game, regardless of primary state */
  lit: boolean;
  kind: 'destination' | 'poi';
  cluster?: { count: number; ids: PlaceId[] };
}

export const STATE_LABEL: Record<MarkerState, string> = {
  activated: 'Activated', visited: 'Visited', planned: 'Planned', saved: 'Saved', match: 'Search match', discover: 'Discover',
};
export const STATE_COLOR: Record<MarkerState, string> = {
  activated: '#ffd884', visited: '#4fbf86', planned: '#3dd6c6', saved: '#aaa4ea', match: '#ffffff', discover: '#9fb0e8',
};
export const STATE_SHAPE: Record<MarkerState, 'circle' | 'diamond' | 'square' | 'star'> = {
  activated: 'star', visited: 'square', planned: 'diamond', saved: 'circle', match: 'circle', discover: 'circle',
};

export interface MarkerInput {
  places: Place[];
  saved: Record<PlaceId, SavedPlace>;
  activations: Activation[];
  layers: Record<'saved' | 'planned' | 'visited' | 'activated' | 'discover', boolean>;
  /** active search/filter matches (ids). When non-empty and `filtering`, only matches are shown in the discover layer. */
  matchIds: Set<PlaceId>;
  filtering: boolean;
  selectedId?: PlaceId;
  /** show landmarks (POIs) — when zoomed in, or when a parent is selected */
  showPois: boolean;
  focusParent?: PlaceId;
}

export function buildMarkers(i: MarkerInput): MarkerDatum[] {
  const lit = new Set(i.activations.map((a) => a.placeId));
  const out: MarkerDatum[] = [];
  for (const p of i.places) {
    const s = i.saved[p.id];
    const isLit = lit.has(p.id);
    let state: MarkerState | null = null;
    if (isLit) state = 'activated';
    else if (s?.status === 'visited') state = 'visited';
    else if (s?.status === 'planned') state = 'planned';
    else if (s) state = 'saved';
    else if (i.filtering && i.matchIds.has(p.id)) state = 'match';
    else if (!i.filtering) state = 'discover';

    if (!state) continue;
    // layer visibility. An activated place is also shown via its saved state if the activated layer is off.
    if (state === 'activated' && !i.layers.activated) {
      state = s ? (s.status === 'visited' ? 'visited' : s.status === 'planned' ? 'planned' : 'saved') : null;
      if (!state) continue;
    }
    if ((state === 'saved' && !i.layers.saved) || (state === 'planned' && !i.layers.planned) || (state === 'visited' && !i.layers.visited)) continue;
    if ((state === 'discover' || state === 'match') && !i.layers.discover) continue;
    if (p.kind === 'poi' && state === 'discover' && !(i.showPois || i.focusParent === p.parentId || i.selectedId === p.id)) continue;
    out.push({ id: p.id, lat: p.lat, lng: p.lng, name: p.name, state, lit: isLit, kind: p.kind });
  }
  return out;
}

/** Greedy de-clutter: only passive markers (discover/match) are merged; personal states are never hidden. */
export function clusterMarkers(markers: MarkerDatum[], radiusKm: number, keep: Set<PlaceId>): MarkerDatum[] {
  if (radiusKm <= 0) return markers;
  const fixed = markers.filter((m) => m.state !== 'discover' || keep.has(m.id));
  const passive = markers.filter((m) => m.state === 'discover' && !keep.has(m.id));
  const used = new Set<PlaceId>();
  const out: MarkerDatum[] = [...fixed];
  for (const m of passive) {
    if (used.has(m.id)) continue;
    const group = passive.filter((o) => !used.has(o.id) && haversineKm(m, o) < radiusKm);
    group.forEach((g) => used.add(g.id));
    if (group.length === 1) out.push(m);
    else {
      const lat = group.reduce((a, g) => a + g.lat, 0) / group.length;
      const lng = group.reduce((a, g) => a + g.lng, 0) / group.length;
      out.push({ id: `cluster:${group.map((g) => g.id).join(',')}`, lat, lng, name: `${group.length} places`, state: 'discover', lit: false, kind: 'destination', cluster: { count: group.length, ids: group.map((g) => g.id) } });
    }
  }
  return out;
}

export function matchIdsOf(matches: Match[]): Set<PlaceId> {
  return new Set(matches.map((m) => m.place.id));
}

export const altToZoom = (alt: number) => Math.max(2, Math.min(15, 2 + Math.log2(2.5 / Math.max(0.02, alt)) * 1.9));
export const zoomToAlt = (zoom: number) => Math.max(0.05, 2.5 / 2 ** ((zoom - 2) / 1.9));
export const altToClusterKm = (alt: number) => (alt > 1.6 ? 900 : alt > 1.0 ? 450 : alt > 0.6 ? 200 : 0);
export const zoomToClusterKm = (zoom: number) => altToClusterKm(zoomToAlt(zoom));
