import { useEffect, useMemo, useRef, useState } from 'react';
import type { Place } from '../../shared/types';
import { Icon } from './Icon';
import { useCatalog } from '../lib/hooks';
import { useStore } from '../store';
import { nameSearch } from '../lib/discovery';

/** Modal place chooser: saved places first, then anything in the catalogue. */
export function PlacePicker({ open, onClose, onPick, title = 'Choose a place', destinationsOnly = false }: { open: boolean; onClose: () => void; onPick: (p: Place) => void; title?: string; destinationsOnly?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { places, get } = useCatalog();
  const saved = useStore((s) => s.saved);
  const [q, setQ] = useState('');
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { d.showModal(); setQ(''); }
    if (!open && d.open) d.close();
  }, [open]);
  const list = useMemo(() => {
    const pool = destinationsOnly ? places.filter((p) => p.kind === 'destination') : places;
    if (q.trim()) return nameSearch(pool, q, 12);
    const sv = Object.keys(saved).map((id) => get(id)).filter(Boolean) as Place[];
    const rest = pool.filter((p) => p.kind === 'destination' && !saved[p.id]).slice(0, 8);
    return [...sv.filter((p) => !destinationsOnly || p.kind === 'destination'), ...rest];
  }, [q, places, saved, get, destinationsOnly]);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="pp-title">
      <div className="stack">
        <div className="row spread"><h2 id="pp-title" style={{ fontSize: '1.3rem' }}>{title}</h2><button className="btn icon sm ghost" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
        <div className="searchfield small-field"><Icon name="search" /><input className="searchinput" autoFocus placeholder="Search places…" aria-label="Search places" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <ul className="stack" style={{ gap: 6, maxHeight: '50vh', overflowY: 'auto' }}>
          {!q.trim() && <li className="eyebrow">Your saved places, then suggestions</li>}
          {list.map((p) => (
            <li key={p.id}><button className="nearby-row" onClick={() => { onPick(p); onClose(); }}>
              <span className="grow"><b>{p.name}</b><span className="muted small"> · {p.country}{saved[p.id] ? ' · saved' : ''}{p.kind === 'poi' ? ' · landmark' : ''}</span></span><Icon name="plus" width={16} height={16} /></button></li>
          ))}
          {list.length === 0 && <li className="muted small">No match in the catalogue. Add the place from Explore (worldwide lookup) and save it first.</li>}
        </ul>
      </div>
    </dialog>
  );
}
