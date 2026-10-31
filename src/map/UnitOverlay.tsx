import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Arrow, Echelon, Nat, Scenario, Unit } from '../data/types';
import { NAT_TINT } from '../data/controllers';
import { useStore } from '../store';
import { flagId } from '../components/Flags';
import { projectPos, type XY } from './geodata';
import { currentView, onView, unitRects, type View } from './viewBus';
import { arrowPath, smoothLine } from './arrows';
import { ancestors, buildTree, descendants, ECH_MIN_K, isMobile } from '../lib/units';
import { personById, portraitUrl } from '../lib/people';

const FLAG: Record<Echelon, [number, number]> = { AG: [54, 36], A: [42, 28], C: [30, 20], D: [26, 17] };
const FONT: Record<Echelon, number> = { AG: 13, A: 12, C: 11, D: 10 };

let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(s: string, size: number, weight = 700) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return s.length * size * 0.8;
  measureCtx.font = `${weight} ${size}px "Noto Sans KR", system-ui, sans-serif`;
  return measureCtx.measureText(s).width;
}

interface Geo {
  u: Unit;
  xy: XY;
  /** marker bbox relative to anchor (left, top, right, bottom), without / with portrait */
  box: [number, number, number, number];
  boxP: [number, number, number, number] | null;
  lw: number;
}

function markerGeometry(u: Unit, withPortrait: boolean): Geo['box'] & { lw?: number } {
  const [fw, fh] = mobileSize(u) ?? FLAG[u.ech];
  const fs = FONT[u.ech];
  const lw = textWidth(u.label, fs) + 10;
  const lh = fs + 6;
  const left = Math.min(-fw / 2, -lw / 2) - (withPortrait ? 34 : 0);
  const right = Math.max(fw / 2, lw / 2);
  return [left, -fh / 2, right, fh / 2 + lh];
}

function mobileSize(u: Unit): [number, number] | null {
  if (!isMobile(u) || u.ech === 'D' || u.ech === 'AG') return null;
  return u.ech === 'A' ? [56, 24] : [40, 17];
}

const TANK_PATH = 'M2,13.5h40a3.5,3.5 0 0 1 0,7h-40a3.5,3.5 0 0 1 0,-7ZM4,13L8.5,8H39.5L44,13ZM15.5,8L18,3.4H30L32.5,8ZM30.5,4.6H47.5V6.4H30.5Z';

function TankIcon({ nat, w, h }: { nat: Nat; w: number; h: number }) {
  const sov = nat === 'SOV';
  const west = ['USA', 'GBR', 'CAN', 'FFL', 'POL', 'AUS', 'NZL', 'SAF', 'IND'].includes(nat);
  const fill = sov ? '#34452b' : west ? '#4a4e36' : '#2b2f33';
  return (
    <svg x={-w / 2} y={-h / 2} width={w} height={h} viewBox="0 0 48 21" className="tank">
      <path d={TANK_PATH} fill={fill} stroke="#d9d6c8" strokeWidth="0.9" />
      {sov && <path d="M24,4.2l0.9,2.1h2.2l-1.8,1.3l0.7,2.1l-1.9,-1.3l-1.9,1.3l0.7,-2.1l-1.8,-1.3h2.2Z" fill="#e33" transform="translate(0,-0.6)" />}
      {nat === 'DEU' && <path d="M24,9.3v4.2M21.9,11.4h4.2" stroke="#fff" strokeWidth="1.8" />}
      {west && <path d="M24,9.6l0.8,1.9h2l-1.6,1.2l0.6,1.9l-1.8,-1.2l-1.8,1.2l0.6,-1.9l-1.6,-1.2h2Z" fill="#f4f1e6" />}
    </svg>
  );
}

