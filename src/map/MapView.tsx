import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import 'd3-transition';
import { easeCubicInOut } from 'd3-ease';
import { useStore } from '../store';
import { MapRenderer } from './renderer';
import { loadBase, loadRelief, project, TerritoryStore, type TerrFeature } from './geodata';
import { publishView } from './viewBus';
import { MapRendererHandle } from './handle';
import { UnitOverlay } from './UnitOverlay';
import { scenarioForDate } from '../data/scenarios';
import { controllerInfo, STATUS_LABEL } from '../data/controllers';
import { EUROPE_CAMERA, SNAPSHOTS } from '../data/timeline';

export const territories = new TerritoryStore();

export function MapView() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const frame = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; f: TerrFeature } | null>(null);

  const snapshot = useStore((s) => s.snapshot);
  const layers = useStore((s) => s.layers);
  const strong = useStore((s) => s.territoryStrength === 'strong');
  const selection = useStore((s) => s.selection);
  const fly = useStore((s) => s.fly);
  const scenario = useMemo(() => scenarioForDate(snapshot), [snapshot]);

  const requestDraw = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      rendererRef.current?.draw();
    });
  };

  // init renderer, zoom, data
  useEffect(() => {
    const wrap = wrapRef.current!, canvas = canvasRef.current!;
    const r = new MapRenderer(canvas);
    rendererRef.current = r;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      r.resize(rect.width, rect.height);
      publishView({ k: r.t.k, x: r.t.x, y: r.t.y, w: rect.width, h: rect.height });
      requestDraw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    const z = d3zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.28, 48])
      .filter((e: Event) => {
        const ev = e as MouseEvent;
        if (ev.type === 'dblclick' && (ev.target as Element).closest?.('.unit')) return false;
        return (!ev.ctrlKey || ev.type === 'wheel') && !ev.button;
      })
      .on('zoom', (ev: { transform: ZoomTransform }) => {
        r.t = ev.transform;
        publishView({ k: ev.transform.k, x: ev.transform.x, y: ev.transform.y, w: r.w, h: r.h });
        useStore.getState().zoomK !== ev.transform.k && useStore.setState({ zoomK: ev.transform.k });
        requestDraw();
      });
    zoomRef.current = z;
    const sel = select(wrap);
    sel.call(z);
    MapRendererHandle.zoomBy = (f: number) => {
      sel.transition().duration(350).call(z.scaleBy, f);
    };
    // initial camera
    const st = useStore.getState();
    const sc = scenarioForDate(st.snapshot);
    const cam = sc?.camera ?? SNAPSHOTS.find((s) => s.date === st.snapshot)?.camera ?? EUROPE_CAMERA;
    sel.call(z.transform, cameraTransform(cam.center, cam.zoom, r.w, r.h));

    let alive = true;
    Promise.all([loadBase(), territories.load()])
      .then(([base]) => {
        if (!alive) return;
        r.base = base;
        const [bx0, by0, bx1, by1] = base.bounds;
        z.translateExtent([
          [bx0 - 600, by0 - 400],
          [bx1 + 600, by1 + 400],
        ]);
        r.cur = territories.get(useStore.getState().snapshot.replace(/-/g, ''));
        setReady(true);
        requestDraw();
        loadRelief()
          .then(({ img, info }) => {
            r.relief = { img, bounds: info.bounds };
            requestDraw();
          })
          .catch(() => undefined);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      alive = false;
      ro.disconnect();
      sel.on('.zoom', null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // snapshot changes → crossfade territory + camera
  const firstSnap = useRef(true);
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !ready) return;
    const next = territories.get(snapshot.replace(/-/g, ''));
    if (firstSnap.current) {
      firstSnap.current = false;
      r.cur = next;
      const sc0 = scenarioForDate(snapshot);
      const cam0 = sc0?.camera ?? SNAPSHOTS.find((s) => s.date === snapshot)?.camera ?? EUROPE_CAMERA;
      if (zoomRef.current && wrapRef.current) {
        select(wrapRef.current).call(zoomRef.current.transform, cameraTransform(cam0.center, cam0.zoom, r.w, r.h));
      }
      requestDraw();
      return;
    }
    if (next && r.cur && next.key !== r.cur.key) {
      r.prev = r.cur;
      r.cur = next;
      r.fade = 0;
      const t0 = performance.now();
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const dur = reduce ? 1 : 650;
      const step = (t: number) => {
        r.fade = Math.min(1, (t - t0) / dur);
        r.draw();
        if (r.fade < 1) requestAnimationFrame(step);
        else r.prev = null;
      };
      requestAnimationFrame(step);
    }
    const sc = scenarioForDate(snapshot);
    const cam = sc?.camera ?? SNAPSHOTS.find((s) => s.date === snapshot)?.camera ?? EUROPE_CAMERA;
    useStore.getState().flyTo(cam.center, cam.zoom, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, ready]);

  // fly requests
  useEffect(() => {
    if (!fly || !zoomRef.current || !wrapRef.current || !rendererRef.current) return;
    const r = rendererRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    select(wrapRef.current)
      .transition()
      .duration(reduce ? 0 : fly.duration ?? 1100)
      .ease(easeCubicInOut)
      .call(zoomRef.current.transform, cameraTransform(fly.center, fly.zoom, r.w, r.h));
  }, [fly]);

  // render options
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.opts = {
      territory: layers.territory,
      fronts: layers.fronts,
      rails: layers.rails,
      rivers: layers.rivers,
      cities: layers.cities,
      strong,
      keyCities: scenario?.keyCities ?? [],
    };
    r.highlightPid = selection?.kind === 'piece' ? selection.pid : null;
    r.highlightCtrl = selection?.kind === 'piece' ? selection.ctrl : null;
    requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, strong, selection, scenario]);

  // territory click / hover
  useEffect(() => {
    const wrap = wrapRef.current!;
    let downAt: [number, number] | null = null;
    const onDown = (e: PointerEvent) => {
      downAt = [e.clientX, e.clientY];
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest('.unit')) return;
      if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
      const r = rendererRef.current;
      if (!r) return;
      const rect = wrap.getBoundingClientRect();
      const f = r.hitTest(e.clientX - rect.left, e.clientY - rect.top);
      const st = useStore.getState();
      if (f) st.select({ kind: 'piece', pid: f.pid, ctrl: f.c, status: f.s });
      else st.select(null);
    };
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = rendererRef.current;
        if (!r) return;
        if ((e.target as Element).closest?.('.unit')) {
          if (r.hoverPid) {
            r.hoverPid = null;
            requestDraw();
          }
          setHoverInfo(null);
          return;
        }
        const rect = wrap.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        const f = r.hitTest(x, y);
        if ((f?.pid ?? null) !== r.hoverPid) {
          r.hoverPid = f?.pid ?? null;
          requestDraw();
        }
        setHoverInfo(f ? { x, y, f } : null);
      });
    };
    const onLeave = () => {
      const r = rendererRef.current;
      if (r) {
        r.hoverPid = null;
        requestDraw();
      }
      setHoverInfo(null);
    };
    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('click', onClick);
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerleave', onLeave);
    return () => {
      wrap.removeEventListener('pointerdown', onDown);
      wrap.removeEventListener('click', onClick);
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerleave', onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pieces = territories.meta?.pieces;
  return (
    <div className="map-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="map-canvas" />
      <UnitOverlay scenario={scenario} />
      {hoverInfo && pieces && (
        <div className="terr-tip" style={{ transform: `translate(${hoverInfo.x + 14}px, ${hoverInfo.y + 12}px)` }}>
          <b>{pieces[hoverInfo.f.pid]?.ko ?? hoverInfo.f.pid}</b>
          <span>
            {controllerInfo(hoverInfo.f.c).ko} · {STATUS_LABEL[hoverInfo.f.s] ?? hoverInfo.f.s}
          </span>
        </div>
      )}
      {!ready && !error && <div className="map-loading">지도 데이터를 불러오는 중…</div>}
      {error && <div className="map-loading err">지도 데이터를 불러오지 못했습니다: {error}</div>}
    </div>
  );
}

/** Scenario cameras are tuned for a ~1040×760 map; scale them to the actual stage. */
export function viewportFactor(w: number, h: number) {
  return Math.min(1.3, Math.max(0.42, Math.min(w / 1040, (h - 64) / 740)));
}

export function cameraTransform(center: [number, number], k0: number, w: number, h: number) {
  const [x, y] = project(center[0], center[1]);
  const tlh = 64; // timeline rail overlaps the bottom of the stage
  const k = k0 * viewportFactor(w, h);
  return zoomIdentity.translate(w / 2 - x * k, (h - tlh) / 2 - y * k).scale(k);
}
