import { SYMBOL } from './labels';

export function money(amount: number, currency: string): string {
  const sym = SYMBOL[currency];
  const n = Math.round(amount).toLocaleString('en-US');
  return sym ? `${sym}${n}` : `${n} ${currency}`;
}

/** Convert a USD estimate into the user's currency ONLY when a live rate is available. */
export function usdTo(amountUsd: number, currency: string, toUSD?: Record<string, number>): { text: string; converted: boolean } {
  if (currency === 'USD') return { text: money(amountUsd, 'USD'), converted: false };
  const rate = toUSD?.[currency];
  if (!rate) return { text: `${money(amountUsd, 'USD')} (USD, no live ${currency} rate)`, converted: false };
  return { text: money(amountUsd / rate, currency), converted: true };
}

export function ago(iso?: string): string {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

export const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export const WEATHER_CODES: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, hail',
};
