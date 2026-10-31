import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { scenarioForDate, SCENARIOS } from '../data/scenarios';
import { formatDateKo, SNAPSHOTS } from '../data/timeline';
import { controllerInfo, sideOf, SIDE_LABEL, STATUS_LABEL } from '../data/controllers';
import { COUNTRIES } from '../data/countries';
import { territories } from '../map/MapView';
import { ancestors, buildTree, ECH_LABEL, type Tree } from '../lib/units';
import { personById } from '../lib/people';
import { resolvePos } from '../map/geodata';
import { currentView } from '../map/viewBus';
import type { Scenario, Side, Unit } from '../data/types';
import { Flag } from './Flags';
import { CommanderCard, Portrait } from './Commander';

const fmtKm = (n: number) => `${Math.round(n / 1000).toLocaleString('ko-KR')}천 km²`;

function flyToUnit(u: Unit) {
  const k = u.ech === 'D' ? 7 : u.ech === 'C' ? 4 : u.ech === 'A' ? 2.6 : 1.6;
  useStore.getState().flyTo(resolvePos(u.at), Math.max(currentView.k, k), 900);
}

export function SidePanel() {
  const open = useStore((s) => s.panelOpen);
  const tab = useStore((s) => s.tab);
  const set = useStore((s) => s.set);
  const snapshot = useStore((s) => s.snapshot);
  const selection = useStore((s) => s.selection);
  const sc = scenarioForDate(snapshot);
  const tree = useMemo(() => buildTree(sc), [sc]);
  const [sheet, setSheet] = useState<'peek' | 'full'>('peek');

  return (
    <aside className={`panel ${open ? 'open' : ''} sheet-${sheet}`} aria-label="상세 정보">
      <div className="panel-grip" onClick={() => setSheet(sheet === 'peek' ? 'full' : 'peek')} role="button" tabIndex={0}
        aria-label={sheet === 'peek' ? '패널 펼치기' : '패널 접기'}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSheet(sheet === 'peek' ? 'full' : 'peek')}>
        <span />
      </div>
      <div className="panel-tabs" role="tablist">
        {([['overview', '개요'], ['detail', '상세'], ['oob', '전투서열']] as const).map(([k, l]) => (
          <button type="button" key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''}
            disabled={k === 'oob' && !sc} onClick={() => set({ tab: k, panelOpen: true })}>
            {l}
            {k === 'detail' && selection && <span className="dot" />}
          </button>
        ))}
        <button type="button" className="panel-close icon-btn" aria-label={open ? '패널 닫기' : '패널 열기'}
          onClick={() => set({ panelOpen: !open })}>
          <svg viewBox="0 0 20 20" aria-hidden="true">{open ? <path d="M7 4.5 12.5 10 7 15.5" /> : <path d="M13 4.5 7.5 10l5.5 5.5" />}</svg>
        </button>
      </div>
      <div className="panel-body">
        {tab === 'overview' && <Overview sc={sc} tree={tree} />}
        {tab === 'detail' && <Detail sc={sc} tree={tree} />}
        {tab === 'oob' && sc && <Oob sc={sc} tree={tree} />}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ overview */

