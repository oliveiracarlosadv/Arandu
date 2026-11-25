// Logotipo ARANDU: o "A" em forma de oca indígena (mesma geometria de scripts/logo-geometry.mjs).

import { useId } from 'react';

const ROOF = 'M50,22 C57.5,40 80,57 80,78 L20,78 C20,57 42.5,40 50,22Z';
const WINDOW = 'M50,38 L55.6,48.5 L44.4,48.5Z';
const DOOR = 'M42,78 V63 A8,8 0 0 1 58,63 V78Z';

export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0" stopColor="#053b2c" />
          <stop offset="1" stopColor="#0f9f6e" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill={`url(#g${id})`} />
      <g fill="#fff">
        <rect x="48.6" y="11" width="2.8" height="13" rx="1.4" />
        <path d={ROOF} />
        <rect x="15" y="81.5" width="70" height="3" rx="1.5" />
      </g>
      <path d={WINDOW} fill={`url(#g${id})`} />
      <path d={DOOR} fill={`url(#g${id})`} />
    </svg>
  );
}

export function Logo({ size = 30, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      {showWordmark && <span className="text-[15px] font-semibold tracking-[0.22em] text-ink-950 dark:text-white">ARANDU</span>}
    </span>
  );
}
