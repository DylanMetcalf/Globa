import type {
  Day, Itinerary, Pace, Place, PlaceId, Provenance, Stay, Stop, StopKind, TripPurpose, Budget,
} from '../../shared/types';
import { nowIso, uid } from './ids';
import { haversineKm } from './geo';
import { PURPOSE_LABELS } from './labels';

/* ------------------------- pure editing helpers ------------------------- */

export function newStop(partial: Partial<Stop> & { title: string }): Stop {
  return {
    id: uid('stop'), kind: 'place', startTime: '', durationMin: 90, notes: '', provenance: 'user', ...partial,
  };
}

export function newDay(label: string, stayId?: string, stops: Stop[] = []): Day {
  return { id: uid('day'), label, stayId, stops };
}

export function newStay(partial: Partial<Stay> & { title: string }): Stay {
  return {
    id: uid('stay'), days: 7, committed: false, accommodation: '', internet: '', transport: '', workNotes: '', notes: '', ...partial,
  };
}

export function blankItinerary(createdBy: string, over: Partial<Itinerary> = {}): Itinerary {
  const t = nowIso();
  return {
    id: uid('trip'), name: 'New itinerary', purpose: 'holiday', status: 'idea', flexibleDates: true, durationDays: 7, pace: 'balanced',
    focus: [], notes: '', assumptions: [], stays: [], days: [], createdBy, createdAt: t, updatedAt: t, generatedBy: 'manual', ...over,
  };
}

const mapDay = (it: Itinerary, dayId: string, fn: (d: Day) => Day): Itinerary => ({ ...it, days: it.days.map((d) => (d.id === dayId ? fn(d) : d)) });

export const addStop = (it: Itinerary, dayId: string, stop: Stop): Itinerary => mapDay(it, dayId, (d) => ({ ...d, stops: [...d.stops, stop] }));
export const removeStop = (it: Itinerary, stopId: string): Itinerary => ({ ...it, days: it.days.map((d) => ({ ...d, stops: d.stops.filter((s) => s.id !== stopId) })) });
export const updateStop = (it: Itinerary, stopId: string, patch: Partial<Stop>): Itinerary => ({
  ...it, days: it.days.map((d) => ({ ...d, stops: d.stops.map((s) => (s.id === stopId ? { ...s, ...patch } : s)) })),
});

/** Move a stop to `toDayId` at `index` (defaults to end). Works within and across days. */
export function moveStop(it: Itinerary, stopId: string, toDayId: string, index?: number): Itinerary {
  let moving: Stop | undefined;
  const stripped = it.days.map((d) => {
    const found = d.stops.find((s) => s.id === stopId);
    if (found) moving = found;
    return { ...d, stops: d.stops.filter((s) => s.id !== stopId) };
  });
  if (!moving) return it;
  const m = moving;
  return {
    ...it,
    days: stripped.map((d) => {
      if (d.id !== toDayId) return d;
      const stops = [...d.stops];
      stops.splice(index === undefined ? stops.length : Math.max(0, Math.min(index, stops.length)), 0, m);
      return { ...d, stops };
    }),
  };
}

/** Accessible alternative to drag-and-drop: move up/down by one, crossing day boundaries. */
export function nudgeStop(it: Itinerary, stopId: string, dir: -1 | 1): Itinerary {
  const di = it.days.findIndex((d) => d.stops.some((s) => s.id === stopId));
  if (di < 0) return it;
  const si = it.days[di].stops.findIndex((s) => s.id === stopId);
  const target = si + dir;
  if (target >= 0 && target < it.days[di].stops.length) return moveStop(it, stopId, it.days[di].id, target);
  const nd = di + dir;
  if (nd < 0 || nd >= it.days.length) return it;
  return moveStop(it, stopId, it.days[nd].id, dir === -1 ? it.days[nd].stops.length : 0);
}

export function addDay(it: Itinerary, label?: string, stayId?: string): Itinerary {
  return { ...it, days: [...it.days, newDay(label ?? `Day ${it.days.length + 1}`, stayId)], durationDays: Math.max(it.durationDays, it.days.length + 1) };
}
export const removeDay = (it: Itinerary, dayId: string): Itinerary => ({ ...it, days: it.days.filter((d) => d.id !== dayId) });
export const replaceDayStops = (it: Itinerary, dayId: string, stops: Stop[]): Itinerary => mapDay(it, dayId, (d) => ({ ...d, stops }));

export function stopsOfPlace(it: Itinerary, placeId: PlaceId): Stop[] {
  return it.days.flatMap((d) => d.stops).filter((s) => s.placeId === placeId);
}
export function itineraryPlaceIds(it: Itinerary): PlaceId[] {
  const ids = new Set<PlaceId>();
  it.stays.forEach((s) => s.placeId && ids.add(s.placeId));
  it.days.forEach((d) => d.stops.forEach((s) => s.placeId && ids.add(s.placeId)));
  if (it.coverPlaceId) ids.add(it.coverPlaceId);
  return [...ids];
}
export const stopCount = (it: Itinerary) => it.days.reduce((n, d) => n + d.stops.length, 0);

