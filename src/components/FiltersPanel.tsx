import { useMemo, useState } from 'react';
import type { ActivityTag, Climate, Criteria, EnvTag, FoodTag, LifestyleTag, PracticalTag, SettlementType, StayDuration } from '../../shared/types';
import { ACTIVITY_TAGS, ENV_TAGS, FOOD_TAGS, LIFESTYLE_TAGS, PRACTICAL_TAGS, SETTLEMENT_TYPES, STAY_DURATIONS } from '../../shared/types';
import { Icon } from './Icon';
import {
  ACTIVITY_LABELS, CLIMATE_LABELS, CURRENCIES, ENV_LABELS, FOOD_LABELS, LIFESTYLE_LABELS, MONTHS, PRACTICAL_LABELS, SETTLEMENT_LABELS, STAY_LABELS,
} from '../lib/labels';
import { criteriaChips, criteriaIsEmpty, emptyCriteria } from '../lib/discovery';
import { useStore } from '../store';
import { useUi } from '../store/ui';

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const STAY_TYPES = ['cabin', 'apartment', 'guesthouse', 'villa', 'hotel'];
const CLIMATES = Object.keys(CLIMATE_LABELS) as Climate[];

interface SectionDef { id: string; title: string; hint?: string; options: { key: string; label: string; on: boolean; set: () => void }[] }

export function ActiveChips({ criteria, onChange }: { criteria: Criteria; onChange: (c: Criteria) => void }) {
  const chips = criteriaChips(criteria);
  if (!chips.length) return null;
  return (
    <div className="row wrap" role="list" aria-label="Active filters" style={{ gap: 6 }}>
      {chips.map((c) => (
        <button key={c.key} role="listitem" className="chip on" onClick={() => onChange(c.remove(criteria))} aria-label={`Remove filter ${c.label}`}>
          {c.label}<Icon name="close" className="x" />
        </button>
      ))}
      <button className="chip" onClick={() => onChange(emptyCriteria(criteria.text))}>Reset all</button>
    </div>
  );
}

