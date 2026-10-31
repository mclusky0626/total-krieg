"""Geometry helpers for authoring territory zones and front lines."""
from __future__ import annotations

import json
import math

from shapely.geometry import LineString, MultiPolygon, Polygon, box
from shapely.ops import unary_union
from shapely.validation import make_valid

from common import APP_DATA, km_to_deg, polys

_PLACES = None


def places():
    global _PLACES
    if _PLACES is None:
        _PLACES = json.load(open(APP_DATA / "places.json", encoding="utf-8"))
    return _PLACES


def pt(tok):
    """Resolve a waypoint token.

    - (lon, lat) tuple/list
    - "placekey"                      → that place
    - ("placekey", dx_km, dy_km)      → offset east/north in km
    """
    if isinstance(tok, str):
        p = places()[tok]
        return (p["lon"], p["lat"])
    if isinstance(tok, (tuple, list)) and len(tok) == 3 and isinstance(tok[0], str):
        p = places()[tok[0]]
        dlon, dlat = km_to_deg(1, p["lat"])
        return (p["lon"] + tok[1] * dlon, p["lat"] + tok[2] * dlat)
    return (float(tok[0]), float(tok[1]))


def pts(tokens):
    return [pt(t) for t in tokens]


def chaikin(coords, n=2, closed=False):
    """Corner-cutting smoothing so hand-authored lines look organic."""
    c = list(coords)
    for _ in range(n):
        out = []
        rng = range(len(c)) if closed else range(len(c) - 1)
        if not closed:
            out.append(c[0])
        for i in rng:
            p0, p1 = c[i], c[(i + 1) % len(c)]
            out.append((0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]))
            out.append((0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]))
        if not closed:
            out.append(c[-1])
        c = out
    return c


def fix(g):
    if g.is_empty:
        return g
    if not g.is_valid:
        g = make_valid(g)
    return unary_union([p for p in polys(g)]) if not isinstance(g, (Polygon, MultiPolygon)) else g


def poly(tokens, smooth=1):
    c = pts(tokens)
    if smooth:
        c = chaikin(c, smooth, closed=True)
    return fix(Polygon(c))


def side_of_line(tokens, side: str, far=None, smooth=2):
    """Polygon on one side of a north→south polyline.

    side='west' closes the polygon through `far` longitude west of the line,
    side='east' through `far` longitude east of it. The line must run from its
    northern end to its southern end and should begin/end in an area where the
    closing edges do not matter (sea, neutral country or beyond the map).
    """
    c = pts(tokens)
    if smooth:
        c = chaikin(c, smooth)
    lat_n, lat_s = c[0][1], c[-1][1]
    if far is None:
        far = -40.0 if side == "west" else 90.0
    ring = c + [(far, lat_s), (far, lat_n)]
    return fix(Polygon(ring))


def line(tokens, smooth=2):
    c = pts(tokens)
    if smooth:
        c = chaikin(c, smooth)
    return LineString(c)


def circle(center, radius_km, n=32):
    lon, lat = pt(center)
    dlon, dlat = km_to_deg(radius_km, lat)
    return Polygon([(lon + dlon * math.cos(2 * math.pi * i / n), lat + dlat * math.sin(2 * math.pi * i / n)) for i in range(n)])


def bbox(w, s, e, n):
    return box(w, s, e, n)