export function totalEstimatedCost(it: Itinerary): number {
  return it.days.reduce((n, d) => n + d.stops.reduce((m, s) => m + (s.cost ?? 0), 0), 0);
}

export const toMinutes = (t: string): number | undefined => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
};
export const fromMinutes = (n: number): string => {
  const m = ((Math.round(n) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Where a stop ends, for gentle overlap warnings. */
export function overlaps(day: Day): Set<string> {
  const bad = new Set<string>();
  const timed = day.stops.map((s) => ({ s, a: toMinutes(s.startTime) })).filter((x) => x.a !== undefined) as { s: Stop; a: number }[];
  timed.sort((x, y) => x.a - y.a);
  for (let i = 0; i < timed.length - 1; i++) {
    if (timed[i].a + timed[i].s.durationMin > timed[i + 1].a) { bad.add(timed[i].s.id); bad.add(timed[i + 1].s.id); }
  }
  return bad;
}

/* ------------------------- generation (demo mode) ------------------------- */

export interface WizardAnswers {
  purpose: TripPurpose;
  name?: string;
  destinationIds: PlaceId[];
  startDate?: string;
  flexibleDates: boolean;
  durationDays: number;
  focus: string[];
  budget?: Budget;
  pace: Pace;
  includeSaved: PlaceId[];
  createdBy: string;
  /** rotates which nearby places are chosen (used by “regenerate day”) */
  offset?: number;
}

const PACE_STOPS: Record<Pace, number> = { relaxed: 2, balanced: 3, packed: 4 };

const FOCUS_ACTIVITY: Record<string, StopKind> = { food: 'food', nature: 'activity', culture: 'place', adventure: 'activity', work: 'work', relax: 'rest' };

/**
 * Deterministic, offline itinerary draft built ONLY from catalogue places the user chose or that sit near the destination.
 * Times and durations are suggestions. Nothing here is a booking, a price or live availability.
 */
export function generateDraft(a: WizardAnswers, catalog: Place[]): Itinerary {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const dests = a.destinationIds.map((id) => byId.get(id)).filter(Boolean) as Place[];
  const saved = a.includeSaved.map((id) => byId.get(id)).filter(Boolean) as Place[];
  const assumptions: string[] = [
    'Times and durations are suggestions, not reservations.',
    'Straight-line distances are used for ordering; real travel times depend on transport and roads.',
    'No opening hours, prices or availability have been checked. Verify before you go.',
  ];
  if (!dests.length) assumptions.push('No destination chosen yet — add a stay to anchor the plan.');
  if (a.budget) assumptions.push('Budget is recorded as a target; individual stop costs are left blank until you add them.');

  const totalDays = Math.max(1, a.durationDays);
  const longStay = totalDays > 21 || dests.length > 1 && totalDays > 14;
  const perStay = dests.length ? Math.max(1, Math.round(totalDays / dests.length)) : totalDays;

  const stays: Stay[] = dests.map((p, i) => newStay({
    title: p.name, placeId: p.id, days: i === dests.length - 1 ? Math.max(1, totalDays - perStay * (dests.length - 1)) : perStay,
    committed: false,
    monthlyCost: undefined,
    internet: p.scores.internet >= 5 ? 'excellent' : p.scores.internet >= 4 ? 'good' : p.scores.internet >= 3 ? 'ok' : 'poor',
    transport: p.practical.includes('car-free') ? 'Walkable / public transport (curated)' : 'Check whether you will need a car (curated note)',
    workNotes: p.practical.includes('coworking') ? 'Coworking spaces are likely available (verify).' : '',
    notes: `Estimated monthly living cost for two: ${p.monthlyCostUSD ? `$${p.monthlyCostUSD[0].toLocaleString()}–$${p.monthlyCostUSD[1].toLocaleString()} (curated estimate)` : 'not available'}.`,
  }));
  if (!stays.length) stays.push(newStay({ title: 'Stay (to be decided)', days: totalDays }));

  // Candidate stops: saved places first, then POIs near each stay.
  const days: Day[] = [];
  const dayBudget = PACE_STOPS[a.pace];
  const daysToPlan = longStay ? Math.min(7, perStay) : totalDays;

  stays.forEach((stay) => {
    const home = stay.placeId ? byId.get(stay.placeId) : undefined;
    const near = home
      ? catalog.filter((p) => p.kind === 'poi' && haversineKm(p, home) < 350).sort((x, y) => haversineKm(x, home) - haversineKm(y, home))
      : [];
    const pool: Place[] = [...saved.filter((p) => !home || haversineKm(p, home) < 400), ...near];
    const seen = new Set<string>();
    const unique = pool.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
    const planDays = Math.min(daysToPlan, stay.days);
    let cursor = a.offset ?? 0;
    for (let d = 0; d < planDays; d++) {
      const label = longStay ? `${stay.title} · typical day ${d + 1}` : dests.length > 1 ? `${stay.title} · day ${d + 1}` : `Day ${days.length + 1}`;
      const stops: Stop[] = [];
      const wantsWork = a.purpose === 'work' || a.purpose === 'long-stay' || a.focus.includes('work');
      let t = 9 * 60;
      if (wantsWork && (d % 7 < 5) && a.pace !== 'packed') {
        stops.push(newStop({ kind: 'work', title: 'Focus work block', startTime: fromMinutes(t), durationMin: 240, notes: 'Add your café or coworking spot.', provenance: 'demo' }));
        t += 270;
      }
      const n = wantsWork ? Math.max(1, dayBudget - 1) : dayBudget;
      for (let k = 0; k < n; k++) {
        const place = unique[cursor++ % Math.max(1, unique.length)];
        if (place) {
          const kind: StopKind = place.env.length ? 'activity' : 'place';
          stops.push(newStop({
            kind, title: place.name, placeId: place.id, startTime: fromMinutes(t), durationMin: place.kind === 'poi' ? 180 : 120,
            notes: place.summary, provenance: 'demo',
          }));
          t += (place.kind === 'poi' ? 180 : 120) + 30;
          if (k === 0 && stops.length && t < 13 * 60 + 30 && n > 1) {
            stops.push(newStop({ kind: 'food', title: 'Lunch — choose a local spot', startTime: fromMinutes(Math.max(t, 12 * 60 + 30)), durationMin: 60, notes: 'Use Suggest More on the destination to find real options.', provenance: 'demo' }));
            t = Math.max(t, 12 * 60 + 30) + 90;
          }
        } else {
          stops.push(newStop({ kind: FOCUS_ACTIVITY[a.focus[0] ?? 'relax'] ?? 'rest', title: 'Free time — explore on foot', startTime: fromMinutes(t), durationMin: 120, provenance: 'demo' }));
          t += 150;
        }
      }
      if (a.pace === 'relaxed' || d === planDays - 1) stops.push(newStop({ kind: 'rest', title: 'Slow evening', startTime: '19:00', durationMin: 120, provenance: 'demo' }));
      days.push(newDay(label, stay.id, stops));
    }
  });

  const cover = dests[0]?.id ?? saved[0]?.id;
  const title = a.name?.trim() || (dests.length ? `${dests.map((d) => d.name.replace(/\s*\(.*\)/, '')).join(' → ')}` : `${PURPOSE_LABELS[a.purpose]} plan`);
  return blankItinerary(a.createdBy, {
    name: title, purpose: a.purpose, status: longStay ? 'tentative' : 'idea', startDate: a.startDate, flexibleDates: a.flexibleDates,
    durationDays: totalDays, pace: a.pace, focus: a.focus, budget: a.budget, coverPlaceId: cover, assumptions, stays, days,
    notes: longStay ? 'Long-stay plan: days shown are a typical rhythm for each stay, not a booked schedule.' : '', generatedBy: 'demo',
  });
}

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  live: 'Live', curated: 'Curated', estimate: 'Estimate', user: 'Your entry', demo: 'Demo draft', ai: 'AI suggestion',
};

/** Convert (already server-validated) AI output into an Itinerary. Everything is tagged `ai` so the UI can say so. */
export function fromAi(res: any, a: WizardAnswers): Itinerary {
  const stays: Stay[] = (res.stays?.length ? res.stays : [{ title: 'Stay', days: a.durationDays, notes: '' }]).map((s: any) =>
    newStay({ title: String(s.title ?? 'Stay'), placeId: s.placeId, days: Number(s.days) || 7, notes: String(s.notes ?? '') }));
  const days: Day[] = (res.days ?? []).map((d: any, i: number) => newDay(String(d.label ?? `Day ${i + 1}`), stays[Math.min(stays.length - 1, Math.max(0, Number(d.stayIndex) || 0))]?.id,
    (d.stops ?? []).map((s: any) => newStop({ kind: s.kind ?? 'place', title: String(s.title ?? 'Stop'), placeId: s.placeId, startTime: /^\d{1,2}:\d{2}$/.test(s.startTime ?? '') ? s.startTime : '', durationMin: Number(s.durationMin) || 90, notes: String(s.notes ?? ''), provenance: 'ai' }))));
  return blankItinerary(a.createdBy, {
    name: a.name?.trim() || String(res.name ?? 'Draft itinerary'), purpose: a.purpose, status: a.durationDays > 21 ? 'tentative' : 'idea', startDate: a.startDate, flexibleDates: a.flexibleDates,
    durationDays: a.durationDays, pace: a.pace, focus: a.focus, budget: a.budget, coverPlaceId: stays[0]?.placeId ?? a.destinationIds[0], notes: String(res.notes ?? ''),
    assumptions: [...(res.assumptions ?? []).map(String), 'Drafted by an AI model from catalogue data. Times, costs and travel details are suggestions, not bookings.'], stays, days, generatedBy: 'ai',
  });
}
