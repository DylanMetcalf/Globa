import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Place } from '../../shared/types';
import { api } from '../services/api';

/** Small route map for an itinerary: numbered stops joined in order (straight lines, not routes). */
export function TripMap({ points }: { points: { place: Place; n: number }[] }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    let dead = false;
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView([20, 10], 2);
    api.mapConfig().catch(() => ({ tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors', custom: false })).then((c) => { if (!dead) L.tileLayer(c.tileUrl, { attribution: c.attribution, maxZoom: 17 }).addTo(m); });
    const pts = points.map((p) => [p.place.lat, p.place.lng] as [number, number]);
    points.forEach((p) => L.marker([p.place.lat, p.place.lng], { icon: L.divIcon({ className: 'leaflet-gmark', html: `<span class="tripnum">${p.n}</span>`, iconSize: [0, 0] }), title: p.place.name, alt: p.place.name }).addTo(m));
    if (pts.length > 1) L.polyline(pts, { color: '#e0a82e', weight: 2.5, dashArray: '6 6' }).addTo(m);
    if (pts.length) m.fitBounds(L.latLngBounds(pts).pad(0.4), { maxZoom: 9, animate: false });
    return () => { dead = true; m.remove(); };
  }, [points]);
  return <div ref={el} className="tripmap" role="img" aria-label="Map of itinerary stops" />;
}
