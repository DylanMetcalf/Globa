import { useId } from 'react';

/** GLOBA mark: two runners, hand in hand, tracing an orbit — line art, built to work from 16px to 512px. */
export function LogoMark({ size = 40, animated = false, title = 'GLOBA' }: { size?: number; animated?: boolean; title?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} className="logo-mark">
      <defs>
        <linearGradient id={`${id}-g`} x1="6" y1="8" x2="58" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3dd6c6" />
          <stop offset="1" stopColor="#ffd884" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="none" stroke="#3dd6c6" strokeOpacity="0.28" strokeWidth="1.3" />
      <g transform="rotate(-24 32 32)"><ellipse cx="32" cy="32" rx="30" ry="9" fill="none" stroke="#f2b84b" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 3" /></g>
      <g stroke={`url(#${id}-g)`} className={animated ? 'run-bob' : undefined}>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3">
<circle cx="44" cy="14.5" r="4.1"/><path d="M43 19.5 L39.5 33"/><path d="M42.2 22.5 L49 27.5 L53 24.5"/><path d="M42.2 22.5 L34 26.5 L28.5 30.5"/><path d="M39.5 33 L46.5 39.5 L45 50.5"/><path d="M39.5 33 L32.5 40 L26.5 43.5"/>
<circle cx="21.5" cy="16.5" r="3.9"/><path d="M18 14.3 Q11.5 12.5 10 18.5"/><path d="M20.5 21.5 L17.5 33"/><path d="M20 24.5 L24.5 29 L28.5 30.5"/><path d="M20 24.5 L13.5 27.5 L10.5 23.5"/><path d="M17.5 33 L24.5 39 L22 49.5"/><path d="M17.5 33 L11 40 L5.5 43.5"/><path d="M13.6 37.2 L21.5 36.6"/>
</g>
<path d="M31 22.2 c-1.5-1.8-4.2-.6-3.2 1.5 .7 1.3 3.2 2.8 3.2 2.8 s2.5-1.5 3.2-2.8 c1-2.1-1.7-3.3-3.2-1.5z" fill="#ff8a9b" stroke="none"/>
      </g>
    </svg>
  );
}

export function Logo({ size = 36, animated = false, tagline = false }: { size?: number; animated?: boolean; tagline?: boolean }) {
  return (
    <span className="logo-full" style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3 }}>
      <LogoMark size={size} animated={animated} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: size * 0.62, letterSpacing: '0.2em', fontWeight: 600 }}>GLOBA</span>
        {tagline && <span style={{ fontSize: size * 0.26, opacity: 0.7, letterSpacing: '0.04em', marginTop: 6 }}>Your world. Your adventures. Your story.</span>}
      </span>
    </span>
  );
}
