// Step 1 of the relief build: compute, for every pixel of the output raster
// (in projected "world units"), the lon/lat it shows. build_relief.py then
// samples Natural Earth I shaded relief at those positions.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createProjection, AOI_BOUNDS } from '../src/map/projection.ts';

const proj = createProjection();
const [W, S, E, N] = AOI_BOUNDS;
// projected bounds of the AOI (sample its outline densely)
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
for (let i = 0; i <= 400; i++) {
  const t = i / 400;
  for (const p of [[W + (E - W) * t, S], [W + (E - W) * t, N], [W, S + (N - S) * t], [E, S + (N - S) * t]]) {
    const [x, y] = proj(p);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
}
const PX_PER_UNIT = Number(process.env.RELIEF_RES ?? 0.75);
const w = Math.ceil((x1 - x0) * PX_PER_UNIT), h = Math.ceil((y1 - y0) * PX_PER_UNIT);
const lon = new Float32Array(w * h), lat = new Float32Array(w * h);
for (let j = 0; j < h; j++) {
  for (let i = 0; i < w; i++) {
    const ll = proj.invert([x0 + (i + 0.5) / PX_PER_UNIT, y0 + (j + 0.5) / PX_PER_UNIT]);
    const k = j * w + i;
    lon[k] = ll ? ll[0] : NaN; lat[k] = ll ? ll[1] : NaN;
  }
}
mkdirSync('.cache/build', { recursive: true });
writeFileSync('.cache/build/relief_lon.f32', Buffer.from(lon.buffer));
writeFileSync('.cache/build/relief_lat.f32', Buffer.from(lat.buffer));
const meta = { width: w, height: h, bounds: [x0, y0, x1, y1], pxPerUnit: PX_PER_UNIT };
writeFileSync('.cache/build/relief_meta.json', JSON.stringify(meta));
console.log('relief grid', meta);
