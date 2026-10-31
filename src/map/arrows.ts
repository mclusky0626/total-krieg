import type { XY } from './geodata';

/** Catmull-Rom sample of a polyline through pts (screen space). */
export function smoothLine(pts: XY[], step = 6): XY[] {
  if (pts.length < 2) return pts;
  const out: XY[] = [];
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const seg = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(seg / step));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Tapered arrow polygon (SVG path d) for a centerline. */
export function arrowPath(line: XY[], w0: number, w1: number): { d: string; tail: XY; head: XY } | null {
  if (line.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const L = cum[cum.length - 1];
  if (L < 12) return null;
  const hl = Math.min(L * 0.45, Math.max(14, w1 * 2.6));
  const hw = w1 * 2.5;
  const shaftEnd = L - hl;
  const left: XY[] = [], right: XY[] = [];
  let lastI = 0;
  for (let i = 0; i < line.length; i++) {
    if (cum[i] > shaftEnd) break;
    lastI = i;
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    const w = (w0 + (w1 - w0) * (cum[i] / shaftEnd)) / 2;
    left.push([line[i][0] + nx * w, line[i][1] + ny * w]);
    right.push([line[i][0] - nx * w, line[i][1] - ny * w]);
  }
  const base = line[lastI];
  const tip = line[line.length - 1];
  let dx = tip[0] - base[0], dy = tip[1] - base[1];
  const dl = Math.hypot(dx, dy) || 1;
  dx /= dl; dy /= dl;
  const nx = -dy, ny = dx;
  const hb: XY = [tip[0] - dx * hl, tip[1] - dy * hl];
  const pts: XY[] = [
    ...left,
    [hb[0] + nx * (w1 / 2), hb[1] + ny * (w1 / 2)],
    [hb[0] + nx * (hw / 2), hb[1] + ny * (hw / 2)],
    tip,
    [hb[0] - nx * (hw / 2), hb[1] - ny * (hw / 2)],
    [hb[0] - nx * (w1 / 2), hb[1] - ny * (w1 / 2)],
    ...right.reverse(),
  ];
  const d = 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
  return { d, tail: line[0], head: tip };
}
