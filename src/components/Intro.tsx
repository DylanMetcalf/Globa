import { useEffect, useState } from 'react';
import { OrthoGlobe, type OrthoMarker } from './OrthoGlobe';
import { LogoMark } from './Logo';
import { Icon } from './Icon';
import { useReducedMotion } from '../lib/hooks';
import { BUILTIN_PLACES } from '../data/catalog';

const SPARKS: OrthoMarker[] = BUILTIN_PLACES.filter((p) => p.kind === 'destination').slice(0, 16).map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, color: '#ffd884', shape: 'circle', r: 3 }));

/** First-visit: full branded reveal. Returning users: a short splash that auto-continues. Always skippable. */
export function Intro({ returning, onDone }: { returning: boolean; onDone: () => void }) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (reduced) { setPhase(3); return; }
    const t = [setTimeout(() => setPhase(1), 500), setTimeout(() => setPhase(2), 1500), setTimeout(() => setPhase(3), 2400)];
    return () => t.forEach(clearTimeout);
  }, [reduced]);
  useEffect(() => {
    if (!returning) return;
    const t = setTimeout(onDone, reduced ? 300 : 1500);
    return () => clearTimeout(t);
  }, [returning, reduced, onDone]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' || (e.key === 'Enter' && phase >= 3)) onDone(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [phase, onDone]);

  const letters = 'GLOBA'.split('');
  return (
    <div className={`intro night ${returning ? 'returning' : ''}`} data-phase={phase} role="dialog" aria-label="Welcome to GLOBA">
      <div className="intro-stars" aria-hidden="true" />
      <div className="intro-globe" aria-hidden="true"><OrthoGlobe markers={SPARKS} speed={0.35} initial={[10, -18]} reduced={reduced} /></div>
      <div className="intro-rings" aria-hidden="true"><i /><i /><i /></div>
      <div className="intro-center">
        <div className="intro-mark"><LogoMark size={returning ? 110 : 150} animated={!reduced} /></div>
        <h1 className="intro-word" aria-label="GLOBA">
          {letters.map((l, i) => <span key={i} style={{ transitionDelay: `${i * 90}ms` }} aria-hidden="true">{l}</span>)}
        </h1>
        <p className="intro-tag">Your world. Your adventures. Your story.</p>
        {!returning && (
          <button className="btn gold intro-enter" onClick={onDone} disabled={phase < 3}>
            Enter your world <Icon name="right" />
          </button>
        )}
      </div>
      <button className="intro-skip btn ghost sm" onClick={onDone} aria-label="Skip introduction">Skip</button>
    </div>
  );
}
