import { useEffect, useRef, useState } from 'react';
import type { Climate, EnvTag, Profile, StayDuration } from '../../shared/types';
import { ENV_TAGS, STAY_DURATIONS } from '../../shared/types';
import { Icon } from '../components/Icon';
import { CharacterPortrait } from '../components/CharacterPortrait';
import { useStore } from '../store';
import { useUi } from '../store/ui';
import { ACCESSORIES, CELEBRATION_LABEL, HAIR_COLORS, HAIR_STYLES, SKIN_TONES, celebrationFor, outfitColor } from '../game/characters';
import { CLIMATE_LABELS, CURRENCIES, ENV_LABELS, STAY_LABELS } from '../lib/labels';
import { playSound } from '../game/audio';

function Section({ id, title, desc, children }: { id?: string; title: string; desc?: string; children: React.ReactNode }) {
  return <section id={id} className="card pad stack set-sec"><div><h2 style={{ fontSize: '1.4rem' }}>{title}</h2>{desc && <p className="muted small" style={{ margin: '4px 0 0' }}>{desc}</p>}</div>{children}</section>;
}

function CharacterEditor({ p }: { p: Profile }) {
  const upd = useStore((s) => s.updateCharacter);
  const c = p.character;
  return (
    <div className="char-ed">
      <div className="stack center" style={{ alignItems: 'center' }}>
        <CharacterPortrait c={c} size={150} label={`${p.name}'s character preview`} />
        <span className="badge" style={{ whiteSpace: 'normal', textAlign: 'center' }}>{c.personalised ? 'Personalised' : 'Placeholder — not a likeness'}</span>
        <span className="small muted">Celebrates with: {CELEBRATION_LABEL[celebrationFor(p.id)]}</span>
      </div>
      <div className="stack">
        <label className="field"><span className="label">Outfit colour</span><input type="range" min={0} max={360} value={c.outfitHue} onChange={(e) => upd(p.id, { outfitHue: Number(e.target.value) })} style={{ accentColor: outfitColor(c.outfitHue) }} aria-label={`${p.name} outfit hue`} /></label>
        <div className="field"><span className="label">Skin tone</span><div className="row wrap" style={{ gap: 6 }}>{SKIN_TONES.map((t, i) => <button key={t} className={`swatch ${c.skin === i ? 'on' : ''}`} style={{ background: t }} aria-label={`Skin tone ${i + 1}`} aria-pressed={c.skin === i} onClick={() => upd(p.id, { skin: i })} />)}</div></div>
        <div className="field"><span className="label">Hair colour</span><div className="row wrap" style={{ gap: 6 }}>{HAIR_COLORS.map((t, i) => <button key={t} className={`swatch ${c.hair === i ? 'on' : ''}`} style={{ background: t }} aria-label={`Hair colour ${i + 1}`} aria-pressed={c.hair === i} onClick={() => upd(p.id, { hair: i })} />)}</div></div>
        <div className="field"><span className="label">Hair style</span><div className="row wrap" style={{ gap: 6 }}>{HAIR_STYLES.map((h) => <button key={h} className="chip" aria-pressed={c.hairStyle === h} onClick={() => upd(p.id, { hairStyle: h })}>{h}</button>)}</div></div>
        <div className="field"><span className="label">Accessory</span><div className="row wrap" style={{ gap: 6 }}>{ACCESSORIES.map((h) => <button key={h} className="chip" aria-pressed={c.accessory === h} onClick={() => upd(p.id, { accessory: h })}>{h}</button>)}</div></div>
        <label className="field"><span className="label">Reference notes <span className="muted">(for a future personalised model)</span></span>
          <textarea className="input" rows={2} placeholder="e.g. where the reference photos are, style notes…" value={c.referenceNote} onChange={(e) => upd(p.id, { referenceNote: e.target.value })} /></label>
        <label className="row small"><input type="checkbox" checked={c.personalised} onChange={(e) => upd(p.id, { personalised: e.target.checked })} />Mark as personalised (only once a character has been designed from photos)</label>
      </div>
    </div>
  );
}

