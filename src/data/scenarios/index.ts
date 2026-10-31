import type { Scenario } from '../types';
import { fallweiss } from './fallweiss';
import { fallgelb } from './fallgelb';
import { barbarossa } from './barbarossa';
import { typhoon } from './typhoon';
import { alamein } from './alamein';
import { uranus } from './uranus';
import { kursk } from './kursk';
import { overlord } from './overlord';
import { bagration } from './bagration';
import { bulge } from './bulge';
import { berlin } from './berlin';

export const SCENARIOS: Scenario[] = [fallweiss, fallgelb, barbarossa, typhoon, alamein, uranus, kursk, overlord, bagration, bulge, berlin];

const BY_DATE = new Map(SCENARIOS.map((s) => [s.date, s]));
const BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));

export function scenarioForDate(d: string): Scenario | null {
  return BY_DATE.get(d) ?? null;
}

export function scenarioById(id: string): Scenario | null {
  return BY_ID.get(id) ?? null;
}
