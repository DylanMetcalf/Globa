import {
  AdditiveBlending, AmbientLight, BackSide, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, DataTexture,
  DirectionalLight, DoubleSide, Fog, Group, HemisphereLight, LinearSRGBColorSpace, Material, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter, Object3D, PerspectiveCamera,
  PointLight, Points, PointsMaterial, RedFormat, RingGeometry, Scene, ShaderMaterial, SphereGeometry, SRGBColorSpace, Sprite, SpriteMaterial, Texture, TorusGeometry, Vector3, WebGLRenderer,
} from 'three';
import type { CharacterSettings } from '../../shared/types';
import { HAIR_COLORS, SKIN_TONES, outfitColor, type Celebration } from './characters';
import { BUILDERS, PALETTES, cloudShape, type Theme, type WorldHost } from './worlds';

export type { Theme } from './worlds';
export { themeFor, ALL_THEMES, PALETTES } from './worlds';

export interface GameEvents {
  onNear: (near: boolean, dist: number, angle: number) => void;
  onActivated: () => void;
  onCelebrated: () => void;
  onComplete: () => void;
  onError: (e: Error) => void;
}

export interface GameOptions {
  canvas: HTMLCanvasElement;
  theme: Theme;
  seed: string;
  player: { settings: CharacterSettings; celebration: Celebration };
  companion: { settings: CharacterSettings; celebration: Celebration };
  reduced: boolean;
  mobile: boolean;
  events: GameEvents;
}

const R = 24; // island radius: a big floating disk
const rngFrom = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
};
const damp = (cur: number, tgt: number, k: number, dt: number) => cur + (tgt - cur) * (1 - Math.exp(-k * dt));
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

interface CircleC { x: number; z: number; r: number }
interface BoxC { x0: number; x1: number; z0: number; z1: number }

