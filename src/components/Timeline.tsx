import { useMemo } from 'react';
import { useStore } from '../store';
import { SNAPSHOTS, snapshotIndex } from '../data/timeline';
import { scenarioForDate } from '../data/scenarios';

const T0 = Date.parse('1939-08-01');
const T1 = Date.parse('1945-06-01');
const pos = (d: string) => ((Date.parse(d) - T0) / (T1 - T0)) * 100;

export function Timeline() {
  const snapshot = useStore((s) => s.snapshot);
  const playing = useStore((s) => s.playing);
  const setSnapshot = useStore((s) => s.setSnapshot);
  const set = useStore((s) => s.set);
  const i = snapshotIndex(snapshot);
  const years = useMemo(() => [1940, 1941, 1942, 1943, 1944, 1945], []);
  return (
    <nav className="timeline" aria-label="연표">
      <div className="tl-buttons">
        <button type="button" className="icon-btn" aria-label="이전 시점" disabled={i <= 0}
          onClick={() => i > 0 && setSnapshot(SNAPSHOTS[i - 1].date)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>
        </button>
        <button type="button" className="icon-btn play" aria-label={playing ? '재생 정지' : '연표 재생'}
          onClick={() => {
            if (!playing && i >= SNAPSHOTS.length - 1) setSnapshot(SNAPSHOTS[0].date);
            set({ playing: !playing });
          }}>
          {playing ? (
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10" /></svg>
          ) : (
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.5v11l9-5.5z" className="fill" /></svg>
          )}
        </button>
        <button type="button" className="icon-btn" aria-label="다음 시점" disabled={i >= SNAPSHOTS.length - 1}
          onClick={() => i < SNAPSHOTS.length - 1 && setSnapshot(SNAPSHOTS[i + 1].date)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>
        </button>
      </div>
      <div className="tl-track">
        <div className="tl-line" />
        {years.map((y) => (
          <div key={y} className="tl-year" style={{ left: `${pos(`${y}-01-01`)}%` }}>
            <span>{y}</span>
          </div>
        ))}
        <div className="tl-progress" style={{ width: `${pos(snapshot)}%` }} />
        {SNAPSHOTS.map((s) => {
          const sc = scenarioForDate(s.date);
          const cur = s.date === snapshot;
          return (
            <button
              type="button"
              key={s.date}
              className={`tl-dot ${sc ? 'has-op' : ''} ${cur ? 'cur' : ''}`}
              style={{ left: `${pos(s.date)}%` }}
              aria-label={`${s.date} ${s.title}`}
              aria-current={cur ? 'step' : undefined}
              onClick={() => setSnapshot(s.date)}
            >
              <span className="tl-tip">
                <b>{s.date.replace(/-/g, '.')}</b> {s.title}
              </span>
            </button>
          );
        })}
      </div>
      <div className="tl-now">
        <span className="tl-date">{snapshot.replace(/-/g, '.')}</span>
        <span className="tl-title">{SNAPSHOTS[i]?.title}</span>
      </div>
    </nav>
  );
}
