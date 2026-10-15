import { useEffect, useMemo, useState } from 'react';
import type { Place, PlaceId, SavedPlace } from '../../shared/types';
import { BUILTIN_PLACES } from '../data/catalog';
import { useStore } from '../store';

export function useCatalog() {
  const custom = useStore((s) => s.customPlaces);
  return useMemo(() => {
    const places = [...BUILTIN_PLACES, ...Object.values(custom)];
    const byId = new Map<PlaceId, Place>(places.map((p) => [p.id, p]));
    return { places, byId, get: (id?: PlaceId) => (id ? byId.get(id) : undefined) };
  }, [custom]);
}

export function usePlace(id?: PlaceId): Place | undefined {
  const { get } = useCatalog();
  return get(id);
}

export function useIsSaved(id: PlaceId): SavedPlace | undefined {
  return useStore((s) => s.saved[id]);
}

export function useMedia(query: string): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

export const useIsMobile = () => useMedia('(max-width: 820px), (max-height: 520px) and (pointer: coarse)');

export function useReducedMotion(): boolean {
  const pref = useStore((s) => s.settings.reducedMotion);
  const sys = useMedia('(prefers-reduced-motion: reduce)');
  return pref === 'on' ? true : pref === 'off' ? false : sys;
}

export function useDebounced<T>(v: T, ms = 250): T {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

/** True if WebGL context can be created. Cached after first check. */
let webgl: boolean | undefined;
export function hasWebGL(): boolean {
  if (webgl !== undefined) return webgl;
  try {
    const c = document.createElement('canvas');
    webgl = Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { webgl = false; }
  return webgl;
}

/** Minimal modal behaviour for custom drawers: Escape closes, focus moves in, and is restored on close. */
export function useDrawerA11y(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('button, input, select, [tabindex]');
    first?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const a = f[0]; const z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('keydown', key, true); prev?.focus?.(); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}
