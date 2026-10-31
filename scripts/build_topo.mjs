// Convert the GeoJSON layers produced by the Python scripts into quantized
// TopoJSON for the browser (shared arcs + delta encoding ≈ 3-5x smaller).
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { topology } from 'topojson-server';

const which = process.argv[2] ?? 'base';
const jobs = {
  base: ['.cache/build/base.geo.json', 'public/data/base.topo.json', 1e5],
  territories: ['.cache/build/territories.geo.json', 'public/data/territories.topo.json', 2e5],
};
const [src, dst, q] = jobs[which];
const layers = JSON.parse(readFileSync(src, 'utf8'));
const objects = {};
const extra = {};
for (const [k, v] of Object.entries(layers)) {
  if (v && v.type === 'FeatureCollection') objects[k] = v;
  else extra[k] = v;
}
const topo = topology(objects, q);
Object.assign(topo, extra);
writeFileSync(dst, JSON.stringify(topo));
console.log(`wrote ${dst} (${Math.round(statSync(dst).size / 1024)} KB)`);