export function FiltersPanel({ criteria, onChange, showChips = true }: { criteria: Criteria; onChange: (c: Criteria) => void; showChips?: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ env: true, stay: true });
  const [find, setFind] = useState('');
  const presets = useStore((s) => s.filterPresets);
  const addPreset = useStore((s) => s.addPreset);
  const removePreset = useStore((s) => s.removePreset);
  const homeCurrency = useStore((s) => s.settings.currency);
  const toast = useUi((s) => s.toast);
  const [presetName, setPresetName] = useState('');
  const c = criteria;
  const set = (patch: Partial<Criteria>) => onChange({ ...c, ...patch });

  const sections: SectionDef[] = useMemo(() => [
    { id: 'env', title: 'Natural environment', options: ENV_TAGS.map((k: EnvTag) => ({ key: k, label: ENV_LABELS[k], on: c.env.includes(k), set: () => set({ env: toggle(c.env, k) }) })) },
    { id: 'settlement', title: 'Destination type', options: SETTLEMENT_TYPES.map((k: SettlementType) => ({ key: k, label: SETTLEMENT_LABELS[k], on: c.settlement.includes(k), set: () => set({ settlement: toggle(c.settlement, k) }) })) },
    { id: 'lifestyle', title: 'Lifestyle', options: LIFESTYLE_TAGS.map((k: LifestyleTag) => ({ key: k, label: LIFESTYLE_LABELS[k], on: c.lifestyle.includes(k), set: () => set({ lifestyle: toggle(c.lifestyle, k) }) })) },
    { id: 'practical', title: 'Practical requirements', options: PRACTICAL_TAGS.map((k: PracticalTag) => ({ key: k, label: PRACTICAL_LABELS[k], on: c.practical.includes(k), set: () => set({ practical: toggle(c.practical, k) }) })) },
    { id: 'activities', title: 'Outdoor activities', options: ACTIVITY_TAGS.map((k: ActivityTag) => ({ key: k, label: ACTIVITY_LABELS[k], on: c.activities.includes(k), set: () => set({ activities: toggle(c.activities, k) }) })) },
    { id: 'food', title: 'Food culture', options: FOOD_TAGS.map((k: FoodTag) => ({ key: k, label: FOOD_LABELS[k], on: c.food.includes(k), set: () => set({ food: toggle(c.food, k) }) })) },
    { id: 'stayTypes', title: 'Accommodation type', options: STAY_TYPES.map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1), on: c.stayTypes.includes(k), set: () => set({ stayTypes: toggle(c.stayTypes, k) }) })) },
    { id: 'climate', title: 'Climate', options: CLIMATES.map((k) => ({ key: k, label: CLIMATE_LABELS[k], on: c.climate.includes(k), set: () => set({ climate: toggle(c.climate, k) }) })) },
    { id: 'months', title: 'Season (months)', hint: 'Months you want to be there', options: MONTHS.map((m, i) => ({ key: m, label: m, on: c.months.includes(i + 1), set: () => set({ months: toggle(c.months, i + 1) }) })) },
  ], [c]); // eslint-disable-line react-hooks/exhaustive-deps

  const f = find.trim().toLowerCase();
  const matching = f ? sections.map((s) => ({ ...s, options: s.options.filter((o) => o.label.toLowerCase().includes(f)) })).filter((s) => s.options.length) : sections;

  return (
    <div className="filters stack" style={{ gap: 'var(--s-4)' }}>
      <div className="searchfield small-field"><Icon name="search" /><input className="searchinput" placeholder="Search filters (e.g. glacier, Wi-Fi)…" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Search filters" /></div>
      {showChips && <ActiveChips criteria={c} onChange={onChange} />}

      <fieldset className="fgroup">
        <legend>Stay duration</legend>
        <div className="row wrap" style={{ gap: 6 }}>
          {STAY_DURATIONS.map((d: StayDuration) => <button key={d} className="chip" aria-pressed={c.stay === d} onClick={() => set({ stay: c.stay === d ? undefined : d, kind: c.stay === d ? c.kind : d === 'weekend' || d === 'week' ? c.kind : 'destination' })}>{STAY_LABELS[d]}</button>)}
        </div>
      </fieldset>

      <fieldset className="fgroup">
        <legend>Budget <span className="muted small">(estimates are in USD; converted only with live rates)</span></legend>
        <div className="row wrap">
          <input className="input" style={{ width: 120 }} type="number" min={0} inputMode="numeric" placeholder="Amount" aria-label="Budget amount" value={c.budget?.amount ?? ''}
            onChange={(e) => { const v = e.target.value; set({ budget: v === '' ? undefined : { amount: Number(v), currency: c.budget?.currency ?? homeCurrency, period: c.budget?.period ?? 'month' } }); }} />
          <select className="input" style={{ width: 100 }} aria-label="Budget currency" value={c.budget?.currency ?? homeCurrency} onChange={(e) => set({ budget: { amount: c.budget?.amount ?? 0, currency: e.target.value, period: c.budget?.period ?? 'month' } })}>
            {CURRENCIES.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select className="input" style={{ width: 140 }} aria-label="Budget period" value={c.budget?.period ?? 'month'} onChange={(e) => set({ budget: { amount: c.budget?.amount ?? 0, currency: c.budget?.currency ?? homeCurrency, period: e.target.value as 'day' | 'week' | 'month' } })}>
            <option value="day">per day</option><option value="week">per week</option><option value="month">per month</option>
          </select>
        </div>
        <label className="row small" style={{ marginTop: 8 }}>Relative cost level (any → cheapest)
          <input type="range" min={0} max={5} value={c.maxCost ?? 0} onChange={(e) => set({ maxCost: Number(e.target.value) || undefined })} aria-label="Maximum relative cost level" />
          <b>{c.maxCost ? `≤ ${c.maxCost}/5` : 'Any'}</b>
        </label>
      </fieldset>

      <fieldset className="fgroup">
        <legend>Crowds, fame & remoteness</legend>
        <div className="row wrap">
          <div className="seg" role="group" aria-label="Crowds">
            <button aria-pressed={c.crowds === 'any'} onClick={() => set({ crowds: 'any' })}>Any crowds</button>
            <button aria-pressed={c.crowds === 'low'} onClick={() => set({ crowds: 'low' })}>Fewer crowds</button>
          </div>
          <div className="seg" role="group" aria-label="Popularity">
            <button aria-pressed={c.popularity === 'any'} onClick={() => set({ popularity: 'any' })}>Any</button>
            <button aria-pressed={c.popularity === 'hidden'} onClick={() => set({ popularity: 'hidden' })}>Hidden gems</button>
            <button aria-pressed={c.popularity === 'popular'} onClick={() => set({ popularity: 'popular' })}>Famous</button>
          </div>
          <div className="seg" role="group" aria-label="Remoteness">
            <button aria-pressed={c.remoteness === 'any'} onClick={() => set({ remoteness: 'any' })}>Any</button>
            <button aria-pressed={c.remoteness === 'remote'} onClick={() => set({ remoteness: 'remote' })}>Remote</button>
            <button aria-pressed={c.remoteness === 'connected'} onClick={() => set({ remoteness: 'connected' })}>Connected</button>
          </div>
        </div>
      </fieldset>

      {matching.map((s) => {
        const isOpen = f ? true : open[s.id];
        const count = s.options.filter((o) => o.on).length;
        return (
          <section key={s.id} className="fsec">
            <button className="fsec-head" aria-expanded={isOpen} aria-controls={`f-${s.id}`} onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}>
              <span>{s.title}{count > 0 && <span className="badge curated" style={{ marginLeft: 8 }}>{count}</span>}</span>
              <Icon name="chevron" style={{ transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform var(--dur-2)' }} />
            </button>
            {isOpen && (
              <div id={`f-${s.id}`} className="row wrap" style={{ gap: 6, paddingTop: 8 }}>
                {s.options.map((o) => <button key={o.key} className="chip" aria-pressed={o.on} onClick={o.set}>{o.label}</button>)}
              </div>
            )}
          </section>
        );
      })}

      <fieldset className="fgroup">
        <legend>Presets</legend>
        {presets.length === 0 && <p className="small muted">Save a combination of filters to reuse later.</p>}
        <div className="row wrap" style={{ gap: 6 }}>
          {presets.map((p) => (
            <span key={p.id} className="chip static" style={{ paddingRight: 4 }}>
              <button className="plainbtn" onClick={() => { onChange({ ...emptyCriteria(), ...(p.criteria as Criteria) }); toast(`Applied preset “${p.name}”`); }}>{p.name}</button>
              <button className="btn icon sm ghost" style={{ minHeight: 26, width: 26 }} aria-label={`Delete preset ${p.name}`} onClick={() => removePreset(p.id)}><Icon name="close" width={14} height={14} /></button>
            </span>
          ))}
        </div>
        <form className="row" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); if (!presetName.trim() || criteriaIsEmpty(c)) return; addPreset(presetName.trim(), c); setPresetName(''); toast('Preset saved'); }}>
          <input className="input" placeholder="Preset name" aria-label="Preset name" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
          <button className="btn" disabled={!presetName.trim() || criteriaIsEmpty(c)}>Save</button>
        </form>
      </fieldset>
      <button className="btn" onClick={() => onChange(emptyCriteria(c.text))} disabled={criteriaIsEmpty(c)}><Icon name="refresh" />Reset filters</button>
    </div>
  );
}
