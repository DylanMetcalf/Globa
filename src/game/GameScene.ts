import {
  AdditiveBlending, AmbientLight, BackSide, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, DataTexture,
  DirectionalLight, DoubleSide, Fog, Group, HemisphereLight, IcosahedronGeometry, LinearSRGBColorSpace, Material, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter, Object3D, PerspectiveCamera,
  PointLight, Points, PointsMaterial, RedFormat, RingGeometry, Scene, ShaderMaterial, SphereGeometry, SRGBColorSpace, Sprite, SpriteMaterial, TorusGeometry, Vector3, WebGLRenderer,
} from 'three';
import type { CharacterSettings } from '../../shared/types';
import { HAIR_COLORS, SKIN_TONES, outfitColor, type Celebration } from './characters';

export type Theme = 'meadow' | 'bridge' | 'alpine' | 'coast' | 'desert';

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

const R = 14; // island radius
const rngFrom = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
};
const damp = (cur: number, tgt: number, k: number, dt: number) => cur + (tgt - cur) * (1 - Math.exp(-k * dt));
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

interface CircleC { x: number; z: number; r: number }
interface BoxC { x0: number; x1: number; z0: number; z1: number }

/* ------------------------------ characters ------------------------------ */
class Character {
  root = new Group();
  body = new Group();
  legL = new Group(); legR = new Group(); armL = new Group(); armR = new Group();
  head = new Group();
  yaw = 0;
  private walk = 0;
  speed = 0;
  celebrating: Celebration | null = null;
  celeT = 0;
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
    // legs
    for (const [g, x] of [[this.legL, -0.14], [this.legR, 0.14]] as const) {
      g.position.set(x, 0.62, 0); const leg = mesh(new CapsuleGeometry(0.1, 0.32, 4, 8), mat(pants), 0.06); leg.position.y = -0.26; g.add(leg);
      const shoe = mesh(new SphereGeometry(0.13, 10, 8), mat('#f4efe3'), 0.06); shoe.position.set(0, -0.5, 0.05); shoe.scale.set(1, 0.7, 1.4); g.add(shoe); this.body.add(g);
    }
    // arms
    for (const [g, x] of [[this.armL, -0.4], [this.armR, 0.4]] as const) {
      g.position.set(x, 1.22, 0); const arm = mesh(new CapsuleGeometry(0.08, 0.3, 4, 8), mat(outfit), 0.06); arm.position.y = -0.2; g.add(arm);
      const hand = mesh(new SphereGeometry(0.095, 10, 8), mat(skin), 0.06); hand.position.y = -0.46; g.add(hand); this.body.add(g);
    }
    // head
    this.head.position.y = 1.62; this.body.add(this.head);
    const skull = mesh(new SphereGeometry(0.3, 18, 14), mat(skin), 0.045); this.head.add(skull);
    for (const x of [-0.11, 0.11]) { const e = new Mesh(new SphereGeometry(0.04, 8, 6), new MeshBasicMaterial({ color: 0x1b1b2a })); geos.push(e.geometry); mats.push(e.material as Material); e.position.set(x, 0.03, 0.27); this.head.add(e); }
    const smile = new Mesh(new TorusGeometry(0.07, 0.014, 6, 12, Math.PI), new MeshBasicMaterial({ color: 0x1b1b2a })); geos.push(smile.geometry); mats.push(smile.material as Material); smile.position.set(0, -0.08, 0.28); smile.rotation.z = Math.PI; this.head.add(smile);
    const hm = mat(hair);
    if (s.hairStyle === 'short') { const h = mesh(new SphereGeometry(0.33, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hm, 0.04); h.position.set(0, 0.03, -0.02); this.head.add(h); }
    else if (s.hairStyle === 'long') { const h = mesh(new SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hm, 0.04); h.position.set(0, 0.03, -0.03); this.head.add(h); const back = mesh(new CapsuleGeometry(0.26, 0.45, 4, 10), hm, 0.04); back.position.set(0, -0.28, -0.14); this.head.add(back); }
    else if (s.hairStyle === 'cap') { const capM = mat(outfitColor((s.outfitHue + 140) % 360, 42)); const dome = mesh(new SphereGeometry(0.33, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capM, 0.04); dome.position.y = 0.06; this.head.add(dome); const brim = mesh(new CylinderGeometry(0.2, 0.2, 0.03, 14, 1, false, 0, Math.PI), capM, 0.04); brim.position.set(0, 0.1, 0.3); brim.rotation.y = Math.PI / 2; brim.rotation.z = 0; this.head.add(brim); }
    else { for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const b = mesh(new SphereGeometry(0.13, 8, 6), hm, 0.04); b.position.set(Math.cos(a) * 0.25, 0.2 + (i % 2) * 0.05, Math.sin(a) * 0.22 - 0.02); this.head.add(b); } const top = mesh(new SphereGeometry(0.2, 10, 8), hm, 0.04); top.position.y = 0.3; this.head.add(top); }
    if (s.accessory === 'glasses') { for (const x of [-0.11, 0.11]) { const r = new Mesh(new TorusGeometry(0.075, 0.014, 6, 14), new MeshBasicMaterial({ color: 0x1b1b2a })); geos.push(r.geometry); mats.push(r.material as Material); r.position.set(x, 0.03, 0.285); this.head.add(r); } }
    if (s.accessory === 'backpack') { const bp = mesh(new BoxGeometry(0.4, 0.5, 0.24), mat('#d98a3a'), 0.05); bp.position.set(0, 0.98, -0.34); this.body.add(bp); }
    if (s.accessory === 'scarf') { const sc = mesh(new TorusGeometry(0.2, 0.07, 8, 16), mat('#ef7d6a'), 0.05); sc.rotation.x = Math.PI / 2; sc.position.y = 1.36; this.body.add(sc); const tail = mesh(new BoxGeometry(0.1, 0.32, 0.05), mat('#ef7d6a'), 0.05); tail.position.set(0.12, 1.2, 0.26); tail.rotation.z = 0.1; this.body.add(tail); }
    this.root.traverse((o) => { if ((o as Mesh).isMesh) (o as Mesh).castShadow = true; });
  }

