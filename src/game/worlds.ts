import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, Material, Mesh, MeshBasicMaterial,
  MeshToonMaterial, Object3D, OctahedronGeometry, Points, PointsMaterial, RingGeometry, SphereGeometry, TorusGeometry,
} from 'three';

export type Theme =
  | 'savanna' | 'asia' | 'europe' | 'northamerica' | 'southamerica' | 'oceania' | 'antarctica'
  | 'desert' | 'rainforest' | 'lake' | 'alpine' | 'coast' | 'volcano';

export interface Palette { ground: string; side: string; under: string; path: string; skyTop: string; skyMid: string; skyBot: string; fog: string; flowers: string[] | null; sea?: string; label: string }

/** Everything a world needs from the scene. Implemented by GameScene. */
export interface WorldHost {
  R: number;
  seed: string;
  m(color: string | number, emissive?: number): MeshToonMaterial;
  mesh(g: BufferGeometry, mat: Material, outline?: number, shadow?: boolean): Mesh;
  add(o: Object3D): void;
  circle(x: number, z: number, r: number): void;
  box(x0: number, x1: number, z0: number, z1: number): void;
  free(x: number, z: number, r: number): boolean;
  scatter(count: number, fn: (x: number, z: number, i: number, r: () => number) => void, minD?: number, maxD?: number, salt?: string): void;
  rng(salt: string): () => number;
  animate(fn: (t: number, dt: number) => void): void;
  lantern(x: number, z: number): void;
  pathPoint(t: number): { x: number; z: number; dx: number; dz: number };
  glow(): import('three').Texture;
}

export const PALETTES: Record<Theme, Palette> = {
  savanna: { ground: '#d8b865', side: '#9a6b3c', under: '#7a5a46', path: '#f1dcaa', skyTop: '#3a8be0', skyMid: '#ffd9a0', skyBot: '#fff1d6', fog: '#ffe6bd', flowers: ['#ff9e5e', '#ffd23f', '#ffffff'], label: 'African savanna' },
  asia: { ground: '#78cf8c', side: '#8a6a4a', under: '#6f6486', path: '#f3dfe0', skyTop: '#6ea8f0', skyMid: '#ffd2e2', skyBot: '#fff2f7', fog: '#ffe3ee', flowers: ['#ffb7d5', '#ffffff', '#ff8fb8'], label: 'Asian garden' },
  europe: { ground: '#68c466', side: '#8f6a49', under: '#7b6b86', path: '#e6dcc4', skyTop: '#4a86e6', skyMid: '#a9d6ff', skyBot: '#e8f5ff', fog: '#d8ecff', flowers: ['#ff7eb6', '#ffd23f', '#ffffff', '#b794ff'], label: 'European countryside' },
  northamerica: { ground: '#63b968', side: '#7d5a3a', under: '#6b5f78', path: '#e2d2ac', skyTop: '#2f78dd', skyMid: '#9bd2ff', skyBot: '#e6f4ff', fog: '#d3e9ff', flowers: ['#ffd23f', '#ff9e5e', '#ffffff'], label: 'North American wilds' },
  southamerica: { ground: '#3fbf72', side: '#7a5230', under: '#5f5a78', path: '#f0dba5', skyTop: '#2b84e6', skyMid: '#9fe3ff', skyBot: '#e9fbff', fog: '#d7f3ff', flowers: ['#ff5d8f', '#ffd23f', '#9b6bff', '#ff9e5e'], label: 'South American highlands' },
  oceania: { ground: '#8fd07a', side: '#b08a55', under: '#6f7c9a', path: '#f5e3b0', skyTop: '#2a8ae8', skyMid: '#8fe0ff', skyBot: '#eafcff', fog: '#d9f6ff', flowers: ['#ffd23f', '#ff7a59', '#ffffff'], sea: '#33b7e8', label: 'Oceanian shores' },
  antarctica: { ground: '#eef6ff', side: '#a9c8ee', under: '#7fa6d8', path: '#cfe3fb', skyTop: '#1b2a72', skyMid: '#4a74c0', skyBot: '#cfe8ff', fog: '#c6defa', flowers: null, sea: '#2a6fb5', label: 'Antarctic ice' },
  desert: { ground: '#e8c17a', side: '#b8864a', under: '#8a6a50', path: '#f7e3b0', skyTop: '#3a8de0', skyMid: '#ffd49a', skyBot: '#fff0d0', fog: '#ffe5b8', flowers: null, label: 'Desert' },
  rainforest: { ground: '#2fa05a', side: '#6a4a2a', under: '#4d5a6a', path: '#d6c48a', skyTop: '#2c8a9e', skyMid: '#9fe3c9', skyBot: '#e0fff2', fog: '#c8f2dc', flowers: ['#ff4f81', '#ffb030', '#ffffff', '#b45cff'], label: 'Rainforest' },
  lake: { ground: '#70c97a', side: '#8a6a4a', under: '#6a6f94', path: '#e6dcc0', skyTop: '#3e84e4', skyMid: '#a6d8ff', skyBot: '#eaf6ff', fog: '#d8ecff', flowers: ['#ffffff', '#ffd23f', '#b794ff'], label: 'Lakeside' },
  alpine: { ground: '#f2f8ff', side: '#9db6d8', under: '#7a8fb8', path: '#d6e6fa', skyTop: '#4f86e0', skyMid: '#c4def8', skyBot: '#f4f9ff', fog: '#e1eefc', flowers: null, label: 'Alpine snow' },
  coast: { ground: '#f1dd9f', side: '#c9a468', under: '#6f7c9a', path: '#fff0c2', skyTop: '#2a8ae8', skyMid: '#8fe0ff', skyBot: '#eafcff', fog: '#d9f6ff', flowers: ['#ff7a59', '#ffd23f', '#ffffff'], sea: '#3bb9ea', label: 'Seaside' },
  volcano: { ground: '#5a4a5a', side: '#3d3140', under: '#33293a', path: '#8a7690', skyTop: '#33224f', skyMid: '#c4605a', skyBot: '#ffb070', fog: '#e59a78', flowers: null, label: 'Volcanic island' },
};

/* ------------------------------ continents ------------------------------ */
const CONTINENT: Record<string, Theme> = {};
const put = (t: Theme, codes: string) => codes.split(' ').forEach((c) => (CONTINENT[c] = t));
put('savanna', 'ZA NA EG KE TZ MA NG GH ET UG ZW BW MZ SN TN DZ MG RW ZM AO');
put('asia', 'TH ID JP TR GE CN IN VN KR TW MY PH LK NP SG AM AZ KZ IL JO AE SA KH LA MM');
put('europe', 'GB IS NO FR CH AT IT PT SI FO DE ES NL BE SE FI DK IE PL CZ HU HR GR RO BG EE LV LT SK LU MT CY');
put('northamerica', 'CA US MX GL CR PA GT BZ CU JM');
put('southamerica', 'AR CL PE CO BR EC BO UY PY VE');
put('oceania', 'AU NZ FJ PG WS TO');
put('antarctica', 'AQ');

export interface ThemeInput { motif: string; env: string[]; climate: string; countryCode: string; lat: number; lng: number }

/** Strong landscape signals (desert, rainforest, lakes, alpine snow, beaches, volcanoes) win; otherwise the continent decides the look. */
export function themeFor(p: ThemeInput): Theme {
  if (p.motif === 'volcano') return 'volcano';
  if (p.motif === 'desert' || p.motif === 'canyon' || p.climate === 'arid') return 'desert';
  if (p.climate === 'tropical' && (p.env.includes('forests') || p.motif === 'forest')) return 'rainforest';
  if ((p.climate === 'alpine' || p.climate === 'subarctic') && Math.abs(p.lat) > 38) return p.lat < -60 ? 'antarctica' : 'alpine';
  if (p.motif === 'lake') return 'lake';
  if (p.motif === 'coast' || p.motif === 'island') return 'coast';
  if (CONTINENT[p.countryCode]) return CONTINENT[p.countryCode];
  if (p.lat < -60) return 'antarctica';
  if (p.lng < -30) return p.lat > 12 ? 'northamerica' : 'southamerica';
  if (p.lng > 110 && p.lat < -10) return 'oceania';
  if (p.lng > 25 && p.lat > 5) return 'asia';
  if (p.lat < 15 && p.lng > -20 && p.lng < 55) return 'savanna';
  return 'europe';
}

export const ALL_THEMES = Object.keys(PALETTES) as Theme[];

/* ------------------------------ shared pieces ------------------------------ */
const PI2 = Math.PI * 2;

