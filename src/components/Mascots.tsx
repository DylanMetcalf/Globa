import { useState } from 'react';
import { useUi } from '../store/ui';

const QUIPS = [
  'Dylan: “Are we there yet?”', 'Nicole: “Pack the snacks. Obviously.”', 'Dylan: “Next stop: somewhere with mountains.”', 'Nicole: “Window seat, please!”',
  'Dylan: “I found a place with great Wi-Fi!”', 'Nicole: “Ooh, a secret beach!”', 'Both: “One more adventure?”',
];

/** The two of them, mid-run. Decorative line art that matches the logo. */
export function RunningCouple({ size = 120, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`couple ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs><linearGradient id="cg" x1="6" y1="8" x2="58" y2="56" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#22c1b0" /><stop offset="1" stopColor="#ff9a3d" /></linearGradient></defs>
      <path d="M4 56 H60" stroke="currentColor" strokeOpacity=".25" strokeWidth="1.4" strokeDasharray="3 5" className="couple-ground" />
      <g stroke="url(#cg)" className="run-bob" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3">
        <circle cx="44" cy="14.5" r="4.1" /><path d="M43 19.5 L39.5 33" /><path d="M42.2 22.5 L49 27.5 L53 24.5" /><path d="M42.2 22.5 L34 26.5 L28.5 30.5" /><path d="M39.5 33 L46.5 39.5 L45 50.5" /><path d="M39.5 33 L32.5 40 L26.5 43.5" />
        <circle cx="21.5" cy="16.5" r="3.9" /><path d="M18 14.3 Q11.5 12.5 10 18.5" /><path d="M20.5 21.5 L17.5 33" /><path d="M20 24.5 L24.5 29 L28.5 30.5" /><path d="M20 24.5 L13.5 27.5 L10.5 23.5" /><path d="M17.5 33 L24.5 39 L22 49.5" /><path d="M17.5 33 L11 40 L5.5 43.5" /><path d="M13.6 37.2 L21.5 36.6" />
      </g>
      <path d="M31 22.2 c-1.5-1.8-4.2-.6-3.2 1.5 .7 1.3 3.2 2.8 3.2 2.8 s2.5-1.5 3.2-2.8 c1-2.1-1.7-3.3-3.2-1.5z" fill="#ff7a8f" />
    </svg>
  );
}

/** A tiny saucer with Dylan and Nicole on board. */
export function Spaceship({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 120 84" aria-hidden="true" className="ship-svg">
      <defs>
        <radialGradient id="dome" cx=".35" cy=".25" r=".9"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".5" stopColor="#bfeaff" stopOpacity=".55" /><stop offset="1" stopColor="#5aa7e8" stopOpacity=".5" /></radialGradient>
        <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eef2ff" /><stop offset=".55" stopColor="#9aa8e6" /><stop offset="1" stopColor="#5560b8" /></linearGradient>
        <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe9a8" /><stop offset="1" stopColor="#ff7a59" stopOpacity="0" /></linearGradient>
      </defs>
      <path d="M52 60 Q60 84 68 60Z" fill="url(#flame)" className="ship-flame" />
      <ellipse cx="60" cy="52" rx="50" ry="14" fill="url(#hull)" stroke="#2a3790" strokeWidth="1.6" />
      <circle cx="30" cy="54" r="3" fill="#ffd884" /><circle cx="60" cy="58" r="3" fill="#ffd884" /><circle cx="90" cy="54" r="3" fill="#ffd884" />
      <g>{/* Nicole & Dylan peeking out */}
        <circle cx="50" cy="38" r="9" fill="#f3c9a5" stroke="#1b1b2a" strokeWidth="1.4" /><path d="M41 38 Q40 26 52 27 Q58 30 59 36 Q52 30 44 36Z" fill="#4a3022" /><path d="M41 37 Q36 44 40 52" stroke="#4a3022" strokeWidth="4" fill="none" strokeLinecap="round" /><circle cx="47.500" cy="39" r="1.2" fill="#1b1b2a" /><circle cx="53.500" cy="39" r="1.2" fill="#1b1b2a" />
        <circle cx="72" cy="38" r="9" fill="#f3c9a5" stroke="#1b1b2a" strokeWidth="1.4" /><path d="M63 36 Q64 27 73 28 Q81 29 81 37 Q76 31 66 34Z" fill="#8a5a2b" /><circle cx="69.500" cy="39" r="1.2" fill="#1b1b2a" /><circle cx="75.500" cy="39" r="1.2" fill="#1b1b2a" />
      </g>
      <path d="M32 50 Q34 18 60 16 Q86 18 88 50Z" fill="url(#dome)" stroke="#2a3790" strokeWidth="1.4" />
    </svg>
  );
}

/** Drifts slowly across the stage; tap for a quip. Purely decorative, never in the way. */
export function ShipDrift() {
  const [q, setQ] = useState<string | null>(null);
  const toast = useUi((s) => s.toast);
  return (
    <button className="ship" aria-label="A tiny spaceship with Dylan and Nicole — tap for a quip" onClick={() => { const m = QUIPS[Math.floor(Math.random() * QUIPS.length)]; setQ(m); toast(m, { ms: 2800 }); setTimeout(() => setQ(null), 2800); }}>
      <Spaceship size={86} />
      {q && <span className="ship-bubble" aria-hidden="true">{q}</span>}
    </button>
  );
}
