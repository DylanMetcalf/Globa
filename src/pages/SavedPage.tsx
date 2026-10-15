import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Place, Priority, SavedPlace, SavedStatus } from '../../shared/types';
import { Icon } from '../components/Icon';
import { RunningCouple } from '../components/Mascots';
import { PlaceImage } from '../components/PlaceArt';
import { AddToTripDialog, LitPill, announce } from '../components/PlaceBits';
import { useStore, priorityOrder } from '../store';
import { useUi } from '../store/ui';
import { useCatalog } from '../lib/hooks';
import { itineraryPlaceIds } from '../lib/itinerary';
import { ENV_LABELS } from '../lib/labels';
import { STATE_COLOR } from '../lib/markers';
import { fmtDate } from '../lib/format';
import { norm } from '../lib/discovery';

type Tab = 'all' | SavedStatus | 'lit';
type Group = 'none' | 'country' | 'destination';

const STATUS_COPY: Record<SavedStatus, { label: string; blurb: string; color: string }> = {
  saved: { label: 'Considering', blurb: 'Places we are thinking about', color: STATE_COLOR.saved },
  planned: { label: 'Planned', blurb: 'Places we intend to visit', color: STATE_COLOR.planned },
  visited: { label: 'Visited', blurb: 'Places we have actually experienced', color: STATE_COLOR.visited },
};

function SavedCard({ place, entry, onAddTrip }: { place: Place; entry: SavedPlace; onAddTrip: (p: Place) => void }) {
  const nav = useNavigate();
  const update = useStore((s) => s.updateSaved);
  const setStatus = useStore((s) => s.setStatus);
  const unsave = useStore((s) => s.unsavePlace);
  const save = useStore((s) => s.savePlace);
  const sync = useStore((s) => s.syncAchievements);
  const trips = useStore((s) => s.itineraries);
  const lit = useStore((s) => s.activations.some((a) => a.placeId === place.id));
  const people = useStore((s) => s.profiles);
  const toast = useUi((s) => s.toast);
  const requestFocus = useUi((s) => s.requestFocus);
  const select = useUi((s) => s.select);
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState('');
  const inTrips = trips.filter((t) => itineraryPlaceIds(t).includes(place.id));
  const by = people.find((p) => p.id === entry.addedBy);

  const remove = () => {
    const snap = entry;
    unsave(place.id);
    toast(`Removed ${place.name}`, { action: { label: 'Undo', run: () => { save(place.id, { place, status: snap.status }); update(place.id, { notes: snap.notes, tags: snap.tags, priority: snap.priority }); } } });
  };
  const changeStatus = (st: SavedStatus) => { setStatus(place.id, st); announce(sync()); if (st === 'visited') toast(`Marked ${place.name} as visited`); };

  return (
    <article className="card saved-card">
      <Link to={`/place/${place.id}`} className="saved-img" aria-label={`Open ${place.name}`}><PlaceImage place={place} ratio="4 / 3" rounded={false} /></Link>
      <div className="saved-body">
        <div className="row spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3><Link className="plain" to={`/place/${place.id}`}>{place.name}</Link></h3>
            <div className="small muted">{[place.region.split(',')[0], place.country].filter(Boolean).join(', ')} · saved {fmtDate(entry.savedAt)}{by && ` by ${by.name}`}</div>
          </div>
          <LitPill lit={lit} />
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <label className="mini-field"><span>Status</span>
            <select className="input sm" value={entry.status} onChange={(e) => changeStatus(e.target.value as SavedStatus)} aria-label={`Status of ${place.name}`}>
              <option value="saved">Considering</option><option value="planned">Planned</option><option value="visited">Visited</option></select></label>
          <label className="mini-field"><span>Priority</span>
            <select className="input sm" value={entry.priority} onChange={(e) => update(place.id, { priority: e.target.value as Priority })} aria-label={`Priority of ${place.name}`}>
              <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          {entry.tags.map((t) => <button key={t} className="chip on" onClick={() => update(place.id, { tags: entry.tags.filter((x) => x !== t) })} aria-label={`Remove tag ${t}`}>{t}<Icon name="close" className="x" /></button>)}
          <form className="row" style={{ gap: 4 }} onSubmit={(e) => { e.preventDefault(); const t = tag.trim().toLowerCase(); if (t && !entry.tags.includes(t)) update(place.id, { tags: [...entry.tags, t] }); setTag(''); }}>
            <input className="input sm tag-input" placeholder="+ tag" aria-label={`Add tag to ${place.name}`} value={tag} onChange={(e) => setTag(e.target.value)} />
          </form>
        </div>
        {inTrips.length > 0 && <div className="row wrap" style={{ gap: 6 }}><span className="small muted">In:</span>{inTrips.map((t) => <Link key={t.id} to={`/itineraries/${t.id}`} className="chip static" style={{ textDecoration: 'none' }}><Icon name="trips" width={12} height={12} />{t.name}</Link>)}</div>}
        <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} aria-expanded={open} onClick={() => setOpen((v) => !v)}><Icon name="edit" />{entry.notes ? 'Notes' : 'Add notes'}</button>
        {open && <textarea className="input" rows={3} placeholder="Why do we love it? What to check?" value={entry.notes} aria-label={`Notes for ${place.name}`} onChange={(e) => update(place.id, { notes: e.target.value })} />}
        {!open && entry.notes && <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{entry.notes}</p>}
        <div className="row wrap" style={{ gap: 6, marginTop: 'auto' }}>
          <button className="btn sm gold" onClick={() => nav(`/light/${place.id}`)}><Icon name="bulb" />{lit ? 'Light again' : 'Light it up'}</button>
          <button className="btn sm" onClick={() => onAddTrip(place)}><Icon name="trips" />Itinerary</button>
          <button className="btn sm" onClick={() => { select(place.id); requestFocus({ lat: place.lat, lng: place.lng, alt: 0.8 }); nav('/'); }}><Icon name="globe" />Globe</button>
          <button className="btn sm danger ghost" onClick={remove} aria-label={`Remove ${place.name} from saved`}><Icon name="trash" />Remove</button>
        </div>
      </div>
    </article>
  );
}