function DivisionBox({ u }: { u: Unit }) {
  const [w, h] = FLAG.D;
  const k = u.kind ?? 'inf';
  const x0 = -w / 2, y0 = -h / 2;
  const X = <path d={`M${x0},${y0}L${-x0},${-y0}M${-x0},${y0}L${x0},${-y0}`} stroke="#111" strokeWidth="1.1" />;
  const oval = <ellipse cx="0" cy="0" rx={w * 0.32} ry={h * 0.26} fill="none" stroke="#111" strokeWidth="1.2" />;
  return (
    <g className="divbox">
      <rect x={x0} y={y0} width={w} height={h} fill={NAT_TINT[u.nat] ?? '#ccc'} stroke="#111" strokeWidth="1.3" />
      {(k === 'inf' || k === 'gds' || k === 'shock' || k === 'sec' || k === 'mtn' || k === 'abn' || k === 'fj' || k === 'mot' || k === 'ss' || k === 'mar') && X}
      {(k === 'pz' || k === 'tank' || k === 'mech' || k === 'mot') && oval}
      {k === 'cav' && <path d={`M${x0},${-y0}L${-x0},${y0}`} stroke="#111" strokeWidth="1.1" />}
      {(k === 'abn' || k === 'fj') && <path d={`M-5,${y0 + 4.5}q2.5,-3 5,0q2.5,-3 5,0`} fill="none" stroke="#111" strokeWidth="1" />}
      {k === 'mtn' && <path d={`M-3.5,${-y0 - 0.6}L0,${-y0 - 4.6}L3.5,${-y0 - 0.6}Z`} fill="#111" />}
      {k === 'art' && <circle r="2.6" fill="#111" />}
      {k === 'gds' && <text x="0" y={y0 - 2} textAnchor="middle" fontSize="7" fill="#f3d36a" stroke="#111" strokeWidth="2" paintOrder="stroke">G</text>}
      <svg x={x0 - 1} y={y0 - 9} width="12" height="8" viewBox="0 0 60 40" preserveAspectRatio="none">
        <use href={flagId(u.nat, false)} />
      </svg>
    </g>
  );
}

const UnitMarker = memo(function UnitMarker({ u, emblem, portrait, refCb }: {
  u: Unit; emblem: boolean; portrait: string | null; refCb: (el: SVGGElement | null) => void;
}) {
  const select = useStore((s) => s.select);
  const setHover = useStore((s) => s.setHoverUnit);
  const fly = useStore((s) => s.flyTo);
  const mob = mobileSize(u);
  const [fw, fh] = mob ?? FLAG[u.ech];
  const fs = FONT[u.ech];
  const lw = textWidth(u.label, fs) + 10;
  const lh = fs + 6;
  const ag = u.ech === 'AG';
  return (
    <g
      ref={refCb}
      className={`unit ech-${u.ech}`}
      data-id={u.id}
      style={{ display: 'none' }}
      onPointerEnter={() => setHover(u.id)}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: 'unit', id: u.id });
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        const [lon, lat] = (() => {
          const p = u.at;
          return typeof p === 'string' || typeof p[0] === 'string' ? [0, 0] : (p as [number, number]);
        })();
        if (lon || lat) fly([lon, lat], Math.max(currentView.k * 1.8, 5));
      }}
    >
      <g className="unit-body">
        {mob ? (
          <TankIcon nat={u.nat} w={fw} h={fh} />
        ) : u.ech === 'D' ? (
          <DivisionBox u={u} />
        ) : (
          <g className="flag-wrap">
            <rect x={-fw / 2 - 1} y={-fh / 2 - 1} width={fw + 2} height={fh + 2} fill="#0b0b0b" opacity="0.55" transform="translate(2,2.5)" />
            <svg x={-fw / 2} y={-fh / 2} width={fw} height={fh} viewBox="0 0 60 40" preserveAspectRatio="none">
              <use href={flagId(u.nat, emblem)} />
            </svg>
            <rect x={-fw / 2} y={-fh / 2} width={fw} height={fh} fill="none" stroke="#111" strokeWidth="1.2" />
          </g>
        )}
        <g className={`unit-label ${ag ? 'ag' : ''}`} transform={`translate(0,${fh / 2 + (u.ech === 'D' ? 1 : 0)})`}>
          <rect x={-lw / 2} y={0} width={lw} height={lh} rx="1.5" />
          <text x="0" y={lh - 5.5} textAnchor="middle" fontSize={fs}>{u.label}</text>
        </g>
        {portrait && (
          <g className="portrait" transform={`translate(${-Math.max(fw, lw) / 2 - 17},${-1})`}>
            <circle r="16" fill="#0d0d0d" />
            <clipPath id={`pc-${u.id}`}><circle r="14.5" /></clipPath>
            <image href={portrait} x="-14.5" y="-14.5" width="29" height="29" clipPath={`url(#pc-${u.id})`} preserveAspectRatio="xMidYMin slice" />
            <circle r="14.5" fill="none" stroke={ag ? '#e9a23b' : '#e8e2cf'} strokeWidth="1.6" />
          </g>
        )}
      </g>
    </g>
  );
});