  celebrate(kind: Celebration) { this.celebrating = kind; this.celeT = 0; }
  stopCelebrate() { this.celebrating = null; }

  /** Face a point. */
  lookAt(x: number, z: number) { this.yaw = Math.atan2(x - this.root.position.x, z - this.root.position.z); }

  update(dt: number, t: number, moving: number) {
    this.speed = damp(this.speed, moving, 10, dt);
    this.root.rotation.y = this.yaw;
    const { legL, legR, armL, armR, body, head } = this;
    // reset pose
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
        if (cyc < 1.4) { // clap
          const k = Math.sin(cyc * 18);
          armL.rotation.set(-1.25, 0, 0.35 - k * 0.3); armR.rotation.set(-1.25, 0, -0.35 + k * 0.3); head.rotation.x = 0.05; body.position.y = Math.abs(k) * 0.02;
        } else { // excited jump, twice
          const j = (cyc - 1.4) / 0.9; const phase = j % 1; const crouch = phase < 0.18 ? Math.sin((phase / 0.18) * Math.PI) * 0.12 : 0;
          const air = phase >= 0.18 ? Math.sin(((phase - 0.18) / 0.82) * Math.PI) : 0;
          body.position.y = air * 1.0 - crouch; body.scale.set(1 + crouch * 0.4, 1 - crouch, 1 + crouch * 0.4);
          armL.rotation.set(Math.PI * (0.8 + air * 0.2), 0, 0.5); armR.rotation.set(Math.PI * (0.8 + air * 0.2), 0, -0.5);
          legL.rotation.x = air * 0.5; legR.rotation.x = -air * 0.3; body.rotation.z = Math.sin(j * 6) * 0.05;
        }
      } else {
        const b = c * 8; armL.rotation.set(Math.PI * 0.95 + Math.sin(b) * 0.2, 0, 0.3); armR.rotation.set(Math.PI * 0.95 - Math.sin(b) * 0.2, 0, -0.3); body.position.y = Math.abs(Math.sin(b)) * 0.15;
      }
      return;
    }
    if (this.speed > 0.05) {
      this.walk += dt * (6 + this.speed * 4);
      const sw = Math.sin(this.walk) * 0.8 * Math.min(1, this.speed);
      legL.rotation.x = sw; legR.rotation.x = -sw; armL.rotation.x = -sw * 0.8; armR.rotation.x = sw * 0.8;
      body.position.y = Math.abs(Math.cos(this.walk)) * 0.06 * Math.min(1, this.speed); body.rotation.x = 0.1 * Math.min(1, this.speed);
    } else {
      body.position.y = Math.sin(t * 2) * 0.012; armL.rotation.z = 0.08 + Math.sin(t * 2) * 0.02; armR.rotation.z = -0.08 - Math.sin(t * 2) * 0.02; head.rotation.y = Math.sin(t * 0.7) * 0.15;
    }
  }
}

/* ------------------------------ scene ------------------------------ */
export class GameScene {
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
  private bulbGlass!: Mesh; private bulbGlow!: Sprite; private bulbLight = new PointLight(0xffd884, 0, 14, 1.8);
  private beam!: Mesh; private arrow = new Group();
  private sun = new DirectionalLight(0xffffff, 1.7);
  private hemi: HemisphereLight;
  private sky: ShaderMaterial;
  private fireflies!: Points; private ffBase!: Float32Array;
  private clouds: Object3D[] = [];
  private lanterns: { mat: MeshToonMaterial; base: Color }[] = [];
  private blooms: Mesh[] = [];
  private burst?: { pts: Points; vel: Float32Array; t: number };
  private ring?: Mesh;
  private last = 0; private time = 0; private alive = true;
  private keys = new Set<string>();
  private joy = { x: 0, y: 0 };
  private yaw = 0.0; private camDist = 7.6; private camH = 4.7;
  private camTarget = new Vector3(); private camPos = new Vector3();
  private intro = 0;
  private drag: { x: number; id: number } | null = null;
  private litGlass?: MeshBasicMaterial; private actYaw = 0; private lit = false; private actT = -1; private env = 0; private celebrated = false; private completed = false; private pullT = -1;
  private bulbPos = new Vector3(-1.5, 0, -6.2);
  private nearState = false;
  private cleanup: (() => void)[] = [];

  constructor(private o: GameOptions) {
    const { canvas } = o;
    try {
      this.renderer = new WebGLRenderer({ canvas, antialias: !o.mobile || window.devicePixelRatio < 2, powerPreference: 'high-performance' });
    } catch (e) { throw e instanceof Error ? e : new Error('WebGL unavailable'); }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.mobile ? 1.75 : 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.setClearColor(0x0a1030);
    this.camera = new PerspectiveCamera(52, 1, 0.1, 300);

    const tex = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat); tex.minFilter = tex.magFilter = NearestFilter; tex.colorSpace = LinearSRGBColorSpace; tex.needsUpdate = true; this.toon = tex;

    this.sky = new ShaderMaterial({
      side: BackSide, depthWrite: false,
      uniforms: { top: { value: new Color('#2f6fdc') }, mid: { value: new Color('#8fd0ff') }, bottom: { value: new Color('#e9f6ff') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*0.5+0.5,0.0,1.0); vec3 c = h<0.5 ? mix(bottom,mid,h*2.0) : mix(mid,top,(h-0.5)*2.0); gl_FragColor = vec4(c,1.0); }',
    });
    this.mats.push(this.sky);
    const skyMesh = new Mesh(new SphereGeometry(150, 24, 16), this.sky); this.geos.push(skyMesh.geometry); this.scene.add(skyMesh);
    this.scene.fog = new Fog(0xcfe9ff, 40, 130);

