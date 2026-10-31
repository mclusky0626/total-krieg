import peopleData from '../data/people.json';
import portraitData from '../data/portraits.json';
import type { Person, PortraitCredit } from '../data/types';

const PEOPLE = peopleData as Person[];
const PORTRAITS = portraitData as Record<string, PortraitCredit>;
const BY_ID = new Map(PEOPLE.map((p) => [p.id, p]));

export function allPeople() {
  return PEOPLE;
}

export function personById(id: string): Person | null {
  return BY_ID.get(id) ?? null;
}

export function portraitUrl(id: string): string | null {
  const c = PORTRAITS[id];
  return c ? `./portraits/${c.file}` : null;
}

export function portraitCredit(id: string): PortraitCredit | null {
  return PORTRAITS[id] ?? null;
}