function pine(h: WorldHost, x: number, z: number, s = 1, snow = false, col = '#2f9a5c') {
  const g = new Group(); const trunk = h.mesh(new CylinderGeometry(0.16 * s, 0.22 * s, 0.9 * s, 6), h.m('#7a5230'), 0.05); trunk.position.y = 0.45 * s; g.add(trunk);
  for (let i = 0; i < 3; i++) { const c = h.mesh(new ConeGeometry((1.05 - i * 0.27) * s, 1.1 * s, 8), h.m(snow ? (i === 2 ? '#f2f7ff' : '#3d8f6d') : col), 0.04); c.position.y = (1.2 + i * 0.7) * s; g.add(c); }
  g.position.set(x, 0, z); h.add(g); h.circle(x, z, 0.45 * s);
}
function roundTree(h: WorldHost, x: number, z: number, s = 1, col = '#4fbe72', trunkCol = '#7a5230') {
  const g = new Group(); const trunk = h.mesh(new CylinderGeometry(0.17 * s, 0.24 * s, 1.2 * s, 6), h.m(trunkCol), 0.05); trunk.position.y = 0.6 * s; g.add(trunk);
  const crown = h.mesh(new IcosahedronGeometry(0.95 * s, 1), h.m(col), 0.04); crown.position.y = 1.9 * s; g.add(crown);
  g.position.set(x, 0, z); h.add(g); h.circle(x, z, 0.45 * s);
  return g;
}
function palm(h: WorldHost, x: number, z: number, s = 1) {
  const g = new Group(); const trunk = h.mesh(new CylinderGeometry(0.13 * s, 0.2 * s, 2.4 * s, 6), h.m('#b58a55'), 0.05); trunk.position.y = 1.2 * s; trunk.rotation.z = 0.12; g.add(trunk);
  for (let i = 0; i < 6; i++) { const leaf = h.mesh(new BoxGeometry(1.5 * s, 0.05, 0.35 * s), h.m('#3fae6a'), 0.05); leaf.position.set(Math.cos(i) * 0.7 * s + 0.2, 2.5 * s, Math.sin(i) * 0.7 * s); leaf.rotation.y = -i; leaf.rotation.z = -0.35; g.add(leaf); }
  const co = h.mesh(new SphereGeometry(0.16 * s, 8, 6), h.m('#7a4a22'), 0.04); co.position.set(0.25 * s, 2.35 * s, 0); g.add(co);
  g.position.set(x, 0, z); h.add(g); h.circle(x, z, 0.4 * s);
}
function rock(h: WorldHost, x: number, z: number, s = 1, col = '#9aa0b5') { const r = h.mesh(new IcosahedronGeometry(0.7 * s, 0), h.m(col), 0.05); r.position.set(x, 0.3 * s, z); r.rotation.set(x, z, 0); h.add(r); h.circle(x, z, 0.65 * s); }
function acacia(h: WorldHost, x: number, z: number, s = 1) {
  const g = new Group(); const trunk = h.mesh(new CylinderGeometry(0.14 * s, 0.22 * s, 2.2 * s, 6), h.m('#6a4a2a'), 0.05); trunk.position.y = 1.1 * s; trunk.rotation.z = 0.08; g.add(trunk);
  const top = h.mesh(new SphereGeometry(1.5 * s, 12, 8), h.m('#6fae4a'), 0.04); top.scale.set(1, 0.32, 1); top.position.y = 2.4 * s; g.add(top);
  const top2 = h.mesh(new SphereGeometry(1.0 * s, 10, 8), h.m('#7fbe54'), 0.04); top2.scale.set(1, 0.3, 1); top2.position.set(0.6 * s, 2.8 * s, 0.2 * s); g.add(top2);
  g.position.set(x, 0, z); h.add(g); h.circle(x, z, 0.35 * s);
}
function baobab(h: WorldHost, x: number, z: number, s = 1) {
  const g = new Group(); const trunk = h.mesh(new CylinderGeometry(0.8 * s, 1.15 * s, 3 * s, 10), h.m('#9a7a5a'), 0.03); trunk.position.y = 1.5 * s; g.add(trunk);
  for (let i = 0; i < 5; i++) { const b = h.mesh(new CylinderGeometry(0.1 * s, 0.18 * s, 1.4 * s, 5), h.m('#8a6a4a'), 0.05); b.position.set(Math.cos(i * 1.3) * 0.6 * s, 3.4 * s, Math.sin(i * 1.3) * 0.6 * s); b.rotation.z = Math.cos(i * 1.3) * 0.7; b.rotation.x = Math.sin(i * 1.3) * 0.7; g.add(b); }
  const tuft = h.mesh(new IcosahedronGeometry(0.9 * s, 1), h.m('#5fa84a'), 0.04); tuft.position.y = 4.3 * s; tuft.scale.set(1.5, 0.7, 1.5); g.add(tuft);
  g.position.set(x, 0, z); h.add(g); h.circle(x, z, 1.1 * s);
}
function bamboo(h: WorldHost, x: number, z: number, n = 7) {
  const rnd = h.rng(`bamboo${x}${z}`);
  for (let i = 0; i < n; i++) { const hh = 3 + rnd() * 2.2; const c = h.mesh(new CylinderGeometry(0.07, 0.09, hh, 6), h.m(i % 2 ? '#7cc45a' : '#6ab04c'), 0.05); c.position.set(x + (rnd() - 0.5) * 1.6, hh / 2, z + (rnd() - 0.5) * 1.6); h.add(c);
    const leaf = h.mesh(new SphereGeometry(0.4, 6, 5), h.m('#8ed46a'), 0.04); leaf.scale.set(1.6, 0.4, 0.8); leaf.position.set(c.position.x, hh, c.position.z); leaf.rotation.y = rnd() * 3; h.add(leaf); }
  h.circle(x, z, 1.2);
}
function cactus(h: WorldHost, x: number, z: number, s = 1) {
  const g = new Group(); const body = h.mesh(new CapsuleGeometry(0.2, 1.1, 4, 8), h.m('#4fa86a'), 0.05); body.position.y = 0.75; g.add(body);
  const arm = h.mesh(new CapsuleGeometry(0.12, 0.5, 4, 8), h.m('#4fa86a'), 0.05); arm.position.set(0.3, 0.9, 0); arm.rotation.z = -0.9; g.add(arm);
  const fl = h.mesh(new SphereGeometry(0.1, 6, 5), h.m('#ff7aa8'), 0.04); fl.position.set(0, 1.45, 0); g.add(fl);
  g.position.set(x, 0, z); g.scale.setScalar(s); h.add(g); h.circle(x, z, 0.4 * s);
}
function pyramid(h: WorldHost, x: number, z: number, s = 1, col = '#e9c476') {
  const p = h.mesh(new ConeGeometry(2.4 * s, 3.2 * s, 4), h.m(col), 0.03); p.position.set(x, 1.6 * s, z); p.rotation.y = Math.PI / 4; h.add(p);
  const door = h.mesh(new BoxGeometry(0.5 * s, 0.7 * s, 0.1), h.m('#5b4326'), 0, false); door.position.set(x, 0.35 * s, z + 1.62 * s); h.add(door);
  h.circle(x, z, 2.1 * s);
}
function hut(h: WorldHost, x: number, z: number, wall = '#d9b98c', roof = '#c4a25a', s = 1) {
  const g = new Group(); const b = h.mesh(new CylinderGeometry(0.9 * s, 0.95 * s, 1.1 * s, 10), h.m(wall), 0.04); b.position.y = 0.55 * s; g.add(b);
  const r = h.mesh(new ConeGeometry(1.25 * s, 1.1 * s, 10), h.m(roof), 0.04); r.position.y = 1.65 * s; g.add(r);
  const d = h.mesh(new BoxGeometry(0.4 * s, 0.7 * s, 0.1), h.m('#5b4326'), 0, false); d.position.set(0, 0.35 * s, 0.93 * s); g.add(d);
  g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI; h.add(g); h.circle(x, z, 1.1 * s);
}
function house(h: WorldHost, x: number, z: number, wall: string, roof: string, s = 1) {
  const g = new Group(); const b = h.mesh(new BoxGeometry(1.6 * s, 1.2 * s, 1.4 * s), h.m(wall), 0.04); b.position.y = 0.6 * s; g.add(b);
  const r = h.mesh(new ConeGeometry(1.35 * s, 0.9 * s, 4), h.m(roof), 0.04); r.position.y = 1.65 * s; r.rotation.y = Math.PI / 4; g.add(r);
  const d = h.mesh(new BoxGeometry(0.35 * s, 0.6 * s, 0.1), h.m('#5b4326'), 0, false); d.position.set(0, 0.3 * s, 0.72 * s); g.add(d);
  g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI + (x * 7 % 1) * 0.6; h.add(g); h.circle(x, z, 1.15 * s);
}
function cloudShape(h: WorldHost, mat: Material, n = 4) { const g = new Group(); for (let k = 0; k < n; k++) { const s = h.mesh(new SphereGeometry(1.2 + (k % 2) * 0.5, 10, 8), mat, 0, false); s.position.set(k * 1.6 - 2.4, (k % 2) * 0.4, (k % 3) * 0.4); s.scale.y = 0.6; g.add(s); } return g; }
export { cloudShape };

/** Distant backdrop ring of mountains/buildings/etc. */
function ring(h: WorldHost, n: number, dist: number, fn: (a: number, i: number, r: () => number) => Object3D | null, salt = 'ring') {
  const r = h.rng(salt);
  for (let i = 0; i < n; i++) { const a = (i / n) * PI2 + r() * 0.2; const o = fn(a, i, r); if (o) { o.position.x = Math.cos(a) * dist; o.position.z = Math.sin(a) * dist; h.add(o); } }
}
function peak(h: WorldHost, s: number, col: string, snow = true, yBase = -8) {
  const g = new Group(); const c = h.mesh(new ConeGeometry(s * 0.75, s * 1.5, 6), h.m(col), 0, false); c.position.y = yBase + s * 0.75; g.add(c);
  if (snow) { const cap = h.mesh(new ConeGeometry(s * 0.3, s * 0.52, 6), h.m('#ffffff'), 0, false); cap.position.y = yBase + s * 1.25; g.add(cap); }
  return g;
}

