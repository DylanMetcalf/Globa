import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Day, Itinerary, Place, Stay, Stop, StopKind } from '../../shared/types';
import { Icon, type IconName } from '../components/Icon';
import { PlaceImage } from '../components/PlaceArt';
import { PlacePicker } from '../components/PlacePicker';
import { TripMap } from '../components/TripMap';
import { ProvBadge } from '../components/PlaceBits';
import { useStore } from '../store';
import { useUi } from '../store/ui';
import { useCatalog } from '../lib/hooks';
import { PURPOSE_LABELS, STOP_LABELS, CURRENCIES } from '../lib/labels';
import {
  addDay, addStop, generateDraft, moveStop, newStay, newStop, nudgeStop, overlaps, removeDay, removeStop, replaceDayStops, stopCount, totalEstimatedCost, updateStop,
} from '../lib/itinerary';
import { fmtDate, money, usdTo } from '../lib/format';
import { STATUS_LABEL, durationText } from './ItinerariesPage';

const KIND_ICON: Record<StopKind, IconName> = { place: 'pin', food: 'food', coffee: 'coffee', activity: 'compass', transport: 'right', rest: 'sun', work: 'wifi', accommodation: 'bed', note: 'edit' };

type PickTarget = { kind: 'stop'; dayId: string } | { kind: 'replace'; stopId: string } | { kind: 'stay'; stayId: string } | { kind: 'new-stay' } | null;

