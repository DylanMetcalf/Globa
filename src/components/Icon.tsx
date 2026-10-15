import type { SVGProps } from 'react';

const P: Record<string, string> = {
  explore: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.6 2.4 3.9 5.4 3.9 9s-1.3 6.6-3.9 9m0-18C9.4 5.4 8.1 8.4 8.1 12s1.3 6.6 3.9 9M3.5 9h17M3.5 15h17',
  discover: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.6 5.4-2 5.2-5.2 2 2-5.2 5.2-2Z',
  saved: 'M7 4h10a1 1 0 0 1 1 1v15l-6-3.6L6 20V5a1 1 0 0 1 1-1Z',
  trips: 'M5 18a2 2 0 1 0 0 .01M19 6a2 2 0 1 0 0 .01M7 18h7a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h7',
  world: 'M12 3l2.4 5 5.6.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8 9.6 8 12 3Z',
  settings: 'M4 7h9m4 0h3M4 17h3m4 0h9M15 4v6M9 14v6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4',
  filter: 'M4 6h16M7 12h10M10 18h4',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  bulb: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z',
  map: 'M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4Zm0 0v13m6-10v13',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.6 2.4 3.9 5.4 3.9 9s-1.3 6.6-3.9 9m0-18C9.4 5.4 8.1 8.4 8.1 12s1.3 6.6 3.9 9M3.5 9h17M3.5 15h17',
  pin: 'M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0c0 5.4 6.5 11 6.5 11Zm0-8.3a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4Z',
  trash: 'M5 7h14M10 7V4h4v3m-7 0 1 13h8l1-13M10 11v6m4-6v6',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  up: 'M12 19V5m-6 6 6-6 6 6',
  down: 'M12 5v14m6-6-6 6-6-6',
  left: 'M19 12H5m6-6-6 6 6 6',
  right: 'M5 12h14m-6-6 6 6-6 6',
  chevron: 'M6 9l6 6 6-6',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  external: 'M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z',
  send: 'M4 12 20 4l-5 16-3-7-8-1Z',
  sound: 'M4 10v4h4l5 4V6l-5 4H4Zm12-2a5 5 0 0 1 0 8',
  mute: 'M4 10v4h4l5 4V6l-5 4H4Zm13 0 5 5m0-5-5 5',
  home: 'M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z',
  layers: 'm12 4 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5',
  calendar: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm0 4h14M8 4v4m8-4v4',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2',
  cash: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM6 10v4m12-4v4',
  wifi: 'M3 9a14 14 0 0 1 18 0M6 12.5a9.5 9.5 0 0 1 12 0M9 16a5 5 0 0 1 6 0M12 19.5v.01',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',
  mountain: 'm3 19 6-10 3.5 5.5L15 11l6 8H3Z',
  leaf: 'M5 19c0-9 5-14 15-14 0 10-5 15-14 15m-1-1c2-4 5-7 9-9',
  food: 'M7 3v8a2 2 0 0 0 2 2v8M5 3v5m4-5v5m8-5c-2 1.5-3 4-3 7h3v11',
  coffee: 'M5 9h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V9Zm11 1h2a2 2 0 0 1 0 5h-2M8 3v3m4-3v3',
  bed: 'M3 18V6m0 8h18v4m0-4v-2a3 3 0 0 0-3-3h-7v5M7 11.5a1.5 1.5 0 1 0 0-.01',
  info: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 7v5m0-8.5v.01',
  warn: 'M12 4 3 19h18L12 4Zm0 6v4m0 3v.01',
  drag: 'M9 6v.01M9 12v.01M9 18v.01M15 6v.01M15 12v.01M15 18v.01',
  play: 'M7 5v14l12-7L7 5Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  flag: 'M6 21V4m0 1h11l-2 4 2 4H6',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.6 5.4-2 5.2-5.2 2 2-5.2 5.2-2Z',
  star: 'M12 3l2.4 5 5.6.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8 9.6 8 12 3Z',
  refresh: 'M20 11a8 8 0 0 0-14-4L4 9m0-5v5h5M4 13a8 8 0 0 0 14 4l2-2m0 5v-5h-5',
  download: 'M12 4v11m-5-4 5 5 5-5M5 20h14',
  upload: 'M12 16V5m-5 4 5-5 5 5M5 20h14',
  bookmark: 'M7 4h10a1 1 0 0 1 1 1v15l-6-3.6L6 20V5a1 1 0 0 1 1-1Z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
};

export type IconName = keyof typeof P;

export function Icon({ name, ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      <path d={P[name] ?? P.info} />
    </svg>
  );
}
