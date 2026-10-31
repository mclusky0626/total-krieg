import { useStore } from '../store';
import { SNAPSHOTS } from '../data/timeline';
import { scenarioForDate } from '../data/scenarios';
import { Search } from './Search';

export function TopBar() {
  const snapshot = useStore((s) => s.snapshot);
  const snap = SNAPSHOTS.find((s) => s.date === snapshot);
  const sc = scenarioForDate(snapshot);
  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo" aria-label="Total Krieg">
          <span className="logo-a">TOTAL</span>
          <span className="logo-b">KRIEG</span>
        </div>
        <div className="title-box">
          <div className="title-kicker">{sc ? sc.op : '유럽 전역 영토 변화'}</div>
          <div className="title-main">{sc ? sc.title : snap?.title}</div>
        </div>
      </div>
      <Search />
    </header>
  );
}
