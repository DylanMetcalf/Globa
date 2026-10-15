import type { CharacterSettings } from '../../shared/types';
import { HAIR_COLORS, SKIN_TONES, outfitColor } from '../game/characters';

/** 2D portrait of the placeholder character. It mirrors the 3D model's parameters. Not a likeness of a real person. */
export function CharacterPortrait({ c, size = 120, label }: { c: CharacterSettings; size?: number; label?: string }) {
  const skin = SKIN_TONES[c.skin % SKIN_TONES.length];
  const hair = HAIR_COLORS[c.hair % HAIR_COLORS.length];
  const outfit = outfitColor(c.outfitHue);
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={label ?? 'Character portrait'}>
      <defs><radialGradient id={`bg-${c.outfitHue}`} cx="0.5" cy="0.3" r="0.9"><stop offset="0" stopColor={outfitColor(c.outfitHue, 70)} stopOpacity="0.5" /><stop offset="1" stopColor="#0b1130" /></radialGradient></defs>
      <rect width="120" height="120" rx="26" fill={`url(#bg-${c.outfitHue})`} />
      {c.hairStyle === 'long' && <path d="M32 58c-4-30 12-42 28-42s32 12 28 42l2 38H30Z" fill={hair} />}
      {c.accessory === 'backpack' && <rect x="26" y="78" width="14" height="26" rx="6" fill="#d98a3a" />}
      <path d="M26 120c0-24 14-36 34-36s34 12 34 36Z" fill={outfit} />
      {c.accessory === 'scarf' && <path d="M38 86c14 8 30 8 44 0l4 12c-16 10-36 10-52 0Z" fill="#ef7d6a" />}
      <rect x="52" y="70" width="16" height="16" rx="6" fill={skin} />
      <circle cx="60" cy="52" r="24" fill={skin} />
      {c.hairStyle === 'short' && <path d="M36 50c-2-18 10-28 24-28s26 10 24 28c-6-8-14-12-24-12s-18 4-24 12Z" fill={hair} />}
      {c.hairStyle === 'long' && <path d="M35 52c-3-20 9-30 25-30s28 10 25 30c-4-10-12-16-25-16s-21 6-25 16Z" fill={hair} />}
      {c.hairStyle === 'cap' && <><path d="M34 48c0-16 12-24 26-24s26 8 26 24Z" fill={outfitColor((c.outfitHue + 140) % 360, 40)} /><path d="M58 48h34c0 6-8 8-34 6Z" fill={outfitColor((c.outfitHue + 140) % 360, 32)} /></>}
      {c.hairStyle === 'curly' && <g fill={hair}>{[[38, 38], [48, 30], [60, 27], [72, 30], [82, 38], [36, 50], [84, 50]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="10" />)}</g>}
      <circle cx="51" cy="54" r="3" fill="#1b1b2a" /><circle cx="69" cy="54" r="3" fill="#1b1b2a" />
      <path d="M52 64c4 5 12 5 16 0" stroke="#1b1b2a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {c.accessory === 'glasses' && <g fill="none" stroke="#1b1b2a" strokeWidth="2.4"><circle cx="51" cy="54" r="8" /><circle cx="69" cy="54" r="8" /><path d="M59 54h2" /></g>}
    </svg>
  );
}