function SideBar({ snapshot }: { snapshot: string }) {
  const meta = territories.meta?.snapshots.find((s) => s.id === snapshot);
  if (!meta) return null;
  const order: Side[] = ['axis', 'vichy', 'pact', 'neutral', 'allies'];
  const total = Object.values(meta.sides).reduce((a, b) => a + b, 0);
  return (
    <section className="block">
      <h3 className="block-h">지도 범위 안의 지배 면적</h3>
      <div className="sidebar-bar" role="img" aria-label="진영별 면적 비율">
        {order.filter((s) => meta.sides[s]).map((s) => (
          <span key={s} className={`seg side-${s}`} style={{ flexGrow: meta.sides[s] }} title={`${SIDE_LABEL[s]} ${fmtKm(meta.sides[s])}`} />
        ))}
      </div>
      <ul className="side-legend">
        {order.filter((s) => meta.sides[s]).map((s) => (
          <li key={s}>
            <span className={`sw side-${s}`} />
            {SIDE_LABEL[s]} <b>{Math.round((meta.sides[s] / total) * 100)}%</b>
            <span className="muted"> {fmtKm(meta.sides[s])}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Overview({ sc, tree }: { sc: Scenario | null; tree: Tree }) {
  const snapshot = useStore((s) => s.snapshot);
  const snap = SNAPSHOTS.find((s) => s.date === snapshot)!;
  const select = useStore((s) => s.select);
  const tops = tree.roots.filter((u) => u.ech === 'AG' || u.ech === 'A');
  return (
    <div className="overview">
      <div className="eyebrow">{formatDateKo(snapshot)}{sc ? ` · ${sc.theater === 'east' ? '동부전선' : sc.theater === 'west' ? '서부전선' : sc.theater === 'africa' ? '북아프리카' : '유럽'}` : ''}</div>
      <h1 className="ov-title">{sc?.op ?? snap.title}</h1>
      {sc && <p className="ov-sub">{sc.title}</p>}
      <p className="ov-text">{snap.summary}</p>
      {sc?.summary.map((p, i) => <p key={i} className="ov-text">{p}</p>)}
      {sc && sc.facts.length > 0 && (
        <dl className="facts">
          {sc.facts.map((f) => (
            <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd></div>
          ))}
        </dl>
      )}
      {sc?.forces && (
        <section className="block forces">
          <div className="force axis"><div className="eyebrow">추축군</div><p>{sc.forces.axis}</p></div>
          <div className="force allies"><div className="eyebrow">연합군</div><p>{sc.forces.allies}</p></div>
        </section>
      )}
      {sc && tops.length > 0 && (
        <section className="block">
          <h3 className="block-h">주요 지휘부</h3>
          <ul className="top-units">
            {tops.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => { select({ kind: 'unit', id: u.id }); flyToUnit(u); }}>
                  {u.cmd ? <Portrait id={u.cmd} size="sm" /> : <span className="portrait-img ph sm" />}
                  <span className="tu-text">
                    <span className="tu-name"><Flag nat={u.nat} w={18} />{u.name}</span>
                    <span className="tu-cmd">{u.cmd ? `${u.rank ? u.rank + ' ' : ''}${personById(u.cmd)?.ko ?? ''}` : ''}</span>
                  </span>
                  <span className="tu-count">{tree.children.get(u.id)?.length ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <SideBar snapshot={snapshot} />
      {sc?.outcome && (
        <section className="block">
          <h3 className="block-h">결과</h3>
          <p className="ov-text">{sc.outcome}</p>
        </section>
      )}
      {!sc && <p className="hint">이 시점에는 부대 배치 자료가 없습니다. 지도에서 지역을 눌러 점령 상태를 확인하거나, 연표에서 노란 점(작전)을 선택하세요.</p>}
      {sc?.refs && (
        <section className="block refs">
          <h3 className="block-h">참고 자료</h3>
          <ul>{sc.refs.map((r) => <li key={r.u}><a href={r.u} target="_blank" rel="noreferrer">{r.t} ↗</a></li>)}</ul>
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- detail */

function Detail({ sc, tree }: { sc: Scenario | null; tree: Tree }) {
  const selection = useStore((s) => s.selection);
  if (!selection) return <p className="hint">지도에서 부대 깃발이나 지역을 누르면 여기에 자세한 정보가 표시됩니다.</p>;
  if (selection.kind === 'unit') {
    const u = tree.byId.get(selection.id);
    return u ? <UnitDetail u={u} tree={tree} /> : <p className="hint">이 시점에는 해당 부대가 없습니다.</p>;
  }
  if (selection.kind === 'person') return <PersonDetail id={selection.id} />;
  return <PieceDetail pid={selection.pid} ctrl={selection.ctrl} status={selection.status} sc={sc} />;
}

function UnitRow({ u, tree }: { u: Unit; tree: Tree }) {
  const select = useStore((s) => s.select);
  const setHover = useStore((s) => s.setHoverUnit);
  const p = u.cmd ? personById(u.cmd) : null;
  const n = tree.children.get(u.id)?.length ?? 0;
  return (
    <li>
      <button type="button" className="unit-row" onClick={() => { select({ kind: 'unit', id: u.id }); flyToUnit(u); }}
        onMouseEnter={() => setHover(u.id)} onMouseLeave={() => setHover(null)}>
        <Flag nat={u.nat} w={22} />
        <span className="ur-label">{u.label}</span>
        <span className="ur-name">{u.native ?? u.name}</span>
        <span className="ur-cmd">{p?.ko ?? ''}</span>
        {n > 0 && <span className="ur-n">{n}</span>}
      </button>
    </li>
  );
}

function UnitDetail({ u, tree }: { u: Unit; tree: Tree }) {
  const select = useStore((s) => s.select);
  const chain = ancestors(tree, u.id);
  const kids = tree.children.get(u.id) ?? [];
  return (
    <div className="unit-detail">
      {chain.length > 0 && (
        <nav className="crumbs" aria-label="지휘 계통">
          {chain.map((a) => (
            <button type="button" key={a.id} onClick={() => select({ kind: 'unit', id: a.id })}>{a.label}</button>
          ))}
          <span>{u.label}</span>
        </nav>
      )}
      <header className="ud-head">
        <Flag nat={u.nat} w={64} className="big" />
        <div>
          <div className="eyebrow">{ECH_LABEL[u.ech]}{u.kind && u.kind !== 'inf' ? ` · ${KIND_LABEL[u.kind] ?? ''}` : ''}</div>
          <h2 className="ud-name">{u.name}</h2>
          {u.native && <div className="ud-native">{u.native}</div>}
        </div>
      </header>
      {u.note && <p className="ov-text">{u.note}</p>}
      {u.str && <p className="ov-text muted">{u.str}</p>}
      {u.cmd ? <CommanderCard id={u.cmd} rank={u.rank} role="지휘관" /> : <p className="hint small">지휘관 정보 없음</p>}
      <div className="row-actions">
        <button type="button" className="btn" onClick={() => flyToUnit(u)}>지도에서 보기</button>
      </div>
      {kids.length > 0 && (
        <section className="block">
          <h3 className="block-h">예하 부대 {kids.length}</h3>
          <ul className="unit-list">{kids.map((k) => <UnitRow key={k.id} u={k} tree={tree} />)}</ul>
        </section>
      )}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  pz: '기갑', mot: '차량화', mtn: '산악', cav: '기병', abn: '공수', fj: '강하엽병', mech: '기계화', tank: '전차', gds: '근위',
  shock: '충격', sec: '경비', art: '포병', ss: '무장친위대', mar: '해병',
};

function PieceDetail({ pid, ctrl, status, sc }: { pid: string; ctrl: string; status: string; sc: Scenario | null }) {
  const snapshot = useStore((s) => s.snapshot);
  const meta = territories.meta;
  const piece = meta?.pieces[pid];
  const country = piece ? COUNTRIES[piece.k] : undefined;
  const ci = controllerInfo(ctrl);
  const side = sideOf(ctrl, snapshot);
  const snapMeta = meta?.snapshots.find((s) => s.id === snapshot);
  const area = snapMeta?.area[ctrl];
  const area39 = meta?.snapshots[0]?.area[ctrl];
  const myUnits = (sc?.units ?? []).filter((u) => (u.ech === 'AG' || u.ech === 'A') && (u.nat === ci.flag || (ctrl === 'SOV' && u.nat === 'SOV')));
  const tree = useMemo(() => buildTree(sc), [sc]);
  return (
    <div className="piece-detail">
      <header className="ud-head">
        {country?.flag ? <Flag nat={country.flag} w={64} className="big" /> : <span className="flag-ph" />}
        <div>
          <div className="eyebrow">선택한 지역 · {piece?.ko ?? pid}</div>
          <h2 className="ud-name">{country?.ko ?? piece?.ko}</h2>
          <div className="ud-native">{country?.en}</div>
        </div>
      </header>
      <div className="status-row">
        <span className="chip-static" style={{ ['--sw' as string]: ci.color }}>
          <span className="sw" />{ci.ko}
        </span>
        <span className="chip-static">{STATUS_LABEL[status] ?? status}</span>
        <span className={`chip-static side-${side}`}>{SIDE_LABEL[side]}</span>
      </div>
      {area && (
        <p className="ov-text small">
          {formatDateKo(snapshot)} 기준 <b>{ci.ko}</b> 지배 면적 {fmtKm(area)}
          {area39 ? ` (1939년 9월의 ${Math.round((area / area39) * 100)}%)` : ''} · 지도 범위 기준
        </p>
      )}
      {country && (
        <>
          <dl className="facts">
            {country.capital && <div><dt>수도</dt><dd>{country.capital}</dd></div>}
            {country.pop && <div><dt>인구</dt><dd>{country.pop}</dd></div>}
            {country.losses && <div><dt>전쟁 사망자</dt><dd>{country.losses}</dd></div>}
          </dl>
          <p className="ov-text">{country.summary}</p>
          {country.leaders && (
            <section className="block">
              <h3 className="block-h">지도자</h3>
              <ul className="leaders">
                {country.leaders.map((l, i) => (
                  <li key={i}>
                    {l.id ? <LeaderButton id={l.id} role={l.role} years={l.years} /> : (
                      <div className="leader"><span className="portrait-img ph sm">{l.name?.slice(0, 2)}</span><span><b>{l.name}</b><span className="muted"> {l.role} {l.years}</span></span></div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {country.events && (
            <section className="block">
              <h3 className="block-h">영토·정세 변화</h3>
              <ol className="events">
                {country.events.map(([d, t]) => (
                  <li key={d + t} className={d.replace(/\./g, '-') <= snapshot.slice(0, d.length) ? 'past' : ''}><span className="ev-d">{d}</span>{t}</li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
      {myUnits.length > 0 && (
        <section className="block">
          <h3 className="block-h">이 작전의 {ci.ko} 지휘부</h3>
          <ul className="unit-list">{myUnits.map((u) => <UnitRow key={u.id} u={u} tree={tree} />)}</ul>
        </section>
      )}
    </div>
  );
}

function LeaderButton({ id, role, years }: { id: string; role: string; years?: string }) {
  const select = useStore((s) => s.select);
  const p = personById(id);
  if (!p) return null;
  return (
    <button type="button" className="leader" onClick={() => select({ kind: 'person', id })}>
      <Portrait id={id} size="sm" />
      <span><b>{p.ko}</b><span className="muted"> {role}{years ? ` ${years}` : ''}</span></span>
    </button>
  );
}

function PersonDetail({ id }: { id: string }) {
  const setSnapshot = useStore((s) => s.setSnapshot);
  const commands = SCENARIOS.flatMap((s) => s.units.filter((u) => u.cmd === id).map((u) => ({ s, u })));
  return (
    <div className="person-detail">
      <CommanderCard id={id} />
      {commands.length > 0 && (
        <section className="block">
          <h3 className="block-h">지도에 나오는 지휘</h3>
          <ul className="unit-list">
            {commands.map(({ s, u }) => (
              <li key={s.id + u.id}>
                <button type="button" className="unit-row" onClick={() => {
                  setSnapshot(s.date);
                  setTimeout(() => {
                    useStore.getState().select({ kind: 'unit', id: u.id });
                  }, 60);
                }}>
                  <Flag nat={u.nat} w={22} />
                  <span className="ur-label">{u.label}</span>
                  <span className="ur-name">{s.op}</span>
                  <span className="ur-cmd">{s.date.replace(/-/g, '.')}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- OOB */

function Oob({ sc, tree }: { sc: Scenario; tree: Tree }) {
  const axis = tree.roots.filter((u) => ['DEU', 'ITA', 'ROU', 'HUN', 'FIN', 'SVK', 'BGR', 'HRV'].includes(u.nat));
  const allies = tree.roots.filter((u) => !axis.includes(u));
  return (
    <div className="oob">
      <p className="hint small">{sc.op} · {sc.banner} — 부대를 누르면 지도에서 위치와 지휘 계통이 강조됩니다.</p>
      <h3 className="block-h side-axis-h">추축군</h3>
      <ul className="tree">{axis.map((u) => <TreeNode key={u.id} u={u} tree={tree} depth={0} />)}</ul>
      <h3 className="block-h side-allies-h">연합군</h3>
      <ul className="tree">{allies.map((u) => <TreeNode key={u.id} u={u} tree={tree} depth={0} />)}</ul>
    </div>
  );
}

function TreeNode({ u, tree, depth }: { u: Unit; tree: Tree; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const kids = tree.children.get(u.id) ?? [];
  const select = useStore((s) => s.select);
  const setHover = useStore((s) => s.setHoverUnit);
  const selected = useStore((s) => s.selection?.kind === 'unit' && s.selection.id === u.id);
  const p = u.cmd ? personById(u.cmd) : null;
  return (
    <li>
      <div className={`tn ${selected ? 'sel' : ''}`} style={{ paddingLeft: depth * 14 }}>
        {kids.length > 0 ? (
          <button type="button" className="tn-tog" aria-expanded={open} aria-label={open ? '접기' : '펼치기'} onClick={() => setOpen(!open)}>
            {open ? '▾' : '▸'}
          </button>
        ) : <span className="tn-tog" />}
        <button type="button" className="tn-main" onClick={() => { select({ kind: 'unit', id: u.id }); flyToUnit(u); }}
          onMouseEnter={() => setHover(u.id)} onMouseLeave={() => setHover(null)}>
          <Flag nat={u.nat} w={20} />
          <span className="tn-label">{u.label}</span>
          <span className="tn-cmd">{p?.ko ?? ''}</span>
        </button>
      </div>
      {open && kids.length > 0 && (
        <ul>{kids.map((k) => <TreeNode key={k.id} u={k} tree={tree} depth={depth + 1} />)}</ul>
      )}
    </li>
  );
}
