export interface View { k: number; x: number; y: number; w: number; h: number }
type Fn = (v: View) => void;

const subs = new Set<Fn>();
export let currentView: View = { k: 1, x: 0, y: 0, w: 1, h: 1 };

export function publishView(v: View) {
  currentView = v;
  subs.forEach((f) => f(v));
}

export function onView(f: Fn) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

/** Screen rectangles of the unit markers currently shown (written by UnitOverlay, read by the city-label pass). */
export const unitRects: [number, number, number, number][] = [];
