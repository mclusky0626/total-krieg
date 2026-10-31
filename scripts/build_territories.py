"""Territory-control snapshots 1939-1945 → .cache/build/territories.geo.json
(then `node scripts/build_topo.mjs territories`).

Pipeline per snapshot date:
  1. political baseline (annexations, occupations, puppet states)  territory/politics.py
  2. front-line zones (east / Finland / west / Italy / North Africa)  territory/fronts.py
  3. dissolve fragments by (piece, controller, status)
  4. front lines = shared borders between belligerent sides
"""
from __future__ import annotations

import pickle
import sys
import time

from shapely.geometry import LineString, MultiLineString, Polygon
from shapely.ops import linemerge, unary_union
from shapely.prepared import prep

from common import AOI, BUILD, feature, geodesic_area_km2, lines, polys, write_json
from territory import fronts as F
from territory.geo import fix, side_of_line, poly
from territory.pieces import build_pieces
from territory.politics import (LIB_SOV, LIB_SOV_PIECE, LIB_WEST, LIB_WEST_PIECE, axis_controllers, at_war,
                                baseline, side)

SNAPSHOTS = [
    "1939-09-01", "1939-10-06", "1940-05-10", "1940-06-25", "1941-02-10", "1941-06-22", "1941-10-27",
    "1941-12-05", "1942-10-23", "1942-11-19", "1943-07-05", "1943-12-31", "1944-06-06", "1944-06-22",
    "1944-09-15", "1944-12-16", "1945-04-16", "1945-05-08",
]

MIN_AREA = 1.5e-4


def U(gs):
    gs = [g for g in gs if g is not None and not g.is_empty]
    return fix(unary_union(gs)) if gs else Polygon()


class Zone:
    def __init__(self, geom, to, only_from=None, only_pieces=None, label=""):
        self.geom, self.to, self.only_from, self.only_pieces, self.label = fix(geom), to, only_from, only_pieces, label

    def target(self, pid, country, c, s, d):
        if self.only_from is not None and c not in self.only_from:
            return None
        if self.only_pieces is not None and pid not in self.only_pieces:
            return None
        return self.to


class Liberate(Zone):
    def __init__(self, geom, by, extra_from=None):
        super().__init__(geom, None)
        self.by, self.extra_from = by, extra_from or set()

    def target(self, pid, country, c, s, d):
        if c not in axis_controllers(d) | self.extra_from:
            return None
        if self.by == "sov":
            return LIB_SOV_PIECE.get(pid) or LIB_SOV.get(country) or ("SOV", "occupied")
        return LIB_WEST_PIECE.get(pid) or LIB_WEST.get(country) or ("WAL", "occupied")


