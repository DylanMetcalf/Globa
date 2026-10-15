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

const DARK: Record<MarkerState, string> = { activated: '#b9812a', visited: '#237a50', planned: '#16877c', saved: '#5a52b3', match: '#8d96b8', discover: '#4e63b5' };

/** Glossy, sphere-like marker glyph (SVG string) shared by the globe and the 2D map. */
export function markerSvg(state: MarkerState, selected: boolean, size: number): string {
  const c = STATE_COLOR[state]; const d = DARK[state]; const shape = STATE_SHAPE[state];
  const id = `mg-${state}`; const sw = selected ? 2.6 : 1.8;
  const grad = `<defs><radialGradient id="${id}" cx=".34" cy=".28" r=".85"><stop offset="0" stop-color="#fff"/><stop offset=".28" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></radialGradient></defs>`;
  const body = shape === 'square' ? `<rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="url(#${id})" stroke="#06101f" stroke-width="${sw}"/><path d="M8 12.6l3 3 5.2-6" fill="none" stroke="#06231a" stroke-width="2.2" stroke-linecap="round"/>`
    : shape === 'diamond' ? `<path d="M12 1.8l10 10.2-10 10.2L2 12z" fill="url(#${id})" stroke="#06101f" stroke-width="${sw}" stroke-linejoin="round"/>`
    : shape === 'star' ? `<path d="M12 1.2l3.1 6.7 7.3.9-5.4 5 1.5 7.2L12 17.3 5.5 21l1.5-7.2-5.4-5 7.3-.9z" fill="url(#${id})" stroke="#06101f" stroke-width="${sw}" stroke-linejoin="round"/>`
    : `<circle cx="12" cy="12" r="8.2" fill="url(#${id})" stroke="#06101f" stroke-width="${sw}"/><ellipse cx="9.2" cy="8.6" rx="2.6" ry="1.7" fill="#fff" opacity=".75" transform="rotate(-30 9.2 8.6)"/>`;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${grad}${body}</svg>`;
}
