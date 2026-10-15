import { z } from 'zod';
import type {
  Activation, FilterPreset, Itinerary, Profile, SavedPlace, Settings,
} from '../../shared/types';

/** Lenient schemas: unknown fields are dropped, missing fields get defaults. A record that fails is discarded, not the whole store. */
const iso = z.string().min(8);
const budget = z.object({ amount: z.number(), currency: z.string(), period: z.enum(['day', 'week', 'month']) });
const prov = z.enum(['live', 'curated', 'estimate', 'user', 'demo', 'ai']).catch('user');

export const savedSchema = z.object({
  placeId: z.string().min(1),
  addedBy: z.string().catch('dylan'),
  savedAt: iso.catch(() => new Date().toISOString()),
  status: z.enum(['saved', 'planned', 'visited']).catch('saved'),
  visitedAt: z.string().optional(),
  notes: z.string().catch(''),
  tags: z.array(z.string()).catch([]),
  priority: z.enum(['low', 'medium', 'high']).catch('medium'),
});

const stop = z.object({
  id: z.string(),
  kind: z.enum(['place', 'food', 'coffee', 'activity', 'transport', 'rest', 'work', 'accommodation', 'note']).catch('place'),
  title: z.string().catch('Untitled'),
  placeId: z.string().optional(),
  startTime: z.string().catch(''),
  durationMin: z.number().catch(60),
  notes: z.string().catch(''),
  cost: z.number().optional(),
  link: z.string().optional(),
  provenance: prov,
});
const day = z.object({ id: z.string(), label: z.string().catch('Day'), stayId: z.string().optional(), stops: z.array(stop).catch([]) });
const stay = z.object({
  id: z.string(), placeId: z.string().optional(), title: z.string().catch('Stay'), arrive: z.string().optional(), depart: z.string().optional(),
  days: z.number().catch(7), committed: z.boolean().catch(false), accommodation: z.string().catch(''), accommodationLink: z.string().optional(),
  monthlyCost: z.number().optional(), internet: z.enum(['', 'poor', 'ok', 'good', 'excellent']).catch(''),
  transport: z.string().catch(''), workNotes: z.string().catch(''), notes: z.string().catch(''),
});

export const itinerarySchema = z.object({
  id: z.string(),
  name: z.string().catch('Untitled itinerary'),
  purpose: z.enum(['work', 'romantic', 'adventure', 'holiday', 'nature', 'food', 'weekend', 'long-stay', 'other']).catch('other'),
  status: z.enum(['idea', 'tentative', 'committed', 'completed']).catch('idea'),
  startDate: z.string().optional(),
  flexibleDates: z.boolean().catch(true),
  durationDays: z.number().catch(7),
  pace: z.enum(['relaxed', 'balanced', 'packed']).catch('balanced'),
  focus: z.array(z.string()).catch([]),
  budget: budget.optional().catch(undefined),
  coverPlaceId: z.string().optional(),
  notes: z.string().catch(''),
  assumptions: z.array(z.string()).catch([]),
  stays: z.array(stay).catch([]),
  days: z.array(day).catch([]),
  createdBy: z.string().catch('dylan'),
  createdAt: iso.catch(() => new Date().toISOString()),
  updatedAt: iso.catch(() => new Date().toISOString()),
  generatedBy: z.enum(['manual', 'demo', 'ai']).catch('manual'),
});

export const activationSchema = z.object({ id: z.string(), placeId: z.string(), profileId: z.string(), at: iso });

export const settingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).catch('system'),
  reducedMotion: z.enum(['system', 'on', 'off']).catch('system'),
  sound: z.object({ enabled: z.boolean().catch(false), volume: z.number().min(0).max(1).catch(0.5) }).catch({ enabled: false, volume: 0.5 }),
  currency: z.string().catch('USD'),
  units: z.enum(['metric', 'imperial']).catch('metric'),
  introSeen: z.boolean().catch(false),
});

const character = z.object({
  outfitHue: z.number().catch(200), skin: z.number().catch(1), hair: z.number().catch(1),
  hairStyle: z.enum(['short', 'long', 'cap', 'curly']).catch('short'),
  accessory: z.enum(['none', 'glasses', 'backpack', 'scarf']).catch('none'),
  referenceNote: z.string().catch(''), personalised: z.boolean().catch(false),
});
const prefs = z.object({
  interests: z.array(z.string()).catch([]),
  climate: z.array(z.string()).catch([]),
  stay: z.enum(['weekend', 'week', 'month', 'three-months', 'six-months', 'year', 'flexible']).catch('flexible'),
  budget: budget.optional().catch(undefined),
  remoteWork: z.object({ needsWifi: z.boolean().catch(false), minInternet: z.number().catch(3), needsCoworking: z.boolean().catch(false) }).catch({ needsWifi: false, minInternet: 3, needsCoworking: false }),
  crowds: z.enum(['any', 'low']).catch('any'),
});
export const profileSchema = z.object({ id: z.string(), name: z.string().min(1), color: z.string().catch('#3dd6c6'), character, preferences: prefs });

export const presetSchema = z.object({ id: z.string(), name: z.string(), createdAt: iso, criteria: z.record(z.string(), z.unknown()) });

export function parseList<T>(raw: unknown, schema: z.ZodType<any>, dropped: { n: number }): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const r of raw) {
    const res = schema.safeParse(r);
    if (res.success) out.push(res.data as T);
    else dropped.n++;
  }
  return out;
}

export type Persisted = {
  profiles: Profile[]; activeProfileId: string; settings: Settings; saved: Record<string, SavedPlace>;
  customPlaces: Record<string, unknown>; itineraries: Itinerary[]; activations: Activation[]; filterPresets: FilterPreset[];
  achievements: Record<string, string>;
};