def ops_for(d):
    ops = []
    axis_extra_pockets = [F.DODECANESE, F.WEST_CRETE] if d >= "1944-09-01" else []
    # ---------------- EAST
    if d in F.EAST:
        line = F.EAST[d]
        west, east = side_of_line(line, "west"), side_of_line(line, "east")
        sov_p, ax_p = [], []
        if d in ("1941-10-27", "1941-12-05", "1942-10-23", "1942-11-19"):
            sov_p += [F.LENINGRAD_41, F.ORANIENBAUM]
        if d in ("1943-07-05", "1943-12-31"):
            sov_p += [F.ORANIENBAUM]
        if d == "1941-12-05":
            sov_p += [F.SEVASTOPOL_41]
        if d == "1943-12-31":
            ax_p += [fix(F.CRIMEA.difference(F.KERCH_BRIDGEHEAD_43))]
        if d == "1944-09-15":
            sov_p += [F.circle("bratislava", 1) if False else poly([(18.6, 48.95), (19.6, 49.05), (20.1, 48.75),
                                                                       (19.8, 48.45), (19.0, 48.4), (18.5, 48.6)])]
        if d == "1944-12-16":
            ax_p += [F.COURLAND, F.MEMEL_44]
            sov_p += [poly([(14.9, 44.6), (15.4, 44.35), (16.0, 44.05), (16.6, 43.75), (17.2, 43.45), (17.6, 43.05),
                            (17.9, 42.85), (18.6, 42.4), (17.0, 42.0), (15.5, 42.8), (14.5, 44.0)], smooth=1)]
        if d == "1945-04-16":
            ax_p += [F.COURLAND, F.SAMLAND_45, F.HEL_VISTULA_45, F.BRESLAU_45]
        ax_p += axis_extra_pockets
        axis_area = U([fix(west.difference(U(sov_p)))] + ax_p)
        sov_area = fix(U([east] + sov_p).difference(U(ax_p)))
        ops.append(Zone(axis_area, ("DEU", "occupied"), only_from={"SOV"}, label="east-axis"))
        ops.append(Liberate(sov_area, "sov"))
    if d in F.FIN_ZONE:
        ops.append(Zone(F.FIN_ZONE[d], ("FIN", "occupied"), only_from={"SOV"}, label="finland"))
    if "1941-10-27" <= d < "1944-10-10":
        ops.append(Zone(F.ARCTIC_DE, ("DEU", "occupied"), only_from={"SOV"}))
    if d == "1944-09-15":
        ops.append(Zone(F.LAPLAND, ("DEU", "occupied"), only_from={"FIN"}))
    # ---------------- WEST
    if d in F.WEST:
        pockets = F.west_pockets(d)
        if d == "1945-04-16":
            pockets += [F.HOLLAND_45, F.RUHR_45]
        ops.append(Liberate(fix(side_of_line(F.WEST[d], "west").difference(U(pockets))), "west"))
    if d in ("1944-06-06", "1944-06-22"):
        ops.append(Liberate(U(F.normandy(d)), "west"))
    if d == "1945-05-08":
        ops.append(Liberate(side_of_line(F.VE_LINE, "west"), "west"))
        ops.append(Liberate(side_of_line(F.VE_LINE, "east"), "sov"))
        ops.append(Liberate(F.bbox(4, 54.4, 32, 72), "west"))
        ops.append(Zone(F.DODECANESE, ("GBR", "occupied")))
    # ---------------- ITALY
    if d in F.ITALY:
        ops.append(Liberate(side_of_line(F.ITALY[d], "south", far=20.0), "west"))
    # ---------------- NORTH AFRICA
    if d in F.NAF:
        ln = F.NAF[d]
        ops.append(Zone(side_of_line(ln, "west"), ("ITA", "occupied"), only_from={"GBR", "EGY"}, label="naf-axis"))
        ops.append(Liberate(side_of_line(ln, "east"), "west", extra_from={"ITA"}))
        if d in ("1941-06-22", "1941-10-27"):
            ops.append(Zone(F.TOBRUK, ("GBR", "occupied"), only_from={"ITA"}))
        if d == "1941-12-05":
            ops.append(Zone(F.BARDIA_POCKET_41, ("ITA", "colony"), only_from={"GBR"}))
    if d == "1942-11-19":
        ops.append(Zone(fix(F.bbox(7.5, 30.0, 12.0, 37.6).difference(F.AXIS_TUNISIA_42)), ("FRA", "colony"),
                        only_from={"DEU"}))
    # ---------------- misc
    if d == "1940-05-10":
        ops.append(Zone(F.NORTH_NORWAY, ("NOR", "core"), only_from={"DEU"}))
        ops.append(Zone(F.NARVIK, ("DEU", "occupied"), only_from={"NOR"}))
    if "1940-06-22" <= d < "1942-11-11":
        ops.append(Zone(poly([(7.38, 43.74), (7.55, 43.78), (7.6, 44.05), (7.4, 44.1)], smooth=0), ("ITA", "occupied"),
                        only_from={"VIC"}))
    if d == "1941-02-10":
        ops.append(Zone(F.GREEK_ALBANIA_41, ("GRC", "occupied"), only_from={"ITA"}))
    if "1940-06-30" <= d < "1945-05-09":
        ops.append(Zone(F.CHANNEL_ISLANDS, ("DEU", "occupied")))
    if d >= "1940-04-12":
        ops.append(Zone(F.FAROES, ("GBR", "occupied"), only_from={"DNK", "DEU"}))
    if d >= "1941-08-25":
        ops.append(Zone(F.IRAN_SOV, ("SOV", "occupied"), only_from={"IRN"}))
        ops.append(Zone(F.IRAN_GBR, ("GBR", "occupied"), only_from={"IRN"}))
    if d >= "1943-10-04":
        ops.append(Zone(F.CORSICA, ("FRA", "liberated"), only_from={"DEU", "ITA"}))
    if "1943-11-16" <= d < "1945-05-08":
        ops.append(Zone(F.DODECANESE, ("DEU", "occupied"), only_from={"ITA"}))
    if "1944-11-01" <= d < "1945-05-08":
        ops.append(Liberate(poly([(19.0, 42.6), (21.0, 42.7), (23.0, 41.6), (26.5, 41.8), (27.0, 40.0), (26.8, 34.5),
                                  (19.0, 37.0)], smooth=0), "west"))
        ops.append(Zone(F.WEST_CRETE, ("DEU", "occupied"), only_from={"GRC"}))
        ops.append(Zone(F.DODECANESE, ("DEU", "occupied"), only_from={"GRC", "ITA", "YUG"}))
    if "1944-10-25" <= d < "1945-05-08":
        ops.append(Zone(F.FINNMARK_E if d < "1945-02-01" else F.FINNMARK, ("NOR", "liberated"), only_from={"DEU"}))
    return ops


