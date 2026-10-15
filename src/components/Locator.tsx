import { useEffect, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';

let pathCache: Promise<string> | null = null;
const W = 360; const H = 190;
const proj = geoNaturalEarth1().fitSize([W, H], { type: 'Sphere' } as any);

function landPath(): Promise<string> {
  pathCache ??= Promise.all([import('topojson-client'), import('world-atlas/land-110m.json')]).then(([topo, data]) => {
    const t = (data as any).default ?? data;
    return geoPath(proj)(topo.feature(t, t.objects.land) as any) ?? '';
  });
  return pathCache;
}

/** Tiny offline world locator with a pin. */
export function Locator({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const [d, setD] = useState('');
  useEffect(() => { landPath().then(setD); }, []);
  const pt = proj([lng, lat]) ?? [W / 2, H / 2];
  return (
    <svg className="locator" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Location of ${label} on a world map`}>
      <rect width={W} height={H} rx="14" fill="var(--surface-3)" />
      <path d={d} fill="var(--accent)" opacity="0.35" stroke="var(--accent)" strokeWidth="0.6" />
      <circle cx={pt[0]} cy={pt[1]} r="13" fill="var(--st-activated)" opacity="0.25"><animate attributeName="r" values="6;16;6" dur="2.6s" repeatCount="indefinite" /></circle>
      <circle cx={pt[0]} cy={pt[1]} r="5" fill="var(--st-activated)" stroke="#06101f" strokeWidth="2" />
    </svg>
  );
}