function StopRow({ it, day, stop, idx, dragId, setDragId, onChange, onPickReplace, dest }: {
  it: Itinerary; day: Day; stop: Stop; idx: number; dragId: string | null; setDragId: (id: string | null) => void;
  onChange: (fn: (it: Itinerary) => Itinerary) => void; onPickReplace: () => void; dest: (id?: string) => Place | undefined;
}) {
  const [open, setOpen] = useState(false);
  const clash = overlaps(day).has(stop.id);
  const place = dest(stop.placeId);
  const first = it.days[0].id === day.id && idx === 0;
  const lastDay = it.days[it.days.length - 1].id === day.id && idx === day.stops.length - 1;
  return (
    <li
      className={`stop ${dragId === stop.id ? 'dragging' : ''}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', stop.id); e.dataTransfer.effectAllowed = 'move'; setDragId(stop.id); }}
      onDragEnd={() => setDragId(null)}
      onDragOver={(e) => { if (dragId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const id = e.dataTransfer.getData('text/plain'); if (id && id !== stop.id) onChange((t) => moveStop(t, id, day.id, idx)); setDragId(null); }}
    >
      <div className="stop-main">
        <span className="drag" aria-hidden="true" title="Drag to reorder"><Icon name="drag" /></span>
        <span className={`stop-kind k-${stop.kind}`} title={STOP_LABELS[stop.kind]}><Icon name={KIND_ICON[stop.kind]} /></span>
        <input className="input sm time" type="time" aria-label={`Start time for ${stop.title}`} value={stop.startTime} onChange={(e) => onChange((t) => updateStop(t, stop.id, { startTime: e.target.value }))} />
        <div className="grow stop-title">
          <input className="input sm" aria-label="Stop title" value={stop.title} onChange={(e) => onChange((t) => updateStop(t, stop.id, { title: e.target.value }))} />
          <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
            {place && <Link to={`/place/${place.id}`} className="badge curated" style={{ textDecoration: 'none' }}>{place.name} brief</Link>}
            {stop.provenance !== 'user' && <ProvBadge p={stop.provenance} />}
            {clash && <span className="badge estimate" role="status"><Icon name="warn" width={12} height={12} />Overlaps another stop</span>}
          </div>
        </div>
        <label className="dur"><span className="sr-only">Duration in minutes</span><input className="input sm" type="number" min={5} step={5} value={stop.durationMin} onChange={(e) => onChange((t) => updateStop(t, stop.id, { durationMin: Math.max(5, Number(e.target.value) || 5) }))} /><span className="small muted">min</span></label>
        <div className="stop-ctl">
          <button className="btn icon sm ghost" onClick={() => onChange((t) => nudgeStop(t, stop.id, -1))} disabled={first} aria-label={`Move ${stop.title} up`}><Icon name="up" /></button>
          <button className="btn icon sm ghost" onClick={() => onChange((t) => nudgeStop(t, stop.id, 1))} disabled={lastDay} aria-label={`Move ${stop.title} down`}><Icon name="down" /></button>
          <button className="btn icon sm ghost" aria-expanded={open} onClick={() => setOpen(!open)} aria-label={`Details for ${stop.title}`}><Icon name="chevron" style={{ transform: open ? 'rotate(180deg)' : undefined }} /></button>
        </div>
      </div>
      {open && (
        <div className="stop-more">
          <div className="grid-prefs">
            <label className="field"><span className="label">Move to day</span>
              <select className="input sm" value={day.id} onChange={(e) => onChange((t) => moveStop(t, stop.id, e.target.value))}>{it.days.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
            <label className="field"><span className="label">Type</span>
              <select className="input sm" value={stop.kind} onChange={(e) => onChange((t) => updateStop(t, stop.id, { kind: e.target.value as StopKind }))}>{Object.entries(STOP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="field"><span className="label">Estimated cost ({it.budget?.currency ?? 'your currency'})</span>
              <input className="input sm" type="number" min={0} placeholder="optional" value={stop.cost ?? ''} onChange={(e) => onChange((t) => updateStop(t, stop.id, { cost: e.target.value === '' ? undefined : Number(e.target.value), provenance: 'user' }))} /></label>
            <label className="field"><span className="label">Link</span>
              <input className="input sm" type="url" placeholder="https://…" value={stop.link ?? ''} onChange={(e) => onChange((t) => updateStop(t, stop.id, { link: e.target.value || undefined }))} /></label>
          </div>
          <label className="field"><span className="label">Notes</span><textarea className="input" rows={2} value={stop.notes} onChange={(e) => onChange((t) => updateStop(t, stop.id, { notes: e.target.value }))} /></label>
          <div className="row wrap" style={{ gap: 6 }}>
            {stop.link && <a className="btn sm" href={stop.link} target="_blank" rel="noreferrer noopener">Open link<Icon name="external" /></a>}
            <button className="btn sm" onClick={onPickReplace}><Icon name="refresh" />Replace with another place</button>
            <button className="btn sm danger ghost" onClick={() => onChange((t) => removeStop(t, stop.id))}><Icon name="trash" />Remove stop</button>
          </div>
        </div>
      )}
    </li>
  );
}

function StayCard({ it, stay, index, onChange, onPick, onRemove, placeOf }: { it: Itinerary; stay: Stay; index: number; onChange: (p: Partial<Stay>) => void; onPick: () => void; onRemove: () => void; placeOf: Place | undefined }) {
  const fx = useUi((s) => s.fx);
  const currency = useStore((s) => s.settings.currency);
  const est = placeOf?.monthlyCostUSD;
  return (
    <article className="card pad stack stay">
      <div className="row spread wrap">
        <div className="row"><span className="stay-n">{index + 1}</span><input className="input stay-title" aria-label="Stay title" value={stay.title} onChange={(e) => onChange({ title: e.target.value })} /></div>
        <div className="seg" role="group" aria-label="Plan certainty">
          <button aria-pressed={!stay.committed} onClick={() => onChange({ committed: false })}>Tentative</button>
          <button aria-pressed={stay.committed} onClick={() => onChange({ committed: true })}>Committed</button>
        </div>
      </div>
      <div className="grid-prefs">
        <div className="field"><span className="label">Place</span><button className="btn" onClick={onPick}>{placeOf ? placeOf.name : 'Choose a place'}</button></div>
        <label className="field"><span className="label">Planned arrival</span><input className="input" type="date" value={stay.arrive ?? ''} onChange={(e) => onChange({ arrive: e.target.value || undefined })} /></label>
        <label className="field"><span className="label">Planned departure</span><input className="input" type="date" value={stay.depart ?? ''} onChange={(e) => onChange({ depart: e.target.value || undefined })} /></label>
        <label className="field"><span className="label">Length (days)</span><input className="input" type="number" min={1} value={stay.days} onChange={(e) => onChange({ days: Math.max(1, Number(e.target.value) || 1) })} /></label>
        <label className="field"><span className="label">Estimated monthly living cost (USD) <span className="badge estimate">Estimate</span></span>
          <input className="input" type="number" min={0} placeholder={est ? `${est[0]}–${est[1]} curated` : 'unknown'} value={stay.monthlyCost ?? ''} onChange={(e) => onChange({ monthlyCost: e.target.value === '' ? undefined : Number(e.target.value) })} />
          {stay.monthlyCost ? <span className="small muted">≈ {usdTo(stay.monthlyCost, currency, fx?.toUSD).text}</span> : est && <button className="plainbtn small" style={{ color: 'var(--accent)', textAlign: 'left', padding: 0 }} onClick={() => onChange({ monthlyCost: Math.round((est[0] + est[1]) / 2) })}>Use the curated midpoint (${Math.round((est[0] + est[1]) / 2).toLocaleString()})</button>}</label>
        <label className="field"><span className="label">Internet suitability</span>
          <select className="input" value={stay.internet} onChange={(e) => onChange({ internet: e.target.value as Stay['internet'] })}><option value="">Unknown</option><option value="poor">Poor</option><option value="ok">OK</option><option value="good">Good</option><option value="excellent">Excellent</option></select></label>
      </div>
      <label className="field"><span className="label">Accommodation research</span><textarea className="input" rows={2} placeholder="Listings you’re considering, neighbourhoods, hosts to ask…" value={stay.accommodation} onChange={(e) => onChange({ accommodation: e.target.value })} /></label>
      <label className="field"><span className="label">Accommodation link</span><input className="input" type="url" placeholder="https://…" value={stay.accommodationLink ?? ''} onChange={(e) => onChange({ accommodationLink: e.target.value || undefined })} /></label>
      <div className="grid-prefs">
        <label className="field"><span className="label">Transport considerations</span><textarea className="input" rows={2} value={stay.transport} onChange={(e) => onChange({ transport: e.target.value })} /></label>
        <label className="field"><span className="label">Work-friendly locations</span><textarea className="input" rows={2} value={stay.workNotes} onChange={(e) => onChange({ workNotes: e.target.value })} /></label>
      </div>
      <label className="field"><span className="label">Research notes</span><textarea className="input" rows={2} value={stay.notes} onChange={(e) => onChange({ notes: e.target.value })} /></label>
      <div className="row spread wrap">
        <span className="small muted">{it.stays.length > 1 && 'Stays run in the order shown. '}Visa and residency rules are not checked by GLOBA.</span>
        <button className="btn sm danger ghost" onClick={onRemove}><Icon name="trash" />Remove stay</button>
      </div>
    </article>
  );
}

export default function ItineraryPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { get, places } = useCatalog();
  const it = useStore((s) => s.itineraries.find((x) => x.id === id));
  const update = useStore((s) => s.updateItinerary);
  const del = useStore((s) => s.deleteItinerary);
  const dup = useStore((s) => s.duplicateItinerary);
  const toast = useUi((s) => s.toast);
  const fx = useUi((s) => s.fx);
  const loadFx = useUi((s) => s.loadFx);
  const saved = useStore((s) => s.saved);
  const me = useStore((s) => s.activeProfileId);
  const [tab, setTab] = useState<'days' | 'stays' | 'notes'>('days');
  const [dragId, setDragId] = useState<string | null>(null);
  const [pick, setPick] = useState<PickTarget>(null);
  const [freeAdd, setFreeAdd] = useState<string | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);

  const change = (fn: (t: Itinerary) => Itinerary) => id && update(id, fn);
  const mapPoints = useMemo(() => {
    if (!it) return [];
    const pts: { place: Place; n: number }[] = [];
    let n = 1;
    it.days.forEach((d) => d.stops.forEach((s) => { const p = get(s.placeId); if (p) pts.push({ place: p, n: n++ }); }));
    if (!pts.length) it.stays.forEach((s) => { const p = get(s.placeId); if (p) pts.push({ place: p, n: n++ }); });
    return pts;
  }, [it, get]);

  if (!it) return <div className="page"><div className="page-inner"><div className="empty"><h3>Itinerary not found</h3><p>It may have been deleted, or it lives in another browser.</p><Link className="btn primary" to="/itineraries">All itineraries</Link></div></div></div>;

  const cover = get(it.coverPlaceId ?? it.stays[0]?.placeId);
  const cost = totalEstimatedCost(it);
  const livingEst = it.stays.reduce((n, s) => n + (s.monthlyCost ? (s.monthlyCost * s.days) / 30 : 0), 0);
  const cur = it.budget?.currency ?? 'USD';

  const onPick = (p: Place) => {
    if (!pick) return;
    if (pick.kind === 'stop') change((t) => addStop(t, pick.dayId, newStop({ title: p.name, placeId: p.id, kind: 'place', durationMin: p.kind === 'poi' ? 150 : 120, notes: p.tagline })));
    else if (pick.kind === 'replace') change((t) => updateStop(t, pick.stopId, { title: p.name, placeId: p.id, notes: p.tagline, provenance: 'user' }));
    else if (pick.kind === 'stay') change((t) => ({ ...t, stays: t.stays.map((s) => (s.id === pick.stayId ? { ...s, placeId: p.id, title: p.name.replace(/\s*\(.*\)/, '') } : s)) }));
    else change((t) => ({ ...t, stays: [...t.stays, newStay({ title: p.name.replace(/\s*\(.*\)/, ''), placeId: p.id, days: 14 })], coverPlaceId: t.coverPlaceId ?? p.id }));
    if (!saved[p.id]) toast(`${p.name} added. Save it to keep it in your collection.`, { action: { label: 'Save', run: () => useStore.getState().savePlace(p.id, { place: p, status: 'planned' }) } });
    else if (saved[p.id].status === 'saved') useStore.getState().setStatus(p.id, 'planned');
  };

  const regenerate = (day: Day) => {
    const stay = it.stays.find((s) => s.id === day.stayId) ?? it.stays[0];
    const draft = generateDraft({ purpose: it.purpose, destinationIds: stay?.placeId ? [stay.placeId] : [], flexibleDates: true, durationDays: 1, focus: it.focus, pace: it.pace, includeSaved: Object.keys(saved), createdBy: me, offset: Math.floor(Math.random() * 6) }, places);
    const stops = draft.days[0]?.stops ?? [];
    change((t) => replaceDayStops(t, day.id, stops));
    toast(`Regenerated ${day.label} (offline draft). Suggestions only.`);
  };
  const addFree = (dayId: string, kind: StopKind) => {
    const defaults: Partial<Record<StopKind, { title: string; dur: number }>> = { food: { title: 'Dinner — choose a local spot', dur: 90 }, coffee: { title: 'Coffee break', dur: 45 }, accommodation: { title: 'Check in', dur: 30 }, note: { title: 'Note', dur: 10 }, work: { title: 'Focus work block', dur: 180 }, transport: { title: 'Travel', dur: 60 }, rest: { title: 'Rest', dur: 60 } };
    const d = defaults[kind] ?? { title: 'New stop', dur: 60 };
    change((t) => addStop(t, dayId, newStop({ kind, title: d.title, durationMin: d.dur })));
    setFreeAdd(null);
  };

  return (
    <div className="page"><div className="page-inner">
      <Link to="/itineraries" className="btn sm ghost" style={{ alignSelf: 'flex-start', marginBottom: 12 }}><Icon name="left" />All itineraries</Link>
      <div className="trip-hero card">
        <div className="trip-hero-img">{cover ? <PlaceImage place={cover} ratio="21 / 6" rounded={false} showCredit /> : <div style={{ aspectRatio: '21 / 6', background: 'var(--accent-soft)' }} />}</div>
        <div className="trip-hero-body">
          <input className="trip-name" aria-label="Itinerary name" value={it.name} onChange={(e) => change((t) => ({ ...t, name: e.target.value }))} />
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="badge">{PURPOSE_LABELS[it.purpose]}</span>
            <span className="badge"><Icon name="calendar" width={12} height={12} />{it.startDate ? fmtDate(it.startDate) : 'Flexible dates'} · {durationText(it)}</span>
            <span className="badge">{stopCount(it)} stops · {it.days.length} days · {it.stays.length} stay{it.stays.length === 1 ? '' : 's'}</span>
            {it.generatedBy !== 'manual' && <span className={`badge ${it.generatedBy === 'ai' ? 'ai' : 'demo'}`}>{it.generatedBy === 'ai' ? 'AI draft — suggestions' : 'Demo draft — suggestions'}</span>}
            <span className="badge live" title="Changes are saved to this browser as you type"><Icon name="check" width={12} height={12} />Saved locally</span>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <label className="row small"><span className="muted">Status</span><select className="input sm auto" value={it.status} onChange={(e) => change((t) => ({ ...t, status: e.target.value as Itinerary['status'] }))}>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="row small"><span className="muted">Pace</span><select className="input sm auto" value={it.pace} onChange={(e) => change((t) => ({ ...t, pace: e.target.value as Itinerary['pace'] }))}><option value="relaxed">Relaxed</option><option value="balanced">Balanced</option><option value="packed">Packed</option></select></label>
            <label className="row small"><span className="muted">Purpose</span><select className="input sm auto" value={it.purpose} onChange={(e) => change((t) => ({ ...t, purpose: e.target.value as Itinerary['purpose'] }))}>{Object.entries(PURPOSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="row small"><span className="muted">Start</span><input className="input sm auto" type="date" value={it.startDate ?? ''} onChange={(e) => change((t) => ({ ...t, startDate: e.target.value || undefined, flexibleDates: !e.target.value }))} /></label>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn sm" onClick={() => { const nid = dup(it.id); if (nid) { toast('Duplicated'); nav(`/itineraries/${nid}`); } }}><Icon name="copy" />Duplicate</button>
            <button className="btn sm danger ghost" onClick={() => dlg.current?.showModal()}><Icon name="trash" />Delete</button>
          </div>
        </div>
      </div>

      {it.assumptions.length > 0 && (
        <details className="notice" style={{ marginTop: 16 }} open={it.generatedBy !== 'manual'}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Assumptions & what is not verified ({it.assumptions.length})</summary>
          <ul className="bullets" style={{ marginTop: 8 }}>{it.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </details>
      )}

      <div className="trip-grid">
        <div className="stack" style={{ minWidth: 0 }}>
          <div className="tabs" role="tablist" aria-label="Itinerary sections">
            {([['days', `Days (${it.days.length})`], ['stays', `Stays (${it.stays.length})`], ['notes', 'Notes & budget']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
          </div>

          {tab === 'days' && (
            <div className="stack" style={{ gap: 'var(--s-5)' }}>
              {it.stays.length > 0 && it.durationDays > 21 && <div className="notice info"><Icon name="info" />This is a long stay: days show a typical rhythm for each stay, not every day of {durationText(it)}.</div>}
              {it.days.map((d) => (
                <section key={d.id} className={`card day ${dragId ? 'drop-ready' : ''}`} aria-label={d.label}
                  onDragOver={(e) => { if (dragId) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); const sid = e.dataTransfer.getData('text/plain'); if (sid) change((t) => moveStop(t, sid, d.id)); setDragId(null); }}>
                  <div className="day-head">
                    <input className="day-title" aria-label="Day label" value={d.label} onChange={(e) => change((t) => ({ ...t, days: t.days.map((x) => (x.id === d.id ? { ...x, label: e.target.value } : x)) }))} />
                    {it.stays.length > 1 && <select className="input sm auto" aria-label={`Stay for ${d.label}`} value={d.stayId ?? ''} onChange={(e) => change((t) => ({ ...t, days: t.days.map((x) => (x.id === d.id ? { ...x, stayId: e.target.value || undefined } : x)) }))}><option value="">No stay</option>{it.stays.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>}
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn sm ghost" onClick={() => regenerate(d)} title="Replace this day’s stops with a fresh offline suggestion"><Icon name="refresh" />Regenerate</button>
                      <button className="btn icon sm ghost danger" aria-label={`Remove ${d.label}`} onClick={() => change((t) => removeDay(t, d.id))}><Icon name="trash" /></button>
                    </div>
                  </div>
                  <ul className="stops">
                    {d.stops.map((s, i) => <StopRow key={s.id} it={it} day={d} stop={s} idx={i} dragId={dragId} setDragId={setDragId} onChange={change} onPickReplace={() => setPick({ kind: 'replace', stopId: s.id })} dest={get} />)}
                    {d.stops.length === 0 && <li className="muted small" style={{ padding: 12 }}>No stops yet. Add one below, or drop a stop here.</li>}
                  </ul>
                  <div className="row wrap day-add">
                    <button className="btn sm" onClick={() => setPick({ kind: 'stop', dayId: d.id })}><Icon name="plus" />Add place</button>
                    <button className="btn sm" onClick={() => addFree(d.id, 'food')}><Icon name="food" />Meal</button>
                    <button className="btn sm" onClick={() => addFree(d.id, 'coffee')}><Icon name="coffee" />Coffee</button>
                    <button className="btn sm" onClick={() => addFree(d.id, 'accommodation')}><Icon name="bed" />Accommodation</button>
                    <button className="btn sm ghost" aria-expanded={freeAdd === d.id} onClick={() => setFreeAdd(freeAdd === d.id ? null : d.id)}>More…</button>
                    {freeAdd === d.id && (['work', 'transport', 'rest', 'activity', 'note'] as StopKind[]).map((k) => <button key={k} className="chip" onClick={() => addFree(d.id, k)}>{STOP_LABELS[k]}</button>)}
                  </div>
                </section>
              ))}
              <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => change((t) => addDay(t, undefined, t.stays[t.stays.length - 1]?.id))}><Icon name="plus" />Add a day</button>
              <p className="small muted">Drag stops by the handle, or use the arrow buttons and “Move to day” — both work with the keyboard. Times and costs are suggestions you can edit.</p>
            </div>
          )}

          {tab === 'stays' && (
            <div className="stack" style={{ gap: 'var(--s-5)' }}>
              <div className="notice info"><Icon name="info" />Plan stays across countries, regions and towns. Marked <b>Tentative</b> until you commit. Cost figures are estimates; GLOBA does not check visas or residency.</div>
              {it.stays.map((s, i) => (
                <StayCard key={s.id} it={it} stay={s} index={i} placeOf={get(s.placeId)} onPick={() => setPick({ kind: 'stay', stayId: s.id })}
                  onChange={(p) => change((t) => ({ ...t, stays: t.stays.map((x) => (x.id === s.id ? { ...x, ...p } : x)) }))}
                  onRemove={() => change((t) => ({ ...t, stays: t.stays.filter((x) => x.id !== s.id), days: t.days.map((d) => (d.stayId === s.id ? { ...d, stayId: undefined } : d)) }))} />
              ))}
              <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setPick({ kind: 'new-stay' })}><Icon name="plus" />Add a stay</button>
            </div>
          )}

          {tab === 'notes' && (
            <div className="stack card pad">
              <label className="field"><span className="label">Notes</span><textarea className="input" rows={5} value={it.notes} onChange={(e) => change((t) => ({ ...t, notes: e.target.value }))} /></label>
              <div className="grid-prefs">
                <label className="field"><span className="label">Budget amount</span><input className="input" type="number" min={0} value={it.budget?.amount ?? ''} onChange={(e) => change((t) => ({ ...t, budget: e.target.value === '' ? undefined : { amount: Number(e.target.value), currency: t.budget?.currency ?? 'USD', period: t.budget?.period ?? 'month' } }))} /></label>
                <label className="field"><span className="label">Currency</span><select className="input" value={it.budget?.currency ?? 'USD'} onChange={(e) => { void loadFx(); change((t) => ({ ...t, budget: { amount: t.budget?.amount ?? 0, currency: e.target.value, period: t.budget?.period ?? 'month' } })); }}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="field"><span className="label">Per</span><select className="input" value={it.budget?.period ?? 'month'} onChange={(e) => change((t) => ({ ...t, budget: { amount: t.budget?.amount ?? 0, currency: t.budget?.currency ?? 'USD', period: e.target.value as 'day' | 'week' | 'month' } }))}><option value="day">day</option><option value="week">week</option><option value="month">month</option></select></label>
              </div>
              <dl className="summary">
                <div><dt>Stop costs you entered</dt><dd>{cost ? money(cost, cur) : 'None yet'} <ProvBadge p="user" /></dd></div>
                <div><dt>Living cost estimate (from stays)</dt><dd>{livingEst ? `${money(livingEst, 'USD')} (USD)` : 'Add monthly costs on the Stays tab'} <ProvBadge p="estimate" /></dd></div>
              </dl>
              {fx && <p className="small muted">Live rates available (as of {fx.date}); conversions are shown on the Stays tab.</p>}
            </div>
          )}
        </div>

        <aside className="stack trip-side">
          <div className="card pad stack sticky">
            <h3>Route</h3>
            {mapPoints.length ? <TripMap points={mapPoints} /> : <p className="small muted">Add places to see them on the map.</p>}
            <p className="small muted">Stops joined in order by straight lines — not a driving route.</p>
            {mapPoints[0] && <Link className="btn sm" to="/" onClick={() => { useUi.getState().select(mapPoints[0].place.id); useUi.getState().requestFocus({ lat: mapPoints[0].place.lat, lng: mapPoints[0].place.lng, alt: 1.0 }); }}><Icon name="globe" />Open on globe</Link>}
          </div>
        </aside>
      </div>

      <PlacePicker open={!!pick} onClose={() => setPick(null)} onPick={onPick} title={pick?.kind === 'replace' ? 'Replace with…' : pick?.kind === 'stop' ? 'Add a place' : 'Choose a stay'} destinationsOnly={pick?.kind === 'new-stay' || pick?.kind === 'stay'} />
      <dialog ref={dlg} className="modal" aria-labelledby="dtrip">
        <div className="stack"><h2 id="dtrip" style={{ fontSize: '1.3rem' }}>Delete “{it.name}”?</h2><p className="muted">Saved places aren’t affected. You can undo right afterwards.</p>
          <div className="row spread"><button className="btn ghost" onClick={() => dlg.current?.close()}>Keep it</button>
            <button className="btn danger" onClick={() => { const snap = it; del(it.id); dlg.current?.close(); nav('/itineraries'); toast(`Deleted ${snap.name}`, { action: { label: 'Undo', run: () => useStore.getState().addItinerary(snap) } }); }}>Delete</button></div></div>
      </dialog>
    </div></div>
  );
}