function arrowColor(a: Arrow, theaterWest: boolean) {
  const n = a.nat;
  if (a.side === 'axis') return n === 'ITA' ? '#5fb3e8' : n === 'ROU' || n === 'HUN' ? '#7f9ce8' : '#2f8be6';
  if (n === 'SOV' || n === 'POL' || n === 'PLA') return '#e5483c';
  if (n) return '#f0a338';
  return theaterWest ? '#f0a338' : '#e5483c';
}

export function UnitOverlay({ scenario }: { scenario: Scenario | null }) {
  const layers = useStore((s) => s.layers);
  const emblem = useStore((s) => s.flagStyle === 'emblem');
  const selection = useStore((s) => s.selection);
  const hover = useStore((s) => s.hoverUnit);
  const echelonMode = useStore((s) => s.echelonMode);
  const echelons = useStore((s) => s.echelons);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    document.fonts?.ready.then(() => setFontsReady(true));
  }, []);

  const tree = useMemo(() => buildTree(scenario), [scenario]);
  const geos = useMemo<Geo[]>(() => {
    if (!scenario) return [];
    return scenario.units.map((u) => {
      const p = layers.portraits && (u.ech === 'AG' || u.ech === 'A') && u.cmd ? portraitUrl(u.cmd) : null;
      const box = markerGeometry(u, false) as Geo['box'];
      const boxP = p ? (markerGeometry(u, true) as Geo['box']) : null;
      return { u, xy: projectPos(u.at), box, boxP, lw: 0 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, layers.portraits, fontsReady]);

  const order = useMemo(() => {
    const rank: Record<Echelon, number> = { AG: 0, A: 1, C: 2, D: 3 };
    return [...geos].sort((a, b) => rank[a.u.ech] - rank[b.u.ech]);
  }, [geos]);
  const selIdRef = useRef<string | null>(null);

  const selId = selection?.kind === 'unit' ? selection.id : null;
  const related = useMemo(() => {
    if (!selId) return null;
    const s = descendants(tree, selId);
    s.add(selId);
    ancestors(tree, selId).forEach((a) => s.add(a.id));
    return s;
  }, [tree, selId]);

  const refs = useRef(new Map<string, SVGGElement>());
  const arrowRefs = useRef<(SVGPathElement | null)[]>([]);
  const gradRefs = useRef<(SVGLinearGradientElement | null)[]>([]);
  const tipRef = useRef<HTMLDivElement>(null);

  const arrowsWorld = useMemo(
    () => (scenario?.arrows ?? []).map((a) => ({ a, pts: a.pts.map((p) => projectPos(p)) })),
    [scenario],
  );
  const theaterWest = scenario?.theater === 'west' || scenario?.theater === 'africa';

  useEffect(() => {
    const camK = scenario?.camera.zoom ?? 1;
    const update = (v: View) => {
      const { k, x, y, w, h } = v;
      // units
      const placed: [number, number, number, number][] = [];
      const seq = selId || hover ? [...order].sort((a, b) => (+(b.u.id === selId || b.u.id === hover)) - (+(a.u.id === selId || a.u.id === hover))) : order;
      selIdRef.current = selId;
      for (const g of seq) {
        const el = refs.current.get(g.u.id);
        if (!el) continue;
        const forced = g.u.id === selId || g.u.id === hover;
        const echOn = echelonMode === 'auto' ? k >= ECH_MIN_K[g.u.ech] : echelons[g.u.ech];
        if (!layers.units || (!echOn && !forced)) {
          el.style.display = 'none';
          continue;
        }
        const sx = g.xy[0] * k + x, sy = g.xy[1] * k + y;
        if (sx < -120 || sy < -80 || sx > w + 120 || sy > h + 80) {
          el.style.display = 'none';
          continue;
        }
        const withP = !!g.boxP && (g.u.ech === 'AG' || k >= 2.2 || forced);
        const b = withP ? g.boxP! : g.box;
        const r: [number, number, number, number] = [sx + b[0], sy + b[1], sx + b[2], sy + b[3]];
        if (!forced && g.u.ech !== 'AG') {
          const pad = g.u.ech === 'A' ? 6 : 2;
          const hit = placed.some((o) => r[0] < o[2] - pad && r[2] > o[0] + pad && r[1] < o[3] - pad && r[3] > o[1] + pad);
          if (hit) {
            el.style.display = 'none';
            continue;
          }
        }
        if (g.boxP) el.classList.toggle('np', !withP);
        placed.push(r);
        el.style.display = '';
        el.setAttribute('transform', `translate(${sx.toFixed(1)},${sy.toFixed(1)})`);
      }
      unitRects.length = 0;
      for (const r of placed) unitRects.push(r);
      // arrows
      const vf = Math.min(1, Math.max(0.55, w / 1040));
      const f = Math.min(1.7, Math.max(0.5, Math.sqrt(k / (camK * vf)))) * (0.55 + 0.45 * vf);
      arrowsWorld.forEach(({ a, pts }, i) => {
        const el = arrowRefs.current[i];
        const gr = gradRefs.current[i];
        if (!el || !gr) return;
        if (!layers.arrows) {
          el.setAttribute('d', '');
          return;
        }
        const sp = pts.map((p) => [p[0] * k + x, p[1] * k + y] as XY);
        const wgt = a.w ?? 2;
        const res = arrowPath(smoothLine(sp), (2 + wgt * 1.6) * f, (5 + wgt * 3.4) * f);
        if (!res) {
          el.setAttribute('d', '');
          return;
        }
        el.setAttribute('d', res.d);
        gr.setAttribute('x1', String(res.tail[0]));
        gr.setAttribute('y1', String(res.tail[1]));
        gr.setAttribute('x2', String(res.head[0]));
        gr.setAttribute('y2', String(res.head[1]));
      });
      // tooltip
      const tip = tipRef.current;
      if (tip) {
        const g = hover ? geos.find((gg) => gg.u.id === hover) : null;
        if (g) {
          const sx = g.xy[0] * k + x, sy = g.xy[1] * k + y;
          tip.style.transform = `translate(${Math.min(w - 250, sx + g.box[2] + 10)}px, ${Math.max(8, sy + g.box[1])}px)`;
        }
      }
    };
    update(currentView);
    return onView(update);
  }, [order, arrowsWorld, layers, echelonMode, echelons, selId, hover, geos, scenario]);

  const hovered = hover ? tree.byId.get(hover) : null;
  const hp = hovered?.cmd ? personById(hovered.cmd) : null;

  return (
    <>
      <svg className="overlay-svg" width="100%" height="100%">
        <defs>
          {arrowsWorld.map(({ a }, i) => {
            const c = arrowColor(a, theaterWest);
            return (
              <linearGradient key={i} id={`ag-${i}`} gradientUnits="userSpaceOnUse" ref={(el) => (gradRefs.current[i] = el)}>
                <stop offset="0" stopColor={c} stopOpacity={a.kind === 'planned' ? 0.05 : 0.15} />
                <stop offset="0.55" stopColor={c} stopOpacity={a.kind === 'planned' ? 0.25 : 0.75} />
                <stop offset="1" stopColor={c} stopOpacity={a.kind === 'planned' ? 0.45 : 0.98} />
              </linearGradient>
            );
          })}
        </defs>
        <g className="arrows">
          {arrowsWorld.map(({ a }, i) => (
            <path
              key={i}
              ref={(el) => (arrowRefs.current[i] = el)}
              fill={`url(#ag-${i})`}
              stroke={a.kind === 'planned' ? arrowColor(a, theaterWest) : 'rgba(10,10,10,0.35)'}
              strokeWidth={a.kind === 'planned' ? 1.4 : 0.8}
              strokeDasharray={a.kind === 'planned' ? '5 4' : undefined}
              className={`arrow ${a.kind ?? 'attack'}`}
            />
          ))}
        </g>
        <g className={`units ${related ? 'has-sel' : ''}`}>
          {geos.map((g) => (
            <g key={g.u.id} className={`${related ? (related.has(g.u.id) ? 'rel' : 'dim') : ''} ${g.u.id === selId ? 'sel' : ''}`}>
              <UnitMarker
                u={g.u}
                emblem={emblem}
                portrait={layers.portraits && (g.u.ech === 'AG' || g.u.ech === 'A') && g.u.cmd ? portraitUrl(g.u.cmd) : null}
                refCb={(el) => {
                  if (el) refs.current.set(g.u.id, el);
                  else refs.current.delete(g.u.id);
                }}
              />
            </g>
          ))}
        </g>
      </svg>
      <div ref={tipRef} className="unit-tip" hidden={!hovered}>
        {hovered && (
          <>
            <div className="tip-name">{hovered.name}</div>
            {hovered.native && <div className="tip-native">{hovered.native}</div>}
            {hp && (
              <div className="tip-cmd">
                {portraitUrl(hp.id) && <img src={portraitUrl(hp.id)!} alt="" />}
                <span>
                  {hovered.rank ? `${hovered.rank} ` : ''}
                  <b>{hp.ko}</b>
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
