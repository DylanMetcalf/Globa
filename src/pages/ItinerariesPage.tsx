import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Itinerary } from '../../shared/types';
import { Icon } from '../components/Icon';
import { PlaceArt, PlaceImage } from '../components/PlaceArt';
import { useStore } from '../store';
import { useUi } from '../store/ui';
import { useCatalog } from '../lib/hooks';
import { PURPOSE_LABELS } from '../lib/labels';
import { stopCount } from '../lib/itinerary';
import { fmtDate } from '../lib/format';
import { norm } from '../lib/discovery';

export const STATUS_LABEL = { idea: 'Idea', tentative: 'Tentative', committed: 'Committed', completed: 'Completed' } as const;

export function durationText(it: Itinerary): string {
  const d = it.durationDays;
  if (d >= 330) return 'about a year';
  if (d >= 60) return `about ${Math.round(d / 30)} months`;
  if (d >= 14 && d % 7 === 0) return `${d / 7} weeks`;
  return `${d} day${d === 1 ? '' : 's'}`;
}

function TripCard({ it, onDelete }: { it: Itinerary; onDelete: (it: Itinerary) => void }) {
  const { get } = useCatalog();
  const dup = useStore((s) => s.duplicateItinerary);
  const nav = useNavigate();
  const toast = useUi((s) => s.toast);
  const cover = get(it.coverPlaceId ?? it.stays[0]?.placeId);
  const dests = [...new Set(it.stays.map((s) => s.title))];
  return (
    <article className="card trip-card">
      <Link to={`/itineraries/${it.id}`} className="trip-cover" aria-label={`Open ${it.name}`}>
        {cover ? <PlaceImage place={cover} ratio="16 / 9" rounded={false} /> : <div className="place-img" style={{ aspectRatio: '16 / 9' }}><PlaceArt place={{ id: it.id, name: it.name, art: { hue: 215, motif: 'island' } }} /></div>}
        <span className={`badge status-${it.status}`}>{STATUS_LABEL[it.status]}</span>
      </Link>
      <div className="pcard-body">
        <h3><Link className="plain" to={`/itineraries/${it.id}`}>{it.name}</Link></h3>
        <div className="small muted">{dests.length ? dests.join(' → ') : 'No destination yet'}</div>
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="badge">{PURPOSE_LABELS[it.purpose]}</span>
          <span className="badge"><Icon name="calendar" width={12} height={12} />{it.startDate ? fmtDate(it.startDate) : 'Flexible dates'} · {durationText(it)}</span>
          <span className="badge">{stopCount(it)} stop{stopCount(it) === 1 ? '' : 's'} · {it.days.length} day{it.days.length === 1 ? '' : 's'}</span>
          {it.generatedBy !== 'manual' && <span className={`badge ${it.generatedBy === 'ai' ? 'ai' : 'demo'}`}>{it.generatedBy === 'ai' ? 'AI draft' : 'Demo draft'}</span>}
        </div>
        <div className="row wrap" style={{ gap: 6, marginTop: 'auto' }}>
          <button className="btn sm" onClick={() => nav(`/itineraries/${it.id}`)}><Icon name="edit" />Open</button>
          <button className="btn sm" onClick={() => { const id = dup(it.id); if (id) toast('Itinerary duplicated', { action: { label: 'Open', run: () => nav(`/itineraries/${id}`) } }); }}><Icon name="copy" />Duplicate</button>
          <button className="btn sm danger ghost" onClick={() => onDelete(it)} aria-label={`Delete ${it.name}`}><Icon name="trash" />Delete</button>
        </div>
      </div>
    </article>
  );
}

export default function ItinerariesPage() {
  const trips = useStore((s) => s.itineraries);
  const del = useStore((s) => s.deleteItinerary);
  const toast = useUi((s) => s.toast);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [purpose, setPurpose] = useState('');
  const [confirm, setConfirm] = useState<Itinerary | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);

  const list = useMemo(() => trips.filter((t) => (!status || t.status === status) && (!purpose || t.purpose === purpose) && (!q || norm(`${t.name} ${t.stays.map((s) => s.title).join(' ')} ${t.notes}`).includes(norm(q)))), [trips, q, status, purpose]);
  const ask = (t: Itinerary) => { setConfirm(t); setTimeout(() => dlg.current?.showModal(), 0); };

  return (
    <div className="page"><div className="page-inner">
      <header className="page-head">
        <div><div className="eyebrow">Itineraries</div><h1>Turn ideas into plans</h1><p>From a long weekend to six months across three countries. Everything is built from the same places you save and explore.</p></div>
        <Link to="/itineraries/new" className="btn primary"><Icon name="plus" />New itinerary</Link>
      </header>

      {trips.length === 0 ? (
        <div className="empty">
          <svg className="art" viewBox="0 0 120 90" aria-hidden="true"><path d="M20 70c20-40 40 10 60-30 8-16 16-14 20-10" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 9" /><circle cx="20" cy="70" r="7" fill="var(--st-planned)" /><circle cx="100" cy="30" r="9" fill="var(--st-activated)" /></svg>
          <h3>No itineraries yet</h3><p>Start with a few questions and we’ll draft a day-by-day plan you can edit — or add a place to a new itinerary from anywhere in the app.</p>
          <div className="row" style={{ justifyContent: 'center' }}><Link className="btn primary" to="/itineraries/new"><Icon name="plus" />Plan something</Link><Link className="btn" to="/discover">Find a destination first</Link></div>
        </div>
      ) : (
        <>
          <div className="row wrap saved-toolbar">
            <div className="searchfield small-field grow" style={{ minWidth: 200 }}><Icon name="search" /><input className="searchinput" placeholder="Search itineraries…" aria-label="Search itineraries" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className="input sm auto" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select className="input sm auto" aria-label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)}><option value="">Any purpose</option>{Object.entries(PURPOSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </div>
          {list.length === 0 ? <div className="empty"><h3>Nothing matches</h3><button className="btn" onClick={() => { setQ(''); setStatus(''); setPurpose(''); }}>Clear filters</button></div> : <div className="grid-cards trips-grid">{list.map((t) => <TripCard key={t.id} it={t} onDelete={ask} />)}</div>}
        </>
      )}

      <dialog ref={dlg} className="modal" onClose={() => setConfirm(null)} aria-labelledby="del-title">
        <div className="stack">
          <h2 id="del-title" style={{ fontSize: '1.3rem' }}>Delete “{confirm?.name}”?</h2>
          <p className="muted">This removes the itinerary and its {confirm ? stopCount(confirm) : 0} stops from this browser. Saved places are not affected. You can undo right after.</p>
          <div className="row spread"><button className="btn ghost" onClick={() => dlg.current?.close()}>Keep it</button>
            <button className="btn danger" onClick={() => { if (confirm) { const snap = confirm; del(snap.id); toast(`Deleted ${snap.name}`, { action: { label: 'Undo', run: () => useStore.getState().addItinerary(snap) } }); } dlg.current?.close(); }}>Delete</button></div>
        </div>
      </dialog>
    </div></div>
  );
}
