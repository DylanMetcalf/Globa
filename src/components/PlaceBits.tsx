import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Match, Place, Provenance, SavedStatus } from '../../shared/types';
import { Icon } from './Icon';
import { PlaceImage } from './PlaceArt';
import { useStore } from '../store';
import { useUi } from '../store/ui';
import { useCatalog } from '../lib/hooks';
import { REASON_LABELS } from '../lib/labels';
import { PROVENANCE_LABEL, addStop, blankItinerary, newStop, newDay } from '../lib/itinerary';
import { STATE_COLOR } from '../lib/markers';

export function ProvBadge({ p, title }: { p: Provenance; title?: string }) {
  return <span className={`badge ${p}`} title={title ?? provenanceHelp[p]}>{PROVENANCE_LABEL[p]}</span>;
}
const provenanceHelp: Record<Provenance, string> = {
  live: 'Retrieved live from a named source.', curated: 'Editorial knowledge bundled with GLOBA. Not live-verified.',
  estimate: 'A rough estimate. Verify before relying on it.', user: 'Entered by you.', demo: 'Demonstration data generated offline.', ai: 'Suggested by an AI model from retrieved data.',
};

export function StatusPill({ status }: { status?: SavedStatus }) {
  if (!status) return null;
  const map: Record<SavedStatus, { label: string; icon: 'bookmark' | 'calendar' | 'check'; color: string }> = {
    saved: { label: 'Saved', icon: 'bookmark', color: STATE_COLOR.saved },
    planned: { label: 'Planned', icon: 'calendar', color: STATE_COLOR.planned },
    visited: { label: 'Visited', icon: 'check', color: STATE_COLOR.visited },
  };
  const m = map[status];
  return <span className="badge" style={{ color: m.color, borderColor: m.color }}><Icon name={m.icon} width={12} height={12} />{m.label}</span>;
}

export function LitPill({ lit }: { lit: boolean }) {
  if (!lit) return null;
  return <span className="badge" style={{ color: STATE_COLOR.activated, borderColor: STATE_COLOR.activated }}><Icon name="bulb" width={12} height={12} />Lit up</span>;
}

/** Save / unsave with undo, so a mis-tap never silently loses notes. */
export function useSaveToggle(place: Place) {
  const saved = useStore((s) => s.saved[place.id]);
  const save = useStore((s) => s.savePlace);
  const unsave = useStore((s) => s.unsavePlace);
  const toast = useUi((s) => s.toast);
  const sync = useStore((s) => s.syncAchievements);
  const toggle = () => {
    if (saved) {
      const snapshot = saved;
      unsave(place.id);
      toast(`Removed ${place.name} from Saved`, {
        action: { label: 'Undo', run: () => { save(place.id, { place, status: snapshot.status }); useStore.getState().updateSaved(place.id, { notes: snapshot.notes, tags: snapshot.tags, priority: snapshot.priority }); } },
      });
    } else {
      save(place.id, { place });
      toast(`Saved ${place.name}`);
      announce(sync());
    }
  };
  return { saved, toggle };
}

export function announce(ids: string[]) {
  if (!ids.length) return;
  import('../lib/achievements').then(({ ACHIEVEMENTS }) => {
    for (const id of ids) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) useUi.getState().toast(`Achievement unlocked: ${a.title}`, { kind: 'achievement', ms: 6500 });
    }
  });
}

export function PlaceActions({ place, size = 'md', onAddTrip }: { place: Place; size?: 'sm' | 'md'; onAddTrip: () => void }) {
  const { saved, toggle } = useSaveToggle(place);
  const nav = useNavigate();
  const save = useStore((s) => s.savePlace);
  const lit = useStore((s) => s.activations.some((a) => a.placeId === place.id));
  const light = () => { if (!saved) save(place.id, { place }); nav(`/light/${place.id}`); };
  const cls = `btn ${size === 'sm' ? 'sm' : ''}`;
  return (
    <div className="row wrap place-actions">
      <button className={`${cls} ${saved ? '' : 'primary'}`} onClick={toggle} aria-pressed={!!saved}>
        <Icon name="bookmark" fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save'}
      </button>
      <button className={cls} onClick={onAddTrip}><Icon name="trips" />Add to itinerary</button>
      <button className={`${cls} gold`} onClick={light} title="Visit the miniature world and light this place on the globe"><Icon name="bulb" />{lit ? 'Light again' : 'Light it up'}</button>
    </div>
  );
}

