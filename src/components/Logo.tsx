import { useId } from 'react';

/** GLOBA mark: a globe with meridians, circled by an orbit carrying one point of discovery. */
export function LogoMark({ size = 40, animated = false, title = 'GLOBA' }: { size?: number; animated?: boolean; title?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} className="logo-mark">
      <defs>
        <linearGradient id={`${id}-g`} x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3dd6c6" />
          <stop offset="1" stopColor="#aaa4ea" />
        </linearGradient>
        <radialGradient id={`${id}-b`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#1f2c68" />
          <stop offset="1" stopColor="#080d25" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g transform="rotate(-24 32 32)">
        <path d="M4 32A28 11 0 0 1 60 32" fill="none" stroke="#f2b84b" strokeOpacity="0.45" strokeWidth="1.6" />
      </g>
      <circle cx="32" cy="32" r="19" fill={`url(#${id}-b)`} stroke={`url(#${id}-g)`} strokeWidth="2.2" />
      <g fill="none" stroke={`url(#${id}-g)`} strokeWidth="1.4" strokeLinecap="round" opacity="0.9">
        <ellipse cx="32" cy="32" rx="8.5" ry="19" />
        <path d="M13.4 27.5C24 31 40 31 50.6 27.5M13.4 37C24 40.5 40 40.5 50.6 37" />
      </g>
      <g transform="rotate(-24 32 32)">
        <path d="M4 32A28 11 0 0 0 60 32" fill="none" stroke="#f2b84b" strokeWidth="2.2" strokeLinecap="round" />
        <g filter={`url(#${id}-glow)`}>
          {animated ? (
            <circle r="3.6" fill="#ffd884">
              <animateMotion dur="7s" repeatCount="indefinite" path="M60 32A28 11 0 1 1 4 32A28 11 0 1 1 60 32" />
            </circle>
          ) : (
            <circle cx="55" cy="38" r="3.6" fill="#ffd884" />
          )}
        </g>
      </g>
    </svg>
  );
}

export function Logo({ size = 36, animated = false, tagline = false }: { size?: number; animated?: boolean; tagline?: boolean }) {
  return (
    <span className="logo-full" style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3 }}>
      <LogoMark size={size} animated={animated} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: size * 0.62, letterSpacing: '0.22em', fontWeight: 560 }}>GLOBA</span>
        {tagline && <span style={{ fontSize: size * 0.26, opacity: 0.7, letterSpacing: '0.04em', marginTop: 6 }}>Your world. Your adventures. Your story.</span>}
      </span>
    </span>
  );
}