def post(frags, d):
    out = []
    for g, pid, c, s in frags:
        if pid == "ROU-BES" and c == "DEU":
            c, s = "ROU", "core"
        elif pid == "SOV-TRN" and c == "DEU":
            c, s = "ROU", "occupied"
        elif pid == "FIN-KAR" and c == "FIN":
            s = "annexed"
        out.append((g, pid, c, s))
    return out


def apply(frags, op, d, pieces):
    zp = prep(op.geom)
    out = []
    for g, pid, c, s in frags:
        tgt = op.target(pid, pieces[pid]["country"], c, s, d)
        if tgt is None or tgt == (c, s) or not zp.intersects(g):
            out.append((g, pid, c, s))
            continue
        if zp.contains(g):
            out.append((g, pid, tgt[0], tgt[1]))
            continue
        inside = fix(g.intersection(op.geom))
        outside = fix(g.difference(op.geom))
        if not inside.is_empty and inside.area > 1e-7:
            out.append((inside, pid, tgt[0], tgt[1]))
        if not outside.is_empty and outside.area > 1e-7:
            out.append((outside, pid, c, s))
    return out


def compute(d, pieces):
    S = baseline(pieces, d)
    frags = [(p["geom"], pid, *S[pid]) for pid, p in pieces.items()]
    for op in ops_for(d):
        frags = apply(frags, op, d, pieces)
    frags = post(frags, d)
    # dissolve by (pid, controller, status)
    groups = {}
    for g, pid, c, s in frags:
        groups.setdefault((pid, c, s), []).append(g)
    out = []
    for (pid, c, s), gs in groups.items():
        g = fix(unary_union(gs))
        ps = [p for p in polys(g) if p.area >= MIN_AREA]
        if not ps:
            continue
        out.append((fix(unary_union(ps)), pid, c, s))
    return out


def front_lines(feats, d):
    by_ctrl = {}
    for g, pid, c, s in feats:
        by_ctrl.setdefault(c, []).append(g)
    unions = {c: fix(unary_union(gs)) for c, gs in by_ctrl.items()}
    ctrls = sorted(unions)
    segs = []
    for i, a in enumerate(ctrls):
        for b in ctrls[i + 1:]:
            if not at_war(a, b, d):
                continue
            A, B = unions[a], unions[b]
            if not A.envelope.buffer(0.05).intersects(B.envelope):
                continue
            if A.distance(B) > 0.02:
                continue
            shared = A.boundary.intersection(B.buffer(0.012))
            for ln in lines(shared):
                if ln.length > 0.02:
                    segs.append(ln)
    if not segs:
        return []
    merged = linemerge(MultiLineString(segs)) if len(segs) > 1 else segs[0]
    return [ln.simplify(0.01) for ln in lines(merged) if ln.length > 0.05]


def main(only=None):
    t0 = time.time()
    P = build_pieces()
    pieces = P.p
    print(f"pieces: {len(pieces)} ({time.time() - t0:.1f}s)")
    out = {}
    meta = {"snapshots": [], "pieces": {pid: {"ko": p["ko"], "en": p["en"], "k": p["country"]} for pid, p in pieces.items()}}
    prewar_area = {pid: geodesic_area_km2(p["geom"]) for pid, p in pieces.items()}
    for d in SNAPSHOTS:
        if only and d not in only:
            continue
        t = time.time()
        feats = compute(d, pieces)
        fronts = front_lines(feats, d)
        area_ctrl, area_side = {}, {}
        for g, pid, c, s in feats:
            a = geodesic_area_km2(g)
            area_ctrl[c] = area_ctrl.get(c, 0) + a
            sd = side(c, d)
            area_side[sd] = area_side.get(sd, 0) + a
        key = d.replace("-", "")
        out[f"t{key}"] = {"type": "FeatureCollection", "features": [
            feature(g, {"p": pid, "c": c, "s": s}, nd=4) for g, pid, c, s in feats]}
        out[f"f{key}"] = {"type": "FeatureCollection", "features": [feature(ln, {}, nd=4) for ln in fronts]}
        meta["snapshots"].append({
            "id": d, "key": key,
            "area": {c: round(a) for c, a in sorted(area_ctrl.items(), key=lambda kv: -kv[1])},
            "sides": {k: round(v) for k, v in area_side.items()},
            "controllers": {c: side(c, d) for c in area_ctrl},
        })
        pickle.dump(feats, open(BUILD / f"terr_{key}.pkl", "wb"))
        print(f"  {d}: {len(feats)} features, {len(fronts)} front lines ({time.time() - t:.1f}s)")
    meta["prewarArea"] = {pid: round(a) for pid, a in prewar_area.items()}
    out["meta"] = meta
    write_json(BUILD / "territories.geo.json", out)


if __name__ == "__main__":
    main(set(sys.argv[1:]) or None)