/* ------------------------------ animals ------------------------------ */
interface QuadSpec {
  body: string; accent?: string; len: number; hgt: number; legL: number; legR?: number; neck?: number; neckAng?: number; head: number; snout?: number; humps?: number; ears?: 'round' | 'long' | 'big' | 'horn';
  trunk?: boolean; tusks?: boolean; spots?: string; tail?: boolean; fluffy?: boolean; mane?: string;
}
const QUADS: Record<string, QuadSpec> = {
  camel: { body: '#c9a26b', accent: '#a98350', len: 1.6, hgt: 0.7, legL: 1.1, legR: 0.1, neck: 1.0, neckAng: 0.7, head: 0.3, snout: 0.25, humps: 2, ears: 'round', tail: true },
  giraffe: { body: '#e8b84a', accent: '#9a5a1e', len: 1.4, hgt: 0.6, legL: 1.5, legR: 0.09, neck: 2.2, neckAng: 0.12, head: 0.28, snout: 0.22, ears: 'horn', spots: '#9a5a1e', tail: true },
  elephant: { body: '#9aa0ad', accent: '#7a808c', len: 2.0, hgt: 1.2, legL: 0.9, legR: 0.28, neck: 0.3, neckAng: 1.1, head: 0.6, snout: 0.2, ears: 'big', trunk: true, tusks: true, tail: true },
  llama: { body: '#f4ead4', accent: '#c9b48a', len: 1.2, hgt: 0.6, legL: 0.9, legR: 0.08, neck: 0.9, neckAng: 0.35, head: 0.22, snout: 0.15, ears: 'long', fluffy: true, tail: true },
  bison: { body: '#5b3a24', accent: '#3d2616', len: 1.7, hgt: 0.95, legL: 0.7, legR: 0.13, neck: 0.25, neckAng: 1.2, head: 0.45, snout: 0.2, humps: 1, ears: 'horn', mane: '#3d2616', tail: true },
  sheep: { body: '#fbfbf6', accent: '#2c2c34', len: 1.0, hgt: 0.6, legL: 0.5, legR: 0.07, neck: 0.2, neckAng: 1.0, head: 0.2, snout: 0.1, ears: 'round', fluffy: true },
  panda: { body: '#ffffff', accent: '#1b1b24', len: 1.1, hgt: 0.8, legL: 0.5, legR: 0.15, neck: 0.2, neckAng: 1.0, head: 0.42, snout: 0.12, ears: 'round', tail: false },
  deer: { body: '#b98a56', accent: '#f4ead4', len: 1.2, hgt: 0.5, legL: 1.0, legR: 0.06, neck: 0.8, neckAng: 0.45, head: 0.2, snout: 0.2, ears: 'horn', tail: true },
};

function quadruped(h: WorldHost, kind: keyof typeof QUADS, cx: number, cz: number, rad: number, s = 1, speed = 0.12, phase = 0) {
  const q = QUADS[kind]; const g = new Group(); const body = new Group(); g.add(body);
  const torso = h.mesh(new CapsuleGeometry(q.hgt * 0.5, q.len, 6, 10), h.m(q.body), 0.045); torso.rotation.z = Math.PI / 2; torso.position.y = q.legL + q.hgt * 0.45; body.add(torso);
  if (q.fluffy) { for (let i = 0; i < 6; i++) { const f = h.mesh(new SphereGeometry(q.hgt * 0.42, 8, 6), h.m(q.body), 0.04); f.position.set(-q.len * 0.4 + i * (q.len * 0.16), q.legL + q.hgt * 0.5 + (i % 2) * 0.05, (i % 2 ? 0.1 : -0.1)); body.add(f); } }
  if (q.humps) for (let i = 0; i < q.humps; i++) { const hp = h.mesh(new SphereGeometry(q.hgt * 0.38, 8, 6), h.m(q.accent ?? q.body), 0.045); hp.position.set(q.humps === 1 ? q.len * 0.32 : -q.len * 0.22 + i * q.len * 0.45, q.legL + q.hgt * 1.05, 0); body.add(hp); }
  if (q.spots) for (let i = 0; i < 7; i++) { const sp = h.mesh(new SphereGeometry(0.1, 6, 5), h.m(q.spots), 0, false); sp.position.set(-q.len * 0.35 + (i % 4) * q.len * 0.25, q.legL + q.hgt * (0.55 + (i % 3) * 0.15), (i % 2 ? 1 : -1) * q.hgt * 0.42); body.add(sp); }
  // neck + head
  const neckG = new Group(); neckG.position.set(q.len * 0.55, q.legL + q.hgt * 0.65, 0); neckG.rotation.z = -(q.neckAng ?? 0.6); body.add(neckG);
  const nk = h.mesh(new CapsuleGeometry(0.14 * Math.max(1, s * 0.9) * (q.trunk ? 2 : 1), q.neck ?? 0.5, 4, 8), h.m(q.body), 0.05); nk.position.y = (q.neck ?? 0.5) / 2; neckG.add(nk);
  const head = new Group(); head.position.y = (q.neck ?? 0.5) + q.head * 0.3; neckG.add(head);
  const sk = h.mesh(new SphereGeometry(q.head, 10, 8), h.m(q.body), 0.05); head.add(sk);
  const sn = h.mesh(new CapsuleGeometry(q.head * 0.55, q.snout ?? 0.15, 4, 8), h.m(q.accent && kind === 'deer' ? q.body : q.body), 0.05); sn.rotation.z = Math.PI / 2 + 0.3; sn.position.set(q.head * 0.8 + (q.snout ?? 0.15) * 0.4, -q.head * 0.25, 0); head.add(sn);
  for (const z of [-1, 1]) { const e = h.mesh(new SphereGeometry(0.04 + q.head * 0.06, 6, 5), new MeshBasicMaterial({ color: 0x14141e }), 0, false); e.position.set(q.head * 0.55, q.head * 0.25, z * q.head * 0.55); head.add(e);
    if (q.ears === 'big') { const ear = h.mesh(new SphereGeometry(q.head * 1.1, 8, 6), h.m(q.accent ?? q.body), 0.04); ear.scale.set(0.2, 1, 0.9); ear.position.set(-q.head * 0.5, 0, z * q.head * 1.4); head.add(ear); }
    else if (q.ears === 'long') { const ear = h.mesh(new CapsuleGeometry(0.05, q.head * 1.1, 3, 6), h.m(q.body), 0.05); ear.position.set(-q.head * 0.2, q.head * 1.0, z * q.head * 0.45); ear.rotation.z = 0.2; head.add(ear); }
    else if (q.ears === 'horn') { const ear = h.mesh(new ConeGeometry(0.06, q.head * (kind === 'deer' ? 2.2 : 0.9), 5), h.m(kind === 'bison' ? '#efe6d2' : (q.accent ?? '#8a6a4a')), 0.05); ear.position.set(-q.head * 0.1, q.head * 1.2, z * q.head * 0.5); ear.rotation.x = z * 0.35; head.add(ear); }
    else { const ear = h.mesh(new SphereGeometry(q.head * 0.35, 6, 5), h.m(q.accent ?? q.body), 0.04); ear.position.set(-q.head * 0.2, q.head * 0.85, z * q.head * 0.6); head.add(ear); } }
  if (kind === 'panda') for (const z of [-1, 1]) { const p = h.mesh(new SphereGeometry(0.11, 6, 5), h.m('#1b1b24'), 0, false); p.position.set(q.head * 0.78, q.head * 0.22, z * q.head * 0.42); head.add(p); }
  if (q.trunk) { const tr = h.mesh(new CapsuleGeometry(0.15, 1.0, 4, 8), h.m(q.body), 0.05); tr.position.set(q.head * 1.0, -0.55, 0); tr.rotation.z = -0.25; head.add(tr); }
  if (q.tusks) for (const z of [-1, 1]) { const t = h.mesh(new ConeGeometry(0.07, 0.55, 5), h.m('#fff6e0'), 0.04); t.position.set(q.head * 0.95, -0.35, z * 0.28); t.rotation.z = -1.1; head.add(t); }
  if (q.tail) { const t = h.mesh(new CylinderGeometry(0.03, 0.05, 0.7, 5), h.m(q.accent ?? q.body), 0.05); t.position.set(-q.len * 0.62, q.legL + q.hgt * 0.5, 0); t.rotation.z = 0.5; body.add(t); }
  // legs
  const legs: Group[] = [];
  for (const [lx, lz] of [[q.len * 0.38, q.hgt * 0.28], [q.len * 0.38, -q.hgt * 0.28], [-q.len * 0.38, q.hgt * 0.28], [-q.len * 0.38, -q.hgt * 0.28]] as const) {
    const lg = new Group(); lg.position.set(lx, q.legL + q.hgt * 0.1, lz); const leg = h.mesh(new CylinderGeometry(q.legR ?? 0.1, (q.legR ?? 0.1) * 0.85, q.legL, 6), h.m(kind === 'panda' ? '#1b1b24' : q.body), 0.06); leg.position.y = -q.legL / 2; lg.add(leg); body.add(lg); legs.push(lg); }
  g.scale.setScalar(s); h.add(g);
  const dir = (cx + cz) % 2 > 1 ? 1 : -1;
  h.animate((t) => {
    const a = phase + t * speed * dir; g.position.set(cx + Math.cos(a) * rad, 0, cz + Math.sin(a) * rad); g.rotation.y = -a + (dir > 0 ? 0 : Math.PI) + Math.PI / 2 * (dir > 0 ? 0 : 0);
    g.rotation.y = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir) + Math.PI / 2 - Math.PI / 2;
    // model faces +x locally → rotate so local +x points along motion
    const mx = -Math.sin(a) * dir; const mz = Math.cos(a) * dir; g.rotation.y = Math.atan2(-mz, mx);
    const w = t * 5.2 * Math.max(0.6, speed * 6) + phase * 7;
    legs[0].rotation.z = Math.sin(w) * 0.5; legs[3].rotation.z = Math.sin(w) * 0.5; legs[1].rotation.z = -Math.sin(w) * 0.5; legs[2].rotation.z = -Math.sin(w) * 0.5;
    body.position.y = Math.abs(Math.sin(w)) * 0.05; head.rotation.z = Math.sin(w * 0.5) * 0.08;
  });
}

