import { useEffect, useRef, useState } from 'react';
import type { LiveImage, Place } from '../../shared/types';
import { api } from '../services/api';

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const W = 400;
const H = 250;

function ridge(r: () => number, base: number, amp: number, steps: number, jag: number) {
  const pts: string[] = [`M0 ${H}`, `L0 ${base}`];
  for (let i = 1; i <= steps; i++) {
    const x = (W / steps) * i;
    const y = base - amp * (0.35 + r() * 0.65) * (1 - jag) - amp * jag * (i % 2 ? r() : 0.2);
    pts.push(`L${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  pts.push(`L${W} ${H}Z`);
  return pts.join(' ');
}

function curve(r: () => number, base: number, amp: number) {
  const a = r() * 6; const b = 0.8 + r() * 1.2;
  let d = `M0 ${H} L0 ${base}`;
  for (let x = 0; x <= W; x += 10) d += ` L${x} ${(base - Math.sin(x / 60 * b + a) * amp).toFixed(1)}`;
  return d + ` L${W} ${H}Z`;
}

/** Illustrative, offline fallback artwork generated from a place's art direction. Clearly not a photograph. */
export function PlaceArt({ place, className }: { place: Pick<Place, 'id' | 'art' | 'name'>; className?: string }) {
  const r = rng(place.id);
  const { hue, motif } = place.art;
  const h2 = (hue + 40) % 360;
  const night = motif === 'aurora' || motif === 'volcano';
  const sky0 = night ? `hsl(${hue + 20} 60% 8%)` : `hsl(${hue} 55% 22%)`;
  const sky1 = night ? `hsl(${hue + 40} 55% 22%)` : `hsl(${h2} 75% 62%)`;
  const gid = `art-${place.id}`;
  const sunX = 60 + r() * 280;
  const layers: JSX.Element[] = [];
  const fill = (i: number, l = 12) => `hsl(${hue + i * 8} ${40 + i * 6}% ${l + i * 7}%)`;

  if (motif === 'mountain' || motif === 'lake' || motif === 'aurora' || motif === 'volcano' || motif === 'island') {
    const jag = motif === 'island' ? 0.1 : 0.5;
    for (let i = 0; i < 3; i++) layers.push(<path key={`m${i}`} d={ridge(r, 150 + i * 28, 90 - i * 12, 14 - i * 2, jag)} fill={fill(2 - i, 10)} opacity={0.95} />);
  }
  if (motif === 'volcano') layers.push(<path key="v" d={`M120 ${H} L200 90 L280 ${H}Z`} fill="hsl(10 40% 12%)" />, <ellipse key="vg" cx="200" cy="92" rx="22" ry="6" fill="#ff8a3d" opacity=".8" />);
  if (motif === 'coast' || motif === 'island' || motif === 'lake') {
    layers.push(<rect key="sea" y={motif === 'lake' ? 175 : 165} width={W} height={H} fill={`hsl(${hue + 10} 60% ${motif === 'lake' ? 28 : 34}%)`} opacity=".92" />);
    for (let i = 0; i < 5; i++) layers.push(<path key={`w${i}`} d={`M${r() * 300} ${185 + i * 14} q 20 -5 40 0 t 40 0`} stroke="#fff" strokeOpacity=".35" fill="none" strokeWidth="1.4" />);
  }
  if (motif === 'coast') layers.push(<path key="sand" d={curve(r, 215, 8)} fill={`hsl(${38} 55% 62%)`} />);
  if (motif === 'forest') {
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 16; i++) {
        const x = i * 26 + r() * 14 - 6; const base = 190 + row * 28; const s = 18 + row * 8 + r() * 10;
        layers.push(<path key={`t${row}-${i}`} d={`M${x} ${base} l${s / 2} ${-s * 1.8} l${s / 2} ${s * 1.8}Z`} fill={`hsl(${hue + 10 - row * 6} ${45 + row * 6}% ${14 + row * 8}%)`} />);
      }
    }
  }
  if (motif === 'desert') {
    for (let i = 0; i < 3; i++) layers.push(<path key={`d${i}`} d={curve(r, 160 + i * 28, 22 - i * 4)} fill={`hsl(${22 + i * 6} ${60 - i * 4}% ${34 + i * 9}%)`} />);
  }
  if (motif === 'canyon') {
    for (let i = 0; i < 5; i++) layers.push(<path key={`c${i}`} d={`M0 ${H} L0 ${110 + i * 22} L${70 + r() * 60} ${96 + i * 22} L${160 + r() * 30} ${130 + i * 20} L${240 + r() * 40} ${100 + i * 22} L${330 + r() * 30} ${120 + i * 20} L${W} ${100 + i * 22} L${W} ${H}Z`} fill={`hsl(${14 + i * 4} ${58 - i * 3}% ${20 + i * 9}%)`} />);
  }
  if (motif === 'city') {
    for (let i = 0; i < 22; i++) {
      const w = 12 + r() * 22; const x = i * 18 + r() * 6; const hgt = 40 + r() * 110;
      layers.push(<rect key={`b${i}`} x={x} y={H - hgt - 20} width={w} height={hgt + 20} fill={`hsl(${hue} 35% ${10 + (i % 3) * 5}%)`} />);
      for (let k = 0; k < 4; k++) if (r() > 0.4) layers.push(<rect key={`wi${i}-${k}`} x={x + 3 + (k % 2) * 6} y={H - hgt - 14 + k * 14} width="3" height="5" fill="#ffd884" opacity=".85" />);
    }
    layers.push(<rect key="river" y="225" width={W} height="25" fill={`hsl(${hue} 50% 18%)`} />);
  }
  if (motif === 'aurora') {
    for (let i = 0; i < 3; i++) layers.unshift(<path key={`au${i}`} d={`M0 ${70 + i * 18} C 100 ${20 + i * 15}, 200 ${120 - i * 10}, ${W} ${50 + i * 20} L${W} ${90 + i * 20} C 200 ${160 - i * 10}, 100 ${60 + i * 15}, 0 ${110 + i * 18}Z`} fill={i === 1 ? '#a38bff' : '#41ffb4'} opacity={0.28} style={{ filter: 'blur(5px)' }} />);
  }
  const stars = night || motif === 'desert' ? Array.from({ length: 28 }, (_, i) => <circle key={`s${i}`} cx={r() * W} cy={r() * 110} r={r() * 1.1 + 0.3} fill="#fff" opacity={0.5 + r() * 0.5} />) : null;

  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Illustration for ${place.name}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky0} /><stop offset="1" stopColor={sky1} /></linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${gid})`} />
      {stars}
      {!night && <circle cx={sunX} cy={70 + r() * 20} r={20 + r() * 10} fill={`hsl(${(hue + 160) % 360} 95% 82%)`} opacity=".85" />}
      {layers}
    </svg>
  );
}