/* ------------------------------ characters ------------------------------ */
class Character {
  root = new Group();
  body = new Group();
  legL = new Group(); legR = new Group(); armL = new Group(); armR = new Group();
  head = new Group();
  yaw = 0;
  private phase = 0;
  speed = 0;
  lean = 0;
  celebrating: Celebration | null = null;
  celeT = 0;
  waving = 0;
  constructor(s: CharacterSettings, toon: MeshToonMaterial['gradientMap'], mats: Material[], geos: { dispose(): void }[]) {
    const mat = (c: string | Color) => { const m = new MeshToonMaterial({ color: c, gradientMap: toon }); mats.push(m); return m; };
    const mesh = (g: BufferGeometry, m: Material, outline = 0.05) => {
      geos.push(g); const me = new Mesh(g, m); me.castShadow = true;
      if (outline) { const o = new Mesh(g, new MeshBasicMaterial({ color: 0x0a0d1a, side: BackSide })); mats.push(o.material as Material); o.scale.setScalar(1 + outline); me.add(o); }
      return me;
    };
    const skin = SKIN_TONES[s.skin % SKIN_TONES.length]; const hair = HAIR_COLORS[s.hair % HAIR_COLORS.length]; const outfit = outfitColor(s.outfitHue); const pants = outfitColor((s.outfitHue + 200) % 360, 30);
    this.root.add(this.body);
    const torso = mesh(new CapsuleGeometry(0.3, 0.38, 6, 12), mat(outfit)); torso.position.y = 0.95; this.body.add(torso);
    for (const [g, x] of [[this.legL, -0.14], [this.legR, 0.14]] as const) {
      g.position.set(x, 0.62, 0); const leg = mesh(new CapsuleGeometry(0.1, 0.32, 4, 8), mat(pants), 0.06); leg.position.y = -0.26; g.add(leg);
      const shoe = mesh(new SphereGeometry(0.13, 10, 8), mat('#f4efe3'), 0.06); shoe.position.set(0, -0.5, 0.05); shoe.scale.set(1, 0.7, 1.4); g.add(shoe); this.body.add(g);
    }
    for (const [g, x] of [[this.armL, -0.4], [this.armR, 0.4]] as const) {
      g.position.set(x, 1.22, 0); const arm = mesh(new CapsuleGeometry(0.08, 0.3, 4, 8), mat(outfit), 0.06); arm.position.y = -0.2; g.add(arm);
      const hand = mesh(new SphereGeometry(0.095, 10, 8), mat(skin), 0.06); hand.position.y = -0.46; g.add(hand); this.body.add(g);
    }
    this.head.position.y = 1.62; this.body.add(this.head);
    const skull = mesh(new SphereGeometry(0.3, 18, 14), mat(skin), 0.045); this.head.add(skull);
    for (const x of [-0.11, 0.11]) { const e = new Mesh(new SphereGeometry(0.04, 8, 6), new MeshBasicMaterial({ color: 0x1b1b2a })); geos.push(e.geometry); mats.push(e.material as Material); e.position.set(x, 0.03, 0.27); this.head.add(e); }
    const smile = new Mesh(new TorusGeometry(0.07, 0.014, 6, 12, Math.PI), new MeshBasicMaterial({ color: 0x1b1b2a })); geos.push(smile.geometry); mats.push(smile.material as Material); smile.position.set(0, -0.08, 0.28); smile.rotation.z = Math.PI; this.head.add(smile);
    const hm = mat(hair);
    if (s.hairStyle === 'short') { const h = mesh(new SphereGeometry(0.33, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hm, 0.04); h.position.set(0, 0.03, -0.02); this.head.add(h); }
    else if (s.hairStyle === 'long') { const h = mesh(new SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hm, 0.04); h.position.set(0, 0.03, -0.03); this.head.add(h); const back = mesh(new CapsuleGeometry(0.26, 0.45, 4, 10), hm, 0.04); back.position.set(0, -0.28, -0.14); this.head.add(back); }
    else if (s.hairStyle === 'cap') { const capM = mat(outfitColor((s.outfitHue + 140) % 360, 42)); const dome = mesh(new SphereGeometry(0.33, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capM, 0.04); dome.position.y = 0.06; this.head.add(dome); const brim = mesh(new CylinderGeometry(0.2, 0.2, 0.03, 14, 1, false, 0, Math.PI), capM, 0.04); brim.position.set(0, 0.1, 0.3); brim.rotation.y = Math.PI / 2; this.head.add(brim); }
    else { for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const b = mesh(new SphereGeometry(0.13, 8, 6), hm, 0.04); b.position.set(Math.cos(a) * 0.25, 0.2 + (i % 2) * 0.05, Math.sin(a) * 0.22 - 0.02); this.head.add(b); } const top = mesh(new SphereGeometry(0.2, 10, 8), hm, 0.04); top.position.y = 0.3; this.head.add(top); }
    if (s.accessory === 'glasses') { for (const x of [-0.11, 0.11]) { const r = new Mesh(new TorusGeometry(0.075, 0.014, 6, 14), new MeshBasicMaterial({ color: 0x1b1b2a })); geos.push(r.geometry); mats.push(r.material as Material); r.position.set(x, 0.03, 0.285); this.head.add(r); } }
    if (s.accessory === 'backpack') { const bp = mesh(new BoxGeometry(0.4, 0.5, 0.24), mat('#d98a3a'), 0.05); bp.position.set(0, 0.98, -0.34); this.body.add(bp); }
    if (s.accessory === 'scarf') { const sc = mesh(new TorusGeometry(0.2, 0.07, 8, 16), mat('#ef7d6a'), 0.05); sc.rotation.x = Math.PI / 2; sc.position.y = 1.36; this.body.add(sc); const tail = mesh(new BoxGeometry(0.1, 0.32, 0.05), mat('#ef7d6a'), 0.05); tail.position.set(0.12, 1.2, 0.26); tail.rotation.z = 0.1; this.body.add(tail); }
    this.root.traverse((o) => { if ((o as Mesh).isMesh) (o as Mesh).castShadow = true; });
  }

  celebrate(kind: Celebration) { this.celebrating = kind; this.celeT = 0; }
  lookAt(x: number, z: number) { this.yaw = Math.atan2(x - this.root.position.x, z - this.root.position.z); }

  /** `speed` is metres/second actually travelled; the walk cycle is tied to distance so feet never skate. `turn` is yaw velocity for body lean. */
  update(dt: number, t: number, speed: number, turn: number) {
    this.speed = speed;
    this.root.rotation.y = this.yaw;
    const { legL, legR, armL, armR, body, head } = this;
    legL.rotation.set(0, 0, 0); legR.rotation.set(0, 0, 0); armL.rotation.set(0, 0, 0); armR.rotation.set(0, 0, 0);
    body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); body.scale.set(1, 1, 1); head.rotation.set(0, 0, 0);
    if (this.celebrating) {
      this.celeT += dt; const c = this.celeT;
      if (this.celebrating === 'dance') {
        const b = c * 9;
        armL.rotation.set(Math.PI + Math.sin(b) * 0.5, 0, 0.5 + Math.sin(b * 0.5) * 0.3); armR.rotation.set(Math.PI + Math.sin(b + Math.PI) * 0.5, 0, -0.5 - Math.sin(b * 0.5) * 0.3);
        legL.rotation.x = Math.max(0, Math.sin(b)) * 0.9; legR.rotation.x = Math.max(0, Math.sin(b + Math.PI)) * 0.9;
        body.position.y = Math.abs(Math.sin(b)) * 0.18; body.rotation.z = Math.sin(b * 0.5) * 0.18; body.rotation.y = c > 1.4 && c < 2.6 ? ((c - 1.4) / 1.2) * Math.PI * 2 : Math.sin(b * 0.5) * 0.4;
        head.rotation.z = Math.sin(b * 0.5) * 0.2;
      } else if (this.celebrating === 'clapjump') {
        const cyc = c % 3.2;
        if (cyc < 1.4) { const k = Math.sin(cyc * 18); armL.rotation.set(-1.25, 0, 0.35 - k * 0.3); armR.rotation.set(-1.25, 0, -0.35 + k * 0.3); head.rotation.x = 0.05; body.position.y = Math.abs(k) * 0.02; }
        else {
          const j = (cyc - 1.4) / 0.9; const phase = j % 1; const crouch = phase < 0.18 ? Math.sin((phase / 0.18) * Math.PI) * 0.12 : 0; const air = phase >= 0.18 ? Math.sin(((phase - 0.18) / 0.82) * Math.PI) : 0;
          body.position.y = air * 1.0 - crouch; body.scale.set(1 + crouch * 0.4, 1 - crouch, 1 + crouch * 0.4);
          armL.rotation.set(Math.PI * (0.8 + air * 0.2), 0, 0.5); armR.rotation.set(Math.PI * (0.8 + air * 0.2), 0, -0.5); legL.rotation.x = air * 0.5; legR.rotation.x = -air * 0.3; body.rotation.z = Math.sin(j * 6) * 0.05;
        }
      } else { const b = c * 8; armL.rotation.set(Math.PI * 0.95 + Math.sin(b) * 0.2, 0, 0.3); armR.rotation.set(Math.PI * 0.95 - Math.sin(b) * 0.2, 0, -0.3); body.position.y = Math.abs(Math.sin(b)) * 0.15; }
      return;
    }
    const k = Math.min(1, speed / 4.4);
    this.lean = damp(this.lean, clamp01(k) * 0.14, 8, dt);
    if (speed > 0.15) {
      this.phase += dt * speed * 2.15; // stride tied to distance travelled
      const sw = Math.sin(this.phase) * (0.35 + 0.55 * k);
      legL.rotation.x = sw; legR.rotation.x = -sw; armL.rotation.x = -sw * 0.85; armR.rotation.x = sw * 0.85;
      body.position.y = Math.abs(Math.cos(this.phase)) * 0.07 * k; body.rotation.x = this.lean; body.rotation.z = -turn * 0.04; head.rotation.x = -this.lean * 0.6;
      body.rotation.y = Math.sin(this.phase) * 0.08 * k;
    } else {
      body.position.y = Math.sin(t * 2) * 0.012; armL.rotation.z = 0.08 + Math.sin(t * 2) * 0.02; armR.rotation.z = -0.08 - Math.sin(t * 2) * 0.02; head.rotation.y = Math.sin(t * 0.7) * 0.15;
      if (this.waving > 0) { this.waving -= dt; armR.rotation.set(Math.PI * 0.9, 0, -0.35 + Math.sin(t * 12) * 0.35); head.rotation.z = 0.08; }
    }
  }
}