function hopper(h: WorldHost, cx: number, cz: number, rad: number, s = 1, phase = 0) {
  const g = new Group(); const body = new Group(); g.add(body);
  const m = h.m('#c98a52'); const light = h.m('#f0d2a6');
  const torso = h.mesh(new CapsuleGeometry(0.4, 0.7, 6, 10), m, 0.05); torso.position.y = 1.0; torso.rotation.z = -0.5; body.add(torso);
  const belly = h.mesh(new SphereGeometry(0.34, 8, 6), light, 0.04); belly.position.set(0.18, 0.95, 0); body.add(belly);
  const head = h.mesh(new SphereGeometry(0.26, 10, 8), m, 0.05); head.position.set(0.55, 1.75, 0); body.add(head);
  const sn = h.mesh(new CapsuleGeometry(0.12, 0.2, 4, 8), m, 0.05); sn.rotation.z = Math.PI / 2; sn.position.set(0.82, 1.68, 0); body.add(sn);
  for (const z of [-1, 1]) { const ear = h.mesh(new CapsuleGeometry(0.05, 0.35, 3, 6), m, 0.05); ear.position.set(0.5, 2.1, z * 0.12); body.add(ear); const leg = h.mesh(new CapsuleGeometry(0.12, 0.5, 4, 8), m, 0.05); leg.position.set(-0.1, 0.35, z * 0.22); leg.rotation.z = 0.5; body.add(leg); const arm = h.mesh(new CapsuleGeometry(0.05, 0.25, 3, 6), m, 0.05); arm.position.set(0.45, 1.3, z * 0.22); arm.rotation.z = -0.6; body.add(arm); }
  const tail = h.mesh(new ConeGeometry(0.16, 1.0, 6), m, 0.05); tail.position.set(-0.75, 0.45, 0); tail.rotation.z = 1.2; body.add(tail);
  g.scale.setScalar(s); h.add(g);
  h.animate((t) => {
    const a = phase + t * 0.25; const hop = Math.abs(Math.sin(t * 2.2 + phase)); g.position.set(cx + Math.cos(a) * rad, hop * 0.9, cz + Math.sin(a) * rad);
    g.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); body.rotation.z = Math.sin(t * 2.2 + phase) * 0.12;
  });
}

function penguin(h: WorldHost, x: number, z: number, s = 1) {
  const g = new Group(); const body = h.mesh(new CapsuleGeometry(0.3, 0.45, 6, 10), h.m('#20242f'), 0.05); body.position.y = 0.6; g.add(body);
  const belly = h.mesh(new SphereGeometry(0.26, 10, 8), h.m('#fdfdff'), 0.03); belly.scale.set(0.85, 1.2, 0.6); belly.position.set(0, 0.58, 0.14); g.add(belly);
  const head = h.mesh(new SphereGeometry(0.24, 10, 8), h.m('#20242f'), 0.05); head.position.y = 1.15; g.add(head);
  const beak = h.mesh(new ConeGeometry(0.07, 0.2, 5), h.m('#ff9a2e'), 0.05); beak.rotation.x = Math.PI / 2; beak.position.set(0, 1.12, 0.28); g.add(beak);
  for (const sx of [-1, 1]) { const e = h.mesh(new SphereGeometry(0.035, 6, 5), new MeshBasicMaterial({ color: 0xffffff }), 0, false); e.position.set(sx * 0.1, 1.2, 0.2); g.add(e); const f = h.mesh(new SphereGeometry(0.12, 6, 5), h.m('#ff9a2e'), 0.05); f.scale.set(1, 0.4, 1.4); f.position.set(sx * 0.14, 0.04, 0.08); g.add(f); const w = h.mesh(new CapsuleGeometry(0.06, 0.3, 3, 6), h.m('#20242f'), 0.05); w.position.set(sx * 0.34, 0.7, 0); w.rotation.z = sx * 0.4; g.add(w); }
  g.scale.setScalar(s); g.position.set(x, 0, z); h.add(g); h.circle(x, z, 0.35 * s);
  const ph = x * 3 + z; h.animate((t) => { g.rotation.z = Math.sin(t * 3.4 + ph) * 0.12; g.position.y = Math.abs(Math.sin(t * 3.4 + ph)) * 0.05; g.rotation.y = Math.sin(t * 0.4 + ph) * 0.8 + Math.atan2(-x, -z) + Math.PI; });
}
function bird(h: WorldHost, cx: number, cz: number, rad: number, y: number, col: string, wing: string, phase = 0, speed = 0.5) {
  const g = new Group(); const b = h.mesh(new SphereGeometry(0.22, 8, 6), h.m(col), 0.04, false); b.scale.set(1.5, 0.8, 0.8); g.add(b);
  const wings: Mesh[] = [];
  for (const s of [-1, 1]) { const w = h.mesh(new SphereGeometry(0.28, 6, 5), h.m(wing), 0.03, false); w.scale.set(0.7, 0.14, 1.4); w.position.z = s * 0.28; g.add(w); wings.push(w); }
  h.add(g); h.animate((t) => { const a = phase + t * speed; g.position.set(cx + Math.cos(a) * rad, y + Math.sin(t * 1.3 + phase) * 0.3, cz + Math.sin(a) * rad); g.rotation.y = Math.atan2(-Math.cos(a), Math.sin(a)) ; wings[0].rotation.x = Math.sin(t * 12 + phase) * 0.6; wings[1].rotation.x = -Math.sin(t * 12 + phase) * 0.6; });
}
function pond(h: WorldHost, x: number, z: number, r: number, col = '#4aa8d8', fish = false) {
  const p = h.mesh(new CylinderGeometry(r, r, 0.12, 24), h.m(col), 0.02, false); p.position.set(x, 0.03, z); h.add(p);
  const rim = h.mesh(new TorusGeometry(r, 0.12, 6, 28), h.m('#a89a8a'), 0.02, false); rim.rotation.x = Math.PI / 2; rim.position.set(x, 0.1, z); h.add(rim); h.circle(x, z, r * 0.9);
  if (fish) for (let i = 0; i < 3; i++) { const f = h.mesh(new SphereGeometry(0.16, 6, 5), h.m(i % 2 ? '#ff7a3d' : '#ffffff'), 0.03, false); f.scale.set(1.6, 0.5, 0.7); h.add(f); h.animate((t) => { const a = t * (0.5 + i * 0.2) + i * 2; f.position.set(x + Math.cos(a) * r * 0.6, 0.12, z + Math.sin(a) * r * 0.6); f.rotation.y = -a; }); }
}
function snowfall(h: WorldHost, color = 0xffffff, n = 160, size = 0.12, rise = false) {
  const R = h.R; const pos = new Float32Array(n * 3); const base = new Float32Array(n * 3); const rnd = h.rng('snow');
  for (let i = 0; i < n; i++) { const a = rnd() * PI2; const d = Math.sqrt(rnd()) * R; base.set([Math.cos(a) * d, rnd() * 12, Math.sin(a) * d], i * 3); }
  const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3));
  const mat = new PointsMaterial({ color, size, transparent: true, opacity: 0.9, depthWrite: false, map: h.glow(), blending: rise ? AdditiveBlending : undefined }); const pts = new Points(g, mat); h.add(pts);
  h.animate((t) => { const p = g.getAttribute('position') as BufferAttribute; for (let i = 0; i < n; i++) { const y = rise ? (base[i * 3 + 1] + t * 0.9) % 12 : 12 - ((12 - base[i * 3 + 1] + t * 1.2) % 12); p.setXYZ(i, base[i * 3] + Math.sin(t * 0.5 + i) * 0.6, y, base[i * 3 + 2] + Math.cos(t * 0.4 + i) * 0.6); } p.needsUpdate = true; });
}
function seaBelow(h: WorldHost, col: string, y = -3.2) { const sea = h.mesh(new CylinderGeometry(90, 90, 0.2, 40), h.m(col), 0, false); sea.position.y = y; h.add(sea); }
function sailboat(h: WorldHost, x: number, z: number, y: number, col = '#ff9e5e') {
  const b = new Group(); const hull = h.mesh(new BoxGeometry(2, 0.5, 0.8), h.m('#ffffff'), 0.04); b.add(hull); const sail = h.mesh(new ConeGeometry(0.7, 2, 3), h.m(col), 0.04); sail.position.y = 1.2; b.add(sail); b.position.set(x, y, z); h.add(b);
  h.animate((t) => { b.position.y = y + Math.sin(t) * 0.1; b.rotation.z = Math.sin(t * 0.8) * 0.06; b.position.x = x + Math.sin(t * 0.1) * 3; });
}
function lighthouse(h: WorldHost, x: number, z: number) {
  const g = new Group(); for (let i = 0; i < 4; i++) { const seg = h.mesh(new CylinderGeometry(0.9 - i * 0.12, 1.0 - i * 0.12, 1.2, 12), h.m(i % 2 ? '#e8403a' : '#ffffff'), 0.03); seg.position.y = 0.6 + i * 1.2; g.add(seg); }
  const lamp = h.mesh(new SphereGeometry(0.5, 10, 8), h.m('#fff4c8', 0xffd884), 0.03, false); lamp.position.y = 5.2; g.add(lamp);
  const cap = h.mesh(new ConeGeometry(0.75, 0.7, 10), h.m('#e8403a'), 0.03); cap.position.y = 5.9; g.add(cap);
  g.position.set(x, 0, z); h.add(g); h.circle(x, z, 1.0);
}
function castle(h: WorldHost, x: number, z: number) {
  const g = new Group(); const stone = h.m('#cfc6c0'); const roof = h.m('#c2564a');
  const keep = h.mesh(new BoxGeometry(3.2, 3.6, 3.2), stone, 0.03); keep.position.y = 1.8; g.add(keep);
  const kr = h.mesh(new ConeGeometry(2.3, 1.6, 4), roof, 0.03); kr.position.y = 4.4; kr.rotation.y = Math.PI / 4; g.add(kr);
  for (const [dx, dz] of [[-2.4, -2.1], [2.4, -2.1], [-2.4, 2.1], [2.4, 2.1]] as const) { const tw = h.mesh(new CylinderGeometry(0.75, 0.85, 3.2, 10), stone, 0.03); tw.position.set(dx, 1.6, dz); g.add(tw); const tr = h.mesh(new ConeGeometry(1.0, 1.3, 10), roof, 0.03); tr.position.set(dx, 3.85, dz); g.add(tr); }
  const gate = h.mesh(new BoxGeometry(1.1, 1.5, 0.2), h.m('#5b4326'), 0, false); gate.position.set(0, 0.75, 1.62); g.add(gate);
  const flag = h.mesh(new BoxGeometry(0.9, 0.5, 0.05), h.m('#ffd23f'), 0, false); flag.position.set(0.5, 5.7, 0); g.add(flag); const pole = h.mesh(new CylinderGeometry(0.03, 0.03, 1.3, 4), h.m('#555'), 0, false); pole.position.y = 5.35; g.add(pole);
  g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI; h.add(g); h.box(x - 4.2, x + 4.2, z - 3.6, z + 3.6);
  h.animate((t) => { flag.rotation.y = Math.sin(t * 3) * 0.3; });
}
function windmill(h: WorldHost, x: number, z: number) {
  const mill = new Group(); const base = h.mesh(new CylinderGeometry(0.9, 1.3, 3, 8), h.m('#f2e3c6'), 0.04); base.position.y = 1.5; mill.add(base); const cap = h.mesh(new ConeGeometry(1.15, 1.2, 8), h.m('#c2564a'), 0.04); cap.position.y = 3.5; mill.add(cap);
  const blades = new Group(); for (let i = 0; i < 4; i++) { const bl = h.mesh(new BoxGeometry(0.28, 2.6, 0.06), h.m('#ffffff'), 0.04); bl.position.y = 1.3; const pv = new Group(); pv.rotation.z = (i * Math.PI) / 2; pv.add(bl); blades.add(pv); } blades.position.set(0, 2.9, 1.0); mill.add(blades);
  mill.position.set(x, 0, z); mill.rotation.y = Math.atan2(-x, -z) + Math.PI; h.add(mill); h.circle(x, z, 1.4); h.animate((t) => { blades.rotation.z = t * 0.9; });
}
function pagoda(h: WorldHost, x: number, z: number) {
  const g = new Group(); const wall = h.m('#e8d8c8'); const roof = h.m('#c2433a'); let y = 0;
  for (let i = 0; i < 5; i++) { const w = 2.4 - i * 0.38; const b = h.mesh(new BoxGeometry(w, 1.0, w), wall, 0.03); b.position.y = y + 0.5; g.add(b); const r = h.mesh(new ConeGeometry(w * 0.95, 0.6, 4), roof, 0.03); r.position.y = y + 1.25; r.rotation.y = Math.PI / 4; g.add(r); y += 1.35; }
  const spire = h.mesh(new CylinderGeometry(0.05, 0.05, 1.2, 5), h.m('#ffd23f'), 0, false); spire.position.y = y + 0.8; g.add(spire);
  g.position.set(x, 0, z); h.add(g); h.circle(x, z, 1.8);
}
function torii(h: WorldHost, x: number, z: number, rotY: number) {
  const g = new Group(); const red = h.m('#e5382f');
  for (const s of [-1, 1]) { const p = h.mesh(new CylinderGeometry(0.2, 0.24, 3.2, 8), red, 0.04); p.position.set(s * 1.5, 1.6, 0); g.add(p); }
  const top = h.mesh(new BoxGeometry(4.4, 0.35, 0.4), h.m('#20242f'), 0.04); top.position.y = 3.3; g.add(top); const beam = h.mesh(new BoxGeometry(3.4, 0.25, 0.3), red, 0.04); beam.position.y = 2.7; g.add(beam);
  g.position.set(x, 0, z); g.rotation.y = rotY; h.add(g); h.circle(x + Math.cos(rotY) * 1.5, z - Math.sin(rotY) * 1.5, 0.3); h.circle(x - Math.cos(rotY) * 1.5, z + Math.sin(rotY) * 1.5, 0.3);
}
function cherry(h: WorldHost, x: number, z: number, s = 1) { const g = roundTree(h, x, z, s, '#ffb7d5', '#6a4a3a'); const extra = h.mesh(new IcosahedronGeometry(0.7 * s, 1), h.m('#ffc9e0'), 0.04); extra.position.set(0.5 * s, 2.3 * s, 0.2 * s); g.add(extra); }
function stepPyramid(h: WorldHost, x: number, z: number, s = 1) {
  const g = new Group(); const cols = ['#c9b98c', '#bba97a', '#ad9a68', '#9f8c58'];
  for (let i = 0; i < 4; i++) { const w = (5 - i * 1.1) * s; const b = h.mesh(new BoxGeometry(w, 0.8 * s, w), h.m(cols[i]), 0.03); b.position.y = 0.4 * s + i * 0.8 * s; g.add(b); }
  const top = h.mesh(new BoxGeometry(1.0 * s, 0.7 * s, 1.0 * s), h.m('#7a7a6a'), 0.03); top.position.y = 3.55 * s; g.add(top);
  const stairs = h.mesh(new BoxGeometry(0.8 * s, 3.4 * s, 0.2), h.m('#d8c898'), 0, false); stairs.position.set(0, 1.7 * s, 2.3 * s); stairs.rotation.x = -0.55; g.add(stairs);
  g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI; h.add(g); h.box(x - 2.8 * s, x + 2.8 * s, z - 2.8 * s, z + 2.8 * s);
}
function uluru(h: WorldHost, x: number, z: number) { const r = h.mesh(new SphereGeometry(4, 16, 12), h.m('#c4563a'), 0.02); r.scale.set(1.6, 0.55, 1.0); r.position.set(x, 0.2, z); h.add(r); const r2 = h.mesh(new SphereGeometry(2.2, 12, 10), h.m('#b24a32'), 0.02); r2.scale.set(1.4, 0.7, 1); r2.position.set(x + 3, 0.2, z + 1); h.add(r2); h.box(x - 6, x + 6, z - 3.4, z + 3.4); }
function operaShell(h: WorldHost, x: number, z: number) { const g = new Group(); for (let i = 0; i < 4; i++) { const s = h.mesh(new SphereGeometry(1.4 - i * 0.2, 12, 8, 0, PI2, 0, Math.PI / 2), h.m('#ffffff'), 0.03); s.scale.set(0.6, 1.1, 1); s.position.set(i * 1.1 - 1.6, 0.5, -i * 0.3); s.rotation.y = 0.3; g.add(s); } const base = h.mesh(new BoxGeometry(5, 0.6, 2.4), h.m('#e8d8c0'), 0.03); base.position.y = 0.3; g.add(base); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI; h.add(g); h.box(x - 3, x + 3, z - 2, z + 2); }
function igloo(h: WorldHost, x: number, z: number) { const d = h.mesh(new SphereGeometry(1.5, 14, 10, 0, PI2, 0, Math.PI / 2), h.m('#f4faff'), 0.03); d.position.set(x, 0, z); h.add(d); const door = h.mesh(new CylinderGeometry(0.5, 0.5, 1.3, 10, 1, false, 0, Math.PI), h.m('#8fb6e8'), 0.02); door.rotation.z = Math.PI / 2; door.rotation.y = Math.PI / 2; door.position.set(x, 0.3, z + 1.3); h.add(door); h.circle(x, z, 1.6); }
function snowman(h: WorldHost, x: number, z: number) { const g = new Group(); const w = h.m('#ffffff'); const a = h.mesh(new SphereGeometry(0.7, 10, 8), w, 0.04); a.position.y = 0.7; g.add(a); const b = h.mesh(new SphereGeometry(0.5, 10, 8), w, 0.04); b.position.y = 1.7; g.add(b); const c = h.mesh(new SphereGeometry(0.34, 10, 8), w, 0.04); c.position.y = 2.4; g.add(c);
  const nose = h.mesh(new ConeGeometry(0.06, 0.3, 5), h.m('#ff8a2e'), 0.04); nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.4, 0.4); g.add(nose); const hat = h.mesh(new CylinderGeometry(0.22, 0.22, 0.4, 8), h.m('#20242f'), 0.04); hat.position.y = 2.85; g.add(hat); const scarf = h.mesh(new TorusGeometry(0.34, 0.07, 6, 12), h.m('#e5382f'), 0.04); scarf.rotation.x = Math.PI / 2; scarf.position.y = 2.1; g.add(scarf);
  g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI; h.add(g); h.circle(x, z, 0.7); }
