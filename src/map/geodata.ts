import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Geometry, Position } from 'geojson';
import { createProjection } from './projection';
import places from '../data/places.json';
import type { Pos } from '../data/types';

export type XY = [number, number];
export type BBox = [number, number, number, number];

export const projection = createProjection();

export function project(lon: number, lat: number): XY {
  return projection([lon, lat]) as XY;
}

export interface Place { ko: string; en: string; lon: number; lat: number; rank: number; flags?: string }
export const PLACES = places as Record<string, Place>;

/** Resolve a Pos (lon/lat | place key | [key, dxKm, dyKm]) to lon/lat. */
export function resolvePos(p: Pos): [number, number] {
  if (typeof p === 'string') {
    const pl = PLACES[p];
    if (!pl) {
      console.warn('unknown place', p);
      return [0, 0];
    }
    return [pl.lon, pl.lat];
  }
  if (typeof p[0] === 'string') {
    const pl = PLACES[p[0] as string];
    if (!pl) {
      console.warn('unknown place', p[0]);
      return [0, 0];
    }
    const dx = p[1] as number, dy = p[2] as number;
    return [pl.lon + dx / (111.32 * Math.cos((pl.lat * Math.PI) / 180)), pl.lat + dy / 110.57];
  }
  return p as [number, number];
}

export function projectPos(p: Pos): XY {
  const [lon, lat] = resolvePos(p);
  return project(lon, lat);
}

function emptyBBox(): BBox {
  return [Infinity, Infinity, -Infinity, -Infinity];
}

function addRing(path: Path2D, ring: Position[], bb: BBox, close: boolean) {
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = project(ring[i][0], ring[i][1]);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
    if (x < bb[0]) bb[0] = x;
    if (y < bb[1]) bb[1] = y;
    if (x > bb[2]) bb[2] = x;
    if (y > bb[3]) bb[3] = y;
  }
  if (close) path.closePath();
}

export function geomToPath(g: Geometry | null, path = new Path2D(), bb = emptyBBox()): { path: Path2D; bbox: BBox } {
  if (!g) return { path, bbox: bb };
  switch (g.type) {
    case 'Polygon':
      g.coordinates.forEach((r) => addRing(path, r, bb, true));
      break;
    case 'MultiPolygon':
      g.coordinates.forEach((p) => p.forEach((r) => addRing(path, r, bb, true)));
      break;
    case 'LineString':
      addRing(path, g.coordinates, bb, false);
      break;
    case 'MultiLineString':
      g.coordinates.forEach((r) => addRing(path, r, bb, false));
      break;
    case 'GeometryCollection':
      g.geometries.forEach((gg) => geomToPath(gg, path, bb));
      break;
    default:
      break;
  }
  return { path, bbox: bb };
}

export interface BaseLayers {
  land: Path2D;
  sea: Path2D;
  lakes: Path2D;
  rivers: Path2D[]; // by class 0 (major) .. 3 (small)
  rails: Path2D[]; // by class 0 (main) .. 2 (minor)
  bounds: BBox;
}

export interface TerrFeature {
  pid: string;
  c: string;
  s: string;
  path: Path2D;
  bbox: BBox;
}

export interface SnapLayers {
  key: string;
  feats: TerrFeature[];
  ctrlBorders: Path2D;
  natBorders: Path2D;
  fronts: Path2D;
}

export interface TerritoryMeta {
  snapshots: { id: string; key: string; area: Record<string, number>; sides: Record<string, number>; controllers: Record<string, string> }[];
  pieces: Record<string, { ko: string; en: string; k: string }>;
  prewarArea: Record<string, number>;
}

export interface ReliefInfo { src: string; bounds: BBox; width: number; height: number }

const DATA = './data/';

async function getJSON<T>(name: string): Promise<T> {
  const r = await fetch(DATA + name);
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export async function loadBase(): Promise<BaseLayers> {
  const topo = await getJSON<Topology>('base.topo.json');
  const land = feature(topo, topo.objects.land as GeometryCollection);
  const landPath = new Path2D();
  const bounds = emptyBBox();
  land.features.forEach((f) => geomToPath(f.geometry, landPath, bounds));
  const pad = 4000;
  const sea = new Path2D();
  sea.rect(bounds[0] - pad, bounds[1] - pad, bounds[2] - bounds[0] + 2 * pad, bounds[3] - bounds[1] + 2 * pad);
  land.features.forEach((f) => geomToPath(f.geometry, sea));
  const lakes = new Path2D();
  feature(topo, topo.objects.lakes as GeometryCollection).features.forEach((f) => geomToPath(f.geometry, lakes));
  const rivers = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  feature(topo, topo.objects.rivers as GeometryCollection).features.forEach((f) => {
    const r = (f.properties as { r: number }).r;
    const cls = r <= 4 ? 0 : r <= 6 ? 1 : r <= 9 ? 2 : 3;
    geomToPath(f.geometry, rivers[cls]);
  });
  const rails = [new Path2D(), new Path2D(), new Path2D()];
  feature(topo, topo.objects.rails as GeometryCollection).features.forEach((f) => {
    const r = (f.properties as { r: number }).r;
    const cls = r <= 5 ? 0 : r <= 7 ? 1 : 2;
    geomToPath(f.geometry, rails[cls]);
  });
  return { land: landPath, sea, lakes, rivers, rails, bounds };
}

export class TerritoryStore {
  topo: Topology | null = null;
  meta: TerritoryMeta | null = null;
  private cache = new Map<string, SnapLayers>();

  async load() {
    const topo = await getJSON<Topology & { meta: TerritoryMeta }>('territories.topo.json');
    this.topo = topo;
    this.meta = topo.meta;
  }

  get(key: string): SnapLayers | null {
    if (!this.topo) return null;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const obj = this.topo.objects[`t${key}`] as GeometryCollection | undefined;
    if (!obj) return null;
    const fc = feature(this.topo, obj);
    const feats: TerrFeature[] = fc.features.map((f) => {
      const p = f.properties as { p: string; c: string; s: string };
      const { path, bbox } = geomToPath(f.geometry);
      return { pid: p.p, c: p.c, s: p.s, path, bbox };
    });
    const pieces = this.meta?.pieces ?? {};
    type GP = { properties: { p: string; c: string } };
    const ctrl = mesh(this.topo, obj, (a, b) => a !== b && (a as unknown as GP).properties.c !== (b as unknown as GP).properties.c);
    const nat = mesh(this.topo, obj, (a, b) => {
      if (a === b) return false;
      const pa = (a as unknown as GP).properties, pb = (b as unknown as GP).properties;
      return pa.c === pb.c && pieces[pa.p]?.k !== pieces[pb.p]?.k;
    });
    const frontsObj = this.topo.objects[`f${key}`] as GeometryCollection | undefined;
    const fronts = new Path2D();
    if (frontsObj) feature(this.topo, frontsObj).features.forEach((f) => geomToPath(f.geometry, fronts));
    const layers: SnapLayers = {
      key,
      feats,
      ctrlBorders: geomToPath(ctrl).path,
      natBorders: geomToPath(nat).path,
      fronts,
    };
    this.cache.set(key, layers);
    return layers;
  }
}

export async function loadRelief(): Promise<{ img: HTMLImageElement; info: ReliefInfo }> {
  const info = await getJSON<ReliefInfo>('relief.json');
  const img = new Image();
  img.decoding = 'async';
  img.src = './' + info.src;
  await img.decode();
  return { img, info };
}
