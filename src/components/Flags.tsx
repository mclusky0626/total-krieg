import type { Nat } from '../data/types';
import { useStore } from '../store';

/**
 * Historical flags as reusable SVG <symbol>s (viewBox 60×40, 3:2 for every
 * nation so unit markers line up). Simplified for legibility at 24–64 px.
 */

const UJ = (
  <g>
    <rect width="60" height="40" fill="#012169" />
    <path d="M0,0L60,40M60,0L0,40" stroke="#fff" strokeWidth="8" />
    <path d="M0,0L60,40M60,0L0,40" stroke="#c8102e" strokeWidth="2.6" />
    <path d="M30,0V40M0,20H60" stroke="#fff" strokeWidth="12" />
    <path d="M30,0V40M0,20H60" stroke="#c8102e" strokeWidth="7" />
  </g>
);

function Canton({ children }: { children: React.ReactNode }) {
  return <g transform="scale(0.5)">{children}</g>;
}

const star5 = (cx: number, cy: number, r: number) => {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${p.join('L')}Z`;
};

const IRON_CROSS = 'M-1,-1L-2.3,-4.6L2.3,-4.6L1,-1L4.6,-2.3L4.6,2.3L1,1L2.3,4.6L-2.3,4.6L-1,1L-4.6,2.3L-4.6,-2.3Z';

function Hammer() {
  return (
    <g fill="none" stroke="#f6c90e" strokeLinecap="round">
      <path d={star5(0, -8.6, 2.2)} fill="none" strokeWidth="0.9" />
      <path d="M2.9,-3.4A4.4,4.4 0 1 1 -3.5,2.7" strokeWidth="1.5" />
      <path d="M-3.5,2.7L-5.1,4.5" strokeWidth="1.9" />
      <path d="M-2.4,-2.1L3.7,4.3" strokeWidth="1.4" />
      <path d="M-4.4,-0.8L-1.1,-4.0" strokeWidth="2.3" strokeLinecap="butt" />
    </g>
  );
}

const SYMBOLS: Record<string, React.ReactNode> = {
  DEU: (
    <g>
      <rect width="60" height="40" fill="#d0201d" />
      <path d="M0,20H60M26,0V40" stroke="#fff" strokeWidth="7.6" />
      <path d="M0,20H60M26,0V40" stroke="#111" strokeWidth="5" />
      <circle cx="26" cy="20" r="8.6" fill="#fff" stroke="#111" strokeWidth="1.3" />
      <g transform="translate(26,20) rotate(45)">
        <path d="M0,-4.4V4.4M-4.4,0H4.4M0,-4.4H4.4M4.4,0V4.4M0,4.4H-4.4M-4.4,0V-4.4" stroke="#111" strokeWidth="1.8"
          fill="none" strokeLinecap="square" />
      </g>
      <g transform="translate(9.5,8.5) scale(1.25)">
        <path d={IRON_CROSS} fill="#111" stroke="#fff" strokeWidth="0.9" paintOrder="stroke" />
      </g>
    </g>
  ),
  'DEU-alt': (
    <g>
      <rect width="60" height="40" fill="#59614f" />
      <path d="M30,6V34M14,20H46" stroke="#fff" strokeWidth="11" />
      <path d="M30,6V34M14,20H46" stroke="#111" strokeWidth="6.4" />
    </g>
  ),
  SOV: (
    <g>
      <rect width="60" height="40" fill="#cc1f1f" />
      <g transform="translate(17,19) scale(1.45)"><Hammer /></g>
    </g>
  ),
  GBR: UJ,
  USA: (
    <g>
      <rect width="60" height="40" fill="#fff" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={(i * 2 * 40) / 13} width="60" height={40 / 13} fill="#b22234" />
      ))}
      <rect width="26" height={(40 / 13) * 7} fill="#3c3b6e" />
      {Array.from({ length: 48 }, (_, i) => (
        <circle key={i} cx={2.2 + (i % 8) * 3.1} cy={2.1 + Math.floor(i / 8) * 3.55} r="0.75" fill="#fff" />
      ))}
    </g>
  ),
  FRA: (
    <g>
      <rect width="20" height="40" fill="#0055a4" />
      <rect x="20" width="20" height="40" fill="#fff" />
      <rect x="40" width="20" height="40" fill="#ef4135" />
    </g>
  ),
  FFL: (
    <g>
      <rect width="20" height="40" fill="#0055a4" />
      <rect x="20" width="20" height="40" fill="#fff" />
      <rect x="40" width="20" height="40" fill="#ef4135" />
      <path d="M30,8V33M26.5,13.5H33.5M24.5,18.5H35.5" stroke="#ef4135" strokeWidth="2.4" />
    </g>
  ),
  ITA: (
    <g>
      <rect width="20" height="40" fill="#009246" />
      <rect x="20" width="20" height="40" fill="#fff" />
      <rect x="40" width="20" height="40" fill="#ce2b37" />
      <path d="M24.5,12H35.5V22Q35.5,29 30,31.5Q24.5,29 24.5,22Z" fill="#ce2b37" stroke="#1c3f94" strokeWidth="1.4" />
      <path d="M30,13.5V29.5M25.6,19.5H34.4" stroke="#fff" strokeWidth="2.2" />
      <path d="M26,10.5L27,8L28.5,9.5L30,7L31.5,9.5L33,8L34,10.5Z" fill="#f2c94c" />
    </g>
  ),
  POL: (
    <g>
      <rect width="60" height="20" fill="#fff" />
      <rect y="20" width="60" height="20" fill="#dc143c" />
    </g>
  ),
  ROU: (
    <g>
      <rect width="20" height="40" fill="#002b7f" />
      <rect x="20" width="20" height="40" fill="#fcd116" />
      <rect x="40" width="20" height="40" fill="#ce1126" />
    </g>
  ),
  HUN: (
    <g>
      <rect width="60" height="13.4" fill="#cd2a3e" />
      <rect y="13.3" width="60" height="13.4" fill="#fff" />
      <rect y="26.6" width="60" height="13.4" fill="#436f4d" />
      <path d="M26,14H34V22Q34,27 30,28.5Q26,27 26,22Z" fill="#cd2a3e" stroke="#c9a227" strokeWidth="0.8" />
      <path d="M30,15.5V26M27.5,18.5H32.5" stroke="#fff" strokeWidth="1.2" />
    </g>
  ),
  FIN: (
    <g>
      <rect width="60" height="40" fill="#fff" />
      <path d="M21,0V40M0,20H60" stroke="#003580" strokeWidth="10" />
    </g>
  ),
  SVK: (
    <g>
      <rect width="60" height="13.4" fill="#fff" />
      <rect y="13.3" width="60" height="13.4" fill="#0b4ea2" />
      <rect y="26.6" width="60" height="13.4" fill="#ee1c25" />
      <path d="M14,9H25V21Q25,28 19.5,30.5Q14,28 14,21Z" fill="#ee1c25" stroke="#fff" strokeWidth="1.2" />
      <path d="M19.5,12V27M16.5,16H22.5M17.2,20H21.8" stroke="#fff" strokeWidth="1.3" />
    </g>
  ),
  BGR: (
    <g>
      <rect width="60" height="13.4" fill="#fff" />
      <rect y="13.3" width="60" height="13.4" fill="#00966e" />
      <rect y="26.6" width="60" height="13.4" fill="#d62612" />
    </g>
  ),
  HRV: (
    <g>
      <rect width="60" height="13.4" fill="#ff0000" />
      <rect y="13.3" width="60" height="13.4" fill="#fff" />
      <rect y="26.6" width="60" height="13.4" fill="#171796" />
      <path d="M24,10H36V22Q36,29 30,32Q24,29 24,22Z" fill="#fff" stroke="#171796" strokeWidth="0.8" />
      {Array.from({ length: 20 }, (_, i) => {
        const x = i % 5, y = Math.floor(i / 5);
        return (x + y) % 2 === 0 ? <rect key={i} x={24 + x * 2.4} y={10 + y * 2.6} width="2.4" height="2.6" fill="#e00" /> : null;
      })}
    </g>
  ),
  BEL: (
    <g>
      <rect width="20" height="40" fill="#111" />
      <rect x="20" width="20" height="40" fill="#fdda24" />
      <rect x="40" width="20" height="40" fill="#ef3340" />
    </g>
  ),
  NLD: (
    <g>
      <rect width="60" height="13.4" fill="#ae1c28" />
      <rect y="13.3" width="60" height="13.4" fill="#fff" />
      <rect y="26.6" width="60" height="13.4" fill="#21468b" />
    </g>
  ),
  CAN: (
    <g>
      <rect width="60" height="40" fill="#c8102e" />
      <Canton>{UJ}</Canton>
      <path d="M41,13H51V22Q51,28 46,30Q41,28 41,22Z" fill="#f4f0e0" stroke="#d4af37" strokeWidth="0.8" />
      <path d="M43,24Q46,20 49,24" stroke="#2e7d32" strokeWidth="1.4" fill="none" />
    </g>
  ),
  GRC: (
    <g>
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} y={(i * 40) / 9} width="60" height={40 / 9 + 0.1} fill={i % 2 ? '#fff' : '#0d5eaf'} />
      ))}
      <rect width="22.2" height={(40 / 9) * 5} fill="#0d5eaf" />
      <path d="M11.1,0V22.2M0,11.1H22.2" stroke="#fff" strokeWidth="4.4" />
    </g>
  ),
  YUG: (
    <g>
      <rect width="60" height="13.4" fill="#0c4076" />
      <rect y="13.3" width="60" height="13.4" fill="#fff" />
      <rect y="26.6" width="60" height="13.4" fill="#c6363c" />
    </g>
  ),
  PLA: (
    <g>
      <rect width="60" height="13.4" fill="#0c4076" />
      <rect y="13.3" width="60" height="13.4" fill="#fff" />
      <rect y="26.6" width="60" height="13.4" fill="#c6363c" />
      <path d={star5(30, 20.5, 10)} fill="#c6363c" stroke="#f6c90e" strokeWidth="1" />
    </g>
  ),
  NOR: (
    <g>
      <rect width="60" height="40" fill="#ba0c2f" />
      <path d="M22,0V40M0,20H60" stroke="#fff" strokeWidth="10" />
      <path d="M22,0V40M0,20H60" stroke="#00205b" strokeWidth="5" />
    </g>
  ),
  CSK: (
    <g>
      <rect width="60" height="20" fill="#fff" />
      <rect y="20" width="60" height="20" fill="#d7141a" />
      <path d="M0,0L30,20L0,40Z" fill="#11457e" />
    </g>
  ),
  AUS: (
    <g>
      <rect width="60" height="40" fill="#012169" />
      <Canton>{UJ}</Canton>
      <path d={star5(15, 31, 4.6)} fill="#fff" />
      <path d={star5(45, 33, 2.4)} fill="#fff" />
      <path d={star5(38, 19, 2.4)} fill="#fff" />
      <path d={star5(45, 8, 2.4)} fill="#fff" />
      <path d={star5(52, 17, 2.4)} fill="#fff" />
    </g>
  ),
  NZL: (
    <g>
      <rect width="60" height="40" fill="#012169" />
      <Canton>{UJ}</Canton>
      {[[45, 33], [38, 19], [45, 8], [52, 17]].map(([x, y], i) => (
        <path key={i} d={star5(x, y, 2.8)} fill="#c8102e" stroke="#fff" strokeWidth="0.7" />
      ))}
    </g>
  ),
  SAF: (
    <g>
      <rect width="60" height="13.4" fill="#ff7f00" />
      <rect y="13.3" width="60" height="13.4" fill="#fff" />
      <rect y="26.6" width="60" height="13.4" fill="#00247d" />
    </g>
  ),
  IND: (
    <g>
      <rect width="60" height="40" fill="#c8102e" />
      <Canton>{UJ}</Canton>
      <circle cx="45" cy="26" r="6.4" fill="#0b2a6b" stroke="#f6c90e" strokeWidth="1" />
      <path d={star5(45, 26, 4.2)} fill="#fff" />
    </g>
  ),
  ESP: (
    <g>
      <rect width="60" height="40" fill="#c60b1e" />
      <rect y="10" width="60" height="20" fill="#ffc400" />
    </g>
  ),
  DNK: (
    <g>
      <rect width="60" height="40" fill="#c8102e" />
      <path d="M21,0V40M0,20H60" stroke="#fff" strokeWidth="6" />
    </g>
  ),
  SWE: (
    <g>
      <rect width="60" height="40" fill="#006aa7" />
      <path d="M21,0V40M0,20H60" stroke="#fecc00" strokeWidth="7" />
    </g>
  ),
  TUR: (
    <g>
      <rect width="60" height="40" fill="#e30a17" />
      <circle cx="22" cy="20" r="9" fill="#fff" />
      <circle cx="24.4" cy="20" r="7.2" fill="#e30a17" />
      <path d={star5(33, 20, 4)} fill="#fff" transform="rotate(-18 33 20)" />
    </g>
  ),
  CHE: (
    <g>
      <rect width="60" height="40" fill="#da291c" />
      <path d="M30,10V30M20,20H40" stroke="#fff" strokeWidth="6" />
    </g>
  ),
  IRL: (
    <g>
      <rect width="20" height="40" fill="#169b62" />
      <rect x="20" width="20" height="40" fill="#fff" />
      <rect x="40" width="20" height="40" fill="#ff883e" />
    </g>
  ),
  PRT: (
    <g>
      <rect width="60" height="40" fill="#da291c" />
      <rect width="24" height="40" fill="#046a38" />
      <circle cx="24" cy="20" r="7" fill="#ffe900" stroke="#1d2b6b" strokeWidth="0.8" />
    </g>
  ),
};

export function FlagDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {Object.entries(SYMBOLS).map(([k, v]) => (
          <symbol key={k} id={`flag-${k}`} viewBox="0 0 60 40" preserveAspectRatio="none">
            {v}
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

export function flagId(nat: Nat | string, emblem: boolean) {
  if (nat === 'DEU' && emblem) return '#flag-DEU-alt';
  return `#flag-${SYMBOLS[nat] ? nat : 'FRA'}`;
}

/** Standalone flag for HTML contexts (panels, lists). */
export function Flag({ nat, w = 30, className }: { nat: Nat | string; w?: number; className?: string }) {
  const emblem = useStore((s) => s.flagStyle === 'emblem');
  return (
    <svg className={`flag ${className ?? ''}`} width={w} height={(w * 2) / 3} viewBox="0 0 60 40" aria-hidden="true">
      <use href={flagId(nat, emblem)} />
    </svg>
  );
}
