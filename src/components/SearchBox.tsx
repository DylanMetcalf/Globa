import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { GeocodeHit, Place } from '../../shared/types';
import { Icon } from './Icon';
import { useCatalog, useDebounced } from '../lib/hooks';
import { nameSearch, norm } from '../lib/discovery';
import { loadCountries, type CountryFeature } from '../lib/geo';
import { FEATURED_QUERIES } from '../data/catalog';
import { api } from '../services/api';

type Item =
  | { type: 'place'; place: Place }
  | { type: 'country'; feature: CountryFeature }
  | { type: 'geo'; hit: GeocodeHit }
  | { type: 'ask'; q: string }
  | { type: 'example'; q: string };

export function SearchBox({ onAsk, onPlace, onCountry, onGeo, initial = '', placeholder = 'Search a place or describe a trip…', autoFocus = false, compact = false }: {
  onAsk: (q: string) => void; onPlace: (p: Place) => void; onCountry?: (f: CountryFeature) => void; onGeo?: (h: GeocodeHit) => void;
  initial?: string; placeholder?: string; autoFocus?: boolean; compact?: boolean;
}) {
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(-1);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [geo, setGeo] = useState<GeocodeHit[]>([]);
  const [geoErr, setGeoErr] = useState(false);
  const { places } = useCatalog();
  const dq = useDebounced(q, 350);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { setQ(initial); }, [initial]);
  useEffect(() => { loadCountries().then(setCountries); }, []);
  useEffect(() => {
    const out = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, []);
  useEffect(() => {
    if (dq.trim().length < 3) { setGeo([]); setGeoErr(false); return; }
    const ctrl = new AbortController();
    api.geocode(dq.trim(), ctrl.signal).then((r) => { setGeo(r.results.slice(0, 4)); setGeoErr(false); }).catch((e) => { if ((e as Error).message !== 'The request timed out.') setGeoErr(true); setGeo([]); });
    return () => ctrl.abort();
  }, [dq]);

  const items = useMemo<Item[]>(() => {
    const t = q.trim();
    if (!t) return FEATURED_QUERIES.slice(0, 4).map((x) => ({ type: 'example', q: x }) as Item);
    const out: Item[] = [];
    const ps = nameSearch(places, t, 5);
    ps.forEach((p) => out.push({ type: 'place', place: p }));
    const nq = norm(t);
    if (onCountry && nq.length >= 2) countries.filter((c) => norm(c.properties.name).startsWith(nq)).slice(0, 2).forEach((f) => out.push({ type: 'country', feature: f }));
    if (onGeo) {
      const known = new Set(ps.map((p) => norm(p.name)));
      geo.filter((g) => !known.has(norm(g.name))).slice(0, 3).forEach((hit) => out.push({ type: 'geo', hit }));
    }
    out.push({ type: 'ask', q: t });
    return out;
  }, [q, places, countries, geo, onCountry, onGeo]);

  const pick = (it: Item) => {
    setOpen(false);
    if (it.type === 'place') { setQ(it.place.name); onPlace(it.place); }
    else if (it.type === 'country') { setQ(it.feature.properties.name); onCountry?.(it.feature); }
    else if (it.type === 'geo') { setQ(it.hit.name); onGeo?.(it.hit); }
    else { setQ(it.q); onAsk(it.q); }
    input.current?.blur();
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setIdx((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(-1, i - 1)); }
    else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Enter') { e.preventDefault(); if (idx >= 0 && items[idx]) pick(items[idx]); else if (q.trim().length >= 2) { setOpen(false); onAsk(q.trim()); input.current?.blur(); } }
  };

  return (
    <div className={`searchbox ${compact ? 'compact' : ''}`} ref={box}>
      <div className="searchfield" role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-owns={listId}>
        <Icon name="search" />
        <input ref={input} className="searchinput" type="search" value={q} placeholder={placeholder} aria-label="Search places or describe what you want" aria-autocomplete="list" aria-controls={listId}
          aria-activedescendant={idx >= 0 ? `${listId}-${idx}` : undefined} autoFocus={autoFocus} enterKeyHint="search"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(-1); }} onFocus={() => setOpen(true)} onKeyDown={key} />
        {q && <button className="btn icon sm ghost" aria-label="Clear search" onClick={() => { setQ(''); input.current?.focus(); }}><Icon name="close" /></button>}
      </div>
      {open && (
        <ul className="suggest panel" role="listbox" id={listId}>
          {!q.trim() && <li className="suggest-head">Try asking</li>}
          {items.map((it, i) => (
            <li key={i} id={`${listId}-${i}`} role="option" aria-selected={i === idx} className={i === idx ? 'on' : ''} onMouseEnter={() => setIdx(i)} onMouseDown={(e) => { e.preventDefault(); pick(it); }}>
              {it.type === 'place' && (<><Icon name="pin" /><span className="grow"><b>{it.place.name}</b><span className="muted small"> · {it.place.kind === 'poi' ? 'Landmark · ' : ''}{it.place.country}</span></span></>)}
              {it.type === 'country' && (<><Icon name="flag" /><span className="grow"><b>{it.feature.properties.name}</b><span className="muted small"> · Country</span></span></>)}
              {it.type === 'geo' && (<><Icon name="globe" /><span className="grow"><b>{it.hit.name}</b><span className="muted small"> · {[it.hit.region, it.hit.country].filter(Boolean).join(', ')}</span></span><span className="badge live">Live lookup</span></>)}
              {it.type === 'ask' && (<><Icon name="sparkles" /><span className="grow">Find places for “<b>{it.q}</b>”</span></>)}
              {it.type === 'example' && (<><Icon name="sparkles" /><span className="grow">{it.q}</span></>)}
            </li>
          ))}
          {geoErr && q.trim().length >= 3 && <li className="suggest-head">Worldwide lookup is unavailable right now. Curated places still work.</li>}
        </ul>
      )}
    </div>
  );
}
