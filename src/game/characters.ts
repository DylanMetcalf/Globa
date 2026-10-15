import type { CharacterSettings } from '../../shared/types';

export const SKIN_TONES = ['#ffe0c7', '#f3c9a5', '#dfa77c', '#bd8159', '#8c5a3c', '#5d3b27'];
export const HAIR_COLORS = ['#1c1410', '#4a3022', '#8a5a2b', '#c89a4a', '#e8d29a', '#b5483a', '#6e6e7a'];
export const HAIR_STYLES: CharacterSettings['hairStyle'][] = ['short', 'long', 'cap', 'curly'];
export const ACCESSORIES: CharacterSettings['accessory'][] = ['none', 'glasses', 'backpack', 'scarf'];

export const outfitColor = (hue: number, l = 52) => `hsl(${hue}, 70%, ${l}%)`;

/** Signature celebrations — Dylan: victory dance. Nicole: clap then excited jump. Others default to a cheer. */
export type Celebration = 'dance' | 'clapjump' | 'cheer';
export const celebrationFor = (profileId: string): Celebration => (profileId === 'dylan' ? 'dance' : profileId === 'nicole' ? 'clapjump' : 'cheer');
export const CELEBRATION_LABEL: Record<Celebration, string> = { dance: 'Victory dance', clapjump: 'Clap and excited jump', cheer: 'Cheer' };