/* ------------------------------ scene ------------------------------ */
export class GameScene implements WorldHost {
  readonly R = R;
  readonly seed: string;
  private renderer!: WebGLRenderer;
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private mats: Material[] = [];
  private geos: { dispose(): void }[] = [];
  private toon: DataTexture;
  private player: Character;
  private companion: Character;
  private colliders: CircleC[] = [];
  private boxes: BoxC[] = [];
  private bulb = new Group();
  private bulbGlass!: Mesh; private bulbGlow!: Sprite; private bulbLight = new PointLight(0xffd884, 0, 16, 1.8);
  private beam!: Mesh; private arrow = new Group();
  private sun = new DirectionalLight(0xffffff, 1.7);
  private hemi: HemisphereLight;
  private sky: ShaderMaterial;
  private baseSky: [Color, Color, Color];
  private baseFog: Color;
  private fireflies!: Points; private ffBase!: Float32Array;
  private drifters: Object3D[] = [];
  private animators: ((t: number, dt: number) => void)[] = [];
  private lanterns: { mat: MeshToonMaterial; base: Color }[] = [];
  private blooms: Mesh[] = [];
  private burst?: { pts: Points; vel: Float32Array; t: number };
  private ring?: Mesh;
  private glowTex?: Texture;
  private last = 0; private time = 0; private alive = true;
  private keys = new Set<string>();
  private joy = { x: 0, y: 0 };
  private yaw = 0.0; private camDist = 10.6; private camH = 6.8;
  private camTarget = new Vector3(); private camPos = new Vector3();
  private intro = 0;
  private drag: { x: number; id: number } | null = null;
  private litGlass?: MeshBasicMaterial; private actYaw = 0; private lit = false; private actT = -1; private env = 0; private celebrated = false; private completed = false; private pullT = -1;
  private vel = { x: 0, z: 0 }; private cvel = { x: 0, z: 0 }; private idleT = 0;
  readonly bulbPos = new Vector3(-3, 0, -R * 0.56);
  private startZ = R - 4;
  private nearState = false;
  private cleanup: (() => void)[] = [];

  constructor(private o: GameOptions) {
    this.seed = o.seed;
    const { canvas } = o;
    const pal = PALETTES[o.theme];
    try {
      this.renderer = new WebGLRenderer({ canvas, antialias: !o.mobile || window.devicePixelRatio < 2, powerPreference: 'high-performance' });
    } catch (e) { throw e instanceof Error ? e : new Error('WebGL unavailable'); }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.mobile ? 1.75 : 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.setClearColor(0x0a1030);
    this.camera = new PerspectiveCamera(52, 1, 0.1, 500);

    const tex = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat); tex.minFilter = tex.magFilter = NearestFilter; tex.colorSpace = LinearSRGBColorSpace; tex.needsUpdate = true; this.toon = tex;

    this.baseSky = [new Color(pal.skyTop), new Color(pal.skyMid), new Color(pal.skyBot)]; this.baseFog = new Color(pal.fog);
    this.sky = new ShaderMaterial({
      side: BackSide, depthWrite: false,
      uniforms: { top: { value: this.baseSky[0].clone() }, mid: { value: this.baseSky[1].clone() }, bottom: { value: this.baseSky[2].clone() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*0.5+0.5,0.0,1.0); vec3 c = h<0.5 ? mix(bottom,mid,h*2.0) : mix(mid,top,(h-0.5)*2.0); gl_FragColor = vec4(c,1.0); }',
    });
    this.mats.push(this.sky);
    const skyMesh = new Mesh(new SphereGeometry(300, 24, 16), this.sky); this.geos.push(skyMesh.geometry); this.scene.add(skyMesh);
    this.scene.fog = new Fog(this.baseFog.getHex(), 70, 230);

