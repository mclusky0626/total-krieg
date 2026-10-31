import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { controllerInfo, sideOf, SIDE_LABEL } from '../data/controllers';
import { territories } from '../map/MapView';
import type { Side } from '../data/types';

const SIDES: Side[] = ['axis', 'allies', 'pact', 'vichy', 'neutral'];

export function Legend() {
  const [open, setOpen] = useState(() => window.innerWidth > 1100 && window.innerHeight > 860);
  const snapshot = useStore((s) => s.snapshot);
  const zoomK = useStore((s) => s.zoomK);
  const groups = useMemo(() => {
    const meta = territories.meta?.snapshots.find((s) => s.id === snapshot);
    const out: Record<string, { c: string; area: number }[]> = {};
    if (!meta) return out;
    for (const [c, a] of Object.entries(meta.area)) {
      if (a < 2000) continue;
      const sd = sideOf(c, snapshot);
      (out[sd] ??= []).push({ c, area: a });
    }
    return out;
    // zoomK forces a refresh once territory metadata has loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, zoomK > 0]);

  return (
    <aside className={`legend ${open ? 'open' : ''}`} aria-label="범례">
      <button type="button" className="legend-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        범례 {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="legend-body">
          {SIDES.filter((s) => groups[s]?.length).map((s) => (
            <div key={s} className="lg-group">
              <div className={`lg-side side-${s}`}>{SIDE_LABEL[s]}</div>
              <ul>
                {groups[s].slice(0, s === 'neutral' ? 4 : 9).map(({ c }) => (
                  <li key={c}>
                    <span className="sw" style={{ background: controllerInfo(c).color }} />
                    {controllerInfo(c).ko}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="lg-group">
            <div className="lg-side">표시</div>
            <ul className="lg-sym">
              <li><span className="sw pat-solid" />본토·병합</li>
              <li><span className="sw pat-hatch" />군사 점령</li>
              <li><span className="sw pat-dots" />보호령·괴뢰국</li>
              <li><span className="sym-front" />전선</li>
              <li><span className="sym-arrow axis" />추축군 공격</li>
              <li><span className="sym-arrow allies" />연합군 공격</li>
              <li><svg width="22" height="14" viewBox="0 0 60 40" aria-hidden="true"><use href="#flag-DEU" /></svg>군·집단군 (국기)</li>
              <li><svg width="26" height="12" viewBox="0 0 48 21" aria-hidden="true"><path d="M2,13.5h40a3.5,3.5 0 0 1 0,7h-40a3.5,3.5 0 0 1 0,-7ZM4,13L8.5,8H39.5L44,13ZM15.5,8L18,3.4H30L32.5,8ZM30.5,4.6H47.5V6.4H30.5Z" fill="#2b2f33" stroke="#d9d6c8" /></svg>기갑·차량화 부대</li>
              <li><span className="sym-div">✕</span>사단 (보병 ✕ · 기갑 ⬭)</li>
            </ul>
          </div>
          <p className="lg-note">경계와 전선은 10–30 km 수준의 근사치입니다.</p>
        </div>
      )}
    </aside>
  );
}
