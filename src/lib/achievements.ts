import type { DataState } from '../store';
import type { Place } from '../../shared/types';
import { BUILTIN_BY_ID } from '../data/catalog';

export interface AchievementDef {
  id: string;
  title: string;
  blurb: string;
  /** SVG path-ish glyph key, rendered in components/Achievement */
  glyph: 'bulb' | 'compass' | 'pin' | 'map' | 'flag' | 'leaf' | 'sun' | 'globe';
  target: number;
  progress: (s: DataState, resolve: (id: string) => Place | undefined) => number;
}

export interface AchievementStatus extends AchievementDef {
  current: number;
  earned: boolean;
  earnedAt?: string;
}

const uniq = <T,>(a: T[]) => [...new Set(a)];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-light', title: 'First Light', blurb: 'Light up your first destination in the miniature world.', glyph: 'bulb', target: 1,
    progress: (s) => uniq(s.activations.map((a) => a.placeId)).length },
  { id: 'first-adventure', title: 'First Adventure', blurb: 'Mark a place as actually visited.', glyph: 'compass', target: 1,
    progress: (s) => Object.values(s.saved).filter((x) => x.status === 'visited').length },
  { id: 'five-saved', title: 'Five Places Saved', blurb: 'Save five places to consider.', glyph: 'pin', target: 5,
    progress: (s) => Object.keys(s.saved).length },
  { id: 'first-itinerary', title: 'First Itinerary', blurb: 'Turn an idea into a plan.', glyph: 'map', target: 1,
    progress: (s) => s.itineraries.length },
  { id: 'first-country', title: 'First Country Explored', blurb: 'Visit a place and make a whole country count.', glyph: 'flag', target: 1,
    progress: (s, r) => uniq(Object.values(s.saved).filter((x) => x.status === 'visited').map((x) => r(x.placeId)?.countryCode).filter(Boolean)).length },
  { id: 'nature-collector', title: 'Nature Collector', blurb: 'Save five places with real natural features.', glyph: 'leaf', target: 5,
    progress: (s, r) => Object.keys(s.saved).map(r).filter((p) => p && p.env.length > 0 && p.settlement !== 'major-city').length },
  { id: 'weekend-explorer', title: 'Weekend Explorer', blurb: 'Plan a weekend-length trip.', glyph: 'sun', target: 1,
    progress: (s) => s.itineraries.filter((i) => i.purpose === 'weekend' || i.durationDays <= 3).length },
  { id: 'world-in-progress', title: 'World in Progress', blurb: 'Light up five destinations.', glyph: 'globe', target: 5,
    progress: (s) => uniq(s.activations.map((a) => a.placeId)).length },
];

export function computeAchievements(s: DataState): AchievementStatus[] {
  const resolve = (id: string) => s.customPlaces[id] ?? BUILTIN_BY_ID.get(id);
  return ACHIEVEMENTS.map((a) => {
    const current = Math.min(a.progress(s, resolve), a.target);
    return { ...a, current, earned: current >= a.target, earnedAt: s.achievements[a.id] };
  });
}
