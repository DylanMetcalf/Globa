import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import { loadCountries } from '../lib/geo';
import { STATE_COLOR, STATE_LABEL, STATE_SHAPE, clusterMarkers, zoomToClusterKm, type MarkerDatum } from '../lib/markers';
import { api } from '../services/api';

export interface MapHandle {
  flyTo: (lat: number, lng: number, zoom?: number, animate?: boolean) => void;
  getView: () => { lat: number; lng: number; zoom: number } | undefined;
  zoomBy: (d: number) => void;
  invalidate: () => void;
}

interface Props {
  markers: MarkerDatum[];
  selectedId?: string;
  keepIds: Set<string>;
  reduced: boolean;
  offset: { x: number; y: number };
  onSelect: (id: string) => void;
  onCluster: (m: MarkerDatum) => void;
  onZoom: (zoom: number) => void;
  onTilesFailed?: () => void;
  initial: { lat: number; lng: number; zoom: number };
}

function iconHtml(m: MarkerDatum, sel: boolean): string {
  if (m.cluster) return `<span class="gmark cluster"><span class="gcount">${m.cluster.count}</span></span>`;
  const size = m.state === 'discover' ? 18 : 26;
  const c = STATE_COLOR[m.state]; const shape = STATE_SHAPE[m.state];
  const sw = sel ? 3 : 2;
  const common = `fill="${c}" stroke="#06101f" stroke-width="${sw}"`;
  const svg = shape === 'square' ? `<rect x="4" y="4" width="16" height="16" rx="3" ${common}/><path d="M8 12.5l3 3 5-6" fill="none" stroke="#06101f" stroke-width="2.2" stroke-linecap="round"/>`
    : shape === 'diamond' ? `<path d="M12 2l10 10-10 10L2 12z" ${common}/>`
    : shape === 'star' ? `<path d="M12 1.5l3 6.6 7.2.8-5.4 4.8 1.6 7.1L12 17.1 5.6 20.8l1.6-7.1L1.8 8.9l7.2-.8z" ${common}/>`
    : `<circle cx="12" cy="12" r="8" ${common}/>`;
  const label = m.state !== 'discover' || sel ? `<span class="glabel">${m.name.replace(/\s*\(.*\)/, '')}</span>` : '';
  return `<span class="gmark ${m.state} ${sel ? 'sel' : ''}"><svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${svg}</svg>${label}</span>`;
}

/** 2D map (Leaflet). Shares markers with the globe. Country polygons are drawn locally so the map never renders blank offline. */
export const MapView = forwardRef<MapHandle, Props>(function MapView(p, ref) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [zoom, setZoom] = useState(p.initial.zoom);
  const props = useRef(p);
  props.current = p;

  useEffect(() => {
    let dead = false;
    const m = L.map(el.current!, { zoomControl: false, attributionControl: true, worldCopyJump: true, minZoom: 2, maxZoom: 17, zoomSnap: 0.25, zoomAnimation: !p.reduced, fadeAnimation: !p.reduced, markerZoomAnimation: !p.reduced })
      .setView([p.initial.lat, p.initial.lng], p.initial.zoom);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    loadCountries().then((fs) => {
      if (dead) return;
      L.geoJSON({ type: 'FeatureCollection', features: fs } as any, { interactive: false, style: { color: '#7b8bd0', weight: 0.8, fillColor: '#1a2559', fillOpacity: 0.55 } }).addTo(m);
    });
    api.mapConfig().catch(() => ({ tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', custom: false }))
      .then((cfg) => {
        if (dead) return;
        let errors = 0;
        const t = L.tileLayer(cfg.tileUrl, { attribution: cfg.attribution, maxZoom: 17, className: 'globa-tiles' }).addTo(m);
        t.on('tileerror', () => { if (++errors === 6) props.current.onTilesFailed?.(); });
      });
    m.on('zoomend', () => { setZoom(m.getZoom()); props.current.onZoom(m.getZoom()); });
    return () => { dead = true; m.remove(); map.current = null; layer.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, z = 6, animate = true) => {
      const m = map.current; if (!m) return;
      // shift the target so the place sits in the visible area beside the panel
      const o = props.current.offset;
      const c = (o.x || o.y) ? m.unproject(m.project([lat, lng], z).add([o.x, o.y]), z) : L.latLng(lat, lng);
      if (animate && !props.current.reduced) m.flyTo(c, z, { duration: 1.1 }); else m.setView(c, z, { animate: false });
    },
    getView: () => { const m = map.current; if (!m) return undefined; const c = m.getCenter(); return { lat: c.lat, lng: c.lng, zoom: m.getZoom() }; },
    zoomBy: (d) => { map.current?.setZoom(map.current.getZoom() + d); },
    invalidate: () => map.current?.invalidateSize(),
  }), []);

  useEffect(() => {
    const g = layer.current; if (!g) return;
    g.clearLayers();
    const shown = clusterMarkers(p.markers, zoomToClusterKm(zoom), p.keepIds);
    for (const m of shown) {
      const sel = m.id === p.selectedId;
      const icon = L.divIcon({ html: iconHtml(m, sel), className: 'leaflet-gmark', iconSize: [0, 0] });
      const mk = L.marker([m.lat, m.lng], { icon, keyboard: true, title: m.cluster ? `${m.cluster.count} places` : `${m.name} (${STATE_LABEL[m.state]})`, zIndexOffset: sel ? 1000 : m.state === 'discover' ? 0 : 500, alt: m.name });
      mk.on('click', () => (m.cluster ? p.onCluster(m) : p.onSelect(m.id)));
      mk.addTo(g);
    }
  }, [p.markers, p.selectedId, p.keepIds, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="map-box" data-testid="map" />;
});
