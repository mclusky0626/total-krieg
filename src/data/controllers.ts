import type { Nat, Side } from './types';

export interface ControllerInfo {
  ko: string;
  en: string;
  /** fill colour (hex) */
  color: string;
  flag?: Nat;
}

/**
 * Who controls a piece of territory. Colours: Axis = cool slate/blue family,
 * Allies = warm family (Soviet red, Western Allies amber/gold), neutrals = sand.
 */
export const CONTROLLERS: Record<string, ControllerInfo> = {
  DEU: { ko: '독일', en: 'Germany', color: '#3a4758', flag: 'DEU' },
  ITA: { ko: '이탈리아', en: 'Italy', color: '#3e6d8e', flag: 'ITA' },
  HUN: { ko: '헝가리', en: 'Hungary', color: '#5f7898', flag: 'HUN' },
  ROU: { ko: '루마니아', en: 'Romania', color: '#6c7aa6', flag: 'ROU' },
  BGR: { ko: '불가리아', en: 'Bulgaria', color: '#4f7d78', flag: 'BGR' },
  FIN: { ko: '핀란드', en: 'Finland', color: '#7b98b8', flag: 'FIN' },
  SVK: { ko: '슬로바키아', en: 'Slovakia', color: '#5d6f86', flag: 'SVK' },
  HRV: { ko: '크로아티아 독립국', en: 'Independent State of Croatia', color: '#56688a', flag: 'HRV' },
  VIC: { ko: '비시 프랑스', en: 'Vichy France', color: '#8b8f9e', flag: 'FRA' },
  SOV: { ko: '소련', en: 'Soviet Union', color: '#b8322a', flag: 'SOV' },
  GBR: { ko: '영국', en: 'United Kingdom', color: '#c97a2a', flag: 'GBR' },
  FRA: { ko: '프랑스', en: 'France', color: '#d1a23c', flag: 'FFL' },
  USA: { ko: '미국', en: 'United States', color: '#b9883a', flag: 'USA' },
  WAL: { ko: '서방 연합군 점령', en: 'Western Allied occupation', color: '#e0a03e', flag: 'USA' },
  POL: { ko: '폴란드', en: 'Poland', color: '#d98c8c', flag: 'POL' },
  CSK: { ko: '체코슬로바키아', en: 'Czechoslovakia', color: '#d4a96e', flag: 'CSK' },
  NOR: { ko: '노르웨이', en: 'Norway', color: '#d4a96e', flag: 'NOR' },
  DNK: { ko: '덴마크', en: 'Denmark', color: '#d4a96e' },
  NLD: { ko: '네덜란드', en: 'Netherlands', color: '#d4a96e', flag: 'NLD' },
  BEL: { ko: '벨기에', en: 'Belgium', color: '#d4a96e', flag: 'BEL' },
  LUX: { ko: '룩셈부르크', en: 'Luxembourg', color: '#d4a96e' },
  GRC: { ko: '그리스', en: 'Greece', color: '#d4a96e', flag: 'GRC' },
  YUG: { ko: '유고슬라비아', en: 'Yugoslavia', color: '#d4a96e', flag: 'YUG' },
  ALB: { ko: '알바니아', en: 'Albania', color: '#d4a96e' },
  EGY: { ko: '이집트', en: 'Egypt', color: '#cfae7c' },
  IRQ: { ko: '이라크', en: 'Iraq', color: '#cfae7c' },
  IRN: { ko: '이란', en: 'Iran', color: '#b9b29a' },
  EST: { ko: '에스토니아', en: 'Estonia', color: '#b9b29a' },
  LVA: { ko: '라트비아', en: 'Latvia', color: '#b9b29a' },
  LTU: { ko: '리투아니아', en: 'Lithuania', color: '#b9b29a' },
};

export const NEUTRAL_COLOR = '#b9b29a';

export function controllerInfo(c: string): ControllerInfo {
  return CONTROLLERS[c] ?? { ko: c, en: c, color: NEUTRAL_COLOR };
}

export const SIDE_LABEL: Record<Side, string> = {
  axis: '추축국',
  allies: '연합국',
  neutral: '중립국',
  vichy: '비시 정권',
  pact: '독소 불가침 (비교전)',
};

export const STATUS_LABEL: Record<string, string> = {
  core: '본토',
  colony: '식민지·보호령',
  annexed: '병합',
  occupied: '군사 점령',
  protectorate: '보호령',
  client: '괴뢰·종속국',
  liberated: '해방 지역',
};

/** Mirrors scripts/territory/politics.py side() for the client. */
export function sideOf(c: string, d: string): Side {
  if (c === 'DEU' || c === 'HRV' || c === 'SVK') return 'axis';
  if (c === 'ITA') return d < '1940-06-10' ? 'neutral' : d < '1943-09-08' ? 'axis' : 'allies';
  if (c === 'HUN') return d < '1940-11-20' ? 'neutral' : 'axis';
  if (c === 'ROU') return d < '1940-11-23' ? 'neutral' : d < '1944-08-23' ? 'axis' : 'allies';
  if (c === 'BGR') return d < '1941-03-01' ? 'neutral' : d < '1944-09-09' ? 'axis' : 'allies';
  if (c === 'FIN') return d < '1941-06-25' ? 'neutral' : d < '1944-09-19' ? 'axis' : 'allies';
  if (c === 'VIC') return 'vichy';
  if (c === 'SOV') return d < '1941-06-22' ? 'pact' : 'allies';
  if (['GBR', 'FRA', 'POL', 'WAL', 'USA', 'CSK', 'ALB'].includes(c)) return 'allies';
  if (c === 'NOR' || c === 'DNK') return d < '1940-04-09' ? 'neutral' : 'allies';
  if (c === 'NLD' || c === 'BEL' || c === 'LUX') return d < '1940-05-10' ? 'neutral' : 'allies';
  if (c === 'GRC') return d < '1940-10-28' ? 'neutral' : 'allies';
  if (c === 'YUG') return d < '1941-04-06' ? 'neutral' : 'allies';
  if (c === 'EGY') return d < '1940-06-10' ? 'neutral' : 'allies';
  if (c === 'IRQ') return d < '1941-06-01' ? 'neutral' : 'allies';
  if (c === 'IRN') return d < '1941-08-25' ? 'neutral' : 'allies';
  return 'neutral';
}

/** Colours for unit symbols (division boxes, arrows) per nation. */
export const NAT_TINT: Record<Nat, string> = {
  DEU: '#9fb0c2', ITA: '#8fb7d6', ROU: '#a9b5e0', HUN: '#a6c3a2', FIN: '#b9d0ea', SVK: '#aab8cc', BGR: '#9fcfb8',
  HRV: '#a8b6d6', SOV: '#f08a7e', GBR: '#f2b27a', USA: '#e9c88a', FRA: '#9cc0f0', FFL: '#9cc0f0', POL: '#f3a7a7',
  BEL: '#f0d27a', NLD: '#f5b98a', CAN: '#f2a07a', GRC: '#9cc8f0', YUG: '#b8c4f0', NOR: '#f0a0a0', CSK: '#b8c8f0',
  AUS: '#f2b27a', NZL: '#f2b27a', SAF: '#f2c27a', IND: '#f2b27a', PLA: '#f08a7e',
};
