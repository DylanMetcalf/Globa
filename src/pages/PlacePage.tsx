import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { NearbyBusiness, Place, WeatherSnapshot } from '../../shared/types';
import { Icon } from '../components/Icon';
import { PlaceImage, useLiveImage } from '../components/PlaceArt';
import { AddToTripDialog, PlaceActions, ProvBadge, StatusPill, LitPill } from '../components/PlaceBits';
import { Locator } from '../components/Locator';
import { SuggestMore } from '../components/SuggestMore';
import { useCatalog } from '../lib/hooks';
import { useStore } from '../store';
import { useUi } from '../store/ui';
import { api } from '../services/api';
import { haversineKm, formatDistance } from '../lib/geo';
import {
  CLIMATE_LABELS, ENV_LABELS, LIFESTYLE_LABELS, MONTHS, MONTHS_LONG, REASON_LABELS, STAY_LABELS, SETTLEMENT_LABELS, ACTIVITY_LABELS, FOOD_LABELS,
} from '../lib/labels';
import { ago, usdTo, WEATHER_CODES } from '../lib/format';

const DATASET_DATE = 'October 2026';

function Section({ id, title, kicker, children, badge }: { id: string; title: string; kicker?: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <section id={id} className="brief-sec" aria-labelledby={`${id}-h`}>
      {kicker && <div className="eyebrow">{kicker}</div>}
      <div className="row spread wrap"><h2 id={`${id}-h`}>{title}</h2>{badge}</div>
      {children}
    </section>
  );
}

function SeasonStrip({ place }: { place: Place }) {
  return (
    <div>
      <ol className="season" aria-label="Month-by-month guidance">
        {MONTHS.map((m, i) => {
          const good = place.bestMonths.includes(i + 1); const peak = place.peakMonths.includes(i + 1);
          const sweet = good && !peak;
          return (
            <li key={m} className={`${good ? 'good' : ''} ${peak ? 'peak' : ''} ${sweet ? 'sweet' : ''}`} title={`${MONTHS_LONG[i]}: ${sweet ? 'good for long stays, quieter than peak' : good && peak ? 'good weather and peak tourism' : peak ? 'peak tourism' : 'less ideal'}`}>
              <span>{m}</span><b>{sweet ? 'Sweet spot' : good && peak ? 'Good · busy' : peak ? 'Busy' : good ? 'Good' : '—'}</b>
            </li>
          );
        })}
      </ol>
      <p className="small muted" style={{ marginTop: 8 }}>Guidance is approximate and editorial. “Sweet spot” = a good time to live there that is outside peak tourism.</p>
    </div>
  );
}

function reasonStory(p: Place): string {
  const env = p.env.slice(0, 3).map((e) => ENV_LABELS[e].toLowerCase()).join(', ');
  switch (p.primaryReason) {
    case 'landscapes': return `The strongest reason to go is the landscape${env ? `: ${env}` : ''}. ${p.special[0] ?? ''}`;
    case 'food-culture': return `Food and local culture lead the case here${p.food.length ? ` (${p.food.slice(0, 3).map((f) => FOOD_LABELS[f].toLowerCase()).join(', ')})` : ''}. ${p.special[0] ?? ''}`;
    case 'adventure': return `This is above all an adventure base${p.activities.length ? `: ${p.activities.slice(0, 3).map((a) => ACTIVITY_LABELS[a].toLowerCase()).join(', ')}` : ''}. ${p.special[0] ?? ''}`;
    case 'remote-work': return `Its strongest pull is practical: internet is rated ${p.scores.internet}/5 (curated)${p.practical.includes('coworking') ? ' with coworking spaces' : ''}, plus a lifestyle people enjoy living in. ${p.special[0] ?? ''}`;
    case 'slow-living': return `It rewards unhurried living: ${p.lifestyle.slice(0, 3).map((l) => LIFESTYLE_LABELS[l].toLowerCase()).join(', ')}. ${p.special[0] ?? ''}`;
    case 'romance': return `A romantic setting. ${p.special[0] ?? ''}`;
    case 'wildlife': return `Wildlife is the headline. ${p.special[0] ?? ''}`;
    case 'phenomena': return `It offers unusual natural phenomena that few places match. ${p.special[0] ?? ''}`;
    default: return `The deepest layer here is architecture and history. ${p.special[0] ?? ''}`;
  }
}

