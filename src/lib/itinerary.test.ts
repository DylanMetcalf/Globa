import { describe, expect, it } from 'vitest';
import { BUILTIN_PLACES } from '../data/catalog';
import { addDay, addStop, blankItinerary, generateDraft, moveStop, newDay, newStop, nudgeStop, overlaps, removeStop, itineraryPlaceIds, stopCount } from './itinerary';

const trip = () => {
  const a = newStop({ title: 'A' }); const b = newStop({ title: 'B' }); const c = newStop({ title: 'C' });
  const it = blankItinerary('dylan', { days: [newDay('D1', undefined, [a, b]), newDay('D2', undefined, [c])] });
  return { it, a, b, c };
};
const titles = (it: ReturnType<typeof trip>['it']) => it.days.map((d) => d.stops.map((s) => s.title).join(''));

describe('editing', () => {
  it('moves within a day', () => { const { it, a } = trip(); expect(titles(moveStop(it, a.id, it.days[0].id, 1))).toEqual(['BA', 'C']); });
  it('moves between days', () => { const { it, a } = trip(); expect(titles(moveStop(it, a.id, it.days[1].id, 0))).toEqual(['B', 'AC']); });
  it('nudges across day boundaries (keyboard alternative to drag)', () => {
    const { it, b } = trip();
    expect(titles(nudgeStop(it, b.id, 1))).toEqual(['A', 'BC']);
    expect(titles(nudgeStop(nudgeStop(it, b.id, -1), b.id, -1))).toEqual(['BA', 'C']);
  });
  it('does not move past the first/last stop', () => {
    const { it, a, c } = trip();
    expect(nudgeStop(it, a.id, -1)).toEqual(it); expect(nudgeStop(it, c.id, 1)).toEqual(it);
  });
  it('adds and removes stops and days', () => {
    const { it, a } = trip();
    const added = addStop(it, it.days[1].id, newStop({ title: 'D' }));
    expect(stopCount(added)).toBe(4);
    expect(stopCount(removeStop(added, a.id))).toBe(3);
    expect(addDay(it).days).toHaveLength(3);
  });
  it('flags overlapping timed stops', () => {
    const x = newStop({ title: 'x', startTime: '09:00', durationMin: 120 }); const y = newStop({ title: 'y', startTime: '10:00', durationMin: 30 }); const z = newStop({ title: 'z', startTime: '12:00', durationMin: 30 });
    const day = newDay('d', undefined, [x, y, z]);
    expect([...overlaps(day)].sort()).toEqual([x.id, y.id].sort());
  });
});

describe('generateDraft (offline demo)', () => {
  const base = { purpose: 'holiday' as const, flexibleDates: true, focus: [], pace: 'balanced' as const, includeSaved: [], createdBy: 'dylan' };
  it('builds a day-by-day plan from catalogue places only', () => {
    const it = generateDraft({ ...base, destinationIds: ['cape-town'], durationDays: 4 }, BUILTIN_PLACES);
    expect(it.days).toHaveLength(4);
    expect(it.generatedBy).toBe('demo');
    const ids = new Set(BUILTIN_PLACES.map((p) => p.id));
    for (const id of itineraryPlaceIds(it)) expect(ids.has(id)).toBe(true);
    expect(it.assumptions.join(' ')).toMatch(/not reservations/i);
  });
  it('never names a specific business for meals', () => {
    const it = generateDraft({ ...base, destinationIds: ['lisbon'], durationDays: 3 }, BUILTIN_PLACES);
    const meals = it.days.flatMap((d) => d.stops).filter((s) => s.kind === 'food');
    for (const m of meals) { expect(m.placeId).toBeUndefined(); expect(m.provenance).toBe('demo'); }
  });
  it('plans a typical week for long stays instead of every day', () => {
    const it = generateDraft({ ...base, purpose: 'long-stay', destinationIds: ['lisbon', 'funchal'], durationDays: 180 }, BUILTIN_PLACES);
    expect(it.stays).toHaveLength(2);
    expect(it.days.length).toBeLessThanOrEqual(14);
    expect(it.status).toBe('tentative');
  });
  it('respects pace', () => {
    const count = (pace: 'relaxed' | 'packed') => generateDraft({ ...base, pace, destinationIds: ['keswick'], durationDays: 2 }, BUILTIN_PLACES).days.reduce((n, d) => n + d.stops.length, 0);
    expect(count('packed')).toBeGreaterThan(count('relaxed'));
  });
  it('still produces a draft with no destination, stating the assumption', () => {
    const it = generateDraft({ ...base, destinationIds: [], durationDays: 2 }, BUILTIN_PLACES);
    expect(it.days).toHaveLength(2);
    expect(it.assumptions.join(' ')).toMatch(/No destination/);
  });
});
