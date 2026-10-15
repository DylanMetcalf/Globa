/**
 * GLOBA domain model — shared by the web client and the API server.
 *
 * Rules of thumb:
 *  - A Place has ONE stable id and ONE coordinate pair. The globe, the map, saved places,
 *    itineraries and the mini-game all refer to places by id only.
 *  - Provider-specific API payloads never leak into these types (see server/providers).
 *  - Anything that is not live-verified carries a `Provenance`.
 */

export type PlaceId = string;

/** Where a piece of information came from. Never show `curated`/`estimate`/`demo` as live. */
export type Provenance = 'live' | 'curated' | 'estimate' | 'user' | 'demo' | 'ai';

export const ENV_TAGS = [
  'mountains', 'lakes', 'rivers', 'forests', 'waterfalls', 'glaciers', 'deserts', 'canyons', 'caves',
  'volcanoes', 'islands', 'beaches', 'wetlands', 'geology', 'wildlife', 'phenomena',
] as const;
export type EnvTag = (typeof ENV_TAGS)[number];

export const SETTLEMENT_TYPES = [
  'major-city', 'small-town', 'village', 'remote', 'island', 'mountain-retreat', 'coastal-town',
  'countryside', 'national-park', 'cabin', 'rural',
] as const;
export type SettlementType = (typeof SETTLEMENT_TYPES)[number];

export const LIFESTYLE_TAGS = [
  'quiet', 'social', 'romantic', 'adventurous', 'remote', 'walkable', 'creative', 'cultural',
  'outdoors', 'slow-living', 'work-focused',
] as const;
export type LifestyleTag = (typeof LIFESTYLE_TAGS)[number];

export const PRACTICAL_TAGS = [
  'wifi', 'mobile', 'nearby-town', 'healthcare', 'groceries', 'public-transport', 'car-free',
  'walkable', 'coworking', 'airport',
] as const;
export type PracticalTag = (typeof PRACTICAL_TAGS)[number];

export const ACTIVITY_TAGS = [
  'hiking', 'swimming', 'surfing', 'skiing', 'diving', 'climbing', 'cycling', 'kayaking',
  'stargazing', 'photography', 'wine', 'wellness', 'heritage', 'whale-watching', 'aurora',
] as const;
export type ActivityTag = (typeof ACTIVITY_TAGS)[number];

export const FOOD_TAGS = ['street-food', 'seafood', 'wine', 'coffee', 'farm-to-table', 'fine-dining', 'markets', 'vegetarian-friendly'] as const;
export type FoodTag = (typeof FOOD_TAGS)[number];

export const STAY_DURATIONS = ['weekend', 'week', 'month', 'three-months', 'six-months', 'year', 'flexible'] as const;
export type StayDuration = (typeof STAY_DURATIONS)[number];

export const REASONS = [
  'landscapes', 'food-culture', 'adventure', 'romance', 'remote-work', 'slow-living', 'architecture-history',
  'wildlife', 'phenomena',
] as const;
export type Reason = (typeof REASONS)[number];

export type Climate = 'tropical' | 'warm-dry' | 'mediterranean' | 'temperate' | 'cool' | 'alpine' | 'subarctic' | 'arid';

export type PlaceKind = 'destination' | 'poi';

export interface Place {
  id: PlaceId;
  name: string;
  kind: PlaceKind;
  /** POIs belong to a destination (nearby extraordinary places). */
  parentId?: PlaceId;
  country: string;
  countryCode: string;
  region: string;
  lat: number;
  lng: number;
  tagline: string;
  summary: string;
  env: EnvTag[];
  settlement?: SettlementType;
  lifestyle: LifestyleTag[];
  practical: PracticalTag[];
  activities: ActivityTag[];
  food: FoodTag[];
  stayTypes: string[];
  primaryReason: Reason;
  secondaryReasons: Reason[];
  /** 1–5 curated judgements (editorial estimates, not measurements). */
  scores: { crowds: number; popularity: number; internet: number; walkability: number; remoteness: number; cost: number };
  /** Rough monthly living cost for two on a long stay, USD, excluding flights. An ESTIMATE. */
  monthlyCostUSD?: [number, number];
  climate: Climate;
  climateNote: string;
  /** Months (1–12) that suit a long stay. */
  bestMonths: number[];
  /** Months with peak tourism. */
  peakMonths: number[];
  idealStay: StayDuration[];
  special: string[];
  localLife: string[];
  pros: string[];
  cons: string[];
  research: string[];
  wikiTitle?: string;
  /** Art direction seed for the illustrative fallback image. */
  art: { hue: number; motif: ArtMotif };
  provenance: Provenance;
  /** Set for places the user created from a live geocoding result. */
  custom?: boolean;
}

export type ArtMotif = 'mountain' | 'coast' | 'forest' | 'desert' | 'city' | 'island' | 'aurora' | 'volcano' | 'lake' | 'canyon';

/** ---------- Discovery ---------- */

export interface Budget {
  amount: number;
  currency: string;
  period: 'day' | 'week' | 'month';
}