function PrefsEditor({ p }: { p: Profile }) {
  const upd = useStore((s) => s.updatePreferences);
  const pr = p.preferences;
  const tog = <T,>(a: T[], v: T) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);
  return (
    <div className="stack">
      <div className="field"><span className="label">Interests (natural environments)</span><div className="row wrap" style={{ gap: 6 }}>{ENV_TAGS.map((e: EnvTag) => <button key={e} className="chip" aria-pressed={pr.interests.includes(e)} onClick={() => upd(p.id, { interests: tog(pr.interests, e) })}>{ENV_LABELS[e]}</button>)}</div></div>
      <div className="field"><span className="label">Preferred climate</span><div className="row wrap" style={{ gap: 6 }}>{(Object.keys(CLIMATE_LABELS) as Climate[]).map((e) => <button key={e} className="chip" aria-pressed={pr.climate.includes(e)} onClick={() => upd(p.id, { climate: tog(pr.climate, e) })}>{CLIMATE_LABELS[e]}</button>)}</div></div>
      <div className="grid-prefs">
        <label className="field"><span className="label">Typical stay</span><select className="input" value={pr.stay} onChange={(e) => upd(p.id, { stay: e.target.value as StayDuration })}>{STAY_DURATIONS.map((s) => <option key={s} value={s}>{STAY_LABELS[s]}</option>)}</select></label>
        <label className="field"><span className="label">Budget (monthly)</span><input className="input" type="number" min={0} placeholder="optional" value={pr.budget?.amount ?? ''} onChange={(e) => upd(p.id, { budget: e.target.value === '' ? undefined : { amount: Number(e.target.value), currency: pr.budget?.currency ?? 'USD', period: 'month' } })} /></label>
        <label className="field"><span className="label">Budget currency</span><select className="input" value={pr.budget?.currency ?? 'USD'} onChange={(e) => upd(p.id, { budget: { amount: pr.budget?.amount ?? 0, currency: e.target.value, period: 'month' } })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="field"><span className="label">Crowds</span><select className="input" value={pr.crowds} onChange={(e) => upd(p.id, { crowds: e.target.value as 'any' | 'low' })}><option value="any">Don’t mind</option><option value="low">Prefer fewer crowds</option></select></label>
      </div>
      <div className="row wrap" style={{ gap: 16 }}>
        <label className="row small"><input type="checkbox" checked={pr.remoteWork.needsWifi} onChange={(e) => upd(p.id, { remoteWork: { ...pr.remoteWork, needsWifi: e.target.checked } })} />Need reliable Wi-Fi for work</label>
        <label className="row small"><input type="checkbox" checked={pr.remoteWork.needsCoworking} onChange={(e) => upd(p.id, { remoteWork: { ...pr.remoteWork, needsCoworking: e.target.checked } })} />Want coworking nearby</label>
        <label className="row small">Min. internet score <select className="input sm auto" value={pr.remoteWork.minInternet} onChange={(e) => upd(p.id, { remoteWork: { ...pr.remoteWork, minInternet: Number(e.target.value) } })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const profiles = useStore((s) => s.profiles);
  const active = useStore((s) => s.activeProfileId);
  const setActive = useStore((s) => s.setActiveProfile);
  const updateProfile = useStore((s) => s.updateProfile);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const exportData = useStore((s) => s.exportData);
  const importData = useStore((s) => s.importData);
  const resetAll = useStore((s) => s.resetAll);
  const status = useUi((s) => s.status);
  const statusState = useUi((s) => s.statusState);
  const loadStatus = useUi((s) => s.loadStatus);
  const toast = useUi((s) => s.toast);
  const [editing, setEditing] = useState(active);
  const file = useRef<HTMLInputElement>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => { void loadStatus(); }, [loadStatus]);
  useEffect(() => { if (location.hash === '#characters') setTimeout(() => document.getElementById('characters')?.scrollIntoView(), 100); }, []);
  const prof = profiles.find((p) => p.id === editing) ?? profiles[0];

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `globa-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
    toast('Backup downloaded');
  };
  const onFile = async (f?: File) => { if (!f) return; const r = importData(await f.text()); toast(r.message); if (file.current) file.current.value = ''; };

  return (
    <div className="page"><div className="page-inner" style={{ maxWidth: 920 }}>
      <header className="page-head"><div><div className="eyebrow">Settings</div><h1>Make it ours</h1><p>Nothing here is required. Change anything, any time.</p></div></header>
      <div className="stack" style={{ gap: 'var(--s-5)' }}>
        <Section title="Profiles" desc="Dylan and Nicole share one collection. Profiles are local to this browser — there is no account or login yet.">
          <div className="row wrap" style={{ gap: 12 }}>
            {profiles.map((p) => (
              <div key={p.id} className={`profile-card ${p.id === active ? 'on' : ''}`}>
                <CharacterPortrait c={p.character} size={64} label={`${p.name} portrait`} />
                <div className="stack" style={{ gap: 4 }}>
                  <input className="input sm" aria-label={`Name for profile ${p.name}`} value={p.name} onChange={(e) => updateProfile(p.id, { name: e.target.value || p.name })} />
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn sm" aria-pressed={p.id === active} onClick={() => setActive(p.id)}>{p.id === active ? 'Active' : 'Use this profile'}</button>
                    <input type="color" aria-label={`Colour for ${p.name}`} value={p.color} onChange={(e) => updateProfile(p.id, { color: e.target.value })} style={{ width: 36, height: 36, border: 0, background: 'none' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="characters" title="Characters" desc="Original placeholder characters for the miniature world. They are designed to be replaced with versions personalised from photos later — until then they don’t claim to look like anyone.">
          <div className="seg" role="tablist" aria-label="Choose character">{profiles.map((p) => <button key={p.id} role="tab" aria-selected={editing === p.id} onClick={() => setEditing(p.id)}>{p.name}</button>)}</div>
          <CharacterEditor p={prof} />
        </Section>

        <Section title={`${prof.name}’s travel preferences`} desc="Used to personalise discovery and planning. None are required.">
          <div className="seg" role="tablist" aria-label="Choose profile for preferences">{profiles.map((p) => <button key={p.id} role="tab" aria-selected={editing === p.id} onClick={() => setEditing(p.id)}>{p.name}</button>)}</div>
          <PrefsEditor p={prof} />
        </Section>

        <Section title="Appearance & motion">
          <div className="grid-prefs">
            <div className="field"><span className="label">Theme</span><div className="seg" role="group" aria-label="Theme">{(['system', 'light', 'dark'] as const).map((t) => <button key={t} aria-pressed={settings.theme === t} onClick={() => update({ theme: t })}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div></div>
            <div className="field"><span className="label">Reduced motion</span><div className="seg" role="group" aria-label="Reduced motion">{(['system', 'on', 'off'] as const).map((t) => <button key={t} aria-pressed={settings.reducedMotion === t} onClick={() => update({ reducedMotion: t })}>{t === 'system' ? 'Follow device' : t === 'on' ? 'Reduce' : 'Full motion'}</button>)}</div></div>
          </div>
          <p className="small muted">The globe and the miniature world use the night look in every theme.</p>
        </Section>

        <Section title="Sound" desc="Off by default. Nothing ever plays until you turn it on and interact.">
          <label className="row"><input type="checkbox" checked={settings.sound.enabled} onChange={(e) => { update({ sound: { ...settings.sound, enabled: e.target.checked } }); if (e.target.checked) playSound('switch', settings.sound.volume); }} />Enable sound effects & ambience in the miniature world</label>
          <label className="field" style={{ maxWidth: 320 }}><span className="label">Volume</span><input type="range" min={0} max={1} step={0.05} value={settings.sound.volume} onChange={(e) => update({ sound: { ...settings.sound, volume: Number(e.target.value) } })} onMouseUp={() => settings.sound.enabled && playSound('success', settings.sound.volume)} /></label>
        </Section>

        <Section title="Units & currency">
          <div className="grid-prefs">
            <label className="field"><span className="label">Home currency</span><select className="input" value={settings.currency} onChange={(e) => update({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <div className="field"><span className="label">Distances</span><div className="seg" role="group" aria-label="Units">{(['metric', 'imperial'] as const).map((u) => <button key={u} aria-pressed={settings.units === u} onClick={() => update({ units: u })}>{u === 'metric' ? 'Kilometres' : 'Miles'}</button>)}</div></div>
          </div>
          <p className="small muted">Cost estimates are stored in USD and only converted when live exchange rates are available.</p>
        </Section>

        <Section title="Integrations" desc="Which services are live, and which run on demonstration data. Keys live in the server’s .env — never in the browser.">
          {statusState === 'offline' && <div className="notice error"><Icon name="warn" />The GLOBA server isn’t reachable, so all live features (AI, lookup, weather, images, nearby places) are off. Start it with <code>npm run dev</code> or <code>npm start</code>.</div>}
          {statusState === 'loading' && <div className="skeleton" style={{ height: 120 }} />}
          {status && (
            <ul className="stack" style={{ gap: 8 }}>
              {status.integrations.map((i) => (
                <li key={i.id} className="integration">
                  <span className={`badge ${i.state === 'live' ? 'live' : i.state === 'demo' ? 'demo' : ''}`}>{i.state === 'live' ? 'Live' : i.state === 'demo' ? 'Demo' : 'Unavailable'}</span>
                  <div className="grow"><b>{i.label}</b><div className="small muted">{i.detail}</div>{i.env && i.state !== 'live' && <div className="small">Set: {i.env.map((e) => <code key={e} style={{ marginRight: 6 }}>{e}</code>)}</div>}</div>
                </li>
              ))}
            </ul>
          )}
          <p className="small muted">“Live” means the server is configured to call the provider; individual calls can still fail (offline, rate limits) and the UI will say so. See README for setup.</p>
        </Section>

        <Section title="Your data" desc="Stored in this browser only (localStorage, key globa:v1). It survives reloads, is not synced between devices, and isn’t protected by an account. Back it up!">
          <div className="row wrap">
            <button className="btn" onClick={download}><Icon name="download" />Export backup</button>
            <button className="btn" onClick={() => file.current?.click()}><Icon name="upload" />Import backup</button>
            <input ref={file} type="file" accept="application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <button className="btn danger ghost" onClick={() => dlg.current?.showModal()}><Icon name="trash" />Erase everything</button>
          </div>
        </Section>
      </div>

      <dialog ref={dlg} className="modal" aria-labelledby="erase-t">
        <div className="stack"><h2 id="erase-t" style={{ fontSize: '1.3rem' }}>Erase all GLOBA data in this browser?</h2><p className="muted">Saved places, itineraries, lit places, characters and settings will be removed. Export a backup first if you might want them back.</p>
          <div className="row spread"><button className="btn ghost" onClick={() => dlg.current?.close()}>Cancel</button><button className="btn danger" onClick={() => { resetAll(); dlg.current?.close(); toast('Everything erased'); }}>Erase</button></div></div>
      </dialog>
    </div></div>
  );
}
