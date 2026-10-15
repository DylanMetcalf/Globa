import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Icon, type IconName } from './Icon';
import { LogoMark } from './Logo';
import { useStore, activeProfile } from '../store';
import { useUi } from '../store/ui';
import { Assistant } from './Assistant';

const NAV: { to: string; label: string; icon: IconName; end?: boolean; c?: string }[] = [
  { to: '/', label: 'Explore', icon: 'explore', end: true, c: 'nav-explore' },
  { to: '/discover', label: 'Discover', icon: 'discover', c: 'nav-discover' },
  { to: '/saved', label: 'Saved', icon: 'saved', c: 'nav-saved' },
  { to: '/itineraries', label: 'Trips', icon: 'trips', c: 'nav-trips' },
  { to: '/our-world', label: 'Our World', icon: 'world', c: 'nav-our-world' },
];

function Avatar() {
  const profile = useStore(activeProfile);
  const profiles = useStore((s) => s.profiles);
  const set = useStore((s) => s.setActiveProfile);
  const next = () => set(profiles[(profiles.findIndex((p) => p.id === profile.id) + 1) % profiles.length].id);
  return (
    <button className="avatar" style={{ ['--c' as string]: profile.color }} onClick={next} title={`Signed in as ${profile.name} (local profile). Click to switch.`} aria-label={`Active profile: ${profile.name}. Switch profile`}>
      {profile.name[0]}
    </button>
  );
}

export function Shell() {
  const loc = useLocation();
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  const loadStatus = useUi((s) => s.loadStatus);
  const setAssistantOpen = useUi((s) => s.setAssistantOpen);
  const recovery = useStore((s) => s.recoveryNote);
  const clearRecovery = useStore((s) => s.clearRecoveryNote);
  useEffect(() => { void loadStatus(); }, [loadStatus]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar-m">
        <NavLink to="/" aria-label="GLOBA home"><LogoMark size={34} /></NavLink>
        <div className="row">
          <button className="btn ghost icon sm" aria-label="Open travel assistant" style={{ color: '#fff' }} onClick={() => setAssistantOpen(true)}><Icon name="sparkles" /></button>
          <NavLink to="/settings" className="btn ghost icon sm" aria-label="Settings" style={{ color: '#fff' }}><Icon name="settings" /></NavLink>
          <Avatar />
        </div>
      </header>
      <nav className="rail" aria-label="Main">
        <NavLink to="/" className="brand" aria-label="GLOBA home"><LogoMark size={46} /></NavLink>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={`navlink ${n.c ?? ''}`}><Icon name={n.icon} /><span>{n.label}</span></NavLink>
        ))}
        <div className="spacer" />
        <button className="navlink" onClick={() => setAssistantOpen(true)} aria-label="Open travel assistant"><Icon name="sparkles" /><span>Ask</span></button>
        <NavLink to="/settings" className="navlink"><Icon name="settings" /><span>Settings</span></NavLink>
        <Avatar />
      </nav>
      <main id="main" className="main" key={loc.pathname.split('/')[1] || 'explore'}>
        {recovery && (
          <div className="notice error" role="alert" style={{ margin: 12 }}>
            <Icon name="warn" /><div className="grow">{recovery}</div>
            <button className="btn sm" onClick={clearRecovery}>Dismiss</button>
          </div>
        )}
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={`navlink ${n.c ?? ''}`}><Icon name={n.icon} /><span>{n.label}</span></NavLink>
        ))}
      </nav>
      <Assistant />
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'achievement' ? 'achievement' : ''}`}>
            <span className="grow">{t.text}</span>
            {t.action && <button onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>}
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss"><Icon name="close" width={16} height={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