function chalet(h: WorldHost, x: number, z: number) { const g = new Group(); const b = h.mesh(new BoxGeometry(2.6, 1.6, 2.2), h.m('#a8693a'), 0.04); b.position.y = 0.8; g.add(b); const r = h.mesh(new ConeGeometry(2.1, 1.3, 4), h.m('#f4f8ff'), 0.04); r.position.y = 2.2; r.rotation.y = Math.PI / 4; r.scale.set(1.05, 1, 0.9); g.add(r); const d = h.mesh(new BoxGeometry(0.5, 0.9, 0.1), h.m('#4a2a14'), 0, false); d.position.set(0, 0.45, 1.12); g.add(d); const win = h.mesh(new BoxGeometry(0.5, 0.5, 0.08), h.m('#ffe9a8', 0xffc860), 0, false); win.position.set(0.8, 1.0, 1.12); g.add(win); const ch = h.mesh(new BoxGeometry(0.4, 1, 0.4), h.m('#6a4a3a'), 0.04); ch.position.set(-0.8, 2.4, -0.3); g.add(ch);
  g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI; h.add(g); h.box(x - 1.5, x + 1.5, z - 1.4, z + 1.4); }
function cabin(h: WorldHost, x: number, z: number) { const g = new Group(); for (let i = 0; i < 5; i++) { const l = h.mesh(new CylinderGeometry(0.22, 0.22, 3, 8), h.m(i % 2 ? '#8a5a30' : '#7a4c28'), 0.04); l.rotation.z = Math.PI / 2; l.position.y = 0.25 + i * 0.42; g.add(l); } const r = h.mesh(new ConeGeometry(2.3, 1.2, 4), h.m('#5a3a22'), 0.04); r.position.y = 2.7; r.rotation.y = Math.PI / 4; g.add(r); const d = h.mesh(new BoxGeometry(0.55, 1.0, 0.1), h.m('#3a2414'), 0, false); d.position.set(0, 0.5, 1.3); g.add(d);
  g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI; h.add(g); h.box(x - 1.7, x + 1.7, z - 1.5, z + 1.5); }
