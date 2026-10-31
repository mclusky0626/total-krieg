import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { scenarioForDate, SCENARIOS } from '../data/scenarios';
import { allPeople } from '../lib/people';
import { PLACES, resolvePos } from '../map/geodata';
import { Flag } from './Flags';
import { currentView } from '../map/viewBus';

interface Hit {
  kind: 'unit' | 'person' | 'place' | 'op';
  id: string;
  title: string;
  sub: string;
  nat?: string;
  run: () => void;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export function Search() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const snapshot = useStore((s) => s.snapshot);
  const inputRef = useRef<HTMLInputElement>(null);
  const sc = scenarioForDate(snapshot);

  const hits = useMemo<Hit[]>(() => {
    const n = norm(q);
    if (n.length < 1) return [];
    const st = useStore.getState();
    const out: Hit[] = [];
    for (const u of sc?.units ?? []) {
      if (norm(u.label + u.name + (u.native ?? '')).includes(n)) {
        out.push({
          kind: 'unit', id: u.id, title: u.name, sub: u.native ?? '', nat: u.nat,
          run: () => {
            st.select({ kind: 'unit', id: u.id });
            st.flyTo(resolvePos(u.at), Math.max(currentView.k, u.ech === 'D' ? 6 : u.ech === 'C' ? 3.5 : 2));
          },
        });
      }
    }
    for (const p of allPeople()) {
      if (norm(p.ko + p.en).includes(n)) {
        out.push({ kind: 'person', id: p.id, title: p.ko, sub: p.en, nat: p.nat, run: () => st.select({ kind: 'person', id: p.id }) });
      }
    }
    for (const s of SCENARIOS) {
      if (norm(s.op + s.title).includes(n)) {
        out.push({ kind: 'op', id: s.id, title: s.op, sub: s.banner, run: () => st.setSnapshot(s.date) });
      }
    }
    for (const [k, p] of Object.entries(PLACES)) {
      if (p.rank > 0 && norm(p.ko + p.en).includes(n)) {
        out.push({ kind: 'place', id: k, title: p.ko, sub: p.en, run: () => st.flyTo([p.lon, p.lat], Math.max(currentView.k, 3.2)) });
      }
    }
    return out.slice(0, 24);
  }, [q, sc]);

  const choose = (h: Hit) => {
    h.run();
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
  };
  const KIND: Record<Hit['kind'], string> = { unit: '부대', person: '인물', place: '지명', op: '작전' };

  return (
    <div className="search" role="search">
      <input
        id="search-input"
        ref={inputRef}
        type="search"
        value={q}
        placeholder="부대·지휘관·도시 검색  ( / )"
        autoComplete="off"
        aria-label="부대, 지휘관, 도시 검색"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(hits.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter' && hits[active]) choose(hits[active]);
          else if (e.key === 'Escape') {
            setQ('');
            inputRef.current?.blur();
          }
        }}
      />
      {open && q && (
        <ul className="search-results" role="listbox">
          {hits.length === 0 && <li className="empty">결과 없음 — 다른 철자나 원어 이름으로 찾아보세요</li>}
          {hits.map((h, i) => (
            <li
              key={h.kind + h.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(h);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="kind">{KIND[h.kind]}</span>
              {h.nat && <Flag nat={h.nat} w={18} />}
              <span className="t">{h.title}</span>
              <span className="s">{h.sub}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