type AccProvider = Awaited<ReturnType<typeof api.accommodation>>;

function SearchLinks({ place, provider }: { place: Place; provider: AccProvider | null }) {
  const q = encodeURIComponent(`${place.name}, ${place.country}`);
  const links = provider?.searchLinks.length ? provider.searchLinks : [
    { label: 'Airbnb search', url: `https://www.airbnb.com/s/${q}/homes` },
    { label: 'Booking.com search', url: `https://www.booking.com/searchresults.html?ss=${q}` },
    { label: 'Maps: places to stay', url: `https://www.google.com/maps/search/${encodeURIComponent(`accommodation in ${place.name}, ${place.country}`)}` },
  ];
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      {links.map((l) => <a key={l.label} className="btn sm" href={l.url} target="_blank" rel="noreferrer noopener">{l.label}<Icon name="external" /></a>)}
    </div>
  );
}

function Accommodation({ place }: { place: Place }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [list, setList] = useState<NearbyBusiness[]>([]);
  const [at, setAt] = useState('');
  const [provider, setProvider] = useState<AccProvider | null>(null);
  useEffect(() => { api.accommodation(place.name, place.country, place.lat, place.lng).then(setProvider).catch(() => setProvider(null)); }, [place.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const load = () => {
    setState('loading');
    api.nearby(place.lat, place.lng, 'accommodation', 8000).then((r) => {
      const seen = new Set<string>();
      const uniq = r.results.filter((b) => (seen.has(b.name.toLowerCase()) ? false : (seen.add(b.name.toLowerCase()), true)))
        .sort((a, b) => (b.tags.website ? 1 : 0) - (a.tags.website ? 1 : 0) || haversineKm(place, a) - haversineKm(place, b)).slice(0, 5);
      setList(uniq); setAt(r.checkedAt); setState('done');
    }).catch(() => setState('error'));
  };
  return (
    <div className="stack">
      {provider?.state === 'live' && provider.listings.length > 0 && (
        <ul className="acc-list">
          {provider.listings.slice(0, 5).map((l) => (
            <li key={l.id} className="card acc">
              {l.imageUrl ? <img src={l.imageUrl} alt="" loading="lazy" className="acc-art" style={{ objectFit: 'cover' }} /> : <div className="acc-art" aria-hidden="true"><Icon name="bed" width={28} height={28} /></div>}
              <div className="grow"><h3>{l.name}</h3>{l.summary && <p className="small" style={{ margin: 0 }}>{l.summary}</p>}
                <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>{l.priceText && <span className="badge live">{l.priceText}</span>}{l.rating && <span className="badge">★ {l.rating}</span>}<span className="small muted">checked {ago(l.checkedAt)}</span>
                  <a className="btn sm" href={l.url} target="_blank" rel="noreferrer noopener">View listing<Icon name="external" /></a></div></div>
            </li>
          ))}
        </ul>
      )}
      {provider?.state !== 'live' && <div className="notice"><Icon name="info" /><div><b>No live listings provider is connected.</b> GLOBA will not invent properties, prices or availability. Use the search links below, or load places to stay that are listed on OpenStreetMap (names and locations only).</div></div>}
      <SearchLinks place={place} provider={provider} />
      {state === 'idle' && <div><button className="btn" onClick={load}><Icon name="bed" />Load five places to stay from OpenStreetMap</button></div>}
      {state === 'loading' && <div className="skeleton" style={{ height: 120 }} />}
      {state === 'error' && <div className="notice error"><Icon name="warn" />Live lookup is unavailable right now. The search links above still work.</div>}
      {state === 'done' && (
        <>
          {list.length === 0 && <p className="muted">Nothing is listed within 8 km on OpenStreetMap.</p>}
          <ul className="acc-list">
            {list.map((b) => (
              <li key={b.id} className="card acc">
                <div className="acc-art" aria-hidden="true"><Icon name="bed" width={28} height={28} /></div>
                <div className="grow">
                  <h3>{b.name}</h3>
                  <div className="small muted">{b.category.replace(/_/g, ' ')} · {formatDistance(haversineKm(place, b), 'metric')} from centre (straight-line)</div>
                  <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
                    <a className="btn sm" href={b.tags.website ?? b.sourceUrl} target="_blank" rel="noreferrer noopener">{b.tags.website ? 'Official website' : 'OpenStreetMap listing'}<Icon name="external" /></a>
                    <a className="btn sm ghost" href={`https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`} target="_blank" rel="noreferrer noopener">Map<Icon name="external" /></a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="small muted">Source: OpenStreetMap contributors · checked {ago(at)}. Prices, photos, ratings and availability are not shown because they are not in this source.</p>
        </>
      )}
    </div>
  );
}

function LiveWeather({ place }: { place: Place }) {
  const [wx, setWx] = useState<WeatherSnapshot | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const load = () => { setState('loading'); api.weather(place.lat, place.lng).then((r) => { setWx(r.weather); setState('idle'); }).catch(() => setState('error')); };
  if (!wx) return (
    <div className="row wrap"><button className="btn" onClick={load} disabled={state === 'loading'}><Icon name="sun" />{state === 'loading' ? 'Loading…' : 'Load live 7-day forecast'}</button>
      {state === 'error' && <span className="small muted">Forecast unavailable right now.</span>}</div>
  );
  return (
    <div className="stack">
      <div className="row wrap" style={{ gap: 8 }}><span className="badge live">Live · Open-Meteo</span><span className="small muted">checked {ago(wx.checkedAt)} · now {Math.round(wx.tempC)}°C, {WEATHER_CODES[wx.code] ?? 'conditions unknown'}</span></div>
      <ul className="wx">{wx.daily.map((d) => <li key={d.date}><b>{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}</b><span>{Math.round(d.maxC)}° / {Math.round(d.minC)}°</span><span className="muted small">{d.precipMm.toFixed(1)} mm</span></li>)}</ul>
    </div>
  );
}

export default function PlacePage() {
  const { id } = useParams();
  const [qs] = useSearchParams();
  const nav = useNavigate();
  const { get, places } = useCatalog();
  const place = get(id);
  const [addTo, setAddTo] = useState<Place | null>(null);
  const saved = useStore((s) => (id ? s.saved[id] : undefined));
  const lit = useStore((s) => s.activations.some((a) => a.placeId === id));
  const currency = useStore((s) => s.settings.currency);
  const units = useStore((s) => s.settings.units);
  const fx = useUi((s) => s.fx);
  const loadFx = useUi((s) => s.loadFx);
  const live = useLiveImage(place);
  const select = useUi((s) => s.select);
  const requestFocus = useUi((s) => s.requestFocus);
  useEffect(() => { void loadFx(); }, [loadFx]);
  useEffect(() => {
    window.scrollTo(0, 0); document.querySelector('.page')?.scrollTo(0, 0);
    if (location.hash) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth' }), 700);
  }, [id]);

  const nearby = useMemo(() => (place ? places.filter((p) => p.parentId === (place.kind === 'destination' ? place.id : place.parentId) && p.id !== place.id) : []), [places, place]);
  const parent = get(place?.parentId);

  if (!place) {
    return (
      <div className="page"><div className="page-inner"><div className="empty"><h3>We couldn’t find that place</h3><p>It may have been removed, or the link is from another device (saved data lives per browser).</p><Link className="btn primary" to="/">Back to the globe</Link></div></div></div>
    );
  }
  const curated = !place.custom && place.provenance === 'curated';
  const sc = place.scores;
  const cost = place.monthlyCostUSD;
  const showOnGlobe = () => { select(place.id); requestFocus({ lat: place.lat, lng: place.lng, alt: 0.8 }); nav('/'); };

  const rows: { label: string; value: string; prov: 'curated' | 'estimate'; note?: string }[] = curated ? [
    { label: 'Internet', value: `${['', 'Very limited', 'Patchy', 'Usable', 'Good', 'Excellent'][sc.internet]} (${sc.internet}/5)`, prov: 'curated', note: 'Editorial judgement. Test speeds with the host before committing.' },
    { label: 'Cost of living', value: cost ? `${usdTo(cost[0], currency, fx?.toUSD).text} – ${usdTo(cost[1], currency, fx?.toUSD).text} / month for two` : 'No estimate', prov: 'estimate', note: `Rough rent + living costs for two, excluding flights. ${fx && currency !== 'USD' ? `Converted with live rates (${fx.date}).` : ''} Cost level ${sc.cost}/5 relative to other destinations.` },
    { label: 'Accommodation', value: place.stayTypes.length ? place.stayTypes.join(', ') : 'Unknown', prov: 'curated', note: 'Typical stay types. Availability and prices are not checked.' },
    { label: 'Groceries & markets', value: place.practical.includes('groceries') ? 'Available' : 'Limited — plan ahead', prov: 'curated' },
    { label: 'Work spaces', value: place.practical.includes('coworking') ? 'Coworking likely available' : 'Few dedicated coworking options', prov: 'curated' },
    { label: 'Getting around', value: place.practical.includes('car-free') ? 'Walking / public transport work well' : place.practical.includes('public-transport') ? 'Public transport exists; a car adds freedom' : 'A car is likely needed', prov: 'curated' },
    { label: 'Healthcare', value: place.practical.includes('healthcare') ? 'Available locally or nearby' : 'Limited — check distance to clinics', prov: 'curated' },
    { label: 'Seasonality & climate', value: `${CLIMATE_LABELS[place.climate]}. ${place.climateNote}`, prov: 'curated' },
    { label: 'Walkability', value: `${sc.walkability}/5`, prov: 'curated' },
    { label: 'Crowds', value: `${sc.crowds}/5 (5 = very busy at peak)`, prov: 'curated' },
  ] : [];

  return (
    <div className="page brief">
      <div className="brief-hero night">
        <PlaceImage place={place} ratio="21 / 9" rounded={false} showCredit className="hero-img" />
        <div className="hero-scrim" />
        <div className="hero-body">
          <div className="page-inner" style={{ paddingBottom: 0, paddingTop: 0 }}>
            <button className="btn sm panel" style={{ alignSelf: "flex-start" }} onClick={() => nav(-1)} aria-label="Back"><Icon name="left" />Back</button>
            <div className="stack" style={{ marginTop: 'auto', gap: 10, maxWidth: 760 }}>
              <div className="row wrap" style={{ gap: 6 }}><StatusPill status={saved?.status} /><LitPill lit={lit} /><span className="badge curated">{place.custom ? 'Live lookup' : 'Destination brief'}</span></div>
              <h1 style={{ color: '#fff' }}>{place.name}</h1>
              <div style={{ color: '#d7dcf2' }}>{[place.region, place.country].filter(Boolean).join(' · ')}{parent && <> · near <Link to={`/place/${parent.id}`} style={{ color: '#9fe9df' }}>{parent.name.replace(/\s*\(.*\)/, '')}</Link></>}</div>
              <p style={{ color: '#eef0fb', fontSize: '1.15rem', fontFamily: 'var(--font-display)', margin: 0 }}>{place.tagline}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="page-inner brief-grid">
        <div className="brief-main">
          <div className="card pad stack">
            <PlaceActions place={place} onAddTrip={() => setAddTo(place)} />
            <div className="row wrap" style={{ gap: 6 }}>
              {place.env.map((e) => <span key={e} className="chip static">{ENV_LABELS[e]}</span>)}
              {place.settlement && <span className="chip static">{SETTLEMENT_LABELS[place.settlement]}</span>}
              {place.lifestyle.slice(0, 3).map((l) => <span key={l} className="chip static">{LIFESTYLE_LABELS[l]}</span>)}
            </div>
            <p style={{ margin: 0, fontSize: '1.05rem' }}>{place.summary}</p>
            {live?.summary && (
              <blockquote className="wiki">
                <div className="row spread"><span className="eyebrow">From Wikipedia</span><span className="badge live">Live</span></div>
                <p style={{ margin: '6px 0' }}>{live.summary.text.slice(0, 520)}{live.summary.text.length > 520 ? '…' : ''}</p>
                <a href={live.summary.url} target="_blank" rel="noreferrer noopener">Read on Wikipedia <Icon name="external" width={12} height={12} style={{ display: 'inline' }} /></a>
              </blockquote>
            )}
          </div>

          {curated && (
            <Section id="why" kicker="The case for going" title="Main reason to visit" badge={<ProvBadge p="curated" />}>
              <div className="why-card">
                <span className="eyebrow">Primary reason</span>
                <h3 className="why-title">{REASON_LABELS[place.primaryReason]}</h3>
                <p>{reasonStory(place)}</p>
              </div>
              {place.secondaryReasons.length > 0 && <div className="row wrap" style={{ gap: 6 }}><span className="small muted">Also:</span>{place.secondaryReasons.map((r) => <span key={r} className="chip static">{REASON_LABELS[r]}</span>)}</div>}
              <p className="small muted"><b>Best-fit traveller:</b> {place.lifestyle.length ? `people who like ${place.lifestyle.slice(0, 3).map((l) => LIFESTYLE_LABELS[l].toLowerCase()).join(', ')}.` : 'flexible travellers.'}</p>
            </Section>
          )}

          {curated && place.special.length > 0 && (
            <Section id="special" title="What makes it special">
              <ul className="bullets">{place.special.map((s) => <li key={s}>{s}</li>)}</ul>
            </Section>
          )}

          {nearby.length > 0 && (
            <Section id="nearby" kicker="Worth the detour" title="Extraordinary nearby places" badge={<ProvBadge p="curated" />}>
              <div className="grid-cards">
                {nearby.map((n) => (
                  <article key={n.id} className="card poi">
                    <Link to={`/place/${n.id}`} aria-label={`Open ${n.name}`}><PlaceImage place={n} ratio="16 / 9" rounded={false} /></Link>
                    <div className="pcard-body">
                      <h3><Link className="plain" to={`/place/${n.id}`}>{n.name}</Link></h3>
                      <p className="small" style={{ margin: 0 }}>{n.summary}</p>
                      <div className="small muted">{formatDistance(haversineKm(place.kind === 'destination' ? place : (parent ?? place), n), units)} straight-line from {place.kind === 'destination' ? place.name.replace(/\s*\(.*\)/, '') : parent?.name.replace(/\s*\(.*\)/, '')} · real travel time varies</div>
                    </div>
                  </article>
                ))}
              </div>
            </Section>
          )}

          {curated && (place.localLife.length > 0 || place.food.length > 0) && (
            <Section id="local" kicker="Day to day" title="Living like a local" badge={<ProvBadge p="curated" />}>
              <ul className="bullets">{place.localLife.map((s) => <li key={s}>{s}</li>)}</ul>
              {place.food.length > 0 && <p className="small"><b>Food culture:</b> {place.food.map((f) => FOOD_LABELS[f].toLowerCase()).join(', ')}.</p>}
              <p className="small muted">General guidance, not a researched local guide. Use Suggest More below for real, nearby places.</p>
            </Section>
          )}

          {curated && (
            <Section id="longstay" kicker="One month to one year" title="Long-stay suitability">
              <div className="table-wrap">
                <table className="kvtable">
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.label}><th scope="row">{r.label}</th><td>{r.value}{r.note && <div className="small muted">{r.note}</div>}</td><td><ProvBadge p={r.prov} /></td></tr>
                    ))}
                    <tr><th scope="row">Safety</th><td>Not rated by GLOBA. <a href={`https://www.google.com/search?q=${encodeURIComponent(`${place.country} government travel advice`)}`} target="_blank" rel="noreferrer noopener">Check your government’s current travel advice</a>.</td><td><span className="badge">Not verified</span></td></tr>
                    <tr><th scope="row">Visa & residency</th><td>GLOBA does not check eligibility. Rules depend on your passport and change often — <a href={`https://www.google.com/search?q=${encodeURIComponent(`${place.country} official immigration visa requirements`)}`} target="_blank" rel="noreferrer noopener">find the official immigration site</a>.{place.research.map((r) => <div key={r} className="small muted">{r}</div>)}</td><td><span className="badge">Not verified</span></td></tr>
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {curated && (place.pros.length > 0 || place.cons.length > 0) && (
            <Section id="proscons" title="Pros and cons">
              <div className="proscons">
                <div><h3>Pros</h3><ul className="bullets plus">{place.pros.map((s) => <li key={s}>{s}</li>)}</ul></div>
                <div><h3>Cons</h3><ul className="bullets minus">{place.cons.map((s) => <li key={s}>{s}</li>)}</ul></div>
              </div>
            </Section>
          )}

          {curated && place.bestMonths.length > 0 && (
            <Section id="time" kicker="Seasons" title="Best time to visit — and to live there" badge={<ProvBadge p="estimate" />}>
              <SeasonStrip place={place} />
              <p>{place.climateNote}</p>
              <LiveWeather place={place} />
            </Section>
          )}
          {!curated && (
            <Section id="time" title="Weather"><LiveWeather place={place} /></Section>
          )}

          <Section id="stay" kicker="Where to sleep" title="Accommodation"><Accommodation place={place} /></Section>

          {curated && (
            <Section id="summary" title="Practical summary">
              <dl className="summary">
                <div><dt>Best reason to go</dt><dd>{REASON_LABELS[place.primaryReason]}</dd></div>
                <div><dt>Ideal stay</dt><dd>{place.idealStay.map((s) => STAY_LABELS[s]).join(' · ')}</dd></div>
                <div><dt>Best-fit style</dt><dd>{place.lifestyle.slice(0, 3).map((l) => LIFESTYLE_LABELS[l]).join(', ') || 'Flexible'}</dd></div>
                <div><dt>Main practical consideration</dt><dd>{place.cons[0] ?? '—'}</dd></div>
                <div><dt>Why we might love it</dt><dd>{place.special[0]}</dd></div>
                <div><dt>Research before committing</dt><dd>Real internet speeds, rent for your dates, visa options, and {place.practical.includes('car-free') ? 'the neighbourhood you’d live in' : 'whether you need a car'}.</dd></div>
              </dl>
            </Section>
          )}

          <SuggestMore place={place} initialCats={qs.get('suggest')?.split(',') ?? []} />

          <Section id="sources" title="Sources & confidence">
            <ul className="sources">
              {curated && <li><ProvBadge p="curated" /><span>GLOBA curated dataset — editorial knowledge, last reviewed {DATASET_DATE}. <b>Not live-verified.</b> Scores are 1–5 judgements; costs are rough estimates.</span></li>}
              {live?.summary && <li><ProvBadge p="live" /><span><a href={live.summary.url} target="_blank" rel="noreferrer noopener">Wikipedia: {live.summary.title}</a> (summary and photo; see the article for authors and licences).</span></li>}
              {place.wikiTitle && !live?.summary && <li><span className="badge">Link</span><span><a href={`https://en.wikipedia.org/wiki/${place.wikiTitle}`} target="_blank" rel="noreferrer noopener">Wikipedia article</a></span></li>}
              <li><ProvBadge p="live" /><span>Weather: Open-Meteo, when loaded. Places and nearby listings: OpenStreetMap contributors, when loaded. Each shows its own “checked” time.</span></li>
              <li><span className="badge">Unverified</span><span>Visa rules, safety, opening hours, prices and availability are not checked by GLOBA.</span></li>
            </ul>
            <button className="btn" onClick={showOnGlobe}><Icon name="globe" />View on globe</button>
          </Section>
        </div>

        <aside className="brief-side">
          <div className="card pad stack sticky">
            <h3>Location</h3>
            <Locator lat={place.lat} lng={place.lng} label={place.name} />
            <div className="small muted">{place.lat.toFixed(3)}°, {place.lng.toFixed(3)}°</div>
            <button className="btn" onClick={showOnGlobe}><Icon name="globe" />View on globe</button>
            <hr className="divider" />
            <h3>On this page</h3>
            <nav className="toc" aria-label="Brief sections">
              {curated && <a href="#why">Main reason</a>}{nearby.length > 0 && <a href="#nearby">Nearby</a>}{curated && <a href="#longstay">Long stay</a>}{curated && <a href="#time">Best time</a>}<a href="#stay">Accommodation</a><a href="#sm-title">Suggest More</a><a href="#sources">Sources</a>
            </nav>
          </div>
        </aside>
      </div>
      <AddToTripDialog place={addTo} onClose={() => setAddTo(null)} />
    </div>
  );
}