export function PlaceCard({ place, match, why, caveat, onOpen, onAddTrip, compact = false }: {
  place: Place; match?: Match; why?: string; caveat?: string; onOpen?: () => void; onAddTrip?: (p: Place) => void; compact?: boolean;
}) {
  const saved = useStore((s) => s.saved[place.id]);
  const lit = useStore((s) => s.activations.some((a) => a.placeId === place.id));
  const { toggle } = useSaveToggle(place);
  const { get } = useCatalog();
  const parent = get(place.parentId);
  return (
    <article className="pcard card">
      <Link to={`/place/${place.id}`} onClick={onOpen} className="pcard-img" aria-label={`Open ${place.name}`}>
        <PlaceImage place={place} ratio={compact ? '16 / 8' : '16 / 10'} rounded={false} />
        <div className="pcard-badges"><StatusPill status={saved?.status} /><LitPill lit={lit} /></div>
      </Link>
      <div className="pcard-body">
        <div className="row spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3><Link to={`/place/${place.id}`} onClick={onOpen} className="plain">{place.name}</Link></h3>
            <div className="muted small">{place.kind === 'poi' && parent ? `Near ${parent.name.replace(/\s*\(.*\)/, '')} · ` : ''}{[place.region.split(',')[0], place.country].filter(Boolean).join(', ')}</div>
          </div>
          <button className="btn icon sm ghost" onClick={toggle} aria-pressed={!!saved} aria-label={saved ? `Remove ${place.name} from saved` : `Save ${place.name}`}>
            <Icon name="bookmark" fill={saved ? 'var(--st-saved)' : 'none'} style={{ color: saved ? 'var(--st-saved)' : undefined }} />
          </button>
        </div>
        {why ? <p className="small" style={{ margin: 0 }}>{why}{caveat && <span className="muted"> Caveat: {caveat}</span>}</p> : match ? (
          <ul className="reasons">{match.reasons.slice(0, 3).map((r, i) => <li key={i}><Icon name="check" width={14} height={14} />{r}</li>)}
            {match.gaps[0] && <li className="gap"><Icon name="info" width={14} height={14} />{match.gaps[0]}</li>}</ul>
        ) : <p className="small muted" style={{ margin: 0 }}>{place.tagline}</p>}
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="badge curated" title={provenanceHelp.curated}>{REASON_LABELS[place.primaryReason]}</span>
          {place.provenance === 'live' && <ProvBadge p="live" />}
          {match && <span className="badge" title="How many of your criteria this place matches (heuristic)">Fit {Math.round(match.score * 100)}%</span>}
        </div>
        {onAddTrip && <div className="row"><button className="btn sm" onClick={() => onAddTrip(place)}><Icon name="plus" />Add to itinerary</button></div>}
      </div>
    </article>
  );
}

/* ---------------- add to itinerary ---------------- */
export function AddToTripDialog({ place, onClose }: { place: Place | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const trips = useStore((s) => s.itineraries);
  const update = useStore((s) => s.updateItinerary);
  const add = useStore((s) => s.addItinerary);
  const me = useStore((s) => s.activeProfileId);
  const savePlace = useStore((s) => s.savePlace);
  const setStatus = useStore((s) => s.setStatus);
  const sync = useStore((s) => s.syncAchievements);
  const toast = useUi((s) => s.toast);
  const nav = useNavigate();
  const [tripId, setTripId] = useState('');
  const [dayId, setDayId] = useState('');

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (place && !d.open) { d.showModal(); setTripId(trips[0]?.id ?? '__new'); setDayId(trips[0]?.days[0]?.id ?? ''); }
    if (!place && d.open) d.close();
  }, [place]); // eslint-disable-line react-hooks/exhaustive-deps

  const trip = trips.find((t) => t.id === tripId);
  useEffect(() => { if (trip && !trip.days.some((d) => d.id === dayId)) setDayId(trip.days[0]?.id ?? ''); }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!place) return <dialog ref={ref} className="modal" onClose={onClose} />;

  const finish = (id: string) => {
    savePlace(place.id, { place });
    const st = useStore.getState().saved[place.id];
    if (st && st.status === 'saved') setStatus(place.id, 'planned');
    announce(sync());
    toast(`Added ${place.name} to your itinerary`, { action: { label: 'View', run: () => nav(`/itineraries/${id}`) } });
    onClose();
  };
  const confirm = () => {
    const stop = newStop({ title: place.name, placeId: place.id, kind: 'place', notes: place.tagline, startTime: '', durationMin: 120 });
    if (tripId === '__new' || !trip) {
      const it = blankItinerary(me, { name: `${place.name.replace(/\s*\(.*\)/, '')} trip`, coverPlaceId: place.id, durationDays: 3, days: [newDay('Day 1', undefined, [stop])] });
      add(it); finish(it.id);
    } else if (dayId) {
      update(trip.id, (t) => addStop(t, dayId, stop)); finish(trip.id);
    } else {
      update(trip.id, (t) => ({ ...t, days: [...t.days, newDay('Day 1', undefined, [stop])] }));
      finish(trip.id);
    }
  };
  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="atd-title">
      <form method="dialog" className="stack" onSubmit={(e) => { e.preventDefault(); confirm(); }}>
        <h2 id="atd-title" style={{ fontSize: '1.4rem' }}>Add {place.name} to an itinerary</h2>
        <div className="field"><label htmlFor="atd-trip">Itinerary</label>
          <select id="atd-trip" className="input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            <option value="__new">＋ Create a new itinerary</option>
          </select></div>
        {trip && trip.days.length > 0 && (
          <div className="field"><label htmlFor="atd-day">Day</label>
            <select id="atd-day" className="input" value={dayId} onChange={(e) => setDayId(e.target.value)}>
              {trip.days.map((d) => <option key={d.id} value={d.id}>{d.label} ({d.stops.length} stops)</option>)}
            </select></div>
        )}
        <p className="small muted">The place stays saved and is marked Planned. It can belong to several itineraries.</p>
        <div className="row spread"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" type="submit">Add</button></div>
      </form>
    </dialog>
  );
}
