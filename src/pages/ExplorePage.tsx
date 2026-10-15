import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { GeocodeHit, Place } from '../../shared/types';
import type { GlobeHandle } from '../components/GlobeView';
import { MapView, type MapHandle } from '../components/MapView';
import { OrthoGlobe } from '../components/OrthoGlobe';
import { Icon } from '../components/Icon';
import { SearchBox } from '../components/SearchBox';
import { FiltersPanel, ActiveChips } from '../components/FiltersPanel';
import { PlaceActions, StatusPill, LitPill, AddToTripDialog, PlaceCard } from '../components/PlaceBits';
import { PlaceImage } from '../components/PlaceArt';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useStore } from '../store';
import { useUi, type LayerKey } from '../store/ui';
import { useCatalog, useIsMobile, useReducedMotion, hasWebGL, useDrawerA11y } from '../lib/hooks';
import { buildMarkers, matchIdsOf, STATE_COLOR, STATE_LABEL, STATE_SHAPE, altToZoom, zoomToAlt, type MarkerDatum } from '../lib/markers';
import { hasStructure, rankPlaces, emptyCriteria } from '../lib/discovery';
import { featureCentroid, featureKey, featureSpan, loadCountries, placeCountryKey, type CountryFeature } from '../lib/geo';
import { REASON_LABELS } from '../lib/labels';
import { makeCustomPlace } from '../lib/customPlace';
import { api } from '../services/api';

const GlobeView = lazy(() => import('../components/GlobeView').then((m) => ({ default: m.GlobeView })));

const LAYERS: { key: LayerKey; label: string; state: Exclude<keyof typeof STATE_COLOR, 'match'> }[] = [
  { key: 'activated', label: 'Activated', state: 'activated' },
  { key: 'visited', label: 'Visited', state: 'visited' },
  { key: 'planned', label: 'Planned', state: 'planned' },
  { key: 'saved', label: 'Saved', state: 'saved' },
  { key: 'discover', label: 'Discover', state: 'discover' },
];

