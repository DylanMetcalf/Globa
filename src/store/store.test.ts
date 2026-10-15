import { beforeEach, describe, expect, it } from 'vitest';
import { sanitize, useStore, STORE_KEY, defaultProfiles, defaultSettings } from './index';
import { BUILTIN_BY_ID } from '../data/catalog';
import { blankItinerary, newDay, newStop } from '../lib/itinerary';

const reset = () => { localStorage.clear(); useStore.getState().resetAll(); };
beforeEach(reset);

describe('saved places', () => {
  it('saves, updates and removes a place with a stable id', () => {
    const s = useStore.getState();
    s.savePlace('cape-town');
    expect(useStore.getState().saved['cape-town'].status).toBe('saved');
    s.updateSaved('cape-town', { notes: 'Table Mountain sunrise', tags: ['work'], priority: 'high' });
    expect(useStore.getState().saved['cape-town'].notes).toBe('Table Mountain sunrise');
    s.setStatus('cape-town', 'visited');
    expect(useStore.getState().saved['cape-town'].visitedAt).toBeTruthy();
    s.unsavePlace('cape-town');
    expect(useStore.getState().saved['cape-town']).toBeUndefined();
  });
  it('saving twice does not duplicate or reset the entry', () => {
    const s = useStore.getState();
    s.savePlace('lisbon'); s.updateSaved('lisbon', { notes: 'x' }); s.savePlace('lisbon');
    expect(Object.keys(useStore.getState().saved)).toHaveLength(1);
    expect(useStore.getState().saved['lisbon'].notes).toBe('x');
  });
  it('lighting a place up never marks it visited', () => {
    const s = useStore.getState();
    s.savePlace('kyoto'); s.activatePlace('kyoto', 'dylan');
    expect(useStore.getState().saved['kyoto'].status).toBe('saved');
    expect(useStore.getState().activations).toHaveLength(1);
  });
  it('keeps custom places so ids resolve after reload', () => {
    const p = { ...BUILTIN_BY_ID.get('lisbon')!, id: 'geo-1', custom: true };
    useStore.getState().savePlace('geo-1', { place: p });
    expect(useStore.getState().customPlaces['geo-1'].name).toBe('Lisbon');
  });
});

describe('persistence', () => {
  it('writes to localStorage under a versioned key', () => {
    useStore.getState().savePlace('hobart');
    const raw = JSON.parse(localStorage.getItem(STORE_KEY)!);
    expect(raw.version).toBe(1);
    expect(raw.state.saved.hobart).toBeTruthy();
  });
  it('rehydrates saved places and itineraries', async () => {
    const s = useStore.getState();
    s.savePlace('hobart');
    const it = blankItinerary('dylan', { name: 'Tassie', days: [newDay('Day 1', undefined, [newStop({ title: 'Kunanyi', placeId: 'kunanyi' })])] });
    s.addItinerary(it);
    await useStore.persist.rehydrate();
    expect(useStore.getState().saved.hobart).toBeTruthy();
    expect(useStore.getState().itineraries[0].days[0].stops[0].title).toBe('Kunanyi');
  });
  it('discards malformed records but keeps good ones', () => {
    const { data, dropped } = sanitize({
      profiles: [{ id: 'dylan', name: 'Dylan' }, { nope: true }],
      saved: { good: { placeId: 'good', notes: 'ok' }, bad: { notes: 'no id' } },
      itineraries: [{ id: 't1', name: 'Fine' }, 'garbage', { name: 'no id' }],
      activations: [{ id: 'a', placeId: 'x', profileId: 'dylan', at: '2026-01-01T00:00:00Z' }, { id: 'b' }],
      settings: { theme: 'sepia', currency: 5 },
    });
    expect(Object.keys(data.saved)).toEqual(['good']);
    expect(data.itineraries.map((i) => i.id)).toEqual(['t1']);
    expect(data.activations).toHaveLength(1);
    expect(data.settings.theme).toBe('system');
    expect(dropped).toBeGreaterThanOrEqual(4);
    expect(data.profiles.map((p) => p.id)).toEqual(expect.arrayContaining(['dylan', 'nicole']));
  });
  it('survives total garbage', () => {
    for (const junk of [null, undefined, 42, 'x', [], { saved: 7 }]) {
      const { data } = sanitize(junk);
      expect(data.profiles.length).toBe(defaultProfiles().length);
      expect(data.settings).toEqual(defaultSettings());
    }
  });
  it('exports and imports a backup', () => {
    const s = useStore.getState();
    s.savePlace('ubud'); s.updateSaved('ubud', { notes: 'yoga' });
    const json = s.exportData();
    s.resetAll();
    expect(useStore.getState().saved.ubud).toBeUndefined();
    const r = useStore.getState().importData(json);
    expect(r.ok).toBe(true);
    expect(useStore.getState().saved.ubud.notes).toBe('yoga');
    expect(useStore.getState().importData('{"app":"other"}').ok).toBe(false);
    expect(useStore.getState().importData('not json').ok).toBe(false);
  });
});

describe('itineraries in the store', () => {
  it('duplicates with fresh ids and deletes', () => {
    const s = useStore.getState();
    const it = blankItinerary('dylan', { name: 'A', days: [newDay('D1', undefined, [newStop({ title: 'x' })])] });
    s.addItinerary(it);
    const copyId = s.duplicateItinerary(it.id)!;
    const [copy, orig] = [useStore.getState().itineraries.find((i) => i.id === copyId)!, useStore.getState().itineraries.find((i) => i.id === it.id)!];
    expect(copy.name).toBe('A (copy)');
    expect(copy.days[0].id).not.toBe(orig.days[0].id);
    expect(copy.days[0].stops[0].id).not.toBe(orig.days[0].stops[0].id);
    s.deleteItinerary(it.id);
    expect(useStore.getState().itineraries).toHaveLength(1);
  });
});
