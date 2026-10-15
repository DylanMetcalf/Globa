/**
 * Tiny synthesised audio (no asset files). Nothing plays unless the user enabled sound in Settings,
 * and the AudioContext is only created from a user gesture.
 */
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(c: AudioContext, freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine', slideTo?: number) {
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(c.destination); o.start(start); o.stop(start + dur + 0.05);
}

export type Sfx = 'switch' | 'success' | 'whoosh' | 'step';

export function playSound(kind: Sfx, volume = 0.5) {
  const c = ac(); if (!c) return;
  const t = c.currentTime; const v = volume * 0.35;
  if (kind === 'switch') { tone(c, 180, t, 0.06, v, 'square'); tone(c, 90, t + 0.05, 0.08, v * 0.8, 'square'); }
  else if (kind === 'success') { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, t + i * 0.09, 0.5, v, 'triangle')); }
  else if (kind === 'whoosh') {
    const buf = c.createBuffer(1, c.sampleRate * 0.8, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.7);
    const g = c.createGain(); g.gain.value = v * 0.7; s.connect(f).connect(g).connect(c.destination); s.start(t);
  } else tone(c, 220 + Math.random() * 40, t, 0.04, v * 0.3, 'triangle');
}

/** Gentle wind + the odd bird chirp. Returns a stop function. */
export function startAmbience(volume = 0.5): () => void {
  const c = ac(); if (!c) return () => {};
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  const g = c.createGain(); g.gain.value = volume * 0.18;
  src.connect(f).connect(g).connect(c.destination); src.start();
  const bird = setInterval(() => { if (Math.random() < 0.5 && c.state === 'running') { const t = c.currentTime; const base = 1800 + Math.random() * 900; tone(c, base, t, 0.08, volume * 0.06, 'sine', base * 1.3); tone(c, base * 1.2, t + 0.11, 0.08, volume * 0.05, 'sine', base * 0.9); } }, 3800);
  return () => { clearInterval(bird); try { g.gain.setTargetAtTime(0, c.currentTime, 0.2); setTimeout(() => src.stop(), 600); } catch { /* ignore */ } };
}
