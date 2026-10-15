import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { MeshPhongMaterial, Color } from 'three';
import { featureKey, loadCountries, type CountryFeature } from '../lib/geo';
import { STATE_LABEL, clusterMarkers, altToClusterKm, markerSvg, type MarkerDatum } from '../lib/markers';

export interface GlobeHandle {
  flyTo: (lat: number, lng: number, alt?: number, ms?: number) => void;
  getView: () => { lat: number; lng: number; altitude: number } | undefined;
  zoomBy: (f: number) => void;
  reset: () => void;
  pause: (p: boolean) => void;
}

interface Props {
  markers: MarkerDatum[];
  selectedId?: string;
  keepIds: Set<string>;
  selectedCountry?: string;
  highlightCountries: Set<string>;
  litIds: { id: string; lat: number; lng: number }[];
  celebrateId?: string;
  reduced: boolean;
  /** shifts the globe's visual centre so the selected place isn't hidden behind the panel */
  offset: { x: number; y: number };
  onSelect: (id: string) => void;
  onCountry: (f: CountryFeature | null) => void;
  onCluster: (m: MarkerDatum) => void;
  onAltitude: (alt: number) => void;
  onReady?: () => void;
}

const HOME = { lat: 18, lng: 10, altitude: 1.9 };

/** Interactive WebGL globe (three-globe). Country polygons come from bundled Natural Earth data. */
export const GlobeView = forwardRef<GlobeHandle, Props>(function GlobeView(p, ref) {
  const globe = useRef<GlobeMethods | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [hover, setHover] = useState<CountryFeature | null>(null);
  const [alt, setAlt] = useState(HOME.altitude);
  const props = useRef(p);
  props.current = p;

  useEffect(() => { loadCountries().then(setCountries); }, []);
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const material = useMemo(() => new MeshPhongMaterial({ color: new Color('#0c1544'), emissive: new Color('#07103a'), emissiveIntensity: 0.55, shininess: 12, specular: new Color('#3b5bb0') }), []);

  // Smoothly shift the render centre (camera view offset) when a panel opens/closes.
  const curOff = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const g = globe.current; if (!g || !size.w) return;
    const target = p.offset; let raf = 0; const t0 = performance.now(); const from = { ...curOff.current };
    const dur = p.reduced ? 0 : 350;
    const step = (now: number) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1; const e = k * k * (3 - 2 * k);
      curOff.current = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e };
      const cam: any = g.camera();
      if (curOff.current.x || curOff.current.y) cam.setViewOffset(size.w, size.h, curOff.current.x, curOff.current.y, size.w, size.h); else cam.clearViewOffset();
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [p.offset.x, p.offset.y, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const configured = useRef(false);
  const onGlobeReady = () => {
    const g = globe.current; if (!g || configured.current) return;
    configured.current = true;
    g.pointOfView(HOME, 0);
    const c = g.controls() as any;
    c.autoRotate = !p.reduced; c.autoRotateSpeed = 0.35; c.enableDamping = true; c.dampingFactor = 0.08;
    c.minDistance = 120; c.maxDistance = 520; c.zoomSpeed = 0.7; c.rotateSpeed = 0.55;
    c.addEventListener('start', () => { c.autoRotate = false; });
    c.addEventListener('change', () => {
      const pov = g.pointOfView();
      setAlt((prev) => (Math.abs(prev - pov.altitude) > 0.04 ? pov.altitude : prev));
    });
    p.onReady?.();
  };

  useEffect(() => { p.onAltitude(alt); }, [alt]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, altitude = 0.9, ms = 1400) => {
      const g = globe.current; if (!g) return;
      (g.controls() as any).autoRotate = false;
      g.pointOfView({ lat, lng, altitude }, props.current.reduced ? 0 : ms);
    },
    getView: () => globe.current?.pointOfView(),
    zoomBy: (f) => {
      const g = globe.current; if (!g) return;
      const v = g.pointOfView();
      g.pointOfView({ ...v, altitude: Math.max(0.15, Math.min(4, v.altitude * f)) }, props.current.reduced ? 0 : 450);
    },
    reset: () => { const g = globe.current; if (g) { g.pointOfView(HOME, props.current.reduced ? 0 : 1200); } },
    pause: (pa) => { const g = globe.current; if (!g) return; if (pa) g.pauseAnimation(); else g.resumeAnimation(); },
  }), []);

  // De-clutter passive markers by zoom. Selected + personal markers always stay.
  const shown = useMemo(() => clusterMarkers(p.markers, altToClusterKm(alt), p.keepIds), [p.markers, alt, p.keepIds]);

  const elCache = useRef(new Map<string, HTMLElement>());
  const makeEl = (m: MarkerDatum): HTMLElement => {
    const sel = m.id === props.current.selectedId;
    const key = `${m.id}|${m.state}|${sel}|${m.cluster?.count ?? 0}`;
    const hit = elCache.current.get(key);
    if (hit) return hit;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `gmark ${m.state} ${sel ? 'sel' : ''} ${m.cluster ? 'cluster' : ''} ${m.kind}`;
    el.setAttribute('aria-label', m.cluster ? `${m.cluster.count} places, zoom in` : `${m.name}, ${STATE_LABEL[m.state]}`);
    if (m.cluster) {
      el.innerHTML = `<span class="gcount">${m.cluster.count}</span>`;
    } else {
      const size = m.state === 'discover' ? 20 : 30;
      el.innerHTML = `${markerSvg(m.state, sel, size)}${m.state !== 'discover' || sel ? `<span class="glabel">${m.name.replace(/\s*\(.*\)/, '')}</span>` : ''}`;
    }
    el.addEventListener('click', (e) => { e.stopPropagation(); if (m.cluster) props.current.onCluster(m); else props.current.onSelect(m.id); });
    elCache.current.set(key, el);
    if (elCache.current.size > 600) elCache.current.clear();
    return el;
  };

  const rings = useMemo(() => {
    const list = p.litIds.map((l) => ({ ...l, big: l.id === p.celebrateId }));
    return list;
  }, [p.litIds, p.celebrateId]);

  const capColor = (d: object) => {
    const f = d as CountryFeature;
    const k = featureKey(f);
    if (f === hover) return 'rgba(61, 214, 198, 0.75)';
    if (p.selectedCountry && k === p.selectedCountry) return 'rgba(255, 216, 132, 0.7)';
    if (p.highlightCountries.has(k)) return 'rgba(170, 164, 234, 0.55)';
    return 'rgba(36, 62, 140, 0.62)';
  };

  return (
    <div ref={box} className="globe-box" data-testid="globe">
      {size.w > 0 && (
        <Globe
          ref={globe as any}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={material}
          showAtmosphere
          atmosphereColor="#4fe3d3"
          atmosphereAltitude={0.2}
          polygonsData={countries}
          polygonCapColor={capColor}
          polygonSideColor={() => 'rgba(10, 20, 70, 0.4)'}
          polygonStrokeColor={() => 'rgba(150, 190, 255, 0.35)'}
          polygonAltitude={(d) => (d === hover ? 0.02 : 0.006)}
          polygonsTransitionDuration={p.reduced ? 0 : 250}
          onPolygonHover={(d) => { setHover((d as CountryFeature) ?? null); }}
          onPolygonClick={(d) => p.onCountry(d as CountryFeature)}
          polygonLabel={(d) => `<div class="glabel-tip">${(d as CountryFeature).properties?.name}</div>`}
          htmlElementsData={shown}
          htmlLat={(d) => (d as MarkerDatum).lat}
          htmlLng={(d) => (d as MarkerDatum).lng}
          htmlAltitude={0.012}
          htmlElement={(d) => makeEl(d as MarkerDatum)}
          htmlTransitionDuration={p.reduced ? 0 : 300}
          ringsData={rings}
          ringLat={(d) => (d as any).lat}
          ringLng={(d) => (d as any).lng}
          ringColor={() => (t: number) => `rgba(255, 216, 132, ${1 - t})`}
          ringMaxRadius={(d) => ((d as any).big ? 6 : 3)}
          ringPropagationSpeed={(d) => ((d as any).big ? 3 : 1.4)}
          ringRepeatPeriod={(d) => ((d as any).big ? 1100 : 2600)}
          pointsData={rings}
          pointLat={(d) => (d as any).lat}
          pointLng={(d) => (d as any).lng}
          pointAltitude={(d) => ((d as any).big ? 0.32 : 0.14)}
          pointRadius={0.12}
          pointColor={() => '#ffd884'}
          pointsMerge={false}
          onGlobeReady={onGlobeReady}
          onGlobeClick={() => p.onCountry(null)}
        />
      )}
    </div>
  );
});
