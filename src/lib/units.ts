import type { Echelon, Scenario, Unit } from '../data/types';

export const ECH_LABEL: Record<Echelon, string> = {
  AG: '집단군·전선군',
  A: '군·기갑군',
  C: '군단',
  D: '사단·여단',
};

export const ECH_ORDER: Echelon[] = ['AG', 'A', 'C', 'D'];

/** Minimum zoom (k) at which an echelon appears in automatic mode. */
export const ECH_MIN_K: Record<Echelon, number> = { AG: 0, A: 0.95, C: 2.7, D: 5.2 };

export function isMobile(u: Unit) {
  return u.kind === 'pz' || u.kind === 'tank' || u.kind === 'mech' || u.kind === 'mot';
}

export interface Tree {
  byId: Map<string, Unit>;
  children: Map<string, Unit[]>;
  roots: Unit[];
}

export function buildTree(s: Scenario | null): Tree {
  const byId = new Map<string, Unit>();
  const children = new Map<string, Unit[]>();
  const roots: Unit[] = [];
  if (!s) return { byId, children, roots };
  s.units.forEach((u) => byId.set(u.id, u));
  s.units.forEach((u) => {
    if (u.parent && byId.has(u.parent)) {
      const arr = children.get(u.parent) ?? [];
      arr.push(u);
      children.set(u.parent, arr);
    } else roots.push(u);
  });
  return { byId, children, roots };
}

export function ancestors(tree: Tree, id: string): Unit[] {
  const out: Unit[] = [];
  let u = tree.byId.get(id);
  while (u?.parent) {
    const p = tree.byId.get(u.parent);
    if (!p) break;
    out.unshift(p);
    u = p;
  }
  return out;
}

export function descendants(tree: Tree, id: string): Set<string> {
  const out = new Set<string>();
  const walk = (x: string) => {
    for (const c of tree.children.get(x) ?? []) {
      out.add(c.id);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}

export function countDesc(tree: Tree, id: string) {
  return descendants(tree, id).size;
}
