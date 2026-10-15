import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Budget, Pace, Place, TripPurpose } from '../../shared/types';
import { Icon } from '../components/Icon';
import { PlacePicker } from '../components/PlacePicker';
import { LogoMark } from '../components/Logo';
import { useStore } from '../store';
import { useUi } from '../store/ui';
import { useCatalog } from '../lib/hooks';
import { CURRENCIES, PURPOSE_LABELS } from '../lib/labels';
import { TRIP_PURPOSES } from '../../shared/types';
import { fromAi, generateDraft, type WizardAnswers } from '../lib/itinerary';
import { announce } from '../components/PlaceBits';
import { api } from '../services/api';

const FOCUS = [['nature', 'Nature & hiking'], ['food', 'Food & drink'], ['culture', 'Culture & history'], ['adventure', 'Adventure'], ['work', 'Focused work'], ['relax', 'Rest & slow days']] as const;
const DURATIONS = [['A weekend', 3], ['One week', 7], ['Two weeks', 14], ['One month', 30], ['Three months', 90], ['Six months', 180], ['One year', 365]] as const;
const STEPS = ['Purpose', 'Where', 'When', 'How long', 'Focus', 'Budget', 'Pace', 'Saved places'];

export default function ItineraryWizard() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { get, places } = useCatalog();
  const me = useStore((s) => s.activeProfileId);
  const profile = useStore((s) => s.profiles.find((p) => p.id === s.activeProfileId))!;
  const saved = useStore((s) => s.saved);
  const currency = useStore((s) => s.settings.currency);
  const add = useStore((s) => s.addItinerary);
  const aiLive = useUi((s) => s.status?.ai.state === 'live');
  const toast = useUi((s) => s.toast);
  const sync = useStore((s) => s.syncAchievements);

  const pre = params.get('place');
  const [step, setStep] = useState(0);
  const [purpose, setPurpose] = useState<TripPurpose>('holiday');
  const [name, setName] = useState('');
  const [dest, setDest] = useState<string[]>(pre && get(pre) ? [pre] : []);
  const [flex, setFlex] = useState(true);
  const [start, setStart] = useState('');
  const [days, setDays] = useState(7);
  const [focus, setFocus] = useState<string[]>([]);
  const [budgetOn, setBudgetOn] = useState(false);
  const [budget, setBudget] = useState<Budget>({ amount: 0, currency, period: 'month' });
  const [pace, setPace] = useState<Pace>('balanced');
  const [include, setInclude] = useState<string[]>([]);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const savedList = useMemo(() => Object.keys(saved).map((id) => get(id)).filter(Boolean) as Place[], [saved, get]);
  const toggle = <T,>(arr: T[], v: T, set: (a: T[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const invalidStart = start && Number.isNaN(Date.parse(start));
  const last = step === STEPS.length - 1;

  const generate = async () => {
    setErr('');
    const answers: WizardAnswers = { purpose, name, destinationIds: dest, startDate: flex ? undefined : start || undefined, flexibleDates: flex || !start, durationDays: Math.max(1, Math.min(730, days)), focus, budget: budgetOn && budget.amount > 0 ? budget : undefined, pace, includeSaved: include, createdBy: me };
    setBusy(aiLive ? 'Asking the AI to draft your plan from catalogue data…' : 'Drafting your plan…');
    let it = null;
    if (aiLive) {
      try {
        const cands = [...new Set([...dest, ...include])].map((id) => get(id)).filter(Boolean) as Place[];
        const near = places.filter((p) => p.kind === 'poi' && cands.some((c) => Math.hypot(p.lat - c.lat, p.lng - c.lng) < 4)).slice(0, 30);
        const slim = [...cands, ...near].map((p) => ({ id: p.id, name: p.name, kind: p.kind, country: p.country, lat: p.lat, lng: p.lng, summary: p.summary, env: p.env, monthlyCostUSD_estimate: p.monthlyCostUSD }));
        const r = await api.ai.itinerary({ ...answers, profile: { name: profile.name } }, slim);
        it = fromAi(r.itinerary, answers);
        if (!it.days.length) throw new Error('The model returned no days.');
      } catch (e) {
        toast(`AI drafting unavailable (${(e as Error).message}) — used the offline draft instead.`);
        it = null;
      }
    }
    if (!it) { await new Promise((r) => setTimeout(r, 700)); it = generateDraft(answers, places); }
    add(it);
    // mark used saved places as planned
    for (const id of new Set([...dest, ...include])) if (saved[id]?.status === 'saved') useStore.getState().setStatus(id, 'planned');
    announce(sync());
    setBusy(null);
    nav(`/itineraries/${it.id}`);
  };

  if (busy) {
    return (
      <div className="page night" style={{ display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
        <div className="stack center" style={{ alignItems: 'center', maxWidth: 420, padding: 24 }} role="status" aria-live="polite">
          <div className="gen-orbit"><LogoMark size={84} animated /></div>
          <h2>{busy}</h2>
          <p className="muted">Ordering places, balancing the pace and leaving space to breathe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page"><div className="page-inner wizard">
      <Link to="/itineraries" className="btn sm ghost" style={{ alignSelf: 'flex-start', marginBottom: 12 }}><Icon name="left" />All itineraries</Link>
      <div className="wiz-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
        {STEPS.map((s, i) => <button key={s} className={i === step ? 'on' : i < step ? 'done' : ''} onClick={() => setStep(i)} aria-label={`Go to step ${i + 1}: ${s}`}><span>{i < step ? <Icon name="check" width={14} height={14} /> : i + 1}</span></button>)}
      </div>

      <div className="card pad wiz-card">
        {step === 0 && (<div className="stack"><h1>What is this trip for?</h1>
          <div className="row wrap" style={{ gap: 8 }}>{TRIP_PURPOSES.map((p) => <button key={p} className="chip big" aria-pressed={purpose === p} onClick={() => setPurpose(p)}>{PURPOSE_LABELS[p]}</button>)}</div>
          <div className="field"><label htmlFor="w-name">Name it (optional)</label><input id="w-name" className="input" placeholder="e.g. Six months of mountains" value={name} onChange={(e) => setName(e.target.value)} /></div></div>)}
        {step === 1 && (<div className="stack"><h1>Where would you like to go?</h1><p className="muted">Add one place, or several for a multi-stop plan. You can skip this and add stays later.</p>
          <div className="row wrap" style={{ gap: 8 }}>{dest.map((id) => <span key={id} className="chip on">{get(id)?.name}<button className="plainbtn" aria-label={`Remove ${get(id)?.name}`} onClick={() => setDest(dest.filter((x) => x !== id))}><Icon name="close" className="x" /></button></span>)}
            <button className="chip" onClick={() => setPicker(true)}><Icon name="plus" width={14} height={14} />Add a place</button></div>
          {dest.length > 1 && <p className="small muted">Stays will be ordered as listed, with time split roughly evenly. You can adjust each stay afterwards.</p>}</div>)}
        {step === 2 && (<div className="stack"><h1>When would you like to go?</h1>
          <label className="row"><input type="checkbox" checked={flex} onChange={(e) => setFlex(e.target.checked)} />Dates are flexible</label>
          {!flex && <div className="field"><label htmlFor="w-start">Approximate start date</label><input id="w-start" type="date" className="input" style={{ maxWidth: 240 }} value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={!!invalidStart} />{invalidStart && <span className="field-error" role="alert">Please enter a valid date.</span>}</div>}</div>)}
        {step === 3 && (<div className="stack"><h1>How long would you like to stay?</h1>
          <div className="row wrap" style={{ gap: 8 }}>{DURATIONS.map(([l, d]) => <button key={l} className="chip big" aria-pressed={days === d} onClick={() => setDays(d)}>{l}</button>)}</div>
          <div className="field" style={{ maxWidth: 220 }}><label htmlFor="w-days">Or a number of days</label><input id="w-days" className="input" type="number" min={1} max={730} value={days} onChange={(e) => setDays(Number(e.target.value))} /></div>
          {days > 21 && <div className="notice info"><Icon name="info" />For long stays we’ll plan a typical week per stay rather than every single day.</div>}</div>)}
        {step === 4 && (<div className="stack"><h1>What should the trip focus on?</h1>
          <div className="row wrap" style={{ gap: 8 }}>{FOCUS.map(([k, l]) => <button key={k} className="chip big" aria-pressed={focus.includes(k)} onClick={() => toggle(focus, k, setFocus)}>{l}</button>)}</div></div>)}
        {step === 5 && (<div className="stack"><h1>Roughly what’s the budget?</h1><p className="muted">Optional. It is kept as a target, and nothing is booked or priced.</p>
          <label className="row"><input type="checkbox" checked={budgetOn} onChange={(e) => setBudgetOn(e.target.checked)} />Set a budget</label>
          {budgetOn && <div className="row wrap"><input className="input" style={{ width: 140 }} type="number" min={0} aria-label="Budget amount" value={budget.amount || ''} onChange={(e) => setBudget({ ...budget, amount: Number(e.target.value) })} />
            <select className="input" style={{ width: 110 }} aria-label="Currency" value={budget.currency} onChange={(e) => setBudget({ ...budget, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
            <select className="input" style={{ width: 130 }} aria-label="Period" value={budget.period} onChange={(e) => setBudget({ ...budget, period: e.target.value as Budget['period'] })}><option value="day">per day</option><option value="week">per week</option><option value="month">per month</option></select></div>}</div>)}
        {step === 6 && (<div className="stack"><h1>What pace feels right?</h1>
          <div className="pace-grid">{([['relaxed', 'Relaxed', 'Around two things a day, long breaks'], ['balanced', 'Balanced', 'Around three things a day'], ['packed', 'Packed', 'Around four a day, see more']] as const).map(([k, l, d]) => (
            <button key={k} className={`pace ${pace === k ? 'on' : ''}`} aria-pressed={pace === k} onClick={() => setPace(k)}><b>{l}</b><span className="small muted">{d}</span></button>))}</div></div>)}
        {step === 7 && (<div className="stack"><h1>Include any saved places?</h1>
          {savedList.length === 0 ? <p className="muted">You have no saved places yet. You can add places while editing.</p> : (
            <ul className="stack" style={{ gap: 6 }}>{savedList.map((p) => <li key={p.id}><label className="nearby-row"><input type="checkbox" checked={include.includes(p.id)} onChange={() => toggle(include, p.id, setInclude)} /><span className="grow"><b>{p.name}</b><span className="muted small"> · {p.country}</span></span></label></li>)}</ul>)}
          {err && <div className="notice error" role="alert">{err}</div>}</div>)}

        <div className="row spread wiz-nav">
          <button className="btn ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}><Icon name="left" />Back</button>
          <div className="row">
            {step > 0 && !last && <button className="btn ghost" onClick={() => setStep(step + 1)}>Skip</button>}
            {last ? <button className="btn gold" onClick={generate} disabled={!!invalidStart}><Icon name="sparkles" />Create itinerary</button> : <button className="btn primary" onClick={() => setStep(step + 1)} disabled={!!invalidStart && step === 2}>Next<Icon name="right" /></button>}
          </div>
        </div>
      </div>
      <p className="small muted center" style={{ marginTop: 12 }}>{aiLive ? 'AI drafting is on: plans use only places from the catalogue.' : 'Demo drafting: plans are generated offline from catalogue places. No AI key is configured.'}</p>
      <PlacePicker open={picker} onClose={() => setPicker(false)} onPick={(p) => setDest((d) => (d.includes(p.id) ? d : [...d, p.id]))} title="Add a destination" destinationsOnly />
    </div></div>
  );
}