    this.hemi = new HemisphereLight(0xcfe6ff, 0x6a5a4a, 0.85);
    this.scene.add(this.hemi, new AmbientLight(0xffffff, 0.25));
    this.sun.position.set(10, 22, 8); this.sun.castShadow = true;
    const ms = o.mobile ? 1024 : 2048; this.sun.shadow.mapSize.set(ms, ms);
    Object.assign(this.sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 }); this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);

    this.buildIsland(o.theme);
    BUILDERS[o.theme](this);
    this.buildBulb();
    this.buildClouds();
    this.buildFireflies();

    this.player = new Character(o.player.settings, this.toon, this.mats, this.geos);
    this.companion = new Character(o.companion.settings, this.toon, this.mats, this.geos);
    this.player.root.position.set(0, 0, this.startZ); this.player.yaw = Math.PI;
    this.companion.root.position.set(1.9, 0, this.startZ + 1.2); this.companion.yaw = Math.PI;
    this.scene.add(this.player.root, this.companion.root);
    this.camTarget.copy(this.player.root.position); this.updateCamera(0, true);
    this.intro = o.reduced ? 1 : 0;

    this.bind();
    this.resize();
    this.last = performance.now();
    this.renderer.setAnimationLoop(this.frame);
    canvas.addEventListener('webglcontextlost', this.onLost as EventListener);
    this.cleanup.push(() => canvas.removeEventListener('webglcontextlost', this.onLost as EventListener));
  }

  /* ----- public controls ----- */
  setJoystick(x: number, y: number) { this.joy.x = x; this.joy.y = y; }
  interact() { if (!this.lit && this.nearBulb() && this.actT < 0) this.beginActivation(); }
  skip() { if (!this.completed) { this.completed = true; this.o.events.onComplete(); } }
  /** Test/debug hook: run the simulation without rendering (headless software GL is slow). */
  advance(seconds: number) { for (let t = 0; t < seconds; t += 0.05) this.tick(0.05); }
  /** Test/debug hook: place the player next to the bulb. */
  teleportToBulb() { this.player.root.position.set(this.bulbPos.x + 0.2, 0, this.bulbPos.z + 2.0); this.vel.x = this.vel.z = 0; }
  get activated() { return this.lit; }
  playerPosition() { return { x: this.player.root.position.x, z: this.player.root.position.z }; }
  /** Test/debug hook: what was built. */
  stats() { return { colliders: this.colliders.length, animators: this.animators.length, theme: this.o.theme }; }

  /* ----- WorldHost ----- */
  m(color: string | number, emissive?: number): MeshToonMaterial { const m = new MeshToonMaterial({ color, gradientMap: this.toon }); if (emissive) m.emissive = new Color(emissive); this.mats.push(m); return m; }
  mesh(g: BufferGeometry, mat: Material, outline = 0.04, shadow = true): Mesh {
    this.geos.push(g); const me = new Mesh(g, mat); me.castShadow = shadow; me.receiveShadow = true;
    if (outline) { const o = new Mesh(g, new MeshBasicMaterial({ color: 0x0a0d1a, side: BackSide })); this.mats.push(o.material as Material); o.scale.setScalar(1 + outline); me.add(o); }
    return me;
  }
  add(o: Object3D) { this.scene.add(o); }
  circle(x: number, z: number, r: number) { this.colliders.push({ x, z, r }); }
  box(x0: number, x1: number, z0: number, z1: number) { this.boxes.push({ x0, x1, z0, z1 }); }
  rng(salt: string) { return rngFrom(this.seed + salt); }
  animate(fn: (t: number, dt: number) => void) { this.animators.push(fn); }
  glow() {
    if (this.glowTex) return this.glowTex;
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(0.35, 'rgba(255,216,132,0.5)'); g.addColorStop(1, 'rgba(255,216,132,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; this.glowTex = t; return t;
  }
  pathPoint(t: number) {
    const f = (u: number) => ({ x: this.bulbPos.x * u + Math.sin(u * 3.2) * 2.4 * (1 - u * 0.4), z: this.startZ - 1 + (this.bulbPos.z + 1.6 - (this.startZ - 1)) * u });
    const a = f(t); const b = f(Math.min(1, t + 0.01)); const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: a.x, z: a.z, dx: (b.x - a.x) / l, dz: (b.z - a.z) / l };
  }
  free(x: number, z: number, r: number) {
    for (let i = 0; i <= 24; i++) { const p = this.pathPoint(i / 24); if (Math.hypot(x - p.x, z - p.z) < 2.0 + r) return false; }
    if (Math.hypot(x - this.bulbPos.x, z - this.bulbPos.z) < 4.2 + r) return false;
    if (Math.hypot(x, z - this.startZ) < 4 + r) return false;
    return !this.colliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r) && !this.boxes.some((b) => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r);
  }
  scatter(count: number, fn: (x: number, z: number, i: number, r: () => number) => void, minD = 4, maxD = R - 2, salt = 'trees') {
    const rnd = rngFrom(this.seed + salt); let placed = 0; let tries = 0;
    while (placed < count && tries++ < count * 30) {
      const a = rnd() * Math.PI * 2; const d = minD + Math.sqrt(rnd()) * (maxD - minD); const x = Math.cos(a) * d; const z = Math.sin(a) * d;
      if (!this.free(x, z, 0.9)) continue; fn(x, z, placed++, rnd);
    }
  }
  lantern(x: number, z: number) {
    const post = this.mesh(new CylinderGeometry(0.06, 0.08, 1.4, 6), this.m('#4b4458'), 0.05); post.position.set(x, 0.7, z); this.scene.add(post);
    const mat = this.m('#fff2c8'); const lamp = this.mesh(new SphereGeometry(0.2, 10, 8), mat, 0.05, false); lamp.position.set(x, 1.5, z); this.scene.add(lamp);
    this.lanterns.push({ mat, base: new Color('#ffd884') }); this.colliders.push({ x, z, r: 0.2 });
  }

  /* ----- build ----- */
  private buildIsland(theme: Theme) {
    const pal = PALETTES[theme];
    const top = this.mesh(new CylinderGeometry(R, R * 1.02, 1.4, 56), this.m(pal.ground), 0.01); top.position.y = -0.7; this.scene.add(top);
    const rim = this.mesh(new CylinderGeometry(R * 1.03, R * 1.03, 0.5, 56), this.m(pal.side), 0.01); rim.position.y = -1.25; this.scene.add(rim);
    const rock = this.mesh(new ConeGeometry(R * 1.02, 12, 14, 1), this.m(pal.under), 0.01); rock.rotation.x = Math.PI; rock.position.y = -7.7; this.scene.add(rock);
    const rr = rngFrom(this.seed + 'under');
    for (let i = 0; i < 7; i++) { const a = rr() * Math.PI * 2; const d = R * (0.3 + rr() * 0.5); const s = this.mesh(new ConeGeometry(1 + rr(), 4 + rr() * 5, 5), this.m(pal.under), 0.01, false); s.rotation.x = Math.PI; s.position.set(Math.cos(a) * d, -9 - rr() * 3, Math.sin(a) * d); this.scene.add(s); }
    const pm = this.m(pal.path);
    for (let i = 0; i < 24; i++) { const p = this.pathPoint(i / 23); const s = this.mesh(new CylinderGeometry(0.8, 0.86, 0.08, 10), pm, 0.0, false); s.position.set(p.x, 0.04, p.z); s.rotation.y = i; s.receiveShadow = true; this.scene.add(s); }
    if (pal.flowers) {
      const rnd = rngFrom(this.seed + 'flowers');
      for (let i = 0; i < 70; i++) {
        const a = rnd() * Math.PI * 2; const d = 3 + rnd() * (R - 4.5); const x = Math.cos(a) * d; const z = Math.sin(a) * d;
        if (!this.free(x, z, 0.2)) continue;
        const f = this.mesh(new SphereGeometry(0.16, 8, 6), this.m(pal.flowers[i % pal.flowers.length]), 0, false); f.position.set(x, 0.2, z); f.scale.setScalar(0.4); this.scene.add(f); this.blooms.push(f);
        const stem = this.mesh(new CylinderGeometry(0.02, 0.02, 0.2, 4), this.m('#3f9a55'), 0, false); stem.position.set(x, 0.1, z); this.scene.add(stem);
      }
    }
    this.lantern(this.bulbPos.x - 3, this.bulbPos.z + 1.4); this.lantern(this.bulbPos.x + 3, this.bulbPos.z + 1.4);
    this.lantern(-2.4, this.startZ - 2); this.lantern(2.4, this.startZ - 2);
    const mid = this.pathPoint(0.5); this.lantern(mid.x - 2, mid.z); this.lantern(mid.x + 2, mid.z);
  }

  private buildBulb() {
    const b = this.bulb; b.position.copy(this.bulbPos);
    const base = this.mesh(new CylinderGeometry(0.75, 0.95, 0.5, 14), this.m('#8a7f9e'), 0.04); base.position.y = 0.25; b.add(base);
    const neck = this.mesh(new CylinderGeometry(0.32, 0.4, 0.5, 14), this.m('#cfc8dd'), 0.04); neck.position.y = 0.75; b.add(neck);
    const glassMat = new MeshToonMaterial({ color: '#c9d3ea', gradientMap: this.toon, transparent: true, opacity: 0.85 }); this.mats.push(glassMat);
    this.bulbGlass = this.mesh(new SphereGeometry(0.85, 24, 18), glassMat, 0.025, false); this.bulbGlass.position.y = 1.9; b.add(this.bulbGlass);
    const fil = this.mesh(new TorusGeometry(0.22, 0.03, 6, 14), new MeshBasicMaterial({ color: 0x77708a }), 0, false); fil.position.y = 1.9; b.add(fil); this.mats.push(fil.material as Material);
    const sm = new SpriteMaterial({ map: this.glow(), color: 0xffe9a8, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }); this.mats.push(sm);
    this.bulbGlow = new Sprite(sm); this.bulbGlow.scale.setScalar(6); this.bulbGlow.position.y = 1.9; b.add(this.bulbGlow);
    this.bulbLight.position.y = 1.9; b.add(this.bulbLight);
    const bm = new MeshBasicMaterial({ color: 0xffd884, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }); this.mats.push(bm);
    this.beam = new Mesh(new CylinderGeometry(0.2, 0.9, 14, 16, 1, true), bm); this.geos.push(this.beam.geometry); this.beam.position.y = 9; b.add(this.beam);
    const ar = this.mesh(new ConeGeometry(0.28, 0.6, 4), this.m('#ffd884', 0x664400), 0.05, false); ar.rotation.x = Math.PI; this.arrow.add(ar); this.arrow.position.y = 3.6; b.add(this.arrow);
    this.scene.add(b); this.colliders.push({ x: this.bulbPos.x, z: this.bulbPos.z, r: 0.95 });
    const rm = new MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }); this.mats.push(rm);
    this.ring = new Mesh(new RingGeometry(0.9, 1.1, 48), rm); this.geos.push(this.ring.geometry); this.ring.rotation.x = -Math.PI / 2; this.ring.position.set(this.bulbPos.x, 0.06, this.bulbPos.z); this.scene.add(this.ring);
  }

  private buildClouds() {
    const rnd = rngFrom(this.seed + 'clouds'); const cm = this.m('#ffffff');
    for (let i = 0; i < 11; i++) {
      const g = cloudShape(this, cm, 4);
      const a = rnd() * Math.PI * 2; const d = 36 + rnd() * 40; g.position.set(Math.cos(a) * d, -2 + rnd() * 18, Math.sin(a) * d); g.userData.cloud = { a, d, sp: 0.008 + rnd() * 0.014, y: g.position.y }; this.scene.add(g); this.drifters.push(g);
    }
  }

  private buildFireflies() {
    const n = 60; const pos = new Float32Array(n * 3); this.ffBase = new Float32Array(n * 3); const rnd = rngFrom(this.seed + 'ff');
    for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2; const d = 2 + rnd() * (R - 3); this.ffBase.set([Math.cos(a) * d, 0.6 + rnd() * 2.6, Math.sin(a) * d], i * 3); pos.set(this.ffBase.subarray(i * 3, i * 3 + 3), i * 3); }
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3)); this.geos.push(g);
    const m = new PointsMaterial({ color: 0xffe9a8, size: 0.24, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, map: this.glow() }); this.mats.push(m);
    this.fireflies = new Points(g, m); this.scene.add(this.fireflies);
  }

  /* ----- input ----- */
  private bind() {
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if ((k === 'e' || k === 'enter' || k === ' ') && !e.repeat) this.interact();
      this.keys.add(k);
    };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    const blur = () => this.keys.clear();
    const down = (e: PointerEvent) => { this.drag = { x: e.clientX, id: e.pointerId }; this.o.canvas.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (!this.drag || this.drag.id !== e.pointerId) return; this.yaw -= (e.clientX - this.drag.x) * 0.006; this.drag.x = e.clientX; };
    const up = () => { this.drag = null; };
    const rs = () => this.resize();
    const vis = () => { if (document.hidden) this.renderer.setAnimationLoop(null); else { this.last = performance.now(); this.renderer.setAnimationLoop(this.frame); } };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur); window.addEventListener('resize', rs); document.addEventListener('visibilitychange', vis);
    this.o.canvas.addEventListener('pointerdown', down); this.o.canvas.addEventListener('pointermove', move); this.o.canvas.addEventListener('pointerup', up); this.o.canvas.addEventListener('pointercancel', up);
    this.cleanup.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); window.removeEventListener('resize', rs); document.removeEventListener('visibilitychange', vis); this.o.canvas.removeEventListener('pointerdown', down); this.o.canvas.removeEventListener('pointermove', move); this.o.canvas.removeEventListener('pointerup', up); this.o.canvas.removeEventListener('pointercancel', up); });
  }
  private onLost = (e: Event) => { e.preventDefault(); this.o.events.onError(new Error('The graphics context was lost.')); };
  private resize() {
    const c = this.o.canvas; const w = c.clientWidth || window.innerWidth; const h = c.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w / h < 0.8 ? 64 : 55; this.camera.updateProjectionMatrix();
    this.camDist = w / h < 0.8 ? 12.5 : 10.6; this.camH = w / h < 0.8 ? 7.6 : 6.8;
  }

  /* ----- gameplay ----- */
  private nearBulb() { return Math.hypot(this.player.root.position.x - this.bulbPos.x, this.player.root.position.z - this.bulbPos.z) < 3.0; }

  private beginActivation() {
    this.actT = 0; this.actYaw = this.yaw; this.o.events.onActivated();
    this.player.lookAt(this.bulbPos.x, this.bulbPos.z); this.companion.lookAt(this.bulbPos.x, this.bulbPos.z);
    this.vel.x = this.vel.z = 0;
    this.makeBurst();
  }
  private makeBurst() {
    const n = 110; const pos = new Float32Array(n * 3); const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos.set([this.bulbPos.x, 1.9, this.bulbPos.z], i * 3); const a = Math.random() * Math.PI * 2; const u = Math.random() * 2 - 0.3; const s = 2 + Math.random() * 4; vel.set([Math.cos(a) * s, u * 3 + 2, Math.sin(a) * s], i * 3); }
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3)); this.geos.push(g);
    const m = new PointsMaterial({ color: 0xffe9a8, size: 0.3, transparent: true, blending: AdditiveBlending, depthWrite: false, map: this.glow() }); this.mats.push(m);
    const pts = new Points(g, m); this.scene.add(pts); this.burst = { pts, vel, t: 0 };
  }

  private movement(dt: number) {
    const p = this.player; const locked = this.actT >= 0 || this.pullT >= 0 || this.intro < 0.6;
    let ix = 0; let iy = 0;
    if (!locked) {
      const k = this.keys;
      ix = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
      iy = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      ix += this.joy.x; iy += this.joy.y;
      const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
    }
    const mag = Math.hypot(ix, iy);
    const s = Math.sin(this.yaw); const c = Math.cos(this.yaw);
    const tx = (-s * iy + c * ix) * 4.8 * mag; const tz = (-c * iy - s * ix) * 4.8 * mag; // forward = (-sin, -cos), right = (cos, -sin)
    const acc = mag > 0.05 ? 11 : 14; // quick to start, a touch softer to stop
    this.vel.x = damp(this.vel.x, tx, acc, dt); this.vel.z = damp(this.vel.z, tz, acc, dt);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    p.root.position.x += this.vel.x * dt; p.root.position.z += this.vel.z * dt;
    let turn = 0;
    if (sp > 0.25) { const target = Math.atan2(this.vel.x, this.vel.z); const d = angDiff(p.yaw, target); const step = d * (1 - Math.exp(-13 * dt)); p.yaw += step; turn = step / Math.max(dt, 1e-3); }
    this.collide(p.root.position, 0.45, this.vel);
    this.idleT = sp < 0.2 ? this.idleT + dt : 0;
    return { speed: sp, turn };
  }
  private collide(pos: Vector3, pr: number, vel?: { x: number; z: number }) {
    for (let i = 0; i < 2; i++) {
      for (const c of this.colliders) {
        const dx = pos.x - c.x; const dz = pos.z - c.z; const d = Math.hypot(dx, dz); const min = c.r + pr;
        if (d < min && d > 1e-4) { const nx = dx / d; const nz = dz / d; pos.x = c.x + nx * min; pos.z = c.z + nz * min; if (vel) { const vn = vel.x * nx + vel.z * nz; if (vn < 0) { vel.x -= vn * nx; vel.z -= vn * nz; } } } // slide along obstacles
      }
      for (const b of this.boxes) {
        if (pos.x > b.x0 - pr && pos.x < b.x1 + pr && pos.z > b.z0 - pr && pos.z < b.z1 + pr) {
          const l = pos.x - (b.x0 - pr); const r = b.x1 + pr - pos.x; const t = pos.z - (b.z0 - pr); const bt = b.z1 + pr - pos.z; const m = Math.min(l, r, t, bt);
          if (m === l) { pos.x = b.x0 - pr; if (vel && vel.x > 0) vel.x = 0; } else if (m === r) { pos.x = b.x1 + pr; if (vel && vel.x < 0) vel.x = 0; } else if (m === t) { pos.z = b.z0 - pr; if (vel && vel.z > 0) vel.z = 0; } else { pos.z = b.z1 + pr; if (vel && vel.z < 0) vel.z = 0; }
        }
      }
    }
    const d = Math.hypot(pos.x, pos.z); const lim = R - 1.2; if (d > lim) { pos.x *= lim / d; pos.z *= lim / d; }
  }

  private updateCamera(dt: number, snap = false) {
    const pp = this.player.root.position; const act = this.actT >= 0 && this.pullT < 0;
    let dist = this.camDist; let h = this.camH; let tx = pp.x; let ty = 1.3; let tz = pp.z;
    if (this.intro < 1) { const k = 1 - ease(this.intro); dist *= 1 + k * 1.8; h *= 1 + k * 2.4; }
    if (act) { tx = (pp.x + this.bulbPos.x) / 2; tz = (pp.z + this.bulbPos.z) / 2; ty = 1.9; dist = this.camDist * 1.0; h = this.camH * 0.85; if (!this.o.reduced) this.yaw = this.actYaw + Math.sin(this.actT * 0.55) * 0.7; }
    if (this.pullT >= 0) { const k = ease(clamp01(this.pullT / 2)); dist = this.camDist * (1 + k * 2.8); h = this.camH * (1 + k * 4.5); ty = 1.5 - k * 0.5; tx = (pp.x + this.bulbPos.x) / 2; tz = (pp.z + this.bulbPos.z) / 2; this.camera.fov = (this.camera.aspect < 0.8 ? 64 : 55) + k * 16; this.camera.updateProjectionMatrix(); }
    if (!act && this.pullT < 0) { tx += this.vel.x * 0.18; tz += this.vel.z * 0.18; } // look slightly ahead of motion
    this.camTarget.set(snap ? tx : damp(this.camTarget.x, tx, 6, dt), snap ? ty : damp(this.camTarget.y, ty, 5, dt), snap ? tz : damp(this.camTarget.z, tz, 6, dt));
    const want = new Vector3(this.camTarget.x + Math.sin(this.yaw) * dist, this.camTarget.y + h, this.camTarget.z + Math.cos(this.yaw) * dist);
    if (snap) this.camPos.copy(want); else this.camPos.set(damp(this.camPos.x, want.x, 6, dt), damp(this.camPos.y, want.y, 6, dt), damp(this.camPos.z, want.z, 6, dt));
    for (const c of this.colliders) {
      if (c.r < 0.3) continue;
      const dx = this.camPos.x - c.x; const dz = this.camPos.z - c.z; const d = Math.hypot(dx, dz); const min = c.r + 2.0;
      if (d < min && this.camPos.y < 5.6 && d > 1e-3) { const k = (min - d) / min; this.camPos.x += (dx / d) * (min - d) * 0.6; this.camPos.z += (dz / d) * (min - d) * 0.6; this.camPos.y += k * 1.6; }
    }
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camTarget);
  }

  private applyEnv(k: number) {
    const gold = ['#5b4aa8', '#f2b58c', '#ffeccc'];
    (['top', 'mid', 'bottom'] as const).forEach((key, i) => (this.sky.uniforms[key].value as Color).copy(this.baseSky[i]).lerp(new Color(gold[i]), k));
    this.hemi.intensity = 0.85 - 0.3 * k; this.hemi.color.set('#cfe6ff').lerp(new Color('#ffcf9a'), k);
    this.sun.color.set('#ffffff').lerp(new Color('#ffb36b'), k); this.sun.intensity = 1.7 - 0.85 * k;
    (this.scene.fog as Fog).color.copy(this.baseFog).lerp(new Color('#ffdcae'), k);
    for (const l of this.lanterns) l.mat.emissive.copy(l.base).multiplyScalar(k * 1.2);
    for (const f of this.blooms) f.scale.setScalar(0.4 + k * 1.1);
    (this.fireflies.material as PointsMaterial).opacity = k * 0.95;
  }

  private frame = (now: number) => {
    if (!this.alive) return;
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    try { this.tick(dt); this.renderer.render(this.scene, this.camera); } catch (e) { this.o.events.onError(e as Error); this.renderer.setAnimationLoop(null); }
  };

  private tick(dt: number) {
    this.time += dt; const tt = this.time;
    if (this.intro < 1) this.intro = Math.min(1, this.intro + dt / 1.9);
    const mv = this.movement(dt);
    const p = this.player.root.position; const c = this.companion.root.position;
    // companion: follows beside-behind with a soft spring, waves when you pause, helps celebrate
    let cs = 0; let cturn = 0;
    if (this.actT < 0 && this.pullT < 0) {
      const fx = Math.sin(this.player.yaw); const fz = Math.cos(this.player.yaw);
      const tx = p.x - fx * 2.1 + fz * 1.3; const tz = p.z - fz * 2.1 - fx * 1.3;
      const dx = tx - c.x; const dz = tz - c.z; const d = Math.hypot(dx, dz);
      const want = Math.min(5.4, d * 2.6); const wx = d > 0.05 ? (dx / d) * want : 0; const wz = d > 0.05 ? (dz / d) * want : 0;
      this.cvel.x = damp(this.cvel.x, d > 0.35 ? wx : 0, 7, dt); this.cvel.z = damp(this.cvel.z, d > 0.35 ? wz : 0, 7, dt);
      c.x += this.cvel.x * dt; c.z += this.cvel.z * dt; cs = Math.hypot(this.cvel.x, this.cvel.z);
      if (cs > 0.4) { const d2 = angDiff(this.companion.yaw, Math.atan2(this.cvel.x, this.cvel.z)); const st = d2 * (1 - Math.exp(-11 * dt)); this.companion.yaw += st; cturn = st / Math.max(dt, 1e-3); }
      else { const d2 = angDiff(this.companion.yaw, Math.atan2(p.x - c.x, p.z - c.z)); this.companion.yaw += d2 * (1 - Math.exp(-4 * dt)); if (this.idleT > 3.5 && this.companion.waving <= 0 && Math.floor(tt) % 7 === 0) this.companion.waving = 1.4; }
      this.collide(c, 0.4, this.cvel);
    } else if (this.actT >= 0) {
      const side = { x: this.bulbPos.x + 1.9, z: this.bulbPos.z + 2.2 }; const dx = side.x - c.x; const dz = side.z - c.z; const d = Math.hypot(dx, dz);
      if (d > 0.15) { const s = Math.min(4.6, d * 3); c.x += (dx / d) * s * dt; c.z += (dz / d) * s * dt; cs = s; this.companion.yaw = Math.atan2(dx, dz); } else this.companion.lookAt(this.bulbPos.x, this.bulbPos.z);
    }
    this.player.update(dt, tt, mv.speed, mv.turn); this.companion.update(dt, tt, cs, cturn);

    const near = this.actT < 0 && this.nearBulb();
    const wx = this.bulbPos.x - p.x; const wz = this.bulbPos.z - p.z; const sy = Math.sin(this.yaw); const cy = Math.cos(this.yaw);
    const rel = Math.atan2(wx * cy - wz * sy, wx * -sy + wz * -cy); const d = Math.hypot(wx, wz);
    if (near !== this.nearState || (this.actT < 0 && Math.floor(tt * 10) % 3 === 0)) { this.nearState = near; this.o.events.onNear(near, d, rel); }

    if (!this.lit) { this.arrow.position.y = 3.6 + Math.sin(tt * 3) * 0.2; this.arrow.rotation.y = tt * 1.5; const pulse = near ? 0.5 + Math.sin(tt * 8) * 0.5 : 0; (this.bulbGlass.material as MeshToonMaterial).emissive.set(0xffd884).multiplyScalar(pulse * 0.4); (this.beam.material as MeshBasicMaterial).opacity = 0.16 + Math.sin(tt * 2) * 0.05; this.bulbGlow.material.opacity = pulse * 0.35; }

    if (this.actT >= 0) {
      this.actT += dt; const a = this.actT; const red = this.o.reduced;
      if (a > 0.1 && !this.lit) this.lit = true;
      const ramp = ease(clamp01((a - 0.1) / 0.5));
      if (ramp > 0.05 && !this.litGlass) { this.litGlass = new MeshBasicMaterial({ color: 0xfff0b0 }); this.mats.push(this.litGlass); this.bulbGlass.material = this.litGlass; }
      if (this.litGlass) this.litGlass.color.set(0xffe9a0).lerp(new Color(0xffffff), 0.35 + Math.sin(tt * 6) * 0.1);
      this.bulbGlass.scale.setScalar(1 + ramp * 0.06 + Math.sin(tt * 5) * 0.015);
      this.bulbGlow.material.opacity = ramp * 0.95 + Math.sin(tt * 5) * 0.05 * ramp; this.bulbGlow.scale.setScalar(6 + ramp * 3 + Math.sin(tt * 4) * 0.2);
      this.bulbLight.intensity = ramp * 16; (this.beam.material as MeshBasicMaterial).opacity = (1 - ramp) * 0.2; this.arrow.visible = false;
      this.env = ease(clamp01((a - 0.2) / 1.6)); this.applyEnv(this.env);
      if (a > 0.9 && !this.player.celebrating) { this.player.celebrate(this.o.player.celebration); this.companion.celebrate(this.o.companion.celebration); }
      if (a > (red ? 2.2 : 4.9) && !this.celebrated) { this.celebrated = true; this.o.events.onCelebrated(); }
      if (this.celebrated && this.pullT < 0 && a > (red ? 2.6 : 5.2)) this.pullT = 0;
    }
    if (this.pullT >= 0) { this.pullT += dt; if (this.pullT > (this.o.reduced ? 0.4 : 2.1) && !this.completed) { this.completed = true; this.o.events.onComplete(); } }

    if (this.burst) {
      const b = this.burst; b.t += dt; const pos = b.pts.geometry.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < pos.count; i++) { b.vel[i * 3 + 1] -= 6 * dt; pos.setXYZ(i, pos.getX(i) + b.vel[i * 3] * dt, Math.max(0.05, pos.getY(i) + b.vel[i * 3 + 1] * dt), pos.getZ(i) + b.vel[i * 3 + 2] * dt); }
      pos.needsUpdate = true; (b.pts.material as PointsMaterial).opacity = Math.max(0, 1 - b.t / 1.8);
      if (b.t > 1.9) { this.scene.remove(b.pts); this.burst = undefined; }
    }
    if (this.ring && this.actT >= 0.3) { const k = clamp01((this.actT - 0.3) / 1.4); this.ring.scale.setScalar(1 + k * 18); (this.ring.material as MeshBasicMaterial).opacity = (1 - k) * 0.8; }

    for (const fn of this.animators) fn(tt, dt);
    for (const cl of this.drifters) { const cd = cl.userData.cloud; if (cd) { cd.a += cd.sp * dt; cl.position.set(Math.cos(cd.a) * cd.d, cd.y, Math.sin(cd.a) * cd.d); } }
    const pos = this.fireflies.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, this.ffBase[i * 3] + Math.sin(tt * 0.6 + i) * 0.6, this.ffBase[i * 3 + 1] + Math.sin(tt * 0.9 + i * 2) * 0.3, this.ffBase[i * 3 + 2] + Math.cos(tt * 0.5 + i) * 0.6);
    pos.needsUpdate = true;

    this.sun.target.position.set(p.x, 0, p.z); this.sun.position.set(p.x + 10 - this.env * 7, 22 - this.env * 10, p.z + 8);
    this.updateCamera(dt);
  }

  dispose() {
    this.alive = false; this.renderer.setAnimationLoop(null);
    this.cleanup.forEach((f) => f());
    this.scene.traverse((o) => { const m = o as Mesh; if (m.geometry) m.geometry.dispose(); });
    this.geos.forEach((g) => g.dispose()); this.mats.forEach((m) => m.dispose()); this.toon.dispose(); this.glowTex?.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
