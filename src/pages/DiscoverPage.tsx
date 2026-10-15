import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Place } from '../../shared/types';
import { Icon } from '../components/Icon';
import { SearchBox } from '../components/SearchBox';
import { ActiveChips, FiltersPanel } from '../components/FiltersPanel';
import { AddToTripDialog, PlaceCard } from '../components/PlaceBits';
import { useUi } from '../store/ui';
import { useStore, activeProfile } from '../store';
import { useCatalog, useDrawerA11y } from '../lib/hooks';
import { FEATURED_QUERIES } from '../data/catalog';
import { criteriaFromPrefs, emptyCriteria, hasStructure, prefsAreEmpty, rankPlaces } from '../lib/discovery';
import { makeCustomPlace } from '../lib/customPlace';
import { ENV_LABELS } from '../lib/labels';
import type { EnvTag } from '../../shared/types';

const QUICK: EnvTag[] = ['mountains', 'beaches', 'forests', 'glaciers', 'waterfalls', 'volcanoes', 'islands', 'deserts'];

export default function DiscoverPage() {
  const nav = useNavigate();
  const { places } = useCatalog();
  const search = useUi((s) => s.search);
  const criteria = useUi((s) => s.criteria);
  const setCriteria = useUi((s) => s.setCriteria);
  const rerank = useUi((s) => s.rerank);
  const runSearch = useUi((s) => s.runSearch);
  const clearSearch = useUi((s) => s.clearSearch);
  const status = useUi((s) => s.status);
  const fxState = useUi((s) => s.fxState);
  const loadFx = useUi((s) => s.loadFx);
  const [addTo, setAddTo] = useState<Place | null>(null);
  const [drawer, setDrawer] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  useDrawerA11y(drawer, () => setDrawer(false), drawerRef);
  const [all, setAll] = useState(false);
  const [more, setMore] = useState(false);
  const structured = hasStructure(criteria);
  const profile = useStore(activeProfile);
  const fxRates = useUi((s) => s.fx);
  const forYou = useMemo(() => (prefsAreEmpty(profile.preferences) ? [] : rankPlaces(places, criteriaFromPrefs(profile.preferences), { toUSD: fxRates?.toUSD }).slice(0, 3)), [profile.preferences, places, fxRates]);

  const onFilters = (c: typeof criteria) => {
    if (fxState === 'idle' && c.budget) void loadFx();
    setCriteria(c);
    if (hasStructure(c)) rerank(c); else clearSearch();
  };
  const browse = useMemo(() => places.filter((p) => p.kind === 'destination' && !p.custom).sort((a, b) => a.name.localeCompare(b.name)), [places]);
  const top = search.matches.slice(0, 5);
  const rest = search.matches.slice(5, 24);
  const aiState = status?.ai.state;

  const filterBlock = <FiltersPanel criteria={criteria} onChange={onFilters} showChips={false} />;

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <div className="eyebrow">Discover</div>
            <h1>Where could we live next?</h1>
            <p>Describe what you want in your own words, or build it from filters. We rank real places from our catalogue and explain every match.</p>
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className={`badge ${aiState === 'live' ? 'ai' : 'demo'}`} title={status?.ai.state === 'live' ? `${status.ai.provider} · ${status.ai.model}` : 'No AI key configured on the server'}>
              {aiState === 'live' ? `AI mode · ${status?.ai.model}` : 'Demo mode · no AI key configured'}
            </span>
          </div>
        </header>

        <div className="discover-grid">
          <aside className="discover-filters card pad">
            <div className="row spread"><h2 style={{ fontSize: '1.25rem' }}>Filters</h2></div>
            {filterBlock}
          </aside>

          <div className="stack discover-results" style={{ gap: 'var(--s-5)' }}>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <SearchBox initial={search.query} onAsk={(q) => runSearch(q)} onPlace={(p) => nav(`/place/${p.id}`)} onCountry={(f) => runSearch(f.properties.name)}
                onGeo={(h) => { const p = makeCustomPlace(h); useStore.setState((s) => ({ customPlaces: { ...s.customPlaces, [p.id]: p } })); nav(`/place/${p.id}`); }} />
              <button className="btn icon discover-filter-btn" onClick={() => setDrawer(true)} aria-label="Open filters"><Icon name="filter" /></button>
            </div>

            {structured && <ActiveChips criteria={criteria} onChange={onFilters} />}
            {search.business && <Link className="notice info biz" to={`/place/${search.business.placeId}?suggest=${search.business.cat}#sm-title`}><Icon name="food" /><span>Looking for <b>{search.business.label}</b> in {search.business.placeName}? Real, nearby results are pulled live in the brief’s <b>Suggest More</b> — open it →</span></Link>}
            {search.notes.map((n, i) => <div className="notice" key={i}><Icon name="info" /><span>{n}</span></div>)}
            {search.criteria?.budget && !useUi.getState().fx && fxState !== 'idle' && <div className="notice"><Icon name="info" /><span>Live currency rates are unavailable, so budgets in {search.criteria.budget.currency} can’t be compared with USD estimates.</span></div>}

            {search.status === 'loading' && <div className="grid-cards">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 300 }} />)}</div>}

            {search.status !== 'idle' || structured ? (
              <>
                {search.direct.length > 0 && (
                  <section className="stack"><h2>Places named “{search.query}”</h2>
                    <div className="grid-cards">{search.direct.map((p) => <PlaceCard key={p.id} place={p} onAddTrip={setAddTo} />)}</div></section>
                )}
                {top.length > 0 && (
                  <section className="stack">
                    <div className="row spread wrap"><h2>Top matches</h2><span className="muted small">{search.matches.length} place{search.matches.length === 1 ? '' : 's'} fit · showing the best five</span></div>
                    <div className="grid-cards">{top.map((m) => <PlaceCard key={m.place.id} place={m.place} match={m} why={search.explain[m.place.id]?.why} caveat={search.explain[m.place.id]?.caveat} onAddTrip={setAddTo} />)}</div>
                    {search.followUps.length > 0 && <div className="row wrap" style={{ gap: 6 }}><span className="small muted">Follow up:</span>{search.followUps.map((f) => <button key={f} className="chip" onClick={() => runSearch(f)}>{f}</button>)}</div>}
                    {rest.length > 0 && (<>
                      <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setMore((v) => !v)}>{more ? 'Hide' : 'Show'} {rest.length} more matches</button>
                      {more && <div className="grid-cards">{rest.map((m) => <PlaceCard key={m.place.id} place={m.place} match={m} compact onAddTrip={setAddTo} />)}</div>}
                    </>)}
                  </section>
                )}
                {search.status === 'done' && !top.length && !search.direct.length && (
                  <div className="empty">
                    <h3>No curated place fits all of that</h3>
                    <p>{search.unknownArea ? `We don’t have curated places in ${search.unknownArea} yet, but you can look up any town worldwide from the search box.` : 'Try removing a filter or two. We would rather show nothing than make something up.'}</p>
                    <button className="btn primary" onClick={() => { setCriteria(emptyCriteria()); clearSearch(); }}>Clear filters</button>
                  </div>
                )}
                {(search.geo.length > 0) && (
                  <section className="stack"><div className="row wrap"><h2>Worldwide lookup</h2><span className="badge live">Live · Open-Meteo geocoding</span></div>
                    <p className="small muted">Towns and cities beyond our curated catalogue. We only know the name and location for these.</p>
                    <div className="row wrap" style={{ gap: 8 }}>
                      {search.geo.map((g) => (
                        <button key={g.id} className="btn" onClick={() => { const p = makeCustomPlace(g); useStore.setState((s) => ({ customPlaces: { ...s.customPlaces, [p.id]: p } })); nav(`/place/${p.id}`); }}>
                          <Icon name="pin" />{g.name}<span className="muted small">{[g.region, g.country].filter(Boolean).join(', ')}</span>
                        </button>
                      ))}
                    </div></section>
                )}
              </>
            ) : (
              <>
                {forYou.length > 0 && (
                  <section className="stack">
                    <div className="row spread wrap"><h2>Picked for {profile.name}</h2><button className="btn sm" onClick={() => onFilters(criteriaFromPrefs(profile.preferences))}>Use {profile.name}’s preferences as filters</button></div>
                    <p className="small muted" style={{ margin: 0 }}>Ranked from the preferences in Settings — change them any time.</p>
                    <div className="grid-cards">{forYou.map((m) => <PlaceCard key={m.place.id} place={m.place} match={m} compact onAddTrip={setAddTo} />)}</div>
                  </section>
                )}
                <section className="stack">
                  <h2>Try asking</h2>
                  <div className="ask-grid">
                    {FEATURED_QUERIES.map((q) => <button key={q} className="ask-card" onClick={() => runSearch(q)}><Icon name="sparkles" /><span>{q}</span></button>)}
                  </div>
                </section>
                <section className="stack">
                  <h2>Or start from a landscape</h2>
                  <div className="row wrap" style={{ gap: 8 }}>{QUICK.map((e) => <button key={e} className="chip" onClick={() => onFilters({ ...emptyCriteria(), env: [e] })}>{ENV_LABELS[e]}</button>)}</div>
                </section>
                <section className="stack">
                  <div className="row spread wrap"><h2>Browse curated destinations</h2><span className="muted small">{browse.length} places · curated sample dataset</span></div>
                  <div className="grid-cards">{(all ? browse : browse.slice(0, 9)).map((p) => <PlaceCard key={p.id} place={p} compact onAddTrip={setAddTo} />)}</div>
                  {!all && <button className="btn" style={{ alignSelf: 'center' }} onClick={() => setAll(true)}>Show all {browse.length}</button>}
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      {drawer && (
        <div className="drawer-wrap" role="dialog" aria-modal="true" aria-label="Filters" style={{ position: 'fixed' }}>
          <div className="drawer-scrim" onClick={() => setDrawer(false)} />
          <div className="drawer panel night" ref={drawerRef}>
            <div className="row spread"><h2 style={{ fontSize: '1.4rem' }}>Filters</h2><button className="btn icon sm ghost" aria-label="Close filters" onClick={() => setDrawer(false)}><Icon name="close" /></button></div>
            <div className="drawer-body">{filterBlock}</div>
            <button className="btn primary" style={{ marginTop: 12 }} onClick={() => setDrawer(false)}>Show {structured ? search.matches.length : 'all'} results</button>
          </div>
        </div>
      )}
      <AddToTripDialog place={addTo} onClose={() => setAddTo(null)} />
    </div>
  );
}
