import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { RunningCouple } from '../components/Mascots';
import { OrthoGlobe } from '../components/OrthoGlobe';
import { CharacterPortrait } from '../components/CharacterPortrait';
import { useStore } from '../store';
import { useCatalog, useReducedMotion } from '../lib/hooks';
import { computeAchievements, type AchievementStatus } from '../lib/achievements';
import { STATE_COLOR, STATE_SHAPE } from '../lib/markers';
import { CELEBRATION_LABEL, celebrationFor } from '../game/characters';
import { fmtDate } from '../lib/format';

const GLYPH: Record<AchievementStatus['glyph'], string> = {
  bulb: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.6 5.4-2 5.2-5.2 2 2-5.2 5.2-2Z',
  pin: 'M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0c0 5.4 6.5 11 6.5 11Zm0-8.3a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4Z',
  map: 'M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4Zm0 0v13m6-10v13',
  flag: 'M6 21V4m0 1h11l-2 4 2 4H6',
  leaf: 'M5 19c0-9 5-14 15-14 0 10-5 15-14 15m-1-1c2-4 5-7 9-9',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.6 2.4 3.9 5.4 3.9 9s-1.3 6.6-3.9 9m0-18C9.4 5.4 8.1 8.4 8.1 12s1.3 6.6 3.9 9M3.5 9h17M3.5 15h17',
};

function Badge({ a }: { a: AchievementStatus }) {
  return (
    <li className={`ach ${a.earned ? 'earned' : ''}`}>
      <div className="ach-art" aria-hidden="true">
        <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" className="ach-ring" /><g transform="translate(16 16) scale(1.33)"><path d={GLYPH[a.glyph]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></g></svg>
      </div>
      <div className="grow">
        <b>{a.title}</b>
        <div className="small muted">{a.blurb}</div>
        {a.earned
          ? <div className="small ach-status"><Icon name="check" width={14} height={14} />Earned{a.earnedAt ? ` · ${fmtDate(a.earnedAt)}` : ''}</div>
          : <div className="ach-prog" role="progressbar" aria-valuemin={0} aria-valuemax={a.target} aria-valuenow={a.current} aria-label={`${a.title} progress`}><span style={{ width: `${(a.current / a.target) * 100}%` }} /><em className="small">{a.current}/{a.target}</em></div>}
      </div>
    </li>
  );
}

export default function OurWorldPage() {
  const nav = useNavigate();
  const state = useStore((s) => s);
  const { get } = useCatalog();
  const reduced = useReducedMotion();
  const { saved, activations, itineraries, profiles } = state;
  const entries = Object.values(saved);
  const lit = new Set(activations.map((a) => a.placeId));
  const touched = new Set([...entries.map((e) => e.placeId), ...lit]);
  const visitedCountries = new Set(entries.filter((e) => e.status === 'visited').map((e) => get(e.placeId)?.country).filter(Boolean));
  const radarCountries = new Set([...touched].map((id) => get(id)?.country).filter(Boolean));
  const achievements = useMemo(() => computeAchievements(state), [state]);
  const earned = achievements.filter((a) => a.earned).length;

  const markers = useMemo(() => [...touched].map((id) => get(id)).filter(Boolean).map((p) => {
    const e = saved[p!.id];
    const st = lit.has(p!.id) ? 'activated' : e?.status === 'visited' ? 'visited' : e?.status === 'planned' ? 'planned' : 'saved';
    return { id: p!.id, lat: p!.lat, lng: p!.lng, color: STATE_COLOR[st], shape: STATE_SHAPE[st], r: 6 };
  }), [saved, activations, get]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats: [string, number, string][] = [
    ['Places discovered', touched.size, 'Saved, planned, visited or lit up'],
    ['Saved', entries.length, 'In our collection'],
    ['Planned', entries.filter((e) => e.status === 'planned').length, 'We intend to go'],
    ['Lit up', lit.size, 'Activated in the miniature world'],
    ['Visited', entries.filter((e) => e.status === 'visited').length, 'Actually experienced'],
    ['Itineraries', itineraries.length, 'Plans created'],
    ['Countries explored', visitedCountries.size, `${radarCountries.size} on our radar`],
  ];
  const log = [...activations].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

  return (
    <div className="page"><div className="page-inner">
      <header className="page-head">
        <div><div className="eyebrow">Our world</div><h1>Every place we light up is <em>part of our story</em></h1><p>Everything here is counted from what you have actually done. No streaks, no daily pressure — just the world, in progress.</p></div>
        <div className="row" style={{ gap: 16 }}><span className="hide-sm" aria-hidden="true"><RunningCouple size={96} /></span><Link className="btn gold" to="/saved"><Icon name="bulb" />Pick a place to light up</Link></div>
      </header>

      <div className="world-top">
        <div className="world-globe night" aria-label="Your places on a globe">
          <OrthoGlobe markers={markers} reduced={reduced} speed={0.06} initial={[-30, -10]} />
          {markers.length === 0 && <div className="world-empty"><b>Your world is dark — for now.</b><span className="small">Light up your first destination to see it glow here.</span></div>}
          <div className="world-legend small"><span><i style={{ background: STATE_COLOR.activated }} />Lit</span><span><i style={{ background: STATE_COLOR.visited }} />Visited</span><span><i style={{ background: STATE_COLOR.planned }} />Planned</span><span><i style={{ background: STATE_COLOR.saved }} />Saved</span></div>
        </div>
        <div className="stats">{stats.map(([l, n, h]) => <div key={l} className="stat card"><span className="stat-n">{n}</span><b>{l}</b><span className="small muted">{h}</span></div>)}</div>
      </div>

      <section className="stack" style={{ marginTop: 'var(--s-7)' }}>
        <div className="row spread wrap"><h2>Achievements</h2><span className="muted small">{earned} of {achievements.length} earned</span></div>
        <ul className="ach-grid">{achievements.map((a) => <Badge key={a.id} a={a} />)}</ul>
      </section>

      <section className="stack" style={{ marginTop: 'var(--s-7)' }}>
        <h2>Our explorers</h2>
        <div className="grid-cards">
          {profiles.map((p) => (
            <article key={p.id} className="card pad row" style={{ gap: 16 }}>
              <CharacterPortrait c={p.character} size={96} label={`${p.name}'s character`} />
              <div className="stack" style={{ gap: 4 }}>
                <h3 style={{ fontSize: '1.2rem' }}>{p.name}</h3>
                <span className="small muted">Celebration: {CELEBRATION_LABEL[celebrationFor(p.id)]}</span>
                <span className="small muted">{p.character.personalised ? 'Personalised character' : 'Placeholder character — not a likeness yet'}</span>
                <Link to="/settings#characters" className="btn sm" style={{ alignSelf: 'flex-start' }}><Icon name="edit" />Customise</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="stack" style={{ marginTop: 'var(--s-7)' }}>
        <h2>Recent lights</h2>
        {log.length === 0 ? <p className="muted">Nothing lit yet. Save a place, then choose “Light it up”.</p> : (
          <ul className="stack" style={{ gap: 8 }}>{log.map((a) => { const p = get(a.placeId); const who = profiles.find((x) => x.id === a.profileId); return p ? (
            <li key={a.id}><button className="nearby-row" onClick={() => nav(`/place/${p.id}`)}><Icon name="bulb" style={{ color: 'var(--st-activated)' }} /><span className="grow"><b>{p.name}</b><span className="muted small"> · lit by {who?.name ?? 'someone'} · {fmtDate(a.at)}</span></span></button></li>) : null; })}</ul>
        )}
      </section>
    </div></div>
  );
}
