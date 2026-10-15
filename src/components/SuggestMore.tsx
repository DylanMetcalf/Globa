import { useState } from 'react';
import type { NearbyBusiness, Place } from '../../shared/types';
import { Icon } from './Icon';
import { api } from '../services/api';
import { haversineKm, formatDistance } from '../lib/geo';
import { useStore } from '../store';
import { useUi } from '../store/ui';
import { useCatalog } from '../lib/hooks';
import { AddToTripDialog, announce } from './PlaceBits';
import { ago } from '../lib/format';

interface Cat { id: string; label: string; osm?: string[]; curated?: 'hidden' | 'nature' | 'daytrip' | 'date'; icon: 'food' | 'coffee' | 'bed' | 'leaf' | 'sparkles' | 'pin' | 'sun' | 'wifi' | 'compass' | 'info' | 'map' | 'user' | 'star' }
const CATS: Cat[] = [
  { id: 'restaurants', label: 'Restaurants', osm: ['restaurants'], icon: 'food' },
  { id: 'coffee', label: 'Coffee shops', osm: ['coffee'], icon: 'coffee' },
  { id: 'takeaway', label: 'Takeaway', osm: ['takeaway'], icon: 'food' },
  { id: 'hidden', label: 'Hidden gems', curated: 'hidden', icon: 'sparkles' },
  { id: 'nature', label: 'Nature', osm: ['nature'], curated: 'nature', icon: 'leaf' },
  { id: 'activities', label: 'Activities', osm: ['activities'], icon: 'compass' },
  { id: 'date', label: 'Date ideas', osm: ['viewpoints'], curated: 'date', icon: 'star' },
  { id: 'accommodation', label: 'Accommodation', osm: ['accommodation'], icon: 'bed' },
  { id: 'markets', label: 'Local markets', osm: ['markets'], icon: 'map' },
  { id: 'viewpoints', label: 'Scenic viewpoints', osm: ['viewpoints'], icon: 'sun' },
  { id: 'work', label: 'Work-friendly spaces', osm: ['coworking', 'coffee'], icon: 'wifi' },
  { id: 'daytrips', label: 'Day trips', curated: 'daytrip', icon: 'pin' },
  { id: 'practical', label: 'Practical services', osm: ['practical'], icon: 'info' },
];

interface Result {
  key: string; title: string; catLabel: string; source: 'live-osm' | 'curated'; why: string; km: number; lat: number; lng: number;
  tags?: Record<string, string>; url?: string; placeId?: string; biz?: NearbyBusiness;
}

const searchLink = (cat: Cat, place: Place) => `https://www.google.com/maps/search/${encodeURIComponent(`${cat.label} near ${place.name}, ${place.country}`)}`;