/* -------- live image loading (via the server's Wikipedia/Unsplash proxy), cached and de-duplicated -------- */
interface LiveResult { image?: LiveImage; summary?: { text: string; title: string; url: string }; failed?: boolean }
const memo = new Map<string, LiveResult>();
const inflight = new Map<string, Promise<LiveResult>>();

function readSession(id: string): LiveResult | undefined {
  try { const v = sessionStorage.getItem(`globa:img:${id}`); return v ? (JSON.parse(v) as LiveResult) : undefined; } catch { return undefined; }
}
function writeSession(id: string, v: LiveResult) {
  try { sessionStorage.setItem(`globa:img:${id}`, JSON.stringify(v)); } catch { /* ignore */ }
}

export function loadLive(place: Pick<Place, 'id' | 'name' | 'wikiTitle' | 'country'>): Promise<LiveResult> {
  const hit = memo.get(place.id) ?? readSession(place.id);
  if (hit) { memo.set(place.id, hit); return Promise.resolve(hit); }
  let p = inflight.get(place.id);
  if (!p) {
    p = api.image(place.wikiTitle, `${place.name.replace(/\s*\(.*\)/, '')} ${place.country}`)
      .then((r): LiveResult => ({ image: r.image, summary: r.summary }))
      .catch((): LiveResult => ({ failed: true }))
      .then((r) => { memo.set(place.id, r); if (!r.failed) writeSession(place.id, r); inflight.delete(place.id); return r; });
    inflight.set(place.id, p);
  }
  return p;
}

export function useLiveImage(place: Pick<Place, 'id' | 'name' | 'wikiTitle' | 'country'> | undefined, enabled = true) {
  const [res, setRes] = useState<LiveResult | undefined>(() => (place ? memo.get(place.id) : undefined));
  useEffect(() => {
    if (!place || !enabled) return;
    let live = true;
    loadLive(place).then((r) => live && setRes(r));
    return () => { live = false; };
  }, [place?.id, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return res;
}

/** Lazy visibility trigger so list pages don't fetch every image at once. */
function useVisible<T extends Element>() {
  const ref = useRef<T>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || v) return;
    if (!('IntersectionObserver' in window)) { setV(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setV(true); io.disconnect(); } }, { rootMargin: '160px' });
    io.observe(el);
    return () => io.disconnect();
  }, [v]);
  return [ref, v] as const;
}

export function PlaceImage({ place, ratio = '16 / 10', live = true, showCredit = false, className = '', rounded = true }: {
  place: Place; ratio?: string; live?: boolean; showCredit?: boolean; className?: string; rounded?: boolean;
}) {
  const [ref, visible] = useVisible<HTMLDivElement>();
  const res = useLiveImage(place, live && visible);
  const [broken, setBroken] = useState(false);
  const img = res?.image && !broken ? res.image : undefined;
  return (
    <div ref={ref} className={`place-img ${className}`} style={{ aspectRatio: ratio, borderRadius: rounded ? 'var(--r-lg)' : 0 }}>
      {img ? (
        <img src={img.url} alt={`Photo related to ${place.name}`} loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <PlaceArt place={place} />
      )}
      {!img && <span className="img-tag" title="Generated artwork used when no photo is available">Illustration</span>}
      {img && showCredit && (
        <a className="img-tag credit" href={img.creditUrl} target="_blank" rel="noreferrer noopener">Image: {img.credit}</a>
      )}
    </div>
  );
}
