import { describe, expect, it, beforeEach } from 'vitest';
import { computeAchievements } from './achievements';
import { useStore } from '../store';
import { blankItinerary } from './itinerary';

beforeEach(() => { localStorage.clear(); useStore.getState().resetAll(); });
const status = () => Object.fromEntries(computeAchievements(useStore.getState()).map((a) => [a.id, a]));

describe('achievements are derived from real actions', () => {
  it('starts with nothing earned', () => { expect(computeAchievements(useStore.getState()).some((a) => a.earned)).toBe(false); });
  it('First Light needs an activation', () => {
    useStore.getState().savePlace('kyoto');
    expect(status()['first-light'].earned).toBe(false);
    useStore.getState().activatePlace('kyoto', 'nicole');
    expect(status()['first-light'].earned).toBe(true);
  });
  it('lighting up is not visiting', () => {
    useStore.getState().savePlace('kyoto'); useStore.getState().activatePlace('kyoto', 'nicole');
    expect(status()['first-adventure'].earned).toBe(false);
    expect(status()['first-country'].earned).toBe(false);
    useStore.getState().setStatus('kyoto', 'visited');
    expect(status()['first-adventure'].earned).toBe(true);
    expect(status()['first-country'].earned).toBe(true);
  });
  it('counts saved places toward Five Places Saved with visible progress', () => {
    for (const id of ['lisbon', 'kyoto', 'ubud']) useStore.getState().savePlace(id);
    expect(status()['five-saved'].current).toBe(3);
    expect(status()['five-saved'].earned).toBe(false);
    for (const id of ['hobart', 'bled']) useStore.getState().savePlace(id);
    expect(status()['five-saved'].earned).toBe(true);
  });
  it('Weekend Explorer needs a short trip', () => {
    useStore.getState().addItinerary(blankItinerary('dylan', { durationDays: 14 }));
    expect(status()['weekend-explorer'].earned).toBe(false);
    useStore.getState().addItinerary(blankItinerary('dylan', { purpose: 'weekend', durationDays: 3 }));
    expect(status()['weekend-explorer'].earned).toBe(true);
  });
  it('syncAchievements returns only new unlocks, once', () => {
    useStore.getState().addItinerary(blankItinerary('dylan'));
    expect(useStore.getState().syncAchievements()).toEqual(['first-itinerary']);
    expect(useStore.getState().syncAchievements()).toEqual([]);
  });
});
