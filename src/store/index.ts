import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type {
  Activation, CharacterSettings, Criteria, FilterPreset, Itinerary, Place, PlaceId, Preferences, Priority, Profile, SavedPlace, SavedStatus, Settings,
} from '../../shared/types';
import { nowIso, uid } from '../lib/ids';
import { activationSchema, itinerarySchema, parseList, presetSchema, profileSchema, savedSchema, settingsSchema } from './schemas';
import { computeAchievements } from '../lib/achievements';

export const STORE_KEY = 'globa:v1';
export const STORE_VERSION = 1;

/**
 * STORAGE MODEL (honest summary): everything is saved in THIS browser's localStorage under `globa:v1`.
 * It survives reloads but is NOT synced between devices and is NOT protected by an account.
 * To move to a database later, replace `StateStorage` below (or swap the whole persist layer) — no UI code touches storage directly.
 * Before any destructive normalisation we keep a raw copy under `globa:backup:*`.
 */
function makeStorage(): StateStorage {
  const ls = () => { try { return window.localStorage; } catch { return null; } };
  return {
    getItem: (k) => { try { return ls()?.getItem(k) ?? null; } catch { return null; } },
    setItem: (k, v) => { try { ls()?.setItem(k, v); } catch { /* quota or private mode: stay in memory */ } },
    removeItem: (k) => { try { ls()?.removeItem(k); } catch { /* ignore */ } },
  };
}

const defaultPrefs = (): Preferences => ({
  interests: [], climate: [], stay: 'flexible', remoteWork: { needsWifi: false, minInternet: 3, needsCoworking: false }, crowds: 'any',
});

export const defaultProfiles = (): Profile[] => [
  {
    id: 'dylan', name: 'Dylan', color: '#3dd6c6',
    character: { outfitHue: 195, skin: 1, hair: 2, hairStyle: 'short', accessory: 'backpack', referenceNote: '', personalised: false },
    preferences: defaultPrefs(),
  },
  {
    id: 'nicole', name: 'Nicole', color: '#f2b84b',
    character: { outfitHue: 330, skin: 1, hair: 1, hairStyle: 'long', accessory: 'scarf', referenceNote: '', personalised: false },
    preferences: defaultPrefs(),
  },
];

export const defaultSettings = (): Settings => ({
  theme: 'system', reducedMotion: 'system', sound: { enabled: false, volume: 0.5 }, currency: 'USD', units: 'metric', introSeen: false,
});

export interface DataState {
  profiles: Profile[];
  activeProfileId: string;
  settings: Settings;
  saved: Record<PlaceId, SavedPlace>;
  customPlaces: Record<PlaceId, Place>;
  itineraries: Itinerary[];
  activations: Activation[];
  filterPresets: FilterPreset[];
  /** achievement id → ISO time first unlocked (derived from real data, stored so unlock moments are stable) */
  achievements: Record<string, string>;
  recoveryNote: string;
}

interface Actions {
  setActiveProfile: (id: string) => void;
  updateProfile: (id: string, patch: Partial<Pick<Profile, 'name' | 'color'>>) => void;
  updateCharacter: (id: string, patch: Partial<CharacterSettings>) => void;
  updatePreferences: (id: string, patch: Partial<Preferences>) => void;
  updateSettings: (patch: Partial<Settings>) => void;

  savePlace: (id: PlaceId, opts?: { place?: Place; status?: SavedStatus }) => void;
  unsavePlace: (id: PlaceId) => void;
  updateSaved: (id: PlaceId, patch: Partial<Pick<SavedPlace, 'notes' | 'tags' | 'priority' | 'status'>>) => void;
  setStatus: (id: PlaceId, status: SavedStatus) => void;

  addItinerary: (it: Itinerary) => void;
  updateItinerary: (id: string, fn: (it: Itinerary) => Itinerary) => void;
  deleteItinerary: (id: string) => void;
  duplicateItinerary: (id: string) => string | undefined;

  activatePlace: (placeId: PlaceId, profileId: string) => void;
  addPreset: (name: string, criteria: Criteria) => void;
  removePreset: (id: string) => void;
  syncAchievements: () => string[];