export function SuggestMore({ place, initialCats = [] }: { place: Place; initialCats?: string[] }) {
  const { places } = useCatalog();
  const [sel, setSel] = useState<string[]>(() => initialCats.filter((c) => CATS.some((x) => x.id === c)));
  const [radius, setRadius] = useState(5);
  const [needHours, setNeedHours] = useState(false);
  const [kw, setKw] = useState('');
  const [atmos, setAtmos] = useState<'any' | 'quiet' | 'lively' | 'romantic'>('any');
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [pool, setPool] = useState<Result[]>([]);
  const [offset, setOffset] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [checked, setChecked] = useState<string>('');
  const [addTo, setAddTo] = useState<Place | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const savePlace = useStore((s) => s.savePlace);
  const sync = useStore((s) => s.syncAchievements);
  const toast = useUi((s) => s.toast);
  const units = useStore((s) => s.settings.units);

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const run = async () => {
    const cats = CATS.filter((c) => sel.includes(c.id));
    if (!cats.length) return;
    setState('loading'); setErrors([]); setOffset(0); setOpen(null);
    const out: Result[][] = [];
    const errs: string[] = [];
    const home = place.kind === 'poi' && place.parentId ? place : place;
    for (const cat of cats) {
      const list: Result[] = [];
      for (const o of cat.osm ?? []) {
        try {
          const r = await api.nearby(home.lat, home.lng, o, radius * 1000);
          setChecked(r.checkedAt);
          for (const b of r.results) {
            list.push({
              key: b.id, title: b.name, catLabel: cat.label, source: 'live-osm', km: haversineKm(home, b), lat: b.lat, lng: b.lng, tags: b.tags, url: b.tags.website ?? b.sourceUrl, biz: b,
              why: [b.category.replace(/_/g, ' '), b.tags.cuisine && `cuisine: ${b.tags.cuisine.replace(/;/g, ', ')}`, b.tags.opening_hours && 'opening hours listed', b.tags.internet_access && `internet: ${b.tags.internet_access}`, b.tags.outdoor_seating === 'yes' && 'outdoor seating'].filter(Boolean).join(' · '),
            });
          }
        } catch (e) { errs.push(`${cat.label}: ${(e as Error).message}`); }
      }
      if (cat.curated) {
        const near = places.filter((p) => p.kind === 'poi' && p.id !== place.id && haversineKm(p, place) <= (cat.curated === 'daytrip' ? 350 : 200));
        const picks = near.filter((p) => cat.curated === 'nature' ? p.env.length > 0 : cat.curated === 'hidden' ? p.scores.popularity <= 3 : cat.curated === 'date' ? p.secondaryReasons.includes('romance') || p.env.some((e) => ['beaches', 'lakes', 'mountains'].includes(e)) : true);
        for (const p of picks.slice(0, 12)) list.push({ key: `c-${cat.id}-${p.id}`, title: p.name, catLabel: cat.label, source: 'curated', km: haversineKm(place, p), lat: p.lat, lng: p.lng, placeId: p.id, why: p.summary });
      }
      if (cat.id === 'work') {
        // keep cafés only if they list internet access
        for (let i = list.length - 1; i >= 0; i--) if (list[i].biz && list[i].biz!.category === 'cafe' && !list[i].tags?.internet_access) list.splice(i, 1);
      }
      out.push(list);
    }
    // filters
    const k = kw.trim().toLowerCase();
    const keep = (r: Result) => {
      if (needHours && r.source === 'live-osm' && !r.tags?.opening_hours) return false;
      if (r.km > Math.max(radius, r.source === 'curated' ? 350 : radius)) return false;
      if (k && !`${r.title} ${Object.values(r.tags ?? {}).join(' ')} ${r.why}`.toLowerCase().includes(k)) return false;
      if (atmos === 'romantic' && r.source === 'live-osm' && !/(viewpoint|restaurant|wine|bistro)/.test(`${r.biz?.category} ${r.tags?.cuisine ?? ''}`)) return false;
      if (atmos === 'lively' && r.source === 'live-osm' && !/(bar|pub|market|restaurant|fast_food|marketplace)/.test(r.biz?.category ?? '')) return false;
      if (atmos === 'quiet' && r.source === 'live-osm' && /(bar|pub|nightclub|fast_food)/.test(r.biz?.category ?? '')) return false;
      return true;
    };
    // round-robin interleave so every chosen category appears
    const filtered = out.map((l) => l.filter(keep).sort((a, b) => a.km - b.km || a.title.localeCompare(b.title)));
    const merged: Result[] = []; const seen = new Set<string>();
    for (let i = 0; filtered.some((l) => i < l.length); i++) for (const l of filtered) { const r = l[i]; if (r && !seen.has(r.title.toLowerCase() + r.catLabel)) { seen.add(r.title.toLowerCase() + r.catLabel); merged.push(r); } }
    setPool(merged); setErrors(errs); setState('done');
  };

  const shown = pool.slice(offset, offset + 5);
  const toPlace = (r: Result): Place => {
    if (r.placeId) return places.find((p) => p.id === r.placeId)!;
    return {
      id: r.key, name: r.title, kind: 'poi', parentId: place.kind === 'destination' ? place.id : place.parentId, country: place.country, countryCode: place.countryCode, region: place.region,
      lat: r.lat, lng: r.lng, tagline: `${r.catLabel} near ${place.name}`, summary: `${r.catLabel} near ${place.name}. Listed on OpenStreetMap — details, hours and prices are not verified by GLOBA.`,
      env: [], lifestyle: [], practical: [], activities: [], food: [], stayTypes: [], primaryReason: 'food-culture', secondaryReasons: [], scores: { crowds: 3, popularity: 3, internet: 3, walkability: 3, remoteness: 3, cost: 3 },
      climate: place.climate, climateNote: '', bestMonths: [], peakMonths: [], idealStay: ['flexible'], special: [], localLife: [], pros: [], cons: [], research: [], art: place.art, provenance: 'live', custom: true,
    };
  };
  const save = (r: Result) => { const p = toPlace(r); savePlace(p.id, { place: p }); announce(sync()); toast(`Saved ${p.name}`); };

  return (
    <section className="suggest-more card pad" aria-labelledby="sm-title">
      <h2 id="sm-title">Suggest More</h2>
      <p className="muted">Pick what you’re after near {place.name}. Results come from OpenStreetMap listings and GLOBA’s curated landmarks. We never invent a place to fill a list.</p>
      <div className="row wrap" role="group" aria-label="Categories" style={{ gap: 6 }}>
        {CATS.map((c) => <button key={c.id} className="chip" aria-pressed={sel.includes(c.id)} onClick={() => toggle(c.id)}><Icon name={c.icon} width={14} height={14} />{c.label}</button>)}
      </div>
      <div className="grid-prefs">
        <div className="field"><label htmlFor="sm-r">Distance: within {formatDistance(radius, units)} (straight-line)</label><input id="sm-r" type="range" min={1} max={25} value={radius} onChange={(e) => setRadius(Number(e.target.value))} /></div>
        <div className="field"><label htmlFor="sm-k">Keywords</label><input id="sm-k" className="input" placeholder="e.g. vegan, sushi, rooftop" value={kw} onChange={(e) => setKw(e.target.value)} /></div>
        <div className="field"><label htmlFor="sm-a">Atmosphere</label>
          <select id="sm-a" className="input" value={atmos} onChange={(e) => setAtmos(e.target.value as typeof atmos)}><option value="any">Any</option><option value="quiet">Quiet</option><option value="lively">Lively</option><option value="romantic">Romantic</option></select></div>
        <div className="field"><label>Price</label><div className="small muted" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>Not available: OpenStreetMap has no price data. Connect a places provider for price filters.</div></div>
      </div>
      <label className="row small"><input type="checkbox" checked={needHours} onChange={(e) => setNeedHours(e.target.checked)} />Only places that list opening hours (hours are as listed on OpenStreetMap, not verified)</label>
      <div className="row"><button className="btn primary" disabled={!sel.length || state === 'loading'} onClick={run}>{state === 'loading' ? <><span className="spinner" style={{ width: 16, height: 16 }} />Searching…</> : <><Icon name="sparkles" />Suggest</>}</button>
        {!sel.length && <span className="muted small">Choose at least one category.</span>}</div>

      {state === 'done' && (
        <div className="stack" aria-live="polite">
          {errors.length > 0 && (
            <div className="notice error"><Icon name="warn" /><div>Live lookup was unavailable for: {errors.join('; ')}. Try again shortly, or open a search yourself: {CATS.filter((c) => sel.includes(c.id)).map((c) => <a key={c.id} href={searchLink(c, place)} target="_blank" rel="noreferrer noopener" style={{ marginRight: 8 }}>{c.label} <Icon name="external" width={12} height={12} style={{ display: 'inline' }} /></a>)}</div></div>
          )}
          {shown.length === 0 && !errors.length && <div className="empty" style={{ padding: 20 }}><h3>Nothing listed nearby</h3><p className="small">OpenStreetMap coverage varies by area. Try a larger distance, fewer keywords, or other categories.</p></div>}
          {shown.map((r) => (
            <article key={r.key} className="sm-result">
              <div className="row spread" style={{ alignItems: 'flex-start' }}>
                <div className="grow"><h3>{r.title}</h3>
                  <div className="row wrap" style={{ gap: 6, marginTop: 4 }}><span className="badge">{r.catLabel}</span>
                    {r.source === 'live-osm' ? <span className="badge live" title="Retrieved from OpenStreetMap via Overpass">Live · OpenStreetMap</span> : <span className="badge curated">Curated landmark</span>}
                    <span className="badge">{formatDistance(r.km, units)} straight-line</span></div></div>
              </div>
              <p className="small" style={{ margin: '8px 0' }}>{r.why || 'Listed on OpenStreetMap.'}</p>
              {open === r.key && (
                <dl className="small kv">
                  {Object.entries(r.tags ?? {}).map(([k, v]) => <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{v}</dd></div>)}
                  <div><dt>Coordinates</dt><dd>{r.lat.toFixed(4)}, {r.lng.toFixed(4)}</dd></div>
                  {r.url && <div><dt>Source</dt><dd><a href={r.url} target="_blank" rel="noreferrer noopener">{r.url.replace(/^https?:\/\//, '').slice(0, 48)}</a></dd></div>}
                </dl>
              )}
              <div className="row wrap" style={{ gap: 6 }}>
                <button className="btn sm" aria-expanded={open === r.key} onClick={() => setOpen(open === r.key ? null : r.key)}>Details</button>
                <button className="btn sm" onClick={() => save(r)}><Icon name="bookmark" />Save</button>
                <button className="btn sm" onClick={() => setAddTo(toPlace(r))}><Icon name="trips" />Add to itinerary</button>
              </div>
            </article>
          ))}
          <div className="row wrap">
            {pool.length > offset + 5 && <button className="btn" onClick={() => setOffset(offset + 5)}><Icon name="refresh" />Show alternatives ({pool.length - offset - 5} more)</button>}
            {offset > 0 && <button className="btn ghost" onClick={() => setOffset(0)}>Back to first five</button>}
            <button className="btn ghost" onClick={() => document.getElementById('sm-title')?.scrollIntoView({ behavior: 'smooth' })}>Refine</button>
          </div>
          {checked && <p className="small muted">Live results checked {ago(checked)}. Source: OpenStreetMap contributors (ODbL). Hours, ratings and prices are not verified.</p>}
        </div>
      )}
      <AddToTripDialog place={addTo} onClose={() => setAddTo(null)} />
    </section>
  );
}

