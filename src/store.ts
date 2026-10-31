import { create } from 'zustand';
import type { Echelon } from './data/types';

export type Selection =
  | { kind: 'unit'; id: string }
  | { kind: 'piece'; pid: string; ctrl: string; status: string }
  | { kind: 'person'; id: string };

export interface Layers {
  territory: boolean;
  fronts: boolean;
  units: boolean;
  arrows: boolean;
  rails: boolean;
  rivers: boolean;
  cities: boolean;
  portraits: boolean;
}

export interface FlyRequest {
  center: [number, number];
  zoom: number;
  token: number;
  duration?: number;
}

interface State {
  snapshot: string;
  selection: Selection | null;
  hoverUnit: string | null;
  layers: Layers;
  echelonMode: 'auto' | 'manual';
  echelons: Record<Echelon, boolean>;
  flagStyle: 'historical' | 'emblem';
  territoryStrength: 'light' | 'strong';
  panelOpen: boolean;
  tab: 'overview' | 'detail' | 'oob';
  playing: boolean;
  fly: FlyRequest | null;
  zoomK: number;
  setSnapshot: (d: string) => void;
  select: (s: Selection | null) => void;
  setHoverUnit: (id: string | null) => void;
  toggleLayer: (k: keyof Layers) => void;
  setEchelon: (e: Echelon, v: boolean) => void;
  setEchelonMode: (m: 'auto' | 'manual') => void;
  set: (p: Partial<State>) => void;
  flyTo: (center: [number, number], zoom: number, duration?: number) => void;
}

const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem('tk-prefs') ?? '{}');
  } catch {
    return {};
  }
})();

export const useStore = create<State>((set, get) => ({
  snapshot: '1941-10-27',
  selection: null,
  hoverUnit: null,
  layers: {
    territory: true, fronts: true, units: true, arrows: true, rails: true, rivers: true, cities: true, portraits: true,
    ...(saved.layers ?? {}),
  },
  echelonMode: 'auto',
  echelons: { AG: true, A: true, C: true, D: true },
  flagStyle: saved.flagStyle === 'emblem' ? 'emblem' : 'historical',
  territoryStrength: saved.territoryStrength === 'strong' ? 'strong' : 'light',
  panelOpen: true,
  tab: 'overview',
  playing: false,
  fly: null,
  zoomK: 1,
  setSnapshot: (d) => set({ snapshot: d, selection: null, hoverUnit: null, tab: 'overview' }),
  select: (s) => set({ selection: s, tab: s ? 'detail' : get().tab, panelOpen: s ? true : get().panelOpen }),
  setHoverUnit: (id) => set({ hoverUnit: id }),
  toggleLayer: (k) => set({ layers: { ...get().layers, [k]: !get().layers[k] } }),
  setEchelon: (e, v) => set({ echelons: { ...get().echelons, [e]: v }, echelonMode: 'manual' }),
  setEchelonMode: (m) => set({ echelonMode: m }),
  set: (p) => set(p),
  flyTo: (center, zoom, duration) =>
    set({ fly: { center, zoom, duration, token: (get().fly?.token ?? 0) + 1 } }),
}));

useStore.subscribe((s, p) => {
  if (s.layers !== p.layers || s.flagStyle !== p.flagStyle || s.territoryStrength !== p.territoryStrength) {
    try {
      localStorage.setItem('tk-prefs', JSON.stringify({ layers: s.layers, flagStyle: s.flagStyle, territoryStrength: s.territoryStrength }));
    } catch {
      /* storage unavailable */
    }
  }
});