function Swatch({ state }: { state: keyof typeof STATE_COLOR }) {
  const c = STATE_COLOR[state]; const s = STATE_SHAPE[state];
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      {s === 'square' ? <rect x="4" y="4" width="16" height="16" rx="3" fill={c} /> : s === 'diamond' ? <path d="M12 2l10 10-10 10L2 12z" fill={c} /> : s === 'star' ? <path d="M12 1.5l3 6.6 7.2.8-5.4 4.8 1.6 7.1L12 17.1 5.6 20.8l1.6-7.1L1.8 8.9l7.2-.8z" fill={c} /> : <circle cx="12" cy="12" r="8" fill={c} />}
    </svg>
  );
}

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const reduced = useReducedMotion();
  const mobile = useIsMobile();
  const { places, get } = useCatalog();
  const saved = useStore((s) => s.saved);
  const activations = useStore((s) => s.activations);
  const ui = useUi();
  const { mode, selectedId, layers, search, criteria, focus, celebrateId } = ui;

  const globe = useRef<GlobeHandle>(null);
  const map = useRef<MapHandle>(null);
  const [webgl] = useState(hasWebGL);
  const [globeFailed, setGlobeFailed] = useState(false);
  const [alt, setAlt] = useState(2.5);
  const [mapZoom, setMapZoom] = useState(4);
  const [mapMounted, setMapMounted] = useState(mode === 'map');
  const [trans, setTrans] = useState<'idle' | 'to-map' | 'to-globe'>('idle');
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [addTo, setAddTo] = useState<Place | null>(null);
  const [sheetFull, setSheetFull] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  useDrawerA11y(filtersOpen, () => setFiltersOpen(false), drawerRef);
  const useFallbackGlobe = !webgl || globeFailed;
  const panelOpen = Boolean(selectedId || ui.selectedCountry || search.status !== 'idle');

  useEffect(() => { loadCountries().then(setCountries); }, []);

  const selected = get(selectedId);
  const country = useMemo(() => countries.find((c) => c.properties.name === ui.selectedCountry), [countries, ui.selectedCountry]);

  /* ---- criteria → matches (shared with Discover) ---- */
  const filtering = hasStructure(criteria) && search.status !== 'idle' ? true : hasStructure(criteria);
  const matches = useMemo(() => {
    if (!hasStructure(criteria)) return [];
    if (search.matches.length && search.criteria === criteria) return search.matches;
    return rankPlaces(places, criteria, { toUSD: ui.fx?.toUSD });
  }, [criteria, search.matches, search.criteria, places, ui.fx]);
  const matchIds = useMemo(() => matchIdsOf(matches), [matches]);

  const showPois = mode === 'globe' ? alt < 1.1 : mapZoom >= 5;
  const markers = useMemo(
    () => buildMarkers({ places, saved, activations, layers, matchIds, filtering, selectedId, showPois, focusParent: selected?.kind === 'destination' ? selected.id : selected?.parentId }),
    [places, saved, activations, layers, matchIds, filtering, selectedId, showPois, selected],
  );
  const keepIds = useMemo(() => {
    const k = new Set<string>();
    if (!selected) return k;
    k.add(selected.id);
    const root = selected.kind === 'destination' ? selected.id : selected.parentId;
    if (root) { k.add(root); places.forEach((p) => { if (p.parentId === root) k.add(p.id); }); }
    return k;
  }, [selected, places]);
  const litIds = useMemo(() => [...new Set(activations.map((a) => a.placeId))].map((id) => get(id)).filter(Boolean).map((p) => ({ id: p!.id, lat: p!.lat, lng: p!.lng })), [activations, get]);

  const highlightCountries = useMemo(() => {
    const set = new Set<string>();
    if (!countries.length) return set;
    for (const id of Object.keys(saved)) { const p = get(id); if (p) { const k = placeCountryKey(countries, p); if (k) set.add(k); } }
    return set;
  }, [saved, countries, get]);

  // Keep the focused place in the visible area: beside the side panel on desktop, above the sheet on mobile.
  const offset = useMemo(() => (panelOpen ? (mobile ? { x: 0, y: Math.round(window.innerHeight * 0.17) } : { x: 205, y: 0 }) : { x: 0, y: 0 }), [panelOpen, mobile]);

  /* ---- camera helpers ---- */
  const flyTo = useCallback((lat: number, lng: number, altitude = 0.9) => {
    if (useUi.getState().mode === 'globe') globe.current?.flyTo(lat, lng, altitude);
    else map.current?.flyTo(lat, lng, altToZoom(altitude));
  }, []);

  useEffect(() => { if (focus) flyTo(focus.lat, focus.lng, focus.alt ?? 0.8); }, [focus, flyTo]);

  const selectPlace = useCallback((id: string, fly = true) => {
    const p = get(id); if (!p) return;
    ui.select(id);
    setSheetFull(false);
    if (fly) flyTo(p.lat, p.lng, p.kind === 'poi' ? 0.55 : 0.85);
  }, [get, flyTo]); // eslint-disable-line react-hooks/exhaustive-deps

  /* arrival from other pages: ?focus=<id>&lit=1 */
  useEffect(() => {
    const id = params.get('focus');
    if (!id) return;
    const p = get(id);
    if (p) {
      ui.select(id);
      if (params.get('lit')) ui.setCelebrate(id);
      const t = setTimeout(() => flyTo(p.lat, p.lng, 0.7), 600);
      setParams({}, { replace: true });
      return () => clearTimeout(t);
    }
    setParams({}, { replace: true });
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!celebrateId) return;
    const t = setTimeout(() => ui.setCelebrate(undefined), 9000);
    return () => clearTimeout(t);
  }, [celebrateId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- globe ↔ map switch: one continuous change of perspective ---- */
  const switchMode = useCallback((next: 'globe' | 'map') => {
    const cur = useUi.getState().mode;
    if (next === cur || trans !== 'idle') return;
    const sel = get(useUi.getState().selectedId);
    if (next === 'map') {
      const v = globe.current?.getView();
      const lat = sel?.lat ?? v?.lat ?? 20; const lng = sel?.lng ?? v?.lng ?? 10;
      const targetAlt = Math.min(v?.altitude ?? 2.5, 1.2);
      const zoom = altToZoom(sel ? 0.7 : targetAlt);
      setMapMounted(true);
      setMapZoom(zoom);
      requestAnimationFrame(() => map.current?.flyTo(lat, lng, zoom, false));
      if (reduced || useFallbackGlobe) { ui.setMode('map'); requestAnimationFrame(() => map.current?.invalidate()); return; }
      setTrans('to-map');
      globe.current?.flyTo(lat, lng, Math.min(0.5, zoomToAlt(zoom)), 900);
      setTimeout(() => { ui.setMode('map'); map.current?.invalidate(); setTimeout(() => { setTrans('idle'); globe.current?.pause(true); }, 650); }, 800);
    } else {
      const v = map.current?.getView();
      const lat = sel?.lat ?? v?.lat ?? 20; const lng = sel?.lng ?? v?.lng ?? 10;
      globe.current?.pause(false);
      if (reduced || useFallbackGlobe) { ui.setMode('globe'); globe.current?.flyTo(lat, lng, 1.2, 0); return; }
      globe.current?.flyTo(lat, lng, Math.max(0.3, zoomToAlt(v?.zoom ?? 4)), 0);
      setTrans('to-globe');
      ui.setMode('globe');
      setTimeout(() => globe.current?.flyTo(lat, lng, sel ? 0.85 : 1.7, 1300), 60);
      setTimeout(() => setTrans('idle'), 1400);
    }
  }, [trans, get, reduced, useFallbackGlobe]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- countries ---- */
  const pickCountry = useCallback((f: CountryFeature | null) => {
    if (!f) return;
    ui.selectCountry(f.properties.name);
    const c = featureCentroid(f);
    flyTo(c.lat, c.lng, Math.min(2, 0.5 + featureSpan(f) / 40));
  }, [flyTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickCluster = useCallback((m: MarkerDatum) => {
    if (useUi.getState().mode === 'globe') { const v = globe.current?.getView(); globe.current?.flyTo(m.lat, m.lng, Math.max(0.3, (v?.altitude ?? 2) * 0.45), 900); }
    else map.current?.flyTo(m.lat, m.lng, mapZoom + 2);
  }, [mapZoom]);

  const pickGeo = useCallback((h: GeocodeHit) => {
    const p = makeCustomPlace(h);
    useStore.setState((s) => ({ customPlaces: { ...s.customPlaces, [p.id]: p } }));
    ui.select(p.id); flyTo(p.lat, p.lng, 0.8);
  }, [flyTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = (q: string) => { void ui.runSearch(q); ui.select(undefined); ui.selectCountry(undefined); setSheetFull(true); };
  const clearAll = () => { ui.clearSearch(); };
  const hasResults = search.status !== 'idle';
  const panelKind = selected ? 'place' : country ? 'country' : hasResults ? 'results' : null;

  // Fit view to matches when a search completes.
  useEffect(() => {
    if (search.status !== 'done' || !search.matches.length) return;
    const top = search.matches[0].place;
    const t = setTimeout(() => flyTo(top.lat, top.lng, search.matches.length > 1 ? 1.3 : 0.9), 300);
    return () => clearTimeout(t);
  }, [search.status, search.query]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialMap = useMemo(() => {
    const v = globe.current?.getView();
    return { lat: selected?.lat ?? v?.lat ?? 20, lng: selected?.lng ?? v?.lng ?? 10, zoom: 3 };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const orthoMarkers = useMemo(() => markers.filter((m) => !m.cluster).map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, color: STATE_COLOR[m.state], shape: STATE_SHAPE[m.state], r: m.state === 'discover' ? 3.5 : 6 })), [markers]);

  return (
    <div className="explore night" data-mode={mode} data-trans={trans} data-panel={panelKind ? 'open' : 'closed'}>
      <div className="stage" aria-label={mode === 'globe' ? '3D globe' : '2D map'}>
        <div className={`layer-globe ${mode === 'map' && trans === 'idle' ? 'off' : ''} ${trans === 'to-map' ? 'fade-out' : ''} ${trans === 'to-globe' ? 'fade-in' : ''}`}>
          <div className="space" aria-hidden="true" />
          {useFallbackGlobe ? (
            <>
              <div className="globe-box"><OrthoGlobe interactive markers={orthoMarkers} selectedId={selectedId} onPick={(id) => selectPlace(id)} reduced={reduced} speed={0.05} initial={[-10, -15]} /></div>
              <div className="notice info fallback-note" role="status"><Icon name="info" /><span>{webgl ? 'The 3D globe could not start' : 'WebGL is unavailable here'}, so a simplified globe is shown. The 2D map and everything else work normally.</span></div>
            </>
          ) : (
            <ErrorBoundary fallback={<GlobeFailed onFail={() => setGlobeFailed(true)} />} onError={() => setGlobeFailed(true)}>
              <Suspense fallback={<div className="globe-loading" role="status"><span className="spinner" />Loading the globe…</div>}>
              <GlobeView
                ref={globe} markers={markers} selectedId={selectedId} keepIds={keepIds} selectedCountry={country ? featureKey(country) : undefined} highlightCountries={highlightCountries}
                litIds={litIds} celebrateId={celebrateId} reduced={reduced} offset={offset} onSelect={(id) => selectPlace(id)} onCountry={pickCountry} onCluster={pickCluster} onAltitude={setAlt}
              />
              </Suspense>
            </ErrorBoundary>
          )}
        </div>
        {mapMounted && (
          <div className={`layer-map ${mode === 'map' ? 'on' : ''} ${trans === 'to-map' ? 'fade-in' : ''} ${trans === 'to-globe' ? 'fade-out' : ''}`}>
            <MapView ref={map} markers={markers} selectedId={selectedId} keepIds={keepIds} reduced={reduced} offset={offset} onSelect={(id) => selectPlace(id)} onCluster={pickCluster} onZoom={setMapZoom} initial={initialMap} onTilesFailed={() => setTilesFailed(true)} />
            {tilesFailed && <div className="notice info map-note"><Icon name="info" /><span>Map tiles could not be loaded (offline or blocked). Country outlines and your markers still work. Set <code>MAP_TILE_URL</code> to use another tile provider.</span></div>}
          </div>
        )}
      </div>

      {/* top controls */}
      <div className="hud-top">
        <div className="hud-search">
          <SearchBox
            onAsk={ask}
            onPlace={(p) => selectPlace(p.id)}
            onCountry={(f) => pickCountry(f)}
            onGeo={pickGeo}
            initial={search.query}
          />
          <button className={`btn icon ${hasStructure(criteria) ? 'primary' : ''}`} onClick={() => setFiltersOpen(true)} aria-label="Open filters" aria-haspopup="dialog"><Icon name="filter" /></button>
        </div>
        <div className="hud-right">
          <div className="seg viewseg" role="group" aria-label="View">
            <button aria-pressed={mode === 'globe'} onClick={() => switchMode('globe')}><Icon name="globe" />Globe</button>
            <button aria-pressed={mode === 'map'} onClick={() => switchMode('map')}><Icon name="map" />Map</button>
          </div>
        </div>
      </div>
      {hasStructure(criteria) && (
        <div className="hud-chips"><ActiveChips criteria={criteria} onChange={(c) => { ui.setCriteria(c); ui.rerank(c); }} /></div>
      )}

      {/* map controls */}
      <div className="hud-zoom">
        <button className="btn icon panel" aria-label="Zoom in" onClick={() => (mode === 'globe' ? globe.current?.zoomBy(0.6) : map.current?.zoomBy(1))}><Icon name="plus" /></button>
        <button className="btn icon panel" aria-label="Zoom out" onClick={() => (mode === 'globe' ? globe.current?.zoomBy(1.6) : map.current?.zoomBy(-1))}><Icon name="minus" /></button>
        <button className="btn icon panel" aria-label="Reset view" title="Home view" onClick={() => { ui.select(undefined); ui.selectCountry(undefined); if (mode === 'globe') globe.current?.reset(); else map.current?.flyTo(20, 10, 2.5); }}><Icon name="home" /></button>
      </div>

      {/* layers + legend */}
      <div className="hud-layers">
        <button className="btn panel sm" aria-expanded={layersOpen} onClick={() => setLayersOpen((v) => !v)}><Icon name="layers" />Layers</button>
        {layersOpen && (
          <div className="panel layers-pop" role="group" aria-label="Marker layers">
            {LAYERS.map((l) => (
              <label key={l.key} className="layer-row">
                <input type="checkbox" checked={layers[l.key]} onChange={() => ui.toggleLayer(l.key)} />
                <Swatch state={l.state} /><span>{STATE_LABEL[l.state]}</span>
              </label>
            ))}
            <p className="small muted" style={{ margin: '6px 0 0' }}>Shape and label show status, not just colour.</p>
          </div>
        )}
      </div>

      {/* side / bottom panel */}
      {panelKind && (
        <aside className={`hud-panel panel ${sheetFull ? 'full' : ''}`} aria-label="Details">
          {mobile && <button className="sheet-handle" onClick={() => setSheetFull((v) => !v)} aria-label={sheetFull ? 'Collapse panel' : 'Expand panel'}><span /></button>}
          <div className="panel-scroll">
            {panelKind === 'place' && selected && <PlacePanel mobile={mobile} place={selected} onClose={() => ui.select(undefined)} onAddTrip={setAddTo} onPick={selectPlace} />}
            {panelKind === 'country' && country && <CountryPanel feature={country} onClose={() => ui.selectCountry(undefined)} onPick={selectPlace} onFly={() => pickCountry(country)} onAsk={ask} />}
            {panelKind === 'results' && <ResultsPanel onClose={clearAll} onPick={selectPlace} onAddTrip={setAddTo} onGeo={pickGeo} />}
          </div>
        </aside>
      )}

      {/* filters drawer */}
      {filtersOpen && (
        <div className="drawer-wrap" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="drawer-scrim" onClick={() => setFiltersOpen(false)} />
          <div className="drawer panel" ref={drawerRef}>
            <div className="row spread"><h2 style={{ fontSize: '1.4rem' }}>Filters</h2><button className="btn icon sm ghost" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><Icon name="close" /></button></div>
            <p className="small muted">Combine anything. Markers update as you go.</p>
            <div className="drawer-body"><FiltersPanel criteria={criteria} onChange={(c) => { ui.setCriteria(c); if (hasStructure(c)) ui.rerank(c); else ui.clearSearch(); }} /></div>
            <div className="row spread" style={{ marginTop: 12 }}>
              <span className="muted small">{hasStructure(criteria) ? `${matches.length} match${matches.length === 1 ? '' : 'es'}` : 'No filters'}</span>
              <button className="btn primary" onClick={() => { setFiltersOpen(false); setSheetFull(true); }}>Show results</button>
            </div>
          </div>
        </div>
      )}
      <AddToTripDialog place={addTo} onClose={() => setAddTo(null)} />
    </div>
  );
}

function GlobeFailed({ onFail }: { onFail: () => void }) {
  useEffect(() => { onFail(); }, [onFail]);
  return null;
}

/* ------------------------------ panels ------------------------------ */
function PanelHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="row spread" style={{ alignItems: 'flex-start' }}>
      <div><h2 style={{ fontSize: '1.5rem' }}>{title}</h2>{sub && <div className="muted small">{sub}</div>}</div>
      <button className="btn icon sm ghost" onClick={onClose} aria-label="Close panel"><Icon name="close" /></button>
    </div>
  );
}

function PlacePanel({ place, mobile, onClose, onAddTrip, onPick }: { place: Place; mobile: boolean; onClose: () => void; onAddTrip: (p: Place) => void; onPick: (id: string, fly?: boolean) => void }) {
  const saved = useStore((s) => s.saved[place.id]);
  const lit = useStore((s) => s.activations.some((a) => a.placeId === place.id));
  const { places, get } = useCatalog();
  const parent = get(place.parentId);
  const nearby = useMemo(() => places.filter((p) => p.parentId === (place.kind === 'destination' ? place.id : place.parentId) && p.id !== place.id).slice(0, 4), [places, place]);
  return (
    <div className="stack">
      <PlaceImage place={place} ratio={mobile ? '16 / 6' : '16 / 9'} showCredit />
      <PanelHead title={place.name} sub={`${place.kind === 'poi' && parent ? `Near ${parent.name.replace(/\s*\(.*\)/, '')} · ` : ''}${[place.region, place.country].filter(Boolean).join(', ')}`} onClose={onClose} />
      <div className="row wrap" style={{ gap: 6 }}><StatusPill status={saved?.status} /><LitPill lit={lit} />{place.custom ? <span className="badge live">Live lookup</span> : <span className="badge curated" title="Editorial data bundled with GLOBA">{REASON_LABELS[place.primaryReason]}</span>}</div>
      <p style={{ margin: 0 }}>{place.custom ? place.tagline : place.summary}</p>
      <PlaceActions place={place} onAddTrip={() => onAddTrip(place)} />
      <Link className="btn" to={`/place/${place.id}`}><Icon name="expand" />Open full brief</Link>
      {nearby.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="eyebrow">{place.kind === 'destination' ? 'Extraordinary nearby' : 'Also nearby'}</div>
          {nearby.map((n) => (
            <button key={n.id} className="nearby-row" onClick={() => onPick(n.id)}>
              <span className="grow"><b>{n.name}</b><span className="muted small"> · {n.env.slice(0, 2).join(', ')}</span></span><Icon name="right" width={16} height={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CountryPanel({ feature, onClose, onPick, onFly, onAsk }: { feature: CountryFeature; onClose: () => void; onPick: (id: string) => void; onFly: () => void; onAsk: (q: string) => void }) {
  const { places } = useCatalog();
  const name = feature.properties.name;
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [wiki, setWiki] = useState<{ text: string; url: string } | null | 'loading'>('loading');
  useEffect(() => { loadCountries().then(setCountries); }, []);
  const inCountry = useMemo(() => places.filter((p) => p.kind === 'destination' && countries.length && placeCountryKey(countries, p) === featureKey(feature)), [places, countries, feature]);
  const byRegion = useMemo(() => {
    const m = new Map<string, Place[]>();
    inCountry.forEach((p) => m.set(p.region, [...(m.get(p.region) ?? []), p]));
    return [...m.entries()];
  }, [inCountry]);
  useEffect(() => {
    let live = true; setWiki('loading');
    api.image(name).then((r) => live && setWiki(r.summary ? { text: r.summary.text, url: r.summary.url } : null)).catch(() => live && setWiki(null));
    return () => { live = false; };
  }, [name]);
  return (
    <div className="stack">
      <PanelHead title={name} sub="Country" onClose={onClose} />
      {wiki === 'loading' ? <div className="skeleton" style={{ height: 70 }} /> : wiki ? <p className="small" style={{ margin: 0 }}>{wiki.text.slice(0, 360)}{wiki.text.length > 360 ? '…' : ''} <a href={wiki.url} target="_blank" rel="noreferrer noopener">Wikipedia</a> <span className="badge live">Live</span></p> : <p className="small muted">A live summary is not available right now.</p>}
      <button className="btn" onClick={onFly}><Icon name="pin" />Centre on {name}</button>
      {byRegion.length > 0 ? (
        <div className="stack">
          <div className="eyebrow">Curated places · country → region → place</div>
          {byRegion.map(([region, ps]) => (
            <div key={region} className="stack" style={{ gap: 4 }}>
              <div className="small muted" style={{ fontWeight: 700 }}>{region}</div>
              {ps.map((p) => <button key={p.id} className="nearby-row" onClick={() => onPick(p.id)}><span className="grow"><b>{p.name}</b></span><Icon name="right" width={16} height={16} /></button>)}
            </div>
          ))}
        </div>
      ) : (
        <div className="notice info"><Icon name="info" /><div>No curated places in {name} yet. You can still find towns and cities worldwide: <button className="plainbtn" style={{ color: 'var(--accent)', textDecoration: 'underline' }} onClick={() => onAsk(name)}>search “{name}”</button> or type any town in the search box.</div></div>
      )}
    </div>
  );
}

function ResultsPanel({ onClose, onPick, onAddTrip, onGeo }: { onClose: () => void; onPick: (id: string) => void; onAddTrip: (p: Place) => void; onGeo: (h: GeocodeHit) => void }) {
  const s = useUi((u) => u.search);
  const setCriteria = useUi((u) => u.setCriteria);
  const rerank = useUi((u) => u.rerank);
  const [more, setMore] = useState(false);
  const top = s.matches.slice(0, 5);
  const rest = s.matches.slice(5, 20);
  return (
    <div className="stack">
      <PanelHead title={s.status === 'loading' ? 'Searching…' : 'Results'} sub={`“${s.query}”`} onClose={onClose} />
      <div className="row wrap" style={{ gap: 6 }}>
        <span className={`badge ${s.mode === 'ai' ? 'ai' : 'demo'}`} title={s.mode === 'ai' ? 'Interpreted and explained by the configured AI model, using retrieved catalogue data' : 'Offline keyword interpretation with deterministic ranking'}>{s.mode === 'ai' ? 'AI-assisted' : 'Demo mode'}</span>
        <span className="badge curated">Curated catalogue</span>
      </div>
      {s.business && <Link className="notice info biz" to={`/place/${s.business.placeId}?suggest=${s.business.cat}#sm-title`}><Icon name="food" /><span>Looking for <b>{s.business.label}</b> in {s.business.placeName}? Real, nearby results are pulled live in the brief’s <b>Suggest More</b> — open it →</span></Link>}
      {s.criteria && hasStructure(s.criteria) && <ActiveChips criteria={s.criteria} onChange={(c) => { setCriteria(c); rerank(c); }} />}
      {s.notes.map((n, i) => <div key={i} className="notice"><Icon name="info" /><span>{n}</span></div>)}
      {s.status === 'loading' && <div className="skeleton" style={{ height: 120 }} />}
      {s.direct.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="eyebrow">Places</div>
          {s.direct.map((p) => <button key={p.id} className="nearby-row" onClick={() => onPick(p.id)}><span className="grow"><b>{p.name}</b><span className="muted small"> · {p.country}</span></span><Icon name="right" width={16} height={16} /></button>)}
        </div>
      )}
      {top.length > 0 && <div className="eyebrow">Top matches {s.matches.length > 5 && <span className="muted">· {s.matches.length} in total</span>}</div>}
      {top.map((m) => (
        <PlaceCard key={m.place.id} place={m.place} match={m} compact why={s.explain[m.place.id]?.why} caveat={s.explain[m.place.id]?.caveat} onAddTrip={onAddTrip} />
      ))}
      {s.followUps.length > 0 && <div className="row wrap" style={{ gap: 6 }}>{s.followUps.map((f) => <button key={f} className="chip" onClick={() => useUi.getState().runSearch(f)}>{f}</button>)}</div>}
      {rest.length > 0 && (
        <>
          <button className="btn sm" onClick={() => setMore((v) => !v)}>{more ? 'Hide' : 'Show'} more matches ({rest.length})</button>
          {more && rest.map((m) => <button key={m.place.id} className="nearby-row" onClick={() => onPick(m.place.id)}><span className="grow"><b>{m.place.name}</b><span className="muted small"> · {m.place.country} · {Math.round(m.score * 100)}%</span></span></button>)}
        </>
      )}
      {s.status === 'done' && !top.length && !s.direct.length && (
        <div className="empty" style={{ padding: 20 }}>
          <h3>No curated match</h3>
          <p className="small">{s.unknownArea ? `GLOBA has no curated places in ${s.unknownArea} yet.` : 'Nothing in the curated catalogue fits all of that.'} Try removing a filter, or look up a specific town below.</p>
          <button className="btn sm" onClick={() => { setCriteria(emptyCriteria()); useUi.getState().clearSearch(); }}>Clear and start over</button>
        </div>
      )}
      {(s.geo.length > 0 || s.geoState === 'loading') && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="eyebrow">Worldwide lookup <span className="badge live">Live · Open-Meteo</span></div>
          {s.geoState === 'loading' && !s.geo.length && <div className="skeleton" style={{ height: 40 }} />}
          {s.geo.map((g) => <button key={g.id} className="nearby-row" onClick={() => onGeo(g)}><span className="grow"><b>{g.name}</b><span className="muted small"> · {[g.region, g.country].filter(Boolean).join(', ')}</span></span><Icon name="plus" width={16} height={16} /></button>)}
        </div>
      )}
      {s.geoState === 'unavailable' && <p className="small muted">Worldwide lookup is unavailable right now (offline or blocked). Curated results still work.</p>}
    </div>
  );
}

export default ExplorePage;
