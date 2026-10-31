import { useEffect } from 'react';
import { FlagDefs } from './components/Flags';
import { MapView } from './map/MapView';
import { TopBar } from './components/TopBar';
import { Timeline } from './components/Timeline';
import { SidePanel } from './components/SidePanel';
import { MapControls } from './components/MapControls';
import { Legend } from './components/Legend';
import { DateBanner } from './components/DateBanner';
import { useStore } from './store';
import { SNAPSHOTS, snapshotIndex } from './data/timeline';
import { SCENARIOS } from './data/scenarios';

function useHashRouting() {
  useEffect(() => {
    const apply = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (!h) return;
      const sc = SCENARIOS.find((s) => s.id === h);
      const d = sc?.date ?? (h.startsWith('d') ? h.slice(1) : null);
      if (d && snapshotIndex(d) >= 0 && useStore.getState().snapshot !== d) useStore.getState().setSnapshot(d);
    };
    apply();
    window.addEventListener('hashchange', apply);
    const unsub = useStore.subscribe((s, p) => {
      if (s.snapshot === p.snapshot) return;
      const sc = SCENARIOS.find((x) => x.date === s.snapshot);
      const next = '#' + (sc ? sc.id : 'd' + s.snapshot);
      if (location.hash !== next) history.replaceState(null, '', next);
    });
    return () => {
      window.removeEventListener('hashchange', apply);
      unsub();
    };
  }, []);
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select')) return;
      const st = useStore.getState();
      const i = snapshotIndex(st.snapshot);
      if (e.key === 'ArrowRight' && i < SNAPSHOTS.length - 1) st.setSnapshot(SNAPSHOTS[i + 1].date);
      else if (e.key === 'ArrowLeft' && i > 0) st.setSnapshot(SNAPSHOTS[i - 1].date);
      else if (e.key === 'Escape') st.select(null);
      else if (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      } else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function usePlayback() {
  const playing = useStore((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const st = useStore.getState();
      const i = snapshotIndex(st.snapshot);
      if (i >= SNAPSHOTS.length - 1) st.set({ playing: false });
      else st.setSnapshot(SNAPSHOTS[i + 1].date);
    }, 3800);
    return () => window.clearInterval(id);
  }, [playing]);
}

export function App() {
  useHashRouting();
  useKeyboard();
  usePlayback();
  const panelOpen = useStore((s) => s.panelOpen);
  return (
    <div className={`app ${panelOpen ? 'panel-open' : 'panel-closed'}`}>
      <FlagDefs />
      <main className="stage">
        <MapView />
        <TopBar />
        <MapControls />
        <Legend />
        <DateBanner />
        <Timeline />
      </main>
      <SidePanel />
    </div>
  );
}
