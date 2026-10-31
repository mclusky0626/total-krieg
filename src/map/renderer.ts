import type { ZoomTransform } from 'd3-zoom';
import { controllerInfo } from '../data/controllers';
import type { BaseLayers, SnapLayers, TerrFeature, XY } from './geodata';
import { PLACES, project } from './geodata';
import { unitRects } from './viewBus';

export interface RenderOptions {
  territory: boolean;
  fronts: boolean;
  rails: boolean;
  rivers: boolean;
  cities: boolean;
  strong: boolean;
  keyCities: string[];
}

const SEA = '#16242c';
const LAKE = '#1e313a';
const RIVER = '#6d93a6';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface CityLabel { key: string; xy: XY; ko: string; rank: number; cap: boolean }

export class MapRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  dpr = 1;
  w = 0;
  h = 0;
  t: ZoomTransform | { k: number; x: number; y: number } = { k: 1, x: 0, y: 0 };
  base: BaseLayers | null = null;
  relief: { img: HTMLImageElement; bounds: [number, number, number, number] } | null = null;
  cur: SnapLayers | null = null;
  prev: SnapLayers | null = null;
  fade = 1;
  highlightPid: string | null = null;
  highlightCtrl: string | null = null;
  hoverPid: string | null = null;
  opts: RenderOptions = { territory: true, fronts: true, rails: true, rivers: true, cities: true, strong: false, keyCities: [] };
  private patterns = new Map<string, CanvasPattern>();
  private cities: CityLabel[];
  private hitCtx: CanvasRenderingContext2D;

  /** last full-quality frame, reused (transformed) while the view is moving */
  private cache = document.createElement('canvas');
  private cacheT: { k: number; x: number; y: number } | null = null;
  private lastFull = 0;
  private idleTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.hitCtx = document.createElement('canvas').getContext('2d')!;
    this.cities = Object.entries(PLACES)
      .filter(([, p]) => p.rank > 0)
      .map(([key, p]) => ({ key, xy: project(p.lon, p.lat), ko: p.ko, rank: p.rank, cap: p.flags === 'cap' }))
      .sort((a, b) => a.rank - b.rank);
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.cache.width = this.canvas.width;
    this.cache.height = this.canvas.height;
    this.cacheT = null;
  }

  /**
   * Draw for a moving view: blit the cached frame with the relative transform and
   * schedule a crisp frame once motion pauses (or every ~220 ms during long glides).
   */
  drawMoving() {
    const now = performance.now();
    if (!this.cacheT || now - this.lastFull > 220) {
      this.draw(true);
      window.clearTimeout(this.idleTimer);
      this.idleTimer = window.setTimeout(() => this.draw(), 140);
      return;
    }
    const { ctx, dpr } = this;
    const c = this.cacheT;
    const s = this.t.k / c.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = SEA;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(this.cache, dpr * (this.t.x - c.x * s), dpr * (this.t.y - c.y * s), this.cache.width * s, this.cache.height * s);
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => this.draw(), 140);
  }

  /** screen → world */
  invert(sx: number, sy: number): XY {
    return [(sx - this.t.x) / this.t.k, (sy - this.t.y) / this.t.k];
  }

  hitTest(sx: number, sy: number): TerrFeature | null {
    if (!this.cur) return null;
    const [x, y] = this.invert(sx, sy);
    for (let i = this.cur.feats.length - 1; i >= 0; i--) {
      const f = this.cur.feats[i];
      const b = f.bbox;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (this.hitCtx.isPointInPath(f.path, x, y, 'evenodd')) return f;
    }
    return null;
  }

  private pattern(kind: 'hatch' | 'dots' | 'fine', color: string, alpha: number): CanvasPattern | null {
    const key = `${kind}|${color}|${alpha.toFixed(2)}`;
    let p = this.patterns.get(key);
    if (!p) {
      const s = kind === 'dots' ? 7 : kind === 'fine' ? 11 : 7;
      const c = document.createElement('canvas');
      c.width = c.height = s * 2;
      const g = c.getContext('2d')!;
      const [r, gg, b] = hexToRgb(color);
      g.strokeStyle = g.fillStyle = `rgba(${r},${gg},${b},${alpha})`;
      if (kind === 'dots') {
        g.beginPath();
        g.arc(s / 2, s / 2, 1.3, 0, Math.PI * 2);
        g.arc(s * 1.5, s * 1.5, 1.3, 0, Math.PI * 2);
        g.fill();
      } else {
        g.lineWidth = kind === 'fine' ? 1.2 : 2.4;
        g.beginPath();
        for (let o = -2 * s; o <= 4 * s; o += s) {
          g.moveTo(o, 2 * s);
          g.lineTo(o + 2 * s, 0);
        }
        g.stroke();
      }
      p = this.ctx.createPattern(c, 'repeat')!;
      this.patterns.set(key, p);
    }
    return p;
  }

  private territoryAlpha() {
    const k = this.t.k;
    const z = smooth(0.7, 5, k);
    return this.opts.strong ? 0.8 - 0.22 * z : 0.52 - 0.3 * z;
  }

  private drawTerritory(layer: SnapLayers, alphaMul: number, lite = false) {
    const ctx = this.ctx;
    const a = this.territoryAlpha() * alphaMul;
    const s = this.dpr * this.t.k;
    for (const f of layer.feats) {
      const info = controllerInfo(f.c);
      const [r, g, b] = hexToRgb(info.color);
      let fa = a;
      if (f.s === 'occupied') fa = a * 0.6;
      else if (f.s === 'colony' || f.s === 'client' || f.s === 'protectorate') fa = a * 0.75;
      else if (f.s === 'liberated') fa = a * 0.85;
      ctx.fillStyle = `rgba(${r},${g},${b},${fa})`;
      ctx.fill(f.path, 'evenodd');
      const kind = f.s === 'occupied' ? 'hatch' : f.s === 'client' || f.s === 'protectorate' ? 'dots' : f.s === 'annexed' ? 'fine' : null;
      if (kind && !lite) {
        const pat = this.pattern(kind, info.color, Math.min(1, a * (kind === 'fine' ? 1.1 : 1.6)));
        if (pat) {
          pat.setTransform(new DOMMatrix([1 / s, 0, 0, 1 / s, 0, 0]));
          ctx.fillStyle = pat;
          ctx.fill(f.path, 'evenodd');
        }
      }
    }
  }

  /** Full frame. `lite` skips the costly detail (hatching, rail ties, minor rivers) while the view moves. */
  draw(lite = false) {
    const { ctx, dpr } = this;
    const { k, x, y } = this.t;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = SEA;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.base) return;
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);
    const px = 1 / k; // one screen px in world units
    // relief
    if (this.relief) {
      const [bx0, by0, bx1, by1] = this.relief.bounds;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(this.relief.img, bx0, by0, bx1 - bx0, by1 - by0);
    }
    // territory
    if (this.opts.territory) {
      if (this.prev && this.fade < 1) {
        this.drawTerritory(this.prev, 1 - this.fade, lite);
        if (this.cur) this.drawTerritory(this.cur, this.fade, lite);
      } else if (this.cur) this.drawTerritory(this.cur, 1, lite);
    }
    // sea & lakes on top so coasts stay crisp
    ctx.fillStyle = SEA;
    ctx.fill(this.base.sea, 'evenodd');
    ctx.fillStyle = LAKE;
    ctx.fill(this.base.lakes, 'evenodd');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // coastline
    ctx.strokeStyle = 'rgba(6,12,16,0.75)';
    ctx.lineWidth = 0.9 * px;
    ctx.stroke(this.base.land);
    ctx.strokeStyle = 'rgba(120,150,160,0.18)';
    ctx.lineWidth = 2.6 * px;
    ctx.stroke(this.base.land);
    // rivers
    if (this.opts.rivers) {
      ctx.strokeStyle = RIVER;
      const rw = [1.5, 1.0, 0.8, 0.6];
      const rmin = [0, 1.1, 2.4, 4.5];
      for (let i = 0; i < (lite ? 2 : 4); i++) {
        if (k < rmin[i]) continue;
        ctx.globalAlpha = i === 0 ? 0.85 : 0.6 * smooth(rmin[i], rmin[i] * 1.6, k);
        ctx.lineWidth = rw[i] * px * (k > 4 ? 1.15 : 1);
        ctx.stroke(this.base.rivers[i]);
      }
      ctx.globalAlpha = 1;
    }
    // railways (cross-tie style)
    if (this.opts.rails && k > 1.6) {
      const ra = smooth(1.6, 2.6, k);
      const classes = k > 5 ? 3 : k > 3 ? 2 : 1;
      for (let i = 0; i < classes; i++) {
        ctx.globalAlpha = ra * (i === 0 ? 0.85 : 0.6);
        ctx.strokeStyle = '#26261f';
        ctx.lineWidth = (i === 0 ? 1.3 : 0.9) * px;
        ctx.setLineDash([]);
        ctx.stroke(this.base.rails[i]);
        if (lite) continue;
        ctx.lineWidth = (i === 0 ? 4.6 : 3.4) * px;
        ctx.setLineDash([1.1 * px, 5.5 * px]);
        ctx.stroke(this.base.rails[i]);
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    // borders
    if (this.cur && this.opts.territory) {
      ctx.strokeStyle = 'rgba(12,12,10,0.5)';
      ctx.lineWidth = 0.8 * px;
      ctx.setLineDash([4 * px, 3 * px]);
      ctx.stroke(this.cur.natBorders);
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(10,10,8,0.7)';
      ctx.lineWidth = 1.3 * px;
      ctx.stroke(this.cur.ctrlBorders);
      ctx.strokeStyle = 'rgba(235,225,200,0.16)';
      ctx.lineWidth = 3.2 * px;
      ctx.stroke(this.cur.ctrlBorders);
    }
    // highlight (selected piece / controller), hover
    if (this.cur) {
      if (this.highlightCtrl) {
        for (const f of this.cur.feats) {
          if (f.c !== this.highlightCtrl) continue;
          ctx.fillStyle = 'rgba(255,244,214,0.07)';
          ctx.fill(f.path, 'evenodd');
        }
      }
      for (const f of this.cur.feats) {
        const sel = f.pid === this.highlightPid;
        const hov = f.pid === this.hoverPid;
        if (!sel && !hov) continue;
        ctx.strokeStyle = sel ? 'rgba(255,236,170,0.95)' : 'rgba(255,255,255,0.55)';
        ctx.lineWidth = (sel ? 2.4 : 1.4) * px;
        ctx.stroke(f.path);
        if (sel) {
          ctx.fillStyle = 'rgba(255,236,170,0.10)';
          ctx.fill(f.path, 'evenodd');
        }
      }
    }
    // fronts (yellow dashed with dark casing, as on period staff maps)
    if (this.cur && this.opts.fronts) {
      const fw = clamp(1.6 + k * 0.35, 1.8, 3.4);
      ctx.strokeStyle = 'rgba(25,20,5,0.7)';
      ctx.lineWidth = (fw + 3) * px;
      ctx.stroke(this.cur.fronts);
      ctx.strokeStyle = '#f4d64a';
      ctx.lineWidth = fw * px;
      ctx.setLineDash([fw * 2.6 * px, fw * 1.9 * px]);
      ctx.stroke(this.cur.fronts);
      ctx.setLineDash([]);
    }
    // cities in screen space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.opts.cities) this.drawCities();
    // keep this frame for drawMoving()
    const cc = this.cache.getContext('2d');
    if (cc && this.cache.width === this.canvas.width) {
      cc.setTransform(1, 0, 0, 1, 0, 0);
      cc.drawImage(this.canvas, 0, 0);
      this.cacheT = { k, x, y };
    }
    this.lastFull = performance.now();
    if (!lite) window.clearTimeout(this.idleTimer);
  }

  private drawCities() {
    const { ctx } = this;
    const { k, x, y } = this.t;
    const maxRank = k < 0.55 ? 1 : k < 1.1 ? 2 : k < 2.6 ? 3 : 4;
    const occupied: [number, number, number, number][] = [];
    const key = new Set(this.opts.keyCities);
    const list = [...this.cities].sort((a, b) => (key.has(b.key) ? 1 : 0) - (key.has(a.key) ? 1 : 0) || a.rank - b.rank);
    for (const c of list) {
      const isKey = key.has(c.key);
      if (c.rank > maxRank && !isKey) continue;
      const sx = c.xy[0] * k + x, sy = c.xy[1] * k + y;
      if (sx < -40 || sy < -20 || sx > this.w + 40 || sy > this.h + 20) continue;
      const size = c.rank <= 1 ? 14 : c.rank === 2 ? 13 : 12;
      ctx.font = `${c.rank <= 2 || isKey ? 700 : 500} ${size}px "Noto Sans KR", system-ui, sans-serif`;
      const tw = ctx.measureText(c.ko).width;
      const lx = sx + 7, ly = sy - size / 2 - 1;
      const box: [number, number, number, number] = [sx - 5, ly - 2, lx + tw + 6, ly + size + 4];
      if (!isKey && occupied.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])) continue;
      if (c.rank > 1 && unitRects.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])) continue;
      occupied.push(box);
      // marker
      ctx.beginPath();
      if (c.cap) ctx.rect(sx - 4, sy - 4, 8, 8);
      else ctx.arc(sx, sy, c.rank <= 2 ? 3.6 : 2.8, 0, Math.PI * 2);
      ctx.fillStyle = isKey ? '#f39a2b' : '#f4f1e8';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#141414';
      ctx.stroke();
      if (isKey) {
        ctx.fillStyle = '#e8892b';
        ctx.fillRect(lx - 3, ly - 1, tw + 6, size + 4);
        ctx.fillStyle = '#1b1206';
        ctx.fillText(c.ko, lx, ly + size - 1);
      } else {
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = 'rgba(14,14,12,0.88)';
        ctx.strokeText(c.ko, lx, ly + size - 1);
        ctx.fillStyle = c.rank <= 2 ? '#fbf8ef' : '#e9e5d8';
        ctx.fillText(c.ko, lx, ly + size - 1);
      }
    }
  }
}
