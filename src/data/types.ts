export type Side = 'axis' | 'allies' | 'neutral' | 'vichy' | 'pact';

/** Flag / nation code used for unit markers. */
export type Nat =
  | 'DEU' | 'ITA' | 'ROU' | 'HUN' | 'FIN' | 'SVK' | 'BGR' | 'HRV'
  | 'SOV' | 'GBR' | 'USA' | 'FRA' | 'FFL' | 'POL' | 'BEL' | 'NLD' | 'CAN' | 'GRC' | 'YUG' | 'NOR' | 'CSK'
  | 'AUS' | 'NZL' | 'SAF' | 'IND' | 'PLA';

/** AG = army group / Soviet front, A = army / panzer group, C = corps, D = division / brigade */
export type Echelon = 'AG' | 'A' | 'C' | 'D';

export type UnitKind =
  | 'inf' | 'pz' | 'mot' | 'mtn' | 'cav' | 'abn' | 'mech' | 'tank' | 'gds' | 'shock' | 'sec' | 'art' | 'fj' | 'ss' | 'mar';

/** [lon, lat] | place key | [place key, dx km east, dy km north] */
export type Pos = [number, number] | string | [string, number, number];

export interface Unit {
  id: string;
  nat: Nat;
  ech: Echelon;
  kind?: UnitKind;
  /** short label printed under the flag, e.g. "9군" */
  label: string;
  /** full Korean name, e.g. "독일 제9군" */
  name: string;
  /** original-language designation, e.g. "9. Armee" */
  native?: string;
  /** commander person id (src/data/people.json) */
  cmd?: string;
  /** commander's rank at this date */
  rank?: string;
  parent?: string;
  at: Pos;
  note?: string;
  /** strength / composition text */
  str?: string;
}

export interface Arrow {
  side: 'axis' | 'allies';
  pts: Pos[];
  kind?: 'attack' | 'planned' | 'counter' | 'retreat';
  label?: string;
  /** relative weight 1..3 */
  w?: number;
  nat?: Nat;
}

export interface Fact { k: string; v: string }

export interface Scenario {
  id: string;
  /** snapshot date this scenario belongs to (YYYY-MM-DD) */
  date: string;
  /** operation name, e.g. "태풍 작전" */
  op: string;
  title: string;
  /** banner text, e.g. "1941년 10월 27일 전황" */
  banner: string;
  theater: string;
  camera: { center: [number, number]; zoom: number };
  summary: string[];
  facts: Fact[];
  forces?: { axis: string; allies: string };
  outcome?: string;
  units: Unit[];
  arrows: Arrow[];
  /** cities drawn with an orange label box */
  keyCities?: string[];
  refs?: { t: string; u: string }[];
}

export interface Person {
  id: string;
  ko: string;
  en: string;
  native?: string;
  nat: string;
  born?: string;
  died?: string;
  bio?: string;
  /** English Wikipedia title used to fetch the portrait */
  wiki?: string;
  /** alternative wiki (lang:Title) if enwiki has no image */
  alt?: string;
}

export interface PortraitCredit {
  file: string;
  src: string;
  author?: string;
  license?: string;
  page?: string;
}
