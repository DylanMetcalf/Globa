import { useEffect, useRef } from 'react';
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';

export interface OrthoMarker { id: string; lat: number; lng: number; color: string; shape: 'circle' | 'diamond' | 'square' | 'star'; label?: string; r?: number }

let landCache: Promise<any> | null = null;
function loadLand() {
  landCache ??= Promise.all([import('topojson-client'), import('world-atlas/land-110m.json')]).then(([topo, data]) => {
    const t = (data as any).default ?? data;
    return topo.feature(t, t.objects.land);
  });
  return landCache;
}

/**
 * A lightweight Canvas 2D orthographic globe. Used for the intro animation and as the no-WebGL fallback for Explore.
 * Draggable, wheel/pinch-zoomable and clickable when `interactive`.
 */
export function OrthoGlobe({ markers = [], autoRotate = true, interactive = false, onPick, selectedId, className, initial = [-20, -20], speed = 0.12, glow = true, reduced = false }: {
  markers?: OrthoMarker[]; autoRotate?: boolean; interactive?: boolean; onPick?: (id: string) => void; selectedId?: string;
  className?: string; initial?: [number, number]; speed?: number; glow?: boolean; reduced?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef({ rot: [initial[0], initial[1]] as [number, number], zoom: 1, drag: null as null | { x: number; y: number; moved: boolean }, land: null as any, t0: performance.now() });
  const props = useRef({ markers, selectedId, autoRotate, speed, reduced });
  props.current = { markers, selectedId, autoRotate, speed, reduced };

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let w = 0; let h = 0; let dpr = 1;
    let alive = true;
    loadLand().then((l) => { state.current.land = l; });

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let last = performance.now();
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(64, now - last); last = now;
      const s = state.current; const p = props.current;
      if (p.autoRotate && !s.drag && !p.reduced) s.rot[0] += p.speed * dt * 0.06;
      const radius = Math.min(w, h) * 0.4 * s.zoom;
      const cx = w / 2; const cy = h / 2;
      const proj = geoOrthographic().translate([cx, cy]).scale(radius).rotate([s.rot[0], s.rot[1]]).clipAngle(90);
      const path = geoPath(proj, ctx);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (glow) {
        const gr = Math.min(radius * 1.24, Math.min(w, h) / 2);
        const g = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, gr);
        g.addColorStop(0, 'rgba(61,214,198,0.35)'); g.addColorStop(1, 'rgba(61,214,198,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, gr, 0, Math.PI * 2); ctx.fill();
      }
      const sphere = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.4, radius * 0.1, cx, cy, radius);
      sphere.addColorStop(0, '#1d2f78'); sphere.addColorStop(0.6, '#0e1a4d'); sphere.addColorStop(1, '#070d29');
      ctx.fillStyle = sphere; ctx.beginPath(); path({ type: 'Sphere' } as any); ctx.fill();
      ctx.strokeStyle = 'rgba(160,190,255,0.10)'; ctx.lineWidth = 0.6; ctx.beginPath(); path(geoGraticule10()); ctx.stroke();
      if (s.land) {
        ctx.fillStyle = 'rgba(61,214,198,0.55)'; ctx.strokeStyle = 'rgba(190,255,245,0.55)'; ctx.lineWidth = 0.7;
        ctx.beginPath(); path(s.land); ctx.fill(); ctx.stroke();
      }
      const shade = ctx.createRadialGradient(cx + radius * 0.5, cy + radius * 0.5, radius * 0.2, cx, cy, radius * 1.05);
      shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(2,4,16,0.55)');
      ctx.fillStyle = shade; ctx.beginPath(); path({ type: 'Sphere' } as any); ctx.fill();
      ctx.strokeStyle = 'rgba(150,220,255,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); path({ type: 'Sphere' } as any); ctx.stroke();

      const centre: [number, number] = [-s.rot[0], -s.rot[1]];
      const pulse = 0.5 + 0.5 * Math.sin(now / 420);
      for (const m of p.markers) {
        if (geoDistance(centre, [m.lng, m.lat]) > Math.PI / 2 - 0.05) continue;
        const pt = proj([m.lng, m.lat]);
        if (!pt) continue;
        const r = (m.r ?? 5) * (m.id === p.selectedId ? 1.5 : 1);
        ctx.save(); ctx.translate(pt[0], pt[1]);
        ctx.shadowColor = m.color; ctx.shadowBlur = 10 + pulse * 8;
        ctx.fillStyle = m.color; ctx.strokeStyle = '#06101f'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (m.shape === 'circle') ctx.arc(0, 0, r, 0, Math.PI * 2);
        else if (m.shape === 'square') ctx.rect(-r, -r, r * 2, r * 2);
        else if (m.shape === 'diamond') { ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * 1.3, 0); ctx.lineTo(0, r * 1.3); ctx.lineTo(-r * 1.3, 0); ctx.closePath(); }
        else { for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.55 : r * 1.4; const a = (Math.PI / 5) * i - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }
        ctx.fill(); ctx.stroke();
        if (m.id === p.selectedId) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [glow]);

  useEffect(() => {
    if (!interactive) return;
    const canvas = ref.current!;
    const s = state.current;
    const down = (e: PointerEvent) => { canvas.setPointerCapture(e.pointerId); s.drag = { x: e.clientX, y: e.clientY, moved: false }; };
    const move = (e: PointerEvent) => {
      if (!s.drag) return;
      const dx = e.clientX - s.drag.x; const dy = e.clientY - s.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) s.drag.moved = true;
      s.drag.x = e.clientX; s.drag.y = e.clientY;
      const k = 0.35 / s.zoom;
      s.rot[0] += dx * k; s.rot[1] = Math.max(-80, Math.min(80, s.rot[1] - dy * k));
    };
    const up = (e: PointerEvent) => {
      const moved = s.drag?.moved; s.drag = null;
      if (moved || !onPick) return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left; const y = e.clientY - r.top;
      const radius = Math.min(r.width, r.height) * 0.4 * s.zoom;
      const proj = geoOrthographic().translate([r.width / 2, r.height / 2]).scale(radius).rotate([s.rot[0], s.rot[1]]).clipAngle(90);
      let best: { id: string; d: number } | null = null;
      for (const m of props.current.markers) {
        const pt = proj([m.lng, m.lat]);
        if (!pt || geoDistance([-s.rot[0], -s.rot[1]], [m.lng, m.lat]) > Math.PI / 2 - 0.05) continue;
        const d = Math.hypot(pt[0] - x, pt[1] - y);
        if (d < 22 && (!best || d < best.d)) best = { id: m.id, d };
      }
      if (best) onPick(best.id);
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); s.zoom = Math.max(0.7, Math.min(3, s.zoom * (e.deltaY > 0 ? 0.92 : 1.08))); };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('wheel', wheel); };
  }, [interactive, onPick]);

  return <canvas ref={ref} className={className} style={{ width: '100%', height: '100%', touchAction: interactive ? 'none' : 'auto', cursor: interactive ? 'grab' : 'default' }} aria-hidden="true" />;
}