export default function SavedPage() {
  const saved = useStore((s) => s.saved);
  const activations = useStore((s) => s.activations);
  const { get } = useCatalog();
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'priority' | 'name'>('recent');
  const [group, setGroup] = useState<Group>('none');
  const [tagF, setTagF] = useState('');
  const [envF, setEnvF] = useState('');
  const [addTo, setAddTo] = useState<Place | null>(null);

  const litIds = useMemo(() => new Set(activations.map((a) => a.placeId)), [activations]);
  const entries = useMemo(() => Object.values(saved).map((e) => ({ e, p: get(e.placeId) })).filter((x): x is { e: SavedPlace; p: Place } => !!x.p), [saved, get]);
  const counts = { saved: entries.filter((x) => x.e.status === 'saved').length, planned: entries.filter((x) => x.e.status === 'planned').length, visited: entries.filter((x) => x.e.status === 'visited').length, lit: entries.filter((x) => litIds.has(x.p.id)).length };
  const allTags = useMemo(() => [...new Set(entries.flatMap((x) => x.e.tags))].sort(), [entries]);
  const allEnv = useMemo(() => [...new Set(entries.flatMap((x) => x.p.env))].sort(), [entries]);

  const list = useMemo(() => {
    const nq = norm(q);
    let r = entries.filter(({ e, p }) =>
      (tab === 'all' || (tab === 'lit' ? litIds.has(p.id) : e.status === tab)) &&
      (!nq || norm(`${p.name} ${p.country} ${p.region} ${e.notes} ${e.tags.join(' ')}`).includes(nq)) &&
      (!tagF || e.tags.includes(tagF)) && (!envF || p.env.includes(envF as never)));
    r = [...r].sort((a, b) => sort === 'name' ? a.p.name.localeCompare(b.p.name) : sort === 'priority' ? priorityOrder[a.e.priority] - priorityOrder[b.e.priority] || b.e.savedAt.localeCompare(a.e.savedAt) : b.e.savedAt.localeCompare(a.e.savedAt));
    return r;
  }, [entries, tab, q, sort, tagF, envF, litIds]);

  const groups = useMemo(() => {
    if (group === 'none') return [['', list] as const];
    const m = new Map<string, typeof list>();
    for (const x of list) {
      const key = group === 'country' ? x.p.country : (get(x.p.parentId)?.name ?? x.p.name);
      m.set(key, [...(m.get(key) ?? []), x]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [list, group, get]);

  if (!entries.length) {
    return (
      <div className="page"><div className="page-inner">
        <header className="page-head"><div><div className="eyebrow">Saved places</div><h1>Our collection</h1></div></header>
        <div className="empty"><RunningCouple size={132} className="art" />
          <h3>Nothing saved yet</h3><p>Save places from the globe, a destination brief or Discover. Every place you save becomes a possibility.</p>
          <div className="row" style={{ justifyContent: 'center' }}><Link className="btn primary" to="/"><Icon name="globe" />Explore the globe</Link><Link className="btn" to="/discover"><Icon name="discover" />Discover places</Link></div></div>
      </div></div>
    );
  }

  return (
    <div className="page"><div className="page-inner">
      <header className="page-head">
        <div><div className="eyebrow">Saved places · shared by Dylan & Nicole</div><h1>Our collection</h1><p>Considering, planned and visited are different things — and lighting a place up in the miniature world never counts as visiting it.</p></div>
      </header>

      <div className="status-trio">
        {(Object.keys(STATUS_COPY) as SavedStatus[]).map((s) => (
          <button key={s} className={`trio-card ${tab === s ? 'on' : ''}`} aria-pressed={tab === s} onClick={() => setTab(tab === s ? 'all' : s)} style={{ ['--c' as string]: STATUS_COPY[s].color }}>
            <span className="trio-n">{counts[s]}</span><span><b>{STATUS_COPY[s].label}</b><br /><span className="small muted">{STATUS_COPY[s].blurb}</span></span>
          </button>
        ))}
      </div>

      <div className="row wrap saved-toolbar">
        <div className="seg" role="tablist" aria-label="Filter by status">
          {(['all', 'saved', 'planned', 'visited', 'lit'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === 'all' ? `All ${entries.length}` : t === 'lit' ? `Lit up ${counts.lit}` : STATUS_COPY[t].label}</button>
          ))}
        </div>
        <div className="searchfield small-field grow" style={{ minWidth: 200 }}><Icon name="search" /><input className="searchinput" placeholder="Search saved places, notes, tags…" aria-label="Search saved places" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input sm auto" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="recent">Newest first</option><option value="priority">Priority</option><option value="name">Name</option></select>
        <select className="input sm auto" aria-label="Group" value={group} onChange={(e) => setGroup(e.target.value as Group)}><option value="none">No grouping</option><option value="country">Group by country</option><option value="destination">Group by destination</option></select>
        {allTags.length > 0 && <select className="input sm auto" aria-label="Tag" value={tagF} onChange={(e) => setTagF(e.target.value)}><option value="">Any tag</option>{allTags.map((t) => <option key={t}>{t}</option>)}</select>}
        {allEnv.length > 0 && <select className="input sm auto" aria-label="Category" value={envF} onChange={(e) => setEnvF(e.target.value)}><option value="">Any category</option>{allEnv.map((t) => <option key={t} value={t}>{ENV_LABELS[t]}</option>)}</select>}
      </div>

      {list.length === 0 ? <div className="empty"><h3>No saved place matches</h3><p>Try clearing the search or filters.</p><button className="btn" onClick={() => { setQ(''); setTab('all'); setTagF(''); setEnvF(''); }}>Clear filters</button></div> : groups.map(([name, items]) => (
        <section key={name || 'all'} className="stack" style={{ marginBottom: 'var(--s-6)' }}>
          {name && <h2 style={{ fontSize: '1.3rem' }}>{name} <span className="muted small">· {items.length}</span></h2>}
          <div className="saved-grid">{items.map(({ e, p }) => <SavedCard key={p.id} place={p} entry={e} onAddTrip={setAddTo} />)}</div>
        </section>
      ))}
      <AddToTripDialog place={addTo} onClose={() => setAddTo(null)} />
    </div></div>
  );
}