function barn(h: WorldHost, x: number, z: number) { const g = new Group(); const b = h.mesh(new BoxGeometry(3.2, 2.2, 2.6), h.m('#c2433a'), 0.04); b.position.y = 1.1; g.add(b); const r = h.mesh(new ConeGeometry(2.3, 1.4, 4), h.m('#8a2a24'), 0.04); r.position.y = 2.9; r.rotation.y = Math.PI / 4; r.scale.set(1.15, 1, 0.95); g.add(r); const d = h.mesh(new BoxGeometry(1.1, 1.5, 0.1), h.m('#ffffff'), 0, false); d.position.set(0, 0.75, 1.32); g.add(d);
  g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI; h.add(g); h.box(x - 1.8, x + 1.8, z - 1.5, z + 1.5); }
function campfire(h: WorldHost, x: number, z: number) { for (let i = 0; i < 5; i++) { const l = h.mesh(new CylinderGeometry(0.07, 0.07, 0.8, 5), h.m('#5a3a22'), 0.04); l.position.set(x, 0.12, z); l.rotation.set(Math.PI / 2, 0, (i / 5) * Math.PI); h.add(l); } const f = h.mesh(new ConeGeometry(0.3, 0.8, 6), h.m('#ff9a2e', 0xff6a00), 0.02, false); f.position.set(x, 0.5, z); h.add(f); h.animate((t) => { f.scale.set(1 + Math.sin(t * 9) * 0.12, 1 + Math.sin(t * 11) * 0.2, 1); }); h.circle(x, z, 0.8); }
function skyline(h: WorldHost, n: number, dist: number, cols: string[]) { ring(h, n, dist, (_a, i, r) => { const hh = 6 + r() * 16; const b = h.mesh(new BoxGeometry(3 + r() * 3, hh, 3 + r() * 3), h.m(cols[i % cols.length]), 0, false); b.position.y = hh / 2 - 8; const g = new Group(); g.add(b); return g; }, 'sky'); }
function mesa(h: WorldHost, s: number, col: string) { const g = new Group(); const m = h.mesh(new CylinderGeometry(s * 0.6, s * 0.95, s * 1.2, 7), h.m(col), 0, false); m.position.y = s * 0.2 - 8; g.add(m); return g; }
function dune(h: WorldHost, x: number, z: number, s: number, col: string) { const d = h.mesh(new SphereGeometry(s, 16, 10), h.m(col), 0, false); d.scale.set(1.6, 0.28, 1); d.position.set(x, -0.05, z); d.rotation.y = x; h.add(d); }
function iceberg(h: WorldHost, x: number, z: number, s: number) { const g = new Group(); const a = h.mesh(new ConeGeometry(s, s * 1.8, 5), h.m('#e6f3ff'), 0.02, false); a.position.y = s * 0.7 - 3; g.add(a); const b = h.mesh(new ConeGeometry(s * 0.6, s * 1.2, 5), h.m('#cfe6ff'), 0.02, false); b.position.set(s * 0.7, s * 0.3 - 3, 0.4); g.add(b); g.position.set(x, 0, z); h.add(g); }
function fern(h: WorldHost, x: number, z: number, s = 1) { const g = new Group(); for (let i = 0; i < 7; i++) { const a = (i / 7) * PI2; const l = h.mesh(new ConeGeometry(0.16 * s, 1.2 * s, 5), h.m(i % 2 ? '#3fbf6a' : '#2fa85a'), 0.04, false); l.position.set(Math.cos(a) * 0.35 * s, 0.5 * s, Math.sin(a) * 0.35 * s); l.rotation.z = -Math.cos(a) * 0.7; l.rotation.x = Math.sin(a) * 0.7; g.add(l); } g.position.set(x, 0, z); h.add(g); }
function jungleTree(h: WorldHost, x: number, z: number, s = 1) { const g = new Group(); const trunk = h.mesh(new CylinderGeometry(0.22 * s, 0.5 * s, 3.2 * s, 7), h.m('#6a4a2a'), 0.05); trunk.position.y = 1.6 * s; g.add(trunk); for (let i = 0; i < 4; i++) { const c = h.mesh(new IcosahedronGeometry((1.1 - i * 0.12) * s, 1), h.m(i % 2 ? '#2a9a52' : '#34b05e'), 0.04); c.position.set(Math.cos(i * 1.7) * 0.6 * s, (3.4 + i * 0.3) * s, Math.sin(i * 1.7) * 0.6 * s); g.add(c); }
  const vine = h.mesh(new CylinderGeometry(0.03, 0.03, 2.2 * s, 4), h.m('#2d7a3a'), 0, false); vine.position.set(0.7 * s, 2.4 * s, 0.3 * s); g.add(vine); g.position.set(x, 0, z); h.add(g); h.circle(x, z, 0.55 * s); }
function volcanoCone(h: WorldHost, x: number, z: number, s: number) {
  const g = new Group(); const cone = h.mesh(new ConeGeometry(s, s * 1.1, 14, 1, true), h.m('#4a3a46'), 0.01); cone.position.y = s * 0.55; g.add(cone);
  const crater = h.mesh(new CylinderGeometry(s * 0.22, s * 0.22, 0.3, 12), h.m('#ff7a2e', 0xff5a00), 0, false); crater.position.y = s * 1.08; g.add(crater);
  for (let i = 0; i < 4; i++) { const l = h.mesh(new BoxGeometry(0.35, s * 0.9, 0.14), h.m('#ff7a2e', 0xff5a00), 0, false); const a = i * 1.6 + 0.4; l.position.set(Math.cos(a) * s * 0.32, s * 0.55, Math.sin(a) * s * 0.32); l.rotation.set(Math.sin(a) * 0.5, -a, -Math.cos(a) * 0.5); g.add(l); }
  g.position.set(x, 0, z); h.add(g); h.circle(x, z, s * 0.85);
  h.animate((t) => { crater.scale.setScalar(1 + Math.sin(t * 3) * 0.06); });
}
function lavaPool(h: WorldHost, x: number, z: number, r: number) { const p = h.mesh(new CylinderGeometry(r, r, 0.1, 16), h.m('#ff7a2e', 0xff5a00), 0, false); p.position.set(x, 0.04, z); h.add(p); h.circle(x, z, r); h.animate((t) => { p.scale.setScalar(1 + Math.sin(t * 2 + x) * 0.03); }); }
function aurora(h: WorldHost) { const cols = [0x41ffb4, 0xa38bff, 0x62d9ff]; for (let i = 0; i < 3; i++) { const geo = new BufferGeometry(); const n = 24; const pos = new Float32Array(n * 2 * 3); const m = new MeshBasicMaterial({ color: cols[i], transparent: true, opacity: 0.22, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }); const mesh = new Mesh(geo, m); geo.setAttribute('position', new BufferAttribute(pos, 3)); const idx: number[] = []; for (let k = 0; k < n - 1; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } geo.setIndex(idx); mesh.frustumCulled = false; h.add(mesh);
  h.animate((t) => { const p = geo.getAttribute('position') as BufferAttribute; for (let k = 0; k < n; k++) { const u = k / (n - 1); const x = (u - 0.5) * 120; const z = -50 - i * 8 + Math.sin(u * 4 + t * 0.3 + i) * 6; const y = 22 + i * 4 + Math.sin(u * 6 + t * 0.5 + i * 2) * 3; p.setXYZ(k * 2, x, y, z); p.setXYZ(k * 2 + 1, x, y + 14 + Math.sin(u * 9 + t * 0.7) * 4, z); } p.needsUpdate = true; }); } }
function lakeDisc(h: WorldHost, x: number, z: number, r: number) { const l = h.mesh(new CylinderGeometry(r, r, 0.2, 40), h.m('#46a8e0'), 0.01, false); l.position.set(x, 0.02, z); h.add(l); const shore = h.mesh(new RingGeometry(r, r + 0.7, 40), h.m('#e8dcb0'), 0, false); shore.rotation.x = -Math.PI / 2; shore.position.set(x, 0.03, z); h.add(shore); h.circle(x, z, r * 0.92); }
function rowboat(h: WorldHost, x: number, z: number, r: number) { const b = h.mesh(new BoxGeometry(1.6, 0.3, 0.7), h.m('#c2564a'), 0.04, false); h.add(b); h.animate((t) => { const a = t * 0.15; b.position.set(x + Math.cos(a) * r, 0.2 + Math.sin(t * 2) * 0.03, z + Math.sin(a) * r); b.rotation.y = -a; }); }
function duck(h: WorldHost, x: number, z: number, r: number, ph: number) { const g = new Group(); const b = h.mesh(new SphereGeometry(0.2, 8, 6), h.m('#ffffff'), 0.04, false); b.scale.set(1.3, 0.8, 0.9); g.add(b); const hd = h.mesh(new SphereGeometry(0.12, 8, 6), h.m('#3a9a5a'), 0.04, false); hd.position.set(0.22, 0.18, 0); g.add(hd); const bk = h.mesh(new ConeGeometry(0.05, 0.14, 4), h.m('#ffb02e'), 0, false); bk.rotation.z = -Math.PI / 2; bk.position.set(0.38, 0.17, 0); g.add(bk); h.add(g); h.animate((t) => { const a = t * 0.3 + ph; g.position.set(x + Math.cos(a) * r, 0.18, z + Math.sin(a) * r); g.rotation.y = -a - Math.PI / 2 + Math.PI / 2; g.rotation.y = Math.atan2(Math.cos(a), -Math.sin(a)); }); }
function waterfall(h: WorldHost, x: number, z: number) { const cliff = h.mesh(new BoxGeometry(6, 7, 3), h.m('#6a6f60'), 0.02, false); cliff.position.set(x, 3.5, z); h.add(cliff); const w = h.mesh(new BoxGeometry(1.2, 6.6, 0.3), h.m('#a8e6ff'), 0, false); w.position.set(x, 3.5, z + 1.6); h.add(w); h.animate((t) => { (w.material as MeshToonMaterial).emissive.setRGB(0.1 + Math.sin(t * 6) * 0.05, 0.25, 0.3); }); pond(h, x, z + 4, 2.2); h.box(x - 3, x + 3, z - 1.5, z + 1.5); }
function stiltHut(h: WorldHost, x: number, z: number) { const g = new Group(); for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]] as const) { const p = h.mesh(new CylinderGeometry(0.1, 0.1, 1.4, 5), h.m('#6a4a2a'), 0.04); p.position.set(dx, 0.7, dz); g.add(p); } const fl = h.mesh(new BoxGeometry(2.2, 0.2, 2.2), h.m('#8a6a4a'), 0.04); fl.position.y = 1.4; g.add(fl); const b = h.mesh(new BoxGeometry(1.8, 1.2, 1.8), h.m('#c9a46a'), 0.04); b.position.y = 2.1; g.add(b); const r = h.mesh(new ConeGeometry(1.8, 1.2, 4), h.m('#4f8f3a'), 0.04); r.position.y = 3.3; r.rotation.y = Math.PI / 4; g.add(r); g.position.set(x, 0, z); h.add(g); h.circle(x, z, 1.4); }
function umbrella(h: WorldHost, x: number, z: number, col: string) { const p = h.mesh(new CylinderGeometry(0.04, 0.04, 1.8, 5), h.m('#ffffff'), 0.03, false); p.position.set(x, 0.9, z); p.rotation.z = 0.15; h.add(p); const t = h.mesh(new ConeGeometry(1.1, 0.5, 8), h.m(col), 0.04); t.position.set(x - 0.14, 1.9, z); h.add(t); h.circle(x, z, 0.3); }

