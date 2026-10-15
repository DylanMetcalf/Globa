import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/Logo';
import { CharacterPortrait } from '../components/CharacterPortrait';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useStore } from '../store';
import { useUi } from '../store/ui';
import { useCatalog, useIsMobile, useReducedMotion, hasWebGL } from '../lib/hooks';
import { celebrationFor, CELEBRATION_LABEL } from '../game/characters';
import { GameScene, themeFor } from '../game/GameScene';
import { playSound, startAmbience } from '../game/audio';
import { ACHIEVEMENTS } from '../lib/achievements';

type Phase = 'play' | 'lighting' | 'celebrating' | 'leaving';

function Joystick({ onChange }: { onChange: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);
  const upd = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect(); const cx = r.left + r.width / 2; const cy = r.top + r.height / 2; const max = r.width / 2 - 8;
    let dx = e.clientX - cx; let dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    setKnob({ x: dx, y: dy }); onChange(dx / max, -dy / max);
  };
  return (
    <div ref={base} className="joystick" role="application" aria-label="Movement joystick" style={{ touchAction: 'none' }}
      onPointerDown={(e) => { id.current = e.pointerId; (e.target as Element).setPointerCapture(e.pointerId); upd(e); }}
      onPointerMove={(e) => { if (id.current === e.pointerId) upd(e); }}
      onPointerUp={(e) => { if (id.current === e.pointerId) { id.current = null; setKnob({ x: 0, y: 0 }); onChange(0, 0); } }}
      onPointerCancel={() => { id.current = null; setKnob({ x: 0, y: 0 }); onChange(0, 0); }}>
      <div className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

export default function LightItUpPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { get } = useCatalog();
  const place = get(id);
  const saved = useStore((s) => (id ? s.saved[id] : undefined));
  const savePlace = useStore((s) => s.savePlace);
  const profiles = useStore((s) => s.profiles);
  const activeId = useStore((s) => s.activeProfileId);
  const sound = useStore((s) => s.settings.sound);
  const activate = useStore((s) => s.activatePlace);
  const sync = useStore((s) => s.syncAchievements);
  const activationCount = useStore((s) => new Set(s.activations.map((a) => a.placeId)).size);
  const reduced = useReducedMotion();
  const mobile = useIsMobile();
  const setCelebrate = useUi((s) => s.setCelebrate);
  const toast = useUi((s) => s.toast);

  const holder = useRef<HTMLDivElement>(null);
  const game = useRef<GameScene | null>(null);
  const [playerId, setPlayerId] = useState(activeId);
  const [phase, setPhase] = useState<Phase>('play');
  const [near, setNear] = useState(false);
  const [arrow, setArrow] = useState<{ a: number; d: number } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [failMsg, setFailMsg] = useState('');
  const [newAch, setNewAch] = useState<string[]>([]);
  const [hint, setHint] = useState(true);
  const recorded = useRef(false);
  const stopAmb = useRef<(() => void) | null>(null);

  const webgl = useMemo(hasWebGL, []);
  const player = profiles.find((p) => p.id === playerId) ?? profiles[0];
  const companion = profiles.find((p) => p.id !== player.id) ?? profiles[0];
  const needSave = !!place && !saved;

  // record the activation exactly once (never marks the place visited)
  const record = useCallback(() => {
    if (recorded.current || !place) return;
    recorded.current = true;
    if (!useStore.getState().saved[place.id]) savePlace(place.id, { place });
    activate(place.id, player.id);
    const fresh = sync();
    setNewAch(fresh);
  }, [place, player.id, activate, savePlace, sync]);

  const leave = useCallback((lit: boolean) => {
    stopAmb.current?.();
    if (!place) { nav('/'); return; }
    if (lit) {
      setPhase('leaving');
      if (sound.enabled) playSound('whoosh', sound.volume);
      setCelebrate(place.id);
      setTimeout(() => nav(`/?focus=${encodeURIComponent(place.id)}&lit=1`), reduced ? 100 : 650);
      for (const aid of useStore.getState().syncAchievements()) { void aid; }
    } else nav(`/place/${place.id}`);
  }, [place, nav, sound, reduced, setCelebrate]);

  // achievements toast after returning
  useEffect(() => {
    if (phase !== 'leaving' || !newAch.length) return;
    newAch.forEach((aid) => { const a = ACHIEVEMENTS.find((x) => x.id === aid); if (a) toast(`Achievement unlocked: ${a.title}`, { kind: 'achievement', ms: 7000 }); });
  }, [phase, newAch, toast]);

  // boot the 3D scene
  useEffect(() => {
    if (!place || needSave || !webgl || !holder.current) { if (!webgl) { setStatus('failed'); setFailMsg('WebGL isn’t available on this device.'); } return; }
    let scene: GameScene | null = null;
    // A fresh canvas per boot: a canvas whose context was force-lost can't be reused (React StrictMode remounts).
    const cv = document.createElement('canvas');
    cv.className = 'game-canvas';
    cv.setAttribute('aria-label', `Miniature world for ${place.name}. Use the keys or joystick to walk to the glowing light bulb and activate it.`);
    holder.current.appendChild(cv);
    try {
      scene = new GameScene({
        canvas: cv, theme: themeFor(place.art.motif, place.env, place.countryCode), seed: place.id, reduced, mobile,
        player: { settings: player.character, celebration: celebrationFor(player.id) },
        companion: { settings: companion.character, celebration: celebrationFor(companion.id) },
        events: {
          onNear: (n, d, a) => { setNear(n); setArrow({ a, d }); },
          onActivated: () => { setPhase('lighting'); setHint(false); if (sound.enabled) { playSound('switch', sound.volume); setTimeout(() => playSound('success', sound.volume), 600); } record(); },
          onCelebrated: () => setPhase('celebrating'),
          onComplete: () => leave(true),
          onError: (e) => { setFailMsg(e.message); setStatus('failed'); },
        },
      });
      game.current = scene; setStatus('ready');
      if (sound.enabled) stopAmb.current = startAmbience(sound.volume);
      // Test hook (dev builds, ?test, or localStorage globa:e2e=1) — lets automated tests drive the scene headlessly.
      let e2e = false; try { e2e = localStorage.getItem('globa:e2e') === '1'; } catch { /* ignore */ }
      if (import.meta.env.DEV || e2e || new URLSearchParams(location.search).has('test')) (window as any).__globaGame = scene;
    } catch (e) { setFailMsg((e as Error).message); setStatus('failed'); }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') leave(false); };
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('keydown', esc); scene?.dispose(); cv.remove(); game.current = null; stopAmb.current?.(); (window as any).__globaGame = undefined; };
  }, [place?.id, needSave, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const t = setTimeout(() => setHint(false), 14000); return () => clearTimeout(t); }, []);

  if (!place) return <div className="game night" style={{ display: 'grid', placeItems: 'center' }}><div className="card pad stack"><h2>That place isn’t available</h2><Link className="btn primary" to="/">Back to the globe</Link></div></div>;

  if (needSave) {
    return (
      <div className="game night gate"><div className="card pad stack gate-card">
        <LogoMark size={56} animated /><h1 style={{ fontSize: '1.8rem' }}>Save {place.name} first</h1>
        <p className="muted">Places are lit up from your saved collection, so they’re never lost.</p>
        <div className="row"><button className="btn primary" onClick={() => savePlace(place.id, { place })}><Icon name="bookmark" />Save and continue</button><Link className="btn" to={`/place/${place.id}`}>Not now</Link></div>
      </div></div>
    );
  }

  /* 2D fallback: the activation still works without WebGL. */
  if (status === 'failed') {
    const lit = recorded.current;
    return (
      <div className="game night gate"><div className="card pad stack gate-card" role="alert">
        <div className="bulb-2d" data-lit={lit}><Icon name="bulb" width={64} height={64} /></div>
        <h1 style={{ fontSize: '1.8rem' }}>The miniature world can’t load here</h1>
        <p className="muted">{failMsg || 'Your device or browser couldn’t start 3D graphics.'} You can still light {place.name} up on your globe.</p>
        <div className="row wrap"><button className="btn gold" onClick={() => { record(); setTimeout(() => leave(true), 500); }}><Icon name="bulb" />Light it up anyway</button><button className="btn" onClick={() => leave(false)}>Back to {place.name}</button></div>
      </div></div>
    );
  }

  const busy = phase !== 'play';
  const celeb = CELEBRATION_LABEL[celebrationFor(player.id)];
  return (
    <div className={`game night phase-${phase}`} data-testid="game">
      <ErrorBoundary onError={() => { setStatus('failed'); setFailMsg('The scene hit an unexpected error.'); }}>
        <div ref={holder} className="game-holder" />
      </ErrorBoundary>

      {status === 'loading' && <div className="game-loading" role="status"><LogoMark size={56} animated /><span>Building the miniature world…</span></div>}

      <div className="game-top">
        <div className="panel game-pill"><CharacterPortrait c={player.character} size={36} label={player.name} /><div><b>{player.name}</b><div className="small muted">exploring {place.name}</div></div>
          {profiles.length > 1 && !busy && <button className="btn sm ghost" onClick={() => setPlayerId(companion.id)} aria-label={`Switch to ${companion.name}`}>Switch</button>}</div>
        <div className="row" style={{ gap: 8 }}>
          {!busy && <button className="btn sm panel" onClick={() => { record(); if (game.current) game.current.skip(); else leave(true); }} title="Light it up right away and return to the globe"><Icon name="right" />Skip</button>}
          <button className="btn icon panel" onClick={() => leave(false)} aria-label="Exit without lighting"><Icon name="close" /></button>
        </div>
      </div>

      {phase === 'play' && (
        <div className="objective panel" role="status" aria-live="polite">
          <Icon name="bulb" style={{ color: 'var(--st-activated)' }} />
          <div><b>{near ? 'You’re close — activate the bulb!' : 'Walk to the glowing light bulb'}</b>
            {hint && <div className="small muted">{mobile ? 'Drag the joystick to move, drag the scene to look around.' : 'Move with WASD or arrow keys · drag to look around · E to activate · Esc to exit'}</div>}</div>
        </div>
      )}
      {phase === 'play' && arrow && !near && (
        <div className="compass" style={{ transform: `rotate(${arrow.a}rad)` }} aria-hidden="true"><i /></div>
      )}
      {phase === 'lighting' && <div className="banner">Let there be light…</div>}
      {phase === 'celebrating' && (
        <div className="celebrate-card panel" role="status" aria-live="polite">
          <div className="burst"><Icon name="bulb" width={34} height={34} /></div>
          <div><div className="eyebrow">Destination lit</div><h2 style={{ fontSize: '1.6rem' }}>{place.name} is glowing on your globe</h2>
            <p className="small muted" style={{ margin: '4px 0 0' }}>{player.name}’s {celeb.toLowerCase()} · light #{activationCount} · it isn’t marked visited — that’s for when you go.</p>
            {newAch.map((aid) => { const a = ACHIEVEMENTS.find((x) => x.id === aid); return a ? <div key={aid} className="badge ai" style={{ marginTop: 8 }}>🏆 Achievement: {a.title}</div> : null; })}</div>
          <button className="btn gold" onClick={() => game.current?.skip()}>Back to the globe<Icon name="right" /></button>
        </div>
      )}

      {phase === 'play' && mobile && <Joystick onChange={(x, y) => game.current?.setJoystick(x, y)} />}
      {phase === 'play' && (
        <button className={`act-btn ${near ? 'ready' : ''}`} onClick={() => (near ? game.current?.interact() : toast('Walk closer to the glowing bulb first'))} aria-label="Activate the light bulb" aria-disabled={!near} data-testid="interact">
          <Icon name="bulb" width={30} height={30} /><span>{near ? 'Activate' : 'Get closer'}</span>{!mobile && <kbd className="kbd">E</kbd>}
        </button>
      )}
      <div className="fade-out-cover" data-on={phase === 'leaving'} aria-hidden="true" />
    </div>
  );
}