    this.hemi = new HemisphereLight(0xcfe6ff, 0x6a5a4a, 0.85);
    this.scene.add(this.hemi, new AmbientLight(0xffffff, 0.25));
    this.sun.position.set(8, 16, 6); this.sun.castShadow = true;
    const ms = o.mobile ? 512 : 1024; this.sun.shadow.mapSize.set(ms, ms);
    Object.assign(this.sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 }); this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);

    this.buildIsland();
    this.buildTheme(o.theme);
    this.buildBulb();
    this.buildClouds();
    this.buildFireflies();

    this.player = new Character(o.player.settings, this.toon, this.mats, this.geos);
    this.companion = new Character(o.companion.settings, this.toon, this.mats, this.geos);
    this.player.root.position.set(0, 0, 8.2); this.player.yaw = Math.PI; // faces -z toward the bulb
    this.companion.root.position.set(1.8, 0, 9.2); this.companion.yaw = Math.PI;
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
  /** Jump straight to the end of the sequence (Skip). */
  skip() { if (!this.completed) { this.completed = true; this.o.events.onComplete(); } }
  /** Test/debug hook: run the simulation without rendering (headless software GL is slow). */
  advance(seconds: number) { for (let t = 0; t < seconds; t += 0.05) this.tick(0.05); }
  /** Test/debug hook: place the player next to the bulb. */
  teleportToBulb() { this.player.root.position.set(this.bulbPos.x + 0.2, 0, this.bulbPos.z + 2.0); }
  get activated() { return this.lit; }
  /** Test/debug hook. */
  playerPosition() { return { x: this.player.root.position.x, z: this.player.root.position.z }; }

  /* ----- build helpers ----- */
  private m(color: string | number, emissive?: number): MeshToonMaterial { const m = new MeshToonMaterial({ color, gradientMap: this.toon }); if (emissive) m.emissive = new Color(emissive); this.mats.push(m); return m; }
  private mesh(g: BufferGeometry, mat: Material, outline = 0.04, shadow = true): Mesh {
    this.geos.push(g); const me = new Mesh(g, mat); me.castShadow = shadow; me.receiveShadow = true;
    if (outline) { const o = new Mesh(g, new MeshBasicMaterial({ color: 0x0a0d1a, side: BackSide })); this.mats.push(o.material as Material); o.scale.setScalar(1 + outline); me.add(o); }
    return me;
  }

  private buildIsland() {
    const top = this.mesh(new CylinderGeometry(R, R * 1.02, 1.4, 40), this.m('#5cc46f'), 0.012); top.position.y = -0.7; this.scene.add(top);
    top.receiveShadow = true;
    const rim = this.mesh(new CylinderGeometry(R * 1.03, R * 1.03, 0.5, 40), this.m('#8f6a49'), 0.01); rim.position.y = -1.25; this.scene.add(rim);
    const rock = this.mesh(new ConeGeometry(R * 1.02, 8, 12, 1), this.m('#7b6b86'), 0.01); rock.rotation.x = Math.PI; rock.position.y = -5.5; this.scene.add(rock);
    // path (soft stones) from start to bulb
    const pm = this.m('#efdcab');
    for (let i = 0; i < 11; i++) {
      const t = i / 10; const x = Math.sin(t * 3.2) * 1.4 * (1 - t * 0.4) + this.bulbPos.x * t; const z = 7.4 + (this.bulbPos.z + 1.3 - 7.4) * t;
      const s = this.mesh(new CylinderGeometry(0.75, 0.8, 0.08, 10), pm, 0.0, false); s.position.set(x, 0.04, z); s.rotation.y = i; s.receiveShadow = true; this.scene.add(s);
    }
    // grass tufts & flowers (bloom more after activation)
    const rnd = rngFrom(this.o.seed + 'flowers');
    const fcols = ['#ff7eb6', '#ffd23f', '#ffffff', '#b794ff', '#ff9e5e'];
    for (let i = 0; i < 38; i++) {
      const a = rnd() * Math.PI * 2; const d = 3 + rnd() * (R - 4.5); const x = Math.cos(a) * d; const z = Math.sin(a) * d;
      if (this.nearPath(x, z, 1.6)) continue;
      const f = this.mesh(new SphereGeometry(0.16, 8, 6), this.m(fcols[i % fcols.length]), 0, false); f.position.set(x, 0.2, z); f.scale.setScalar(0.4); this.scene.add(f); this.blooms.push(f);
      const stem = this.mesh(new CylinderGeometry(0.02, 0.02, 0.2, 4), this.m('#3f9a55'), 0, false); stem.position.set(x, 0.1, z); this.scene.add(stem);
    }
  }
  private nearPath(x: number, z: number, w: number) {
    for (let i = 0; i <= 10; i++) { const t = i / 10; const px = Math.sin(t * 3.2) * 1.4 * (1 - t * 0.4) + this.bulbPos.x * t; const pz = 7.4 + (this.bulbPos.z + 1.3 - 7.4) * t; if (Math.hypot(x - px, z - pz) < w) return true; }
    return Math.hypot(x - this.bulbPos.x, z - this.bulbPos.z) < 3.4;
  }
  private blocked(x: number, z: number, r: number) {
    return this.nearPath(x, z, 1.7) || this.colliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r) || this.boxes.some((b) => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) || Math.hypot(x - 0, z - 8.4) < 3;
  }

  private pine(x: number, z: number, s = 1, snow = false) {
    const g = new Group(); const trunk = this.mesh(new CylinderGeometry(0.16 * s, 0.22 * s, 0.9 * s, 6), this.m('#7a5230'), 0.05); trunk.position.y = 0.45 * s; g.add(trunk);
    for (let i = 0; i < 3; i++) { const c = this.mesh(new ConeGeometry((1.05 - i * 0.27) * s, 1.1 * s, 8), this.m(snow ? (i === 2 ? '#f2f7ff' : '#3d8f6d') : '#2f9a5c'), 0.04); c.position.y = (1.2 + i * 0.7) * s; g.add(c); }
    g.position.set(x, 0, z); this.scene.add(g); this.colliders.push({ x, z, r: 0.45 * s });
  }
  private roundTree(x: number, z: number, s = 1, col = '#4fbe72') {
    const g = new Group(); const trunk = this.mesh(new CylinderGeometry(0.17 * s, 0.24 * s, 1.2 * s, 6), this.m('#7a5230'), 0.05); trunk.position.y = 0.6 * s; g.add(trunk);
    const crown = this.mesh(new IcosahedronGeometry(0.95 * s, 1), this.m(col), 0.04); crown.position.y = 1.9 * s; g.add(crown);
    g.position.set(x, 0, z); this.scene.add(g); this.colliders.push({ x, z, r: 0.45 * s });
  }
  private palm(x: number, z: number, s = 1) {
    const g = new Group(); const trunk = this.mesh(new CylinderGeometry(0.13 * s, 0.2 * s, 2.4 * s, 6), this.m('#b58a55'), 0.05); trunk.position.y = 1.2 * s; trunk.rotation.z = 0.12; g.add(trunk);
    for (let i = 0; i < 6; i++) { const leaf = this.mesh(new BoxGeometry(1.5 * s, 0.05, 0.35 * s), this.m('#3fae6a'), 0.05); leaf.position.set(Math.cos(i) * 0.7 * s + 0.2, 2.5 * s, Math.sin(i) * 0.7 * s); leaf.rotation.y = -i; leaf.rotation.z = -0.35; g.add(leaf); }
    g.position.set(x, 0, z); this.scene.add(g); this.colliders.push({ x, z, r: 0.4 * s });
  }
  private rock(x: number, z: number, s = 1, col = '#9aa0b5') { const r = this.mesh(new IcosahedronGeometry(0.7 * s, 0), this.m(col), 0.05); r.position.set(x, 0.3 * s, z); r.rotation.set(x, z, 0); this.scene.add(r); this.colliders.push({ x, z, r: 0.65 * s }); }
  private lantern(x: number, z: number) {
    const post = this.mesh(new CylinderGeometry(0.06, 0.08, 1.4, 6), this.m('#4b4458'), 0.05); post.position.set(x, 0.7, z); this.scene.add(post);
    const mat = this.m('#fff2c8'); const lamp = this.mesh(new SphereGeometry(0.2, 10, 8), mat, 0.05, false); lamp.position.set(x, 1.5, z); this.scene.add(lamp);
    this.lanterns.push({ mat, base: new Color('#ffd884') }); this.colliders.push({ x, z, r: 0.2 });
  }
  private scatter(count: number, fn: (x: number, z: number, i: number, r: () => number) => void, minD = 3.5, maxD = R - 1.6, salt = 'trees') {
    const rnd = rngFrom(this.o.seed + salt); let placed = 0; let tries = 0;
    while (placed < count && tries++ < count * 20) {
      const a = rnd() * Math.PI * 2; const d = minD + Math.sqrt(rnd()) * (maxD - minD); const x = Math.cos(a) * d; const z = Math.sin(a) * d;
      if (this.blocked(x, z, 0.9)) continue; fn(x, z, placed++, rnd);
    }
  }

  private buildTheme(theme: Theme) {
    const bgCol = { meadow: '#7cc6a0', bridge: '#8693c9', alpine: '#dbe8f7', coast: '#f0d9a8', desert: '#d9915a' }[theme];
    // distant backdrop ring
    const rnd = rngFrom(this.o.seed + 'bg');
    if (theme === 'alpine') {
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const s = 10 + rnd() * 9; const c = this.mesh(new ConeGeometry(s * 0.7, s * 1.5, 6), this.m('#8aa0c8'), 0, false); c.position.set(Math.cos(a) * 52, s * 0.55 - 6, Math.sin(a) * 52); this.scene.add(c); const cap = this.mesh(new ConeGeometry(s * 0.28, s * 0.52, 6), this.m('#ffffff'), 0, false); cap.position.set(c.position.x, c.position.y + s * 0.5, c.position.z); this.scene.add(cap); }
      this.scatter(18, (x, z, i, r) => (i % 3 === 0 ? this.rock(x, z, 0.8 + r() * 0.6, '#aeb7cf') : this.pine(x, z, 0.9 + r() * 0.7, true)));
    } else if (theme === 'coast') {
      const sea = this.mesh(new CylinderGeometry(70, 70, 0.2, 40), this.m('#4cb6e8'), 0, false); sea.position.y = -3.2; this.scene.add(sea);
      const sand = this.mesh(new RingGeometry(R - 3.2, R - 0.1, 40), this.m('#f3dc9b'), 0, false); sand.rotation.x = -Math.PI / 2; sand.position.y = 0.02; this.scene.add(sand);
      this.scatter(10, (x, z, _i, r) => this.palm(x, z, 0.9 + r() * 0.5), 4.5, R - 4);
      this.scatter(5, (x, z, _i, r) => this.rock(x, z, 0.6 + r() * 0.5, '#d9c8a6'), 4, R - 3.4, 'rocks');
      const boat = new Group(); const hull = this.mesh(new BoxGeometry(2, 0.5, 0.8), this.m('#ffffff'), 0.04); boat.add(hull); const sail = this.mesh(new ConeGeometry(0.7, 2, 3), this.m('#ff9e5e'), 0.04); sail.position.set(0, 1.2, 0); boat.add(sail); boat.position.set(24, -2.9, -14); boat.userData.boat = true; this.scene.add(boat); this.clouds.push(boat);
    } else if (theme === 'desert') {
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3; const s = 7 + rnd() * 6; const mesa = this.mesh(new CylinderGeometry(s * 0.6, s * 0.9, s * 1.2, 7), this.m('#c9703f'), 0, false); mesa.position.set(Math.cos(a) * 50, s * 0.2 - 6, Math.sin(a) * 50); this.scene.add(mesa); }
      this.scatter(9, (x, z, _i, r) => { const g = new Group(); const body = this.mesh(new CapsuleGeometry(0.2, 1.1, 4, 8), this.m('#4fa86a'), 0.05); body.position.y = 0.75; g.add(body); const arm = this.mesh(new CapsuleGeometry(0.12, 0.5, 4, 8), this.m('#4fa86a'), 0.05); arm.position.set(0.3, 0.9, 0); arm.rotation.z = -0.9; g.add(arm); g.position.set(x, 0, z); g.scale.setScalar(0.8 + r() * 0.6); this.scene.add(g); this.colliders.push({ x, z, r: 0.4 }); });
      this.scatter(7, (x, z, _i, r) => this.rock(x, z, 0.8 + r() * 0.7, '#c98a5e'), 3.5, R - 2, 'rocks');
    } else if (theme === 'bridge') {
      // river across the island with a stylised stone bridge and two blocky towers (an original design, not a landmark replica)
      const water = this.mesh(new BoxGeometry(R * 2.4, 0.12, 3.4), this.m('#4aa8d8'), 0, false); water.position.set(0, 0.02, 1.2); this.scene.add(water);
      this.boxes.push({ x0: -R, x1: -1.6, z0: -0.4, z1: 2.8 }, { x0: 1.6, x1: R, z0: -0.4, z1: 2.8 });
      const stone = this.m('#cfc6b4');
      const deck = this.mesh(new BoxGeometry(3.4, 0.35, 4.6), stone, 0.03); deck.position.set(0, 0.55, 1.2); this.scene.add(deck);
      for (const x of [-1.5, 1.5]) { const tw = this.mesh(new BoxGeometry(0.9, 3.6, 0.9), this.m('#b8b0c8'), 0.03); tw.position.set(x, 1.9, 1.2); this.scene.add(tw); const roof = this.mesh(new ConeGeometry(0.75, 0.9, 4), this.m('#5a6fb0'), 0.03); roof.position.set(x, 4.1, 1.2); roof.rotation.y = Math.PI / 4; this.scene.add(roof); this.colliders.push({ x, z: 1.2, r: 0.7 }); }
      const arch = this.mesh(new TorusGeometry(1.4, 0.18, 8, 16, Math.PI), stone, 0.03); arch.position.set(0, 3.3, 1.2); this.scene.add(arch);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const h = 6 + rnd() * 16; const b = this.mesh(new BoxGeometry(3 + rnd() * 3, h, 3 + rnd() * 3), this.m(['#8f9ad0', '#a7a1c9', '#7f8ccb'][i % 3]), 0, false); b.position.set(Math.cos(a) * 46, h / 2 - 6, Math.sin(a) * 46); this.scene.add(b); }
      this.scatter(10, (x, z, _i, r) => this.roundTree(x, z, 0.8 + r() * 0.5, '#5fbf7f'), 3.5, R - 1.8);
      this.lantern(-2.6, 3.6); this.lantern(2.6, 3.6);
    } else {
      // meadow: hills + a little windmill
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const s = 9 + rnd() * 8; const h = this.mesh(new SphereGeometry(s, 14, 10), this.m(i % 2 ? '#6cc97f' : '#5bb673'), 0, false); h.scale.y = 0.5; h.position.set(Math.cos(a) * 50, -6, Math.sin(a) * 50); this.scene.add(h); }
      this.scatter(16, (x, z, i, r) => (i % 3 === 0 ? this.pine(x, z, 0.9 + r() * 0.5) : this.roundTree(x, z, 0.8 + r() * 0.5, i % 2 ? '#4fbe72' : '#74cf6a')));
      this.scatter(5, (x, z, _i, r) => this.rock(x, z, 0.6 + r() * 0.6), 3.5, R - 2, 'rocks');
      const mill = new Group(); const base = this.mesh(new CylinderGeometry(0.9, 1.3, 3, 8), this.m('#f2e3c6'), 0.04); base.position.y = 1.5; mill.add(base); const cap = this.mesh(new ConeGeometry(1.15, 1.2, 8), this.m('#c2564a'), 0.04); cap.position.y = 3.5; mill.add(cap);
      const blades = new Group(); for (let i = 0; i < 4; i++) { const bl = this.mesh(new BoxGeometry(0.28, 2.6, 0.06), this.m('#ffffff'), 0.04); bl.position.y = 1.3; const pv = new Group(); pv.rotation.z = (i * Math.PI) / 2; pv.add(bl); blades.add(pv); } blades.position.set(0, 2.9, 1.0); mill.add(blades); blades.userData.spin = true;
      mill.position.set(9, 0, -5); this.scene.add(mill); this.clouds.push(blades); this.colliders.push({ x: 9, z: -5, r: 1.3 });
    }
    this.lantern(this.bulbPos.x - 2.6, this.bulbPos.z + 1.2); this.lantern(this.bulbPos.x + 2.6, this.bulbPos.z + 1.2);
    this.lantern(-2.2, 6.4); this.lantern(2.2, 6.4);
    // low wooden posts ring the bulb area
    this.scene.fog!.color.set(bgCol);
  }

  private glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(0.35, 'rgba(255,216,132,0.5)'); g.addColorStop(1, 'rgba(255,216,132,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
  }

  private buildBulb() {
    const b = this.bulb; b.position.copy(this.bulbPos);
    const base = this.mesh(new CylinderGeometry(0.75, 0.95, 0.5, 14), this.m('#8a7f9e'), 0.04); base.position.y = 0.25; b.add(base);
    const neck = this.mesh(new CylinderGeometry(0.32, 0.4, 0.5, 14), this.m('#cfc8dd'), 0.04); neck.position.y = 0.75; b.add(neck);
    const glassMat = new MeshToonMaterial({ color: '#c9d3ea', gradientMap: this.toon, transparent: true, opacity: 0.85 }); this.mats.push(glassMat);
    this.bulbGlass = this.mesh(new SphereGeometry(0.85, 24, 18), glassMat, 0.025, false); this.bulbGlass.position.y = 1.9; b.add(this.bulbGlass);
    const fil = this.mesh(new TorusGeometry(0.22, 0.03, 6, 14), new MeshBasicMaterial({ color: 0x77708a }), 0, false); fil.position.y = 1.9; b.add(fil); this.mats.push(fil.material as Material);
    const gt = this.glowTexture(); const sm = new SpriteMaterial({ map: gt, color: 0xffe9a8, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }); this.mats.push(sm);
    this.bulbGlow = new Sprite(sm); this.bulbGlow.scale.setScalar(6); this.bulbGlow.position.y = 1.9; b.add(this.bulbGlow);
    this.bulbLight.position.y = 1.9; b.add(this.bulbLight);
    // beacon beam (guides the player before activation)
    const bm = new MeshBasicMaterial({ color: 0xffd884, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }); this.mats.push(bm);
    this.beam = new Mesh(new CylinderGeometry(0.2, 0.9, 12, 16, 1, true), bm); this.geos.push(this.beam.geometry); this.beam.position.y = 8; b.add(this.beam);
    const ar = this.mesh(new ConeGeometry(0.28, 0.6, 4), this.m('#ffd884', 0x664400), 0.05, false); ar.rotation.x = Math.PI; this.arrow.add(ar); this.arrow.position.y = 3.6; b.add(this.arrow);
    this.scene.add(b); this.colliders.push({ x: this.bulbPos.x, z: this.bulbPos.z, r: 0.95 });
    // shockwave ring
    const rm = new MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }); this.mats.push(rm);
    this.ring = new Mesh(new RingGeometry(0.9, 1.1, 48), rm); this.geos.push(this.ring.geometry); this.ring.rotation.x = -Math.PI / 2; this.ring.position.set(this.bulbPos.x, 0.06, this.bulbPos.z); this.scene.add(this.ring);
  }

  private buildClouds() {
    const rnd = rngFrom(this.o.seed + 'clouds'); const cm = this.m('#ffffff');
    for (let i = 0; i < 9; i++) {
      const g = new Group(); for (let k = 0; k < 4; k++) { const s = this.mesh(new SphereGeometry(1.2 + rnd() * 1.2, 10, 8), cm, 0, false); s.position.set(k * 1.6 - 2.4, rnd() * 0.5, rnd()); s.scale.y = 0.6; g.add(s); }
      const a = rnd() * Math.PI * 2; const d = 24 + rnd() * 28; g.position.set(Math.cos(a) * d, -2 + rnd() * 14, Math.sin(a) * d); g.userData.cloud = { a, d, sp: 0.01 + rnd() * 0.02, y: g.position.y }; this.scene.add(g); this.clouds.push(g);
    }
  }

  private buildFireflies() {
    const n = 46; const pos = new Float32Array(n * 3); this.ffBase = new Float32Array(n * 3); const rnd = rngFrom(this.o.seed + 'ff');
    for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2; const d = 2 + rnd() * (R - 3); this.ffBase.set([Math.cos(a) * d, 0.6 + rnd() * 2.2, Math.sin(a) * d], i * 3); pos.set(this.ffBase.subarray(i * 3, i * 3 + 3), i * 3); }
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3)); this.geos.push(g);
    const m = new PointsMaterial({ color: 0xffe9a8, size: 0.22, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, map: this.glowTexture() }); this.mats.push(m);
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
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w / h < 0.8 ? 62 : 52; this.camera.updateProjectionMatrix();
    this.camDist = w / h < 0.8 ? 9.2 : 7.6; this.camH = w / h < 0.8 ? 5.6 : 4.7;
  }

  /* ----- gameplay ----- */
  private nearBulb() { return Math.hypot(this.player.root.position.x - this.bulbPos.x, this.player.root.position.z - this.bulbPos.z) < 2.9; }

  private beginActivation() {
    this.actT = 0; this.actYaw = this.yaw; this.o.events.onActivated();
    this.player.lookAt(this.bulbPos.x, this.bulbPos.z);
    // companion steps beside the player
    this.companion.lookAt(this.bulbPos.x, this.bulbPos.z);
    this.makeBurst();
  }
  private makeBurst() {
    const n = 90; const pos = new Float32Array(n * 3); const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos.set([this.bulbPos.x, 1.9, this.bulbPos.z], i * 3); const a = Math.random() * Math.PI * 2; const u = Math.random() * 2 - 0.3; const s = 2 + Math.random() * 4; vel.set([Math.cos(a) * s, u * 3 + 2, Math.sin(a) * s], i * 3); }
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3)); this.geos.push(g);
    const m = new PointsMaterial({ color: 0xffe9a8, size: 0.3, transparent: true, blending: AdditiveBlending, depthWrite: false, map: this.glowTexture() }); this.mats.push(m);
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
    if (mag > 0.05) {
      const s = Math.sin(this.yaw); const c = Math.cos(this.yaw);
      const dx = -s * iy + c * ix; const dz = -c * iy - s * ix; // forward = (-sin, -cos), right = (cos, -sin)
      const sp = 4.4 * mag;
      p.root.position.x += dx * sp * dt; p.root.position.z += dz * sp * dt;
      const target = Math.atan2(dx, dz); let diff = target - p.yaw; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2; p.yaw += diff * (1 - Math.exp(-14 * dt));
    }
    this.collide(p.root.position, 0.45);
    return mag;
  }
  private collide(pos: Vector3, pr: number) {
    for (let i = 0; i < 2; i++) {
      for (const c of this.colliders) { const dx = pos.x - c.x; const dz = pos.z - c.z; const d = Math.hypot(dx, dz); const min = c.r + pr; if (d < min && d > 1e-4) { pos.x = c.x + (dx / d) * min; pos.z = c.z + (dz / d) * min; } }
      for (const b of this.boxes) {
        if (pos.x > b.x0 - pr && pos.x < b.x1 + pr && pos.z > b.z0 - pr && pos.z < b.z1 + pr) {
          const l = pos.x - (b.x0 - pr); const r = b.x1 + pr - pos.x; const t = pos.z - (b.z0 - pr); const bt = b.z1 + pr - pos.z; const m = Math.min(l, r, t, bt);
          if (m === l) pos.x = b.x0 - pr; else if (m === r) pos.x = b.x1 + pr; else if (m === t) pos.z = b.z0 - pr; else pos.z = b.z1 + pr;
        }
      }
    }
    const d = Math.hypot(pos.x, pos.z); const lim = R - 1.1; if (d > lim) { pos.x *= lim / d; pos.z *= lim / d; }
  }

  private updateCamera(dt: number, snap = false) {
    const pp = this.player.root.position; const act = this.actT >= 0 && this.pullT < 0;
    let dist = this.camDist; let h = this.camH; let tx = pp.x; let ty = 1.2; let tz = pp.z;
    if (this.intro < 1) { const k = 1 - ease(this.intro); dist *= 1 + k * 1.6; h *= 1 + k * 2.2; }
    if (act) { tx = (pp.x + this.bulbPos.x) / 2; tz = (pp.z + this.bulbPos.z) / 2; ty = 1.9; dist = this.camDist * 1.0; h = this.camH * 0.85; if (!this.o.reduced) this.yaw = this.actYaw + Math.sin(this.actT * 0.55) * 0.7; }
    if (this.pullT >= 0) { const k = ease(clamp01(this.pullT / 2)); dist = this.camDist * (1 + k * 2.6); h = this.camH * (1 + k * 4); ty = 1.5 - k * 0.5; tx = (pp.x + this.bulbPos.x) / 2; tz = (pp.z + this.bulbPos.z) / 2; this.camera.fov = (this.camera.aspect < 0.8 ? 62 : 52) + k * 16; this.camera.updateProjectionMatrix(); }
    this.camTarget.set(snap ? tx : damp(this.camTarget.x, tx, 5, dt), snap ? ty : damp(this.camTarget.y, ty, 5, dt), snap ? tz : damp(this.camTarget.z, tz, 5, dt));
    const want = new Vector3(this.camTarget.x + Math.sin(this.yaw) * dist, this.camTarget.y + h, this.camTarget.z + Math.cos(this.yaw) * dist);
    if (snap) this.camPos.copy(want); else this.camPos.set(damp(this.camPos.x, want.x, 6, dt), damp(this.camPos.y, want.y, 6, dt), damp(this.camPos.z, want.z, 6, dt));
    // keep the camera out of foliage and rocks
    for (const c of this.colliders) {
      if (c.r < 0.3) continue;
      const dx = this.camPos.x - c.x; const dz = this.camPos.z - c.z; const d = Math.hypot(dx, dz); const min = c.r + 2.0;
      if (d < min && this.camPos.y < 5.2 && d > 1e-3) { const k = (min - d) / min; this.camPos.x += (dx / d) * (min - d) * 0.6; this.camPos.z += (dz / d) * (min - d) * 0.6; this.camPos.y += k * 1.6; }
    }
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camTarget);
  }

  private applyEnv(k: number) {
    const lerpC = (m: ShaderMaterial, key: 'top' | 'mid' | 'bottom', a: string, b: string) => (m.uniforms[key].value as Color).set(a).lerp(new Color(b), k);
    lerpC(this.sky, 'top', '#2f6fdc', '#5b4aa8'); lerpC(this.sky, 'mid', '#8fd0ff', '#f2b58c'); lerpC(this.sky, 'bottom', '#e9f6ff', '#ffeccc');
    this.hemi.intensity = 0.85 - 0.3 * k; this.hemi.color.set('#cfe6ff').lerp(new Color('#ffcf9a'), k);
    this.sun.color.set('#ffffff').lerp(new Color('#ffb36b'), k); this.sun.intensity = 1.7 - 0.85 * k; this.sun.position.set(8 - k * 6, 16 - k * 8, 6);
    (this.scene.fog as Fog).color.set('#cfe9ff').lerp(new Color('#ffdcae'), k);
    for (const l of this.lanterns) { l.mat.emissive.copy(l.base).multiplyScalar(k * 1.2); }
    for (const f of this.blooms) f.scale.setScalar(0.4 + k * 1.1);
    (this.fireflies.material as PointsMaterial).opacity = k * 0.95;
    this.renderer.toneMappingExposure = 1;
  }

  private frame = (now: number) => {
    if (!this.alive) return;
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now; this.time += dt;
    try { this.tick(dt); this.renderer.render(this.scene, this.camera); } catch (e) { this.o.events.onError(e as Error); this.renderer.setAnimationLoop(null); }
  };

  private tick(dt: number) {
    const t = this.time;
    if (this.intro < 1) this.intro = Math.min(1, this.intro + dt / 1.9);
    const mag = this.movement(dt);
    // companion follows
    const p = this.player.root.position; const c = this.companion.root.position;
    let cm = 0;
    if (this.actT < 0 && this.pullT < 0) {
      const dx = p.x - c.x; const dz = p.z - c.z; const d = Math.hypot(dx, dz);
      if (d > 2.0) { const s = Math.min(4.6, (d - 1.6) * 3.2); c.x += (dx / d) * s * dt; c.z += (dz / d) * s * dt; cm = Math.min(1, s / 3); this.companion.yaw += (Math.atan2(dx, dz) - this.companion.yaw) * Math.min(1, dt * 8); }
      else { const target = Math.atan2(p.x - c.x, p.z - c.z); this.companion.yaw += ((target - this.companion.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 3); }
      this.collide(c, 0.4);
    } else if (this.actT >= 0) {
      const side = new Vector3(this.bulbPos.x + 1.7, 0, this.bulbPos.z + 2.0); const dx = side.x - c.x; const dz = side.z - c.z; const d = Math.hypot(dx, dz);
      if (d > 0.15) { c.x += (dx / d) * Math.min(4, d * 3) * dt; c.z += (dz / d) * Math.min(4, d * 3) * dt; cm = 1; this.companion.yaw = Math.atan2(dx, dz); } else this.companion.lookAt(this.bulbPos.x, this.bulbPos.z);
    }
    // player pose: walk speed from joystick/keys
    this.player.update(dt, t, mag); this.companion.update(dt, t, cm);

    // near prompt
    const near = this.actT < 0 && this.nearBulb();
    const wx = this.bulbPos.x - p.x; const wz = this.bulbPos.z - p.z;
    const sy = Math.sin(this.yaw); const cy = Math.cos(this.yaw);
    const rel = Math.atan2(wx * cy - wz * sy, wx * -sy + wz * -cy); // 0 = straight ahead on screen, clockwise positive
    const d = Math.hypot(wx, wz);
    if (near !== this.nearState || (this.actT < 0 && Math.floor(t * 10) % 3 === 0)) { this.nearState = near; this.o.events.onNear(near, d, rel); }

    // bulb idle / hint
    if (!this.lit) { this.arrow.position.y = 3.6 + Math.sin(t * 3) * 0.2; this.arrow.rotation.y = t * 1.5; const pulse = near ? 0.5 + Math.sin(t * 8) * 0.5 : 0; (this.bulbGlass.material as MeshToonMaterial).emissive.set(0xffd884).multiplyScalar(pulse * 0.4); (this.beam.material as MeshBasicMaterial).opacity = 0.16 + Math.sin(t * 2) * 0.05; this.bulbGlow.material.opacity = pulse * 0.35; }

    // activation timeline
    if (this.actT >= 0) {
      this.actT += dt; const a = this.actT; const red = this.o.reduced;
      if (a > 0.1 && !this.lit) { this.lit = true; }
      const ramp = ease(clamp01((a - 0.1) / 0.5));
      if (ramp > 0.05 && !this.litGlass) { this.litGlass = new MeshBasicMaterial({ color: 0xfff0b0 }); this.mats.push(this.litGlass); this.bulbGlass.material = this.litGlass; }
      if (this.litGlass) this.litGlass.color.set(0xffe9a0).lerp(new Color(0xffffff), 0.35 + Math.sin(t * 6) * 0.1);
      this.bulbGlass.scale.setScalar(1 + ramp * 0.06 + Math.sin(t * 5) * 0.015);
      this.bulbGlow.material.opacity = ramp * 0.95 + Math.sin(t * 5) * 0.05 * ramp; this.bulbGlow.scale.setScalar(6 + ramp * 3 + Math.sin(t * 4) * 0.2);
      this.bulbLight.intensity = ramp * 16; (this.beam.material as MeshBasicMaterial).opacity = (1 - ramp) * 0.2; this.arrow.visible = false;
      this.env = ease(clamp01((a - 0.2) / 1.6)); this.applyEnv(this.env);
      if (a > 0.9 && !this.player.celebrating) { this.player.celebrate(this.o.player.celebration); this.companion.celebrate(this.o.companion.celebration); }
      if (a > (red ? 2.2 : 4.9) && !this.celebrated) { this.celebrated = true; this.o.events.onCelebrated(); }
      if (this.celebrated && this.pullT < 0 && a > (red ? 2.6 : 5.2)) this.pullT = 0;
    }
    if (this.pullT >= 0) { this.pullT += dt; if (this.pullT > (this.o.reduced ? 0.4 : 2.1) && !this.completed) { this.completed = true; this.o.events.onComplete(); } }

    // burst + ring
    if (this.burst) {
      const b = this.burst; b.t += dt; const pos = b.pts.geometry.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < pos.count; i++) { b.vel[i * 3 + 1] -= 6 * dt; pos.setXYZ(i, pos.getX(i) + b.vel[i * 3] * dt, Math.max(0.05, pos.getY(i) + b.vel[i * 3 + 1] * dt), pos.getZ(i) + b.vel[i * 3 + 2] * dt); }
      pos.needsUpdate = true; (b.pts.material as PointsMaterial).opacity = Math.max(0, 1 - b.t / 1.8);
      if (b.t > 1.9) { this.scene.remove(b.pts); this.burst = undefined; }
    }
    if (this.ring && this.actT >= 0.3) { const k = clamp01((this.actT - 0.3) / 1.4); this.ring.scale.setScalar(1 + k * 14); (this.ring.material as MeshBasicMaterial).opacity = (1 - k) * 0.8; }

    // ambient motion
    for (const c of this.clouds) {
      const cd = c.userData.cloud; if (cd) { cd.a += cd.sp * dt; c.position.set(Math.cos(cd.a) * cd.d, cd.y, Math.sin(cd.a) * cd.d); }
      if (c.userData.spin) c.rotation.z += dt * 0.8;
      if (c.userData.boat) c.position.y = -2.9 + Math.sin(t) * 0.1;
    }
    const pos = this.fireflies.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, this.ffBase[i * 3] + Math.sin(t * 0.6 + i) * 0.6, this.ffBase[i * 3 + 1] + Math.sin(t * 0.9 + i * 2) * 0.3, this.ffBase[i * 3 + 2] + Math.cos(t * 0.5 + i) * 0.6);
    pos.needsUpdate = true;

    this.sun.target.position.set(p.x, 0, p.z); this.sun.position.set(p.x + 8 - this.env * 6, 16 - this.env * 8, p.z + 6);
    this.updateCamera(dt);
  }

  dispose() {
    this.alive = false; this.renderer.setAnimationLoop(null);
    this.cleanup.forEach((f) => f());
    this.scene.traverse((o) => { const m = o as Mesh; if (m.geometry) m.geometry.dispose(); });
    this.geos.forEach((g) => g.dispose()); this.mats.forEach((m) => m.dispose()); this.toon.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}

export function themeFor(motif: string, env: string[] = [], countryCode = ''): Theme {
  if (motif === 'city' || countryCode === 'GB') return 'bridge';
  if (['mountain', 'aurora', 'volcano', 'lake'].includes(motif) || env.includes('glaciers')) return 'alpine';
  if (['coast', 'island'].includes(motif) || env.includes('beaches')) return 'coast';
  if (['desert', 'canyon'].includes(motif)) return 'desert';
  return 'meadow';
}