export interface Criteria {
  text: string;
  env: EnvTag[];
  settlement: SettlementType[];
  lifestyle: LifestyleTag[];
  practical: PracticalTag[];
  activities: ActivityTag[];
  food: FoodTag[];
  stayTypes: string[];
  stay?: StayDuration;
  budget?: Budget;
  months: number[];
  climate: Climate[];
  crowds: 'any' | 'low';
  popularity: 'any' | 'hidden' | 'popular';
  /** Max relative cost level 1–5 (from phrases like "reasonable budget"). */
  maxCost?: number;
  remoteness: 'any' | 'remote' | 'connected';
  kind: 'any' | PlaceKind;
  countryCode?: string;
  near?: { lat: number; lng: number; radiusKm: number; label: string };
}

export interface Match {
  place: Place;
  /** 0..1 */
  score: number;
  reasons: string[];
  gaps: string[];
}

/** ---------- Collections ---------- */

export type SavedStatus = 'saved' | 'planned' | 'visited';
export type Priority = 'low' | 'medium' | 'high';

export interface SavedPlace {
  placeId: PlaceId;
  addedBy: string;
  savedAt: string;
  status: SavedStatus;
  visitedAt?: string;
  notes: string;
  tags: string[];
  priority: Priority;
}

export interface Activation {
  id: string;
  placeId: PlaceId;
  profileId: string;
  at: string;
}

/** ---------- Itineraries ---------- */

export const TRIP_PURPOSES = ['work', 'romantic', 'adventure', 'holiday', 'nature', 'food', 'weekend', 'long-stay', 'other'] as const;
export type TripPurpose = (typeof TRIP_PURPOSES)[number];
export type Pace = 'relaxed' | 'balanced' | 'packed';
export type PlanStatus = 'idea' | 'tentative' | 'committed' | 'completed';
export type StopKind = 'place' | 'food' | 'coffee' | 'activity' | 'transport' | 'rest' | 'work' | 'accommodation' | 'note';

export interface Stop {
  id: string;
  kind: StopKind;
  title: string;
  placeId?: PlaceId;
  /** "HH:MM" or empty if flexible. */
  startTime: string;
  durationMin: number;
  notes: string;
  /** Estimated cost in the itinerary's currency. Always an estimate unless the user entered it. */
  cost?: number;
  link?: string;
  provenance: Provenance;
}

export interface Day {
  id: string;
  label: string;
  stayId?: string;
  stops: Stop[];
}

export interface Stay {
  id: string;
  placeId?: PlaceId;
  title: string;
  arrive?: string;
  depart?: string;
  /** Approximate length in days when exact dates are not set. */
  days: number;
  committed: boolean;
  accommodation: string;
  accommodationLink?: string;
  monthlyCost?: number;
  internet: '' | 'poor' | 'ok' | 'good' | 'excellent';
  transport: string;
  workNotes: string;
  notes: string;
}

export interface Itinerary {
  id: string;
  name: string;
  purpose: TripPurpose;
  status: PlanStatus;
  startDate?: string;
  flexibleDates: boolean;
  durationDays: number;
  pace: Pace;
  focus: string[];
  budget?: Budget;
  coverPlaceId?: PlaceId;
  notes: string;
  assumptions: string[];
  stays: Stay[];
  days: Day[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  generatedBy: 'manual' | 'demo' | 'ai';
}

/** ---------- Profiles & settings ---------- */

export interface CharacterSettings {
  /** Body hue 0–360. */
  outfitHue: number;
  skin: number; // index into palette
  hair: number;
  hairStyle: 'short' | 'long' | 'cap' | 'curly';
  accessory: 'none' | 'glasses' | 'backpack' | 'scarf';
  /** Optional: a reference image the user may attach later so a custom model can be made. */
  referenceNote: string;
  personalised: boolean;
}

export interface Preferences {
  interests: EnvTag[];
  climate: Climate[];
  stay: StayDuration;
  budget?: Budget;
  remoteWork: { needsWifi: boolean; minInternet: number; needsCoworking: boolean };
  crowds: 'any' | 'low';
}

export interface Profile {
  id: string;
  name: string;
  color: string;
  character: CharacterSettings;
  preferences: Preferences;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  reducedMotion: 'system' | 'on' | 'off';
  sound: { enabled: boolean; volume: number };
  currency: string;
  units: 'metric' | 'imperial';
  introSeen: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  criteria: Criteria;
  createdAt: string;
}

/** ---------- Integrations ---------- */

export type ProviderState = 'live' | 'demo' | 'unavailable';

export interface IntegrationStatus {
  id: string;
  label: string;
  state: ProviderState;
  detail: string;
  /** env var(s) that enable it */
  env?: string[];
}

export interface ApiStatus {
  version: string;
  ai: { provider: string; model: string; state: ProviderState };
  integrations: IntegrationStatus[];
  serverTime: string;
}

export interface SourceRef {
  label: string;
  url: string;
  provenance: Provenance;
  checkedAt?: string;
}

export interface LiveImage {
  url: string;
  credit: string;
  creditUrl: string;
  license?: string;
}

export interface GeocodeHit {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  region: string;
  lat: number;
  lng: number;
  population?: number;
  featureCode?: string;
}

export interface NearbyBusiness {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distanceKm?: number;
  tags: Record<string, string>;
  sourceUrl: string;
}

export interface WeatherSnapshot {
  tempC: number;
  windKph: number;
  code: number;
  daily: { date: string; maxC: number; minC: number; precipMm: number }[];
  checkedAt: string;
}

export interface FxRates {
  base: string;
  date: string;
  rates: Record<string, number>;
}