/* ------------------------------ theme builders ------------------------------ */
type Build = (h: WorldHost) => void;
const R_OUT = (h: WorldHost) => h.R - 2.5;

export const BUILDERS: Record<Theme, Build> = {
  savanna(h) {
    ring(h, 6, 78, (_a, i, r) => (i === 0 ? peak(h, 32, '#7a8aa8', true) : peak(h, 12 + r() * 8, '#a58a6a', false)), 'sv');
    h.scatter(16, (x, z, _i, r) => acacia(h, x, z, 0.9 + r() * 0.6), 5, R_OUT(h));
    h.scatter(2, (x, z) => baobab(h, x, z, 1.1), 8, R_OUT(h), 'baobab');
    h.scatter(6, (x, z, _i, r) => rock(h, x, z, 0.6 + r() * 0.7, '#b39b7a'), 5, R_OUT(h), 'rocks');
    const huts = [[-13, 4], [-16, 8], [-11, 9]] as const; huts.forEach(([x, z]) => hut(h, x, z, '#e0c291', '#c4a25a')); campfire(h, -13.5, 6.5);
    quadruped(h, 'giraffe', 9, 0, 6, 1.0, 0.07, 0); quadruped(h, 'giraffe', 9, 0, 6, 0.85, 0.07, 0.5); quadruped(h, 'elephant', 11, -9, 4, 1.0, 0.06, 1); quadruped(h, 'elephant', 11, -9, 4, 0.6, 0.06, 1.3);
  },
  asia(h) {
    ring(h, 5, 80, (_a, i, r) => peak(h, i === 0 ? 34 : 12 + r() * 6, '#8fa0d0', true), 'as');
    h.scatter(12, (x, z, i, r) => (i % 3 ? cherry(h, x, z, 0.9 + r() * 0.5) : roundTree(h, x, z, 1, '#6bbf6a')), 5, R_OUT(h));
    pagoda(h, 12, -10); pagoda(h, 17, -7); const p0 = h.pathPoint(0.55); torii(h, p0.x, p0.z, Math.atan2(p0.dx, p0.dz) + Math.PI / 2);
    bamboo(h, -12, -4, 9); bamboo(h, -15, 6, 7); bamboo(h, -9, -12, 7);
    pond(h, 9, 8, 3.2, '#4aa8d8', true); h.scatter(5, (x, z) => { const l = h.mesh(new CylinderGeometry(0.1, 0.14, 0.7, 6), h.m('#bcb6aa'), 0.04); l.position.set(x, 0.35, z); h.add(l); const c = h.mesh(new SphereGeometry(0.26, 6, 5), h.m('#d9d3c6'), 0.04); c.position.set(x, 0.85, z); h.add(c); h.circle(x, z, 0.3); }, 5, R_OUT(h), 'stone');
    quadruped(h, 'panda', -13, 0, 3, 0.9, 0.05, 0); quadruped(h, 'panda', -13, 0, 3, 0.7, 0.05, 3);
  },
  europe(h) {
    ring(h, 7, 80, (_a, i, r) => peak(h, i % 2 ? 30 : 18 + r() * 8, '#8fa5d0', true), 'eu');
    // stream + stone bridge on the path
    const bp = h.pathPoint(0.45); const ang = Math.atan2(bp.dx, bp.dz);
    const river = h.mesh(new BoxGeometry(h.R * 2.2, 0.1, 3.6), h.m('#4aa8d8'), 0, false); river.position.set(0, 0.02, bp.z); h.add(river);
    h.box(-h.R, bp.x - 1.9, bp.z - 1.9, bp.z + 1.9); h.box(bp.x + 1.9, h.R, bp.z - 1.9, bp.z + 1.9);
    const stone = h.m('#cfc6b4'); const deck = h.mesh(new BoxGeometry(3.6, 0.35, 5), stone, 0.03); deck.position.set(bp.x, 0.5, bp.z); h.add(deck);
    for (const s of [-1, 1]) { const rail = h.mesh(new BoxGeometry(0.25, 0.6, 5), stone, 0.03); rail.position.set(bp.x + s * 1.7, 0.95, bp.z); h.add(rail); }
    void ang;
    castle(h, -2, -R_OUT(h) + 2); windmill(h, 15, -4);
    h.scatter(14, (x, z, i, r) => (i % 3 === 0 ? pine(h, x, z, 0.9 + r() * 0.5) : roundTree(h, x, z, 0.8 + r() * 0.5, i % 2 ? '#5fbf7f' : '#4fae6a')), 5, R_OUT(h));
    h.scatter(3, (x, z) => { const hb = h.mesh(new CylinderGeometry(0.55, 0.55, 0.7, 10), h.m('#e8c76a'), 0.04); hb.rotation.z = Math.PI / 2; hb.position.set(x, 0.4, z); h.add(hb); h.circle(x, z, 0.6); }, 6, R_OUT(h), 'hay');
    for (let i = 0; i < 6; i++) quadruped(h, 'sheep', -12, 8, 3 + (i % 2), 0.7, 0.05 + i * 0.004, i * 1.1);
    house(h, 12, 8, '#f2e3c6', '#c2564a'); house(h, 15, 5, '#f4d9b0', '#7a4a3a');
  },
  northamerica(h) {
    ring(h, 6, 80, (_a, i, r) => (i % 2 ? mesa(h, 14 + r() * 8, '#c9703f') : peak(h, 22, '#8a9ab8', true)), 'na');
    skyline(h, 5, 90, ['#8896c8', '#7a88bd', '#96a0d0']);
    h.scatter(20, (x, z, i, r) => pine(h, x, z, 1.4 + r() * 0.9, false, i % 2 ? '#2a7f55' : '#247048'), 5, R_OUT(h));
    cabin(h, -13, 4); campfire(h, -10, 7); barn(h, 14, 6); water(h);
    quadruped(h, 'bison', 8, -9, 5, 1.0, 0.06, 0); quadruped(h, 'bison', 8, -9, 5, 0.8, 0.06, 0.6); quadruped(h, 'deer', -9, -11, 4, 0.9, 0.08, 2);
    function water(hh: WorldHost) { const tower = new Group(); const t = hh.mesh(new CylinderGeometry(1.3, 1.3, 1.6, 12), hh.m('#d7dbe6'), 0.04); t.position.y = 4.4; tower.add(t); for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]] as const) { const l = hh.mesh(new CylinderGeometry(0.08, 0.08, 3.6, 5), hh.m('#6a5a4a'), 0.04); l.position.set(dx, 1.8, dz); tower.add(l); } tower.position.set(16, 0, -6); hh.add(tower); hh.circle(16, -6, 1.4); }
  },
  southamerica(h) {
    ring(h, 8, 80, (_a, i, r) => peak(h, i % 2 ? 36 : 18 + r() * 10, '#7c8db8', true), 'sa');
    h.scatter(16, (x, z, _i, r) => jungleTree(h, x, z, 0.9 + r() * 0.6), 5, R_OUT(h));
    stepPyramid(h, 12, -11, 1.15);
    house(h, -13, 3, '#ff7a59', '#7a3a2a'); house(h, -15, 7, '#ffd23f', '#8a4a2a'); house(h, -11, 8, '#5aa8ff', '#6a3a2a'); house(h, -12, -3, '#ff5d8f', '#6a3a2a');
    for (let i = 0; i < 3; i++) quadruped(h, 'llama', -4, 8, 5 + i * 0.6, 0.85, 0.05 + i * 0.01, i * 2.1);
    bird(h, 8, 6, 6, 5, '#e5382f', '#2a6bff', 0, 0.45); bird(h, 8, 6, 7, 5.5, '#ffd23f', '#2aa8ff', 2, 0.4);
    h.scatter(7, (x, z) => fern(h, x, z, 1.1), 4, R_OUT(h), 'ferns');
  },
  oceania(h) {
    seaBelow(h, '#33b7e8'); const sand = h.mesh(new RingGeometry(h.R - 6, h.R - 0.05, 48), h.m('#f3dc9b'), 0, false); sand.rotation.x = -Math.PI / 2; sand.position.y = 0.025; h.add(sand);
    uluru(h, 6, -10); operaShell(h, -12, -8); sailboat(h, 34, -18, -2.9, '#ff7a59');
    h.scatter(8, (x, z, _i, r) => palm(h, x, z, 0.9 + r() * 0.4), 5, h.R - 3.5, 'palms');
    h.scatter(7, (x, z, _i, r) => { const g = new Group(); const t = h.mesh(new CylinderGeometry(0.1, 0.16, 2.4, 6), h.m('#e8e2d0'), 0.05); t.position.y = 1.2; g.add(t); for (let k = 0; k < 3; k++) { const c = h.mesh(new SphereGeometry(0.8, 8, 6), h.m('#7fae6a'), 0.04); c.scale.set(1.4, 0.45, 1); c.position.set(Math.cos(k * 2) * 0.5, 2.4 + k * 0.2, Math.sin(k * 2) * 0.5); g.add(c); } g.position.set(x, 0, z); g.scale.setScalar(0.9 + r() * 0.5); h.add(g); h.circle(x, z, 0.4); }, 5, h.R - 6, 'euc');
    for (let i = 0; i < 4; i++) hopper(h, -4, 6, 5 + i * 0.7, 0.85, i * 1.6);
    umbrella(h, 12, 8, '#ff7a59'); umbrella(h, 15, 6, '#ffd23f'); umbrella(h, 13, 11, '#5aa8ff');
    bird(h, 0, 0, 14, 8, '#ffffff', '#e8eef8', 0, 0.3); bird(h, 0, 0, 15, 9, '#ffffff', '#e8eef8', 2, 0.28);
  },
  antarctica(h) {
    seaBelow(h, '#2a6fb5'); aurora(h);
    iceberg(h, 40, -10, 5); iceberg(h, -38, 8, 4); iceberg(h, 20, 40, 6); iceberg(h, -20, -40, 5); iceberg(h, 44, 24, 4);
    igloo(h, -13, 5); igloo(h, 13, -9);
    h.scatter(12, (x, z) => penguin(h, x, z, 0.9 + ((x * 3) % 1) * 0.3), 4, R_OUT(h), 'peng');
    h.scatter(6, (x, z, _i, r) => { const c = h.mesh(new OctahedronGeometry(0.6 + r() * 0.7), h.m('#bfe3ff'), 0.04); c.position.set(x, 0.7, z); c.rotation.y = x; h.add(c); h.circle(x, z, 0.8); }, 5, R_OUT(h), 'ice');
    h.scatter(4, (x, z, _i, r) => pine(h, x, z, 0.8 + r() * 0.3, true), 8, R_OUT(h), 'fp'); snowman(h, 6, 8); snowfall(h, 0xffffff, 120, 0.1);
  },
  desert(h) {
    ring(h, 7, 74, (_a, i, r) => mesa(h, 10 + r() * 8, ['#c9703f', '#b8623a', '#d98a52'][i % 3]), 'dz');
    for (let i = 0; i < 9; i++) { const a = (i / 9) * PI2; dune(h, Math.cos(a) * 58, Math.sin(a) * 58, 9 + (i % 3) * 3, '#e4b865'); }
    dune(h, 14, 10, 4.5, '#e8c27a'); dune(h, -15, 5, 4, '#e8c27a'); dune(h, 6, -20, 5, '#e3b768');
    pyramid(h, 14, -11, 1.5); pyramid(h, 20, -6, 0.9, '#e0b866'); pyramid(h, 9, -17, 0.7, '#dcae60');
    pond(h, -14, -6, 3, '#3fb6c8'); palm(h, -16, -8, 1.1); palm(h, -12, -4, 1); palm(h, -15, -3.5, 0.9);
    h.scatter(9, (x, z, _i, r) => cactus(h, x, z, 0.8 + r() * 0.7), 5, R_OUT(h), 'cact'); h.scatter(6, (x, z, _i, r) => rock(h, x, z, 0.6 + r() * 0.6, '#c9a46a'), 5, R_OUT(h), 'rk');
    for (let i = 0; i < 3; i++) quadruped(h, 'camel', 4, 5, 8 + i * 0.5, 0.95 - i * 0.05, 0.05 + i * 0.008, i * 1.1);
    const tent = h.mesh(new ConeGeometry(1.6, 1.6, 5), h.m('#d9554a'), 0.04); tent.position.set(-6, 0.8, 14); h.add(tent); h.circle(-6, 14, 1.5);
  },
  rainforest(h) {
    ring(h, 7, 78, (_a, i, r) => peak(h, 16 + r() * 12, i % 2 ? '#3f8f6a' : '#4aa07a', false), 'rf');
    h.scatter(26, (x, z, _i, r) => jungleTree(h, x, z, 0.9 + r() * 0.9), 4, R_OUT(h));
    h.scatter(14, (x, z) => fern(h, x, z, 1.2), 3, R_OUT(h), 'fern'); waterfall(h, 4, -R_OUT(h) + 1); stiltHut(h, -13, 4); stiltHut(h, 14, 5);
    bird(h, 0, 2, 9, 6, '#e5382f', '#2a6bff', 0, 0.5); bird(h, 0, 2, 11, 7, '#ffd23f', '#2aa8ff', 1.5, 0.42); bird(h, 0, 2, 10, 5.5, '#3fd06a', '#ff7a59', 3, 0.5);
    quadruped(h, 'deer', -10, -8, 4, 0.7, 0.07, 0);
    snowfall(h, 0xcff7e0, 60, 0.18, true);
  },
  lake(h) {
    ring(h, 8, 78, (_a, i, r) => peak(h, i % 2 ? 30 : 16 + r() * 8, '#7f98c8', true), 'lk');
    lakeDisc(h, 10, 2, 9.5); rowboat(h, 10, 2, 5); for (let i = 0; i < 4; i++) duck(h, 10, 2, 3 + i * 1.3, i * 1.7);
    const dock = h.mesh(new BoxGeometry(5, 0.2, 1.1), h.m('#a8774a'), 0.04); dock.position.set(2, 0.2, 5); h.add(dock);
    h.scatter(20, (x, z, i, r) => (i % 3 ? pine(h, x, z, 1 + r() * 0.6) : roundTree(h, x, z, 0.9 + r() * 0.4, '#5fbf7f')), 4, R_OUT(h)); cabin(h, -13, 6); campfire(h, -10, 9);
    h.scatter(6, (x, z) => { const reed = h.mesh(new CylinderGeometry(0.03, 0.04, 1.2, 4), h.m('#7ea04a'), 0, false); reed.position.set(x, 0.6, z); h.add(reed); }, 4, R_OUT(h), 'reeds');
    quadruped(h, 'deer', -8, -10, 4, 0.9, 0.07, 1);
  },
  alpine(h) {
    ring(h, 8, 72, (_a, i, r) => peak(h, i % 2 ? 40 : 22 + r() * 10, '#8aa0cc', true), 'al');
    h.scatter(22, (x, z, _i, r) => pine(h, x, z, 1 + r() * 0.8, true), 5, R_OUT(h)); chalet(h, -13, 4); chalet(h, 15, -7);
    snowman(h, 6, 9); snowman(h, 8, 11); snowman(h, -4, -9);
    pond(h, 12, 8, 3, '#bfe3ff'); h.scatter(6, (x, z, _i, r) => rock(h, x, z, 0.6 + r() * 0.6, '#c8d4e8'), 5, R_OUT(h), 'rk');
    quadruped(h, 'deer', -10, -10, 4, 0.9, 0.07, 1); snowfall(h, 0xffffff, 200, 0.14);
  },
  coast(h) {
    seaBelow(h, '#3bb9ea'); const sand = h.mesh(new RingGeometry(h.R - 7, h.R - 0.05, 48), h.m('#f3dc9b'), 0, false); sand.rotation.x = -Math.PI / 2; sand.position.y = 0.025; h.add(sand);
    h.scatter(12, (x, z, _i, r) => palm(h, x, z, 0.9 + r() * 0.5), 5, h.R - 3.5, 'palms'); lighthouse(h, -15, -8); sailboat(h, 34, -18, -2.9); sailboat(h, -36, 20, -2.9, '#5aa8ff');
    umbrella(h, 14, 8, '#ff7a59'); umbrella(h, 17, 5, '#ffd23f'); umbrella(h, 12, 11, '#5aa8ff'); h.scatter(6, (x, z, _i, r) => rock(h, x, z, 0.5 + r() * 0.4, '#d9c8a6'), 5, h.R - 3, 'rocks');
    house(h, 10, -9, '#ffffff', '#5aa8ff'); house(h, 13, -12, '#ffe9c4', '#ff7a59');
    for (let i = 0; i < 4; i++) bird(h, 0, 0, 12 + i, 7 + (i % 2), '#ffffff', '#dfe6f2', i * 1.5, 0.3);
  },
  volcano(h) {
    ring(h, 6, 76, (_a, _i, r) => peak(h, 14 + r() * 10, '#4a3a52', false), 'vo');
    volcanoCone(h, 8, -14, 11); lavaPool(h, -9, -5, 2.2); lavaPool(h, 14, 5, 1.6); lavaPool(h, -14, 9, 1.3);
    h.scatter(10, (x, z, _i, r) => rock(h, x, z, 0.7 + r() * 0.9, '#3a2e3c'), 5, R_OUT(h), 'rk'); h.scatter(8, (x, z) => fern(h, x, z, 1.2), 4, R_OUT(h), 'fern');
    h.scatter(5, (x, z, _i, r) => { const t = h.mesh(new CylinderGeometry(0.14, 0.2, 1.8 + r(), 6), h.m('#5a3a28'), 0.05); t.position.set(x, 0.9, z); h.add(t); h.circle(x, z, 0.3); }, 5, R_OUT(h), 'dead');
    pond(h, -4, 13, 2.2, '#4fd0e0'); snowfall(h, 0xff8a40, 90, 0.18, true);
  },
};

export { pine, roundTree };