  exportData: () => string;
  importData: (json: string) => { ok: boolean; message: string };
  resetAll: () => void;
  clearRecoveryNote: () => void;
}

export type Store = DataState & Actions;

const initialData = (): DataState => ({
  profiles: defaultProfiles(), activeProfileId: 'dylan', settings: defaultSettings(), saved: {}, customPlaces: {},
  itineraries: [], activations: [], filterPresets: [], achievements: {}, recoveryNote: '',
});

const DATA_KEYS: (keyof DataState)[] = ['profiles', 'activeProfileId', 'settings', 'saved', 'customPlaces', 'itineraries', 'activations', 'filterPresets', 'achievements'];

/** Validate an unknown blob into DataState. Malformed records are dropped; the number dropped is returned. */
export function sanitize(raw: unknown): { data: DataState; dropped: number } {
  const base = initialData();
  const dropped = { n: 0 };
  if (!raw || typeof raw !== 'object') return { data: base, dropped: 0 };
  const r = raw as Record<string, any>;

  const profiles = parseList<Profile>(r.profiles, profileSchema, dropped);
  const merged = base.profiles.map((d) => profiles.find((p) => p.id === d.id) ?? d);
  const extras = profiles.filter((p) => !base.profiles.some((d) => d.id === p.id));
  base.profiles = [...merged, ...extras];
  base.activeProfileId = base.profiles.some((p) => p.id === r.activeProfileId) ? r.activeProfileId : base.profiles[0].id;

  const s = settingsSchema.safeParse(r.settings ?? {});
  base.settings = s.success ? (s.data as Settings) : defaultSettings();

  if (r.saved && typeof r.saved === 'object') {
    for (const v of Object.values(r.saved)) {
      const res = savedSchema.safeParse(v);
      if (res.success) base.saved[res.data.placeId] = res.data as SavedPlace;
      else dropped.n++;
    }
  }
  if (r.customPlaces && typeof r.customPlaces === 'object') {
    for (const [k, v] of Object.entries(r.customPlaces)) {
      const p = v as Place;
      if (p && typeof p.lat === 'number' && typeof p.lng === 'number' && typeof p.name === 'string' && p.id === k) base.customPlaces[k] = p;
      else dropped.n++;
    }
  }
  base.itineraries = parseList<Itinerary>(r.itineraries, itinerarySchema, dropped);
  base.activations = parseList<Activation>(r.activations, activationSchema, dropped);
  base.filterPresets = parseList<FilterPreset>(r.filterPresets, presetSchema, dropped);
  if (r.achievements && typeof r.achievements === 'object') {
    for (const [k, v] of Object.entries(r.achievements)) if (typeof v === 'string') base.achievements[k] = v;
  }
  return { data: base, dropped: dropped.n };
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialData(),

      setActiveProfile: (id) => set((s) => (s.profiles.some((p) => p.id === id) ? { activeProfileId: id } : s)),
      updateProfile: (id, patch) => set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      updateCharacter: (id, patch) =>
        set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, character: { ...p.character, ...patch } } : p)) })),
      updatePreferences: (id, patch) =>
        set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, preferences: { ...p.preferences, ...patch } } : p)) })),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      savePlace: (id, opts) =>
        set((s) => {
          if (s.saved[id]) return s;
          const entry: SavedPlace = {
            placeId: id, addedBy: s.activeProfileId, savedAt: nowIso(), status: opts?.status ?? 'saved', notes: '', tags: [], priority: 'medium',
          };
          return {
            saved: { ...s.saved, [id]: entry },
            customPlaces: opts?.place?.custom ? { ...s.customPlaces, [id]: opts.place } : s.customPlaces,
          };
        }),
      unsavePlace: (id) =>
        set((s) => {
          const { [id]: _removed, ...rest } = s.saved;
          return { saved: rest };
        }),
      updateSaved: (id, patch) => set((s) => (s.saved[id] ? { saved: { ...s.saved, [id]: { ...s.saved[id], ...patch } } } : s)),
      setStatus: (id, status) =>
        set((s) =>
          s.saved[id]
            ? { saved: { ...s.saved, [id]: { ...s.saved[id], status, visitedAt: status === 'visited' ? nowIso() : undefined } } }
            : s,
        ),

      addItinerary: (it) => set((s) => ({ itineraries: [it, ...s.itineraries] })),
      updateItinerary: (id, fn) =>
        set((s) => ({ itineraries: s.itineraries.map((i) => (i.id === id ? { ...fn(i), updatedAt: nowIso() } : i)) })),
      deleteItinerary: (id) => set((s) => ({ itineraries: s.itineraries.filter((i) => i.id !== id) })),
      duplicateItinerary: (id) => {
        const src = get().itineraries.find((i) => i.id === id);
        if (!src) return undefined;
        const copy: Itinerary = JSON.parse(JSON.stringify(src));
        const stayMap = new Map<string, string>();
        copy.stays = copy.stays.map((st) => { const nid = uid('stay'); stayMap.set(st.id, nid); return { ...st, id: nid }; });
        copy.days = copy.days.map((d) => ({
          ...d, id: uid('day'), stayId: d.stayId ? stayMap.get(d.stayId) : undefined, stops: d.stops.map((x) => ({ ...x, id: uid('stop') })),
        }));
        copy.id = uid('trip');
        copy.name = `${src.name} (copy)`;
        copy.createdAt = copy.updatedAt = nowIso();
        set((s) => ({ itineraries: [copy, ...s.itineraries] }));
        return copy.id;
      },

      activatePlace: (placeId, profileId) =>
        set((s) => ({ activations: [...s.activations, { id: uid('act'), placeId, profileId, at: nowIso() }] })),
      addPreset: (name, criteria) =>
        set((s) => ({ filterPresets: [...s.filterPresets, { id: uid('preset'), name, criteria, createdAt: nowIso() }] })),
      removePreset: (id) => set((s) => ({ filterPresets: s.filterPresets.filter((p) => p.id !== id) })),

      syncAchievements: () => {
        const s = get();
        const earned = computeAchievements(s).filter((a) => a.earned);
        const fresh = earned.filter((a) => !s.achievements[a.id]).map((a) => a.id);
        if (fresh.length) {
          const t = nowIso();
          set((st) => ({ achievements: { ...st.achievements, ...Object.fromEntries(fresh.map((id) => [id, t])) } }));
        }
        return fresh;
      },

      exportData: () => {
        const s = get();
        const data: Record<string, unknown> = { app: 'globa', version: STORE_VERSION, exportedAt: nowIso() };
        for (const k of DATA_KEYS) data[k] = s[k];
        return JSON.stringify(data, null, 2);
      },
      importData: (json) => {
        try {
          const parsed = JSON.parse(json);
          if (parsed?.app !== 'globa') return { ok: false, message: 'This file is not a GLOBA backup.' };
          const { data, dropped } = sanitize(parsed);
          set({ ...data, recoveryNote: '' });
          return { ok: true, message: dropped ? `Imported, skipping ${dropped} unreadable record(s).` : 'Backup imported.' };
        } catch {
          return { ok: false, message: 'That file could not be read as JSON.' };
        }
      },
      resetAll: () => set({ ...initialData() }),
      clearRecoveryNote: () => set({ recoveryNote: '' }),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(makeStorage),
      partialize: (s) => Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as unknown as Store,
      migrate: (persisted) => persisted as Store, // v1 is the first version; add migrations here
      merge: (persisted, current) => {
        const { data, dropped } = sanitize(persisted);
        if (dropped > 0) {
          try {
            window.localStorage.setItem(`globa:backup:${Date.now()}`, JSON.stringify(persisted));
          } catch { /* ignore */ }
        }
        return {
          ...current, ...data,
          recoveryNote: dropped > 0 ? `${dropped} unreadable record(s) were skipped on load. A raw copy was kept in this browser as a backup.` : '',
        };
      },
    },
  ),
);

export const activeProfile = (s: DataState): Profile => s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0];
export const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
