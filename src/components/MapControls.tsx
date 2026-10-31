import { useState } from 'react';
import { useStore, type Layers } from '../store';
import { scenarioForDate } from '../data/scenarios';
import { EUROPE_CAMERA, SNAPSHOTS } from '../data/timeline';
import { ECH_LABEL, ECH_MIN_K, ECH_ORDER } from '../lib/units';
import { MapRendererHandle } from '../map/handle';

const LAYER_LABEL: Record<keyof Layers, string> = {
  territory: '영토 색상',
  fronts: '전선',
  units: '부대',
  arrows: '공격 화살표',
  portraits: '지휘관 사진',
  cities: '도시',
  rivers: '하천',
  rails: '철도',
};

export function MapControls() {
  const [open, setOpen] = useState(false);
  const layers = useStore((s) => s.layers);
  const toggle = useStore((s) => s.toggleLayer);
  const flagStyle = useStore((s) => s.flagStyle);
  const strength = useStore((s) => s.territoryStrength);
  const echelonMode = useStore((s) => s.echelonMode);
  const echelons = useStore((s) => s.echelons);
  const setEchelon = useStore((s) => s.setEchelon);
  const set = useStore((s) => s.set);
  const zoomK = useStore((s) => s.zoomK);
  const snapshot = useStore((s) => s.snapshot);

  const zoomBy = (f: number) => MapRendererHandle.zoomBy(f);
  const reset = () => {
    const sc = scenarioForDate(snapshot);
    const cam = sc?.camera ?? SNAPSHOTS.find((s) => s.date === snapshot)?.camera ?? EUROPE_CAMERA;
    useStore.getState().flyTo(cam.center, cam.zoom, 900);
  };
  return (
    <div className="map-controls">
      <div className="ctrl-group" role="group" aria-label="확대·축소">
        <button type="button" className="icon-btn" aria-label="확대" onClick={() => zoomBy(1.6)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
        </button>
        <button type="button" className="icon-btn" aria-label="축소" onClick={() => zoomBy(1 / 1.6)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12" /></svg>
        </button>
        <button type="button" className="icon-btn" aria-label="작전 지역으로 돌아가기" onClick={reset}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="5.5" /><path d="M10 1.5v4M10 14.5v4M1.5 10h4M14.5 10h4" /></svg>
        </button>
        <button type="button" className="icon-btn" aria-label="유럽 전체 보기"
          onClick={() => useStore.getState().flyTo(EUROPE_CAMERA.center, EUROPE_CAMERA.zoom, 1100)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" /></svg>
        </button>
      </div>
      <div className="ctrl-group">
        <button type="button" className={`icon-btn ${open ? 'on' : ''}`} aria-expanded={open} aria-label="지도 레이어와 표시 설정"
          onClick={() => setOpen(!open)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3 2.5 7 10 11l7.5-4zM2.5 10.5 10 14.5l7.5-4M2.5 13.8 10 17.8l7.5-4" /></svg>
        </button>
      </div>
      {open && (
        <div className="layers-pop" role="dialog" aria-label="표시 설정">
          <h3>레이어</h3>
          <div className="chips">
            {(Object.keys(LAYER_LABEL) as (keyof Layers)[]).map((k) => (
              <label key={k} className={`chip ${layers[k] ? 'on' : ''}`}>
                <input type="checkbox" checked={layers[k]} onChange={() => toggle(k)} />
                {LAYER_LABEL[k]}
              </label>
            ))}
          </div>
          <h3>표시 제대</h3>
          <div className="seg">
            <button type="button" className={echelonMode === 'auto' ? 'on' : ''} onClick={() => set({ echelonMode: 'auto' })}>
              확대 수준에 따라 자동
            </button>
            <button type="button" className={echelonMode === 'manual' ? 'on' : ''} onClick={() => set({ echelonMode: 'manual' })}>
              직접 선택
            </button>
          </div>
          <div className="chips">
            {ECH_ORDER.map((e) => {
              const on = echelonMode === 'auto' ? zoomK >= ECH_MIN_K[e] : echelons[e];
              return (
                <label key={e} className={`chip ${on ? 'on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => setEchelon(e, !on)} />
                  {ECH_LABEL[e]}
                </label>
              );
            })}
          </div>
          <h3>영토 색상</h3>
          <div className="seg">
            <button type="button" className={strength === 'light' ? 'on' : ''} onClick={() => set({ territoryStrength: 'light' })}>지형 우선</button>
            <button type="button" className={strength === 'strong' ? 'on' : ''} onClick={() => set({ territoryStrength: 'strong' })}>영토 강조</button>
          </div>
          <h3>독일군 표기</h3>
          <div className="seg">
            <button type="button" className={flagStyle === 'historical' ? 'on' : ''} onClick={() => set({ flagStyle: 'historical' })}>당시 군기</button>
            <button type="button" className={flagStyle === 'emblem' ? 'on' : ''} onClick={() => set({ flagStyle: 'emblem' })}>발칸크로이츠</button>
          </div>
          <p className="fine">현재 배율 ×{zoomK.toFixed(1)} · 군단은 ×{ECH_MIN_K.C}, 사단은 ×{ECH_MIN_K.D}부터 표시</p>
        </div>
      )}
    </div>
  );
}
