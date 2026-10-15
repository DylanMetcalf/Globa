import type {
  ActivityTag, Climate, EnvTag, FoodTag, LifestyleTag, PracticalTag, Reason, SettlementType, StayDuration, TripPurpose, StopKind,
} from '../../shared/types';

export const ENV_LABELS: Record<EnvTag, string> = {
  mountains: 'Mountains', lakes: 'Lakes', rivers: 'Rivers', forests: 'Forests', waterfalls: 'Waterfalls', glaciers: 'Glaciers',
  deserts: 'Deserts', canyons: 'Canyons', caves: 'Caves', volcanoes: 'Volcanoes', islands: 'Islands', beaches: 'Beaches',
  wetlands: 'Wetlands', geology: 'Unique geology', wildlife: 'Wildlife', phenomena: 'Natural phenomena',
};
export const SETTLEMENT_LABELS: Record<SettlementType, string> = {
  'major-city': 'Major city', 'small-town': 'Small town', village: 'Village', remote: 'Remote settlement', island: 'Island',
  'mountain-retreat': 'Mountain retreat', 'coastal-town': 'Coastal town', countryside: 'Countryside',
  'national-park': 'National park area', cabin: 'Cabin location', rural: 'Rural area',
};
export const LIFESTYLE_LABELS: Record<LifestyleTag, string> = {
  quiet: 'Quiet', social: 'Social', romantic: 'Romantic', adventurous: 'Adventurous', remote: 'Remote', walkable: 'Walkable',
  creative: 'Creative', cultural: 'Cultural', outdoors: 'Outdoors-focused', 'slow-living': 'Slow living', 'work-focused': 'Work-focused',
};
export const PRACTICAL_LABELS: Record<PracticalTag, string> = {
  wifi: 'Reliable Wi-Fi', mobile: 'Mobile coverage', 'nearby-town': 'Nearby town', healthcare: 'Healthcare access',
  groceries: 'Grocery stores', 'public-transport': 'Public transport', 'car-free': 'Car-free friendly', walkable: 'Walkable',
  coworking: 'Coworking', airport: 'Airport access',
};
export const ACTIVITY_LABELS: Record<ActivityTag, string> = {
  hiking: 'Hiking', swimming: 'Swimming', surfing: 'Surfing', skiing: 'Skiing', diving: 'Diving', climbing: 'Climbing',
  cycling: 'Cycling', kayaking: 'Kayaking', stargazing: 'Stargazing', photography: 'Photography', wine: 'Wine', wellness: 'Wellness',
  heritage: 'Heritage', 'whale-watching': 'Whale watching', aurora: 'Aurora',
};
export const FOOD_LABELS: Record<FoodTag, string> = {
  'street-food': 'Street food', seafood: 'Seafood', wine: 'Wine', coffee: 'Coffee', 'farm-to-table': 'Farm-to-table',
  'fine-dining': 'Fine dining', markets: 'Markets', 'vegetarian-friendly': 'Vegetarian-friendly',
};
export const STAY_LABELS: Record<StayDuration, string> = {
  weekend: 'A weekend', week: 'One week', month: 'One month', 'three-months': 'Three months', 'six-months': 'Six months',
  year: 'One year', flexible: 'Flexible',
};
export const STAY_DAYS: Record<StayDuration, number> = { weekend: 3, week: 7, month: 30, 'three-months': 90, 'six-months': 180, year: 365, flexible: 14 };
export const CLIMATE_LABELS: Record<Climate, string> = {
  tropical: 'Tropical', 'warm-dry': 'Warm & dry', mediterranean: 'Mediterranean', temperate: 'Temperate', cool: 'Cool',
  alpine: 'Alpine', subarctic: 'Subarctic', arid: 'Arid',
};
export const REASON_LABELS: Record<Reason, string> = {
  landscapes: 'Extraordinary natural landscapes', 'food-culture': 'Food and local culture', adventure: 'Adventure activities',
  romance: 'Romantic atmosphere', 'remote-work': 'Remote working', 'slow-living': 'Slow living',
  'architecture-history': 'Architecture and history', wildlife: 'Wildlife', phenomena: 'Unique geographical phenomena',
};
export const PURPOSE_LABELS: Record<TripPurpose, string> = {
  work: 'Work', romantic: 'Romantic getaway', adventure: 'Adventure', holiday: 'Holiday', nature: 'Nature retreat',
  food: 'Food exploration', weekend: 'Weekend trip', 'long-stay': 'Long-stay living', other: 'Something else',
};
export const STOP_LABELS: Record<StopKind, string> = {
  place: 'Place', food: 'Meal', coffee: 'Coffee', activity: 'Activity', transport: 'Transport', rest: 'Rest',
  work: 'Work block', accommodation: 'Stay', note: 'Note',
};
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'ZAR', 'AUD', 'NZD', 'CAD', 'CHF', 'JPY', 'SEK', 'NOK'];

export const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', ZAR: 'R', AUD: 'A$', NZD: 'NZ$', CAD: 'C$', CHF: 'CHF ', JPY: '¥', SEK: 'kr ', NOK: 'kr ' };
