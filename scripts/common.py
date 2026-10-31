"""Shared helpers for the data build scripts.

All geodata is kept in WGS84 lon/lat. Projection to screen happens in the
browser (src/map/projection.ts) and in build_relief.mjs (same parameters).
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

from shapely.geometry import (
    GeometryCollection, LineString, MultiLineString, MultiPolygon, Polygon,
    box, mapping, shape,
)
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".cache" / "src"
BUILD = ROOT / ".cache" / "build"
PUBLIC_DATA = ROOT / "public" / "data"
APP_DATA = ROOT / "src" / "data"

# Area of interest (lon/lat). Covers Iberia → Caspian, North Cape → Sahara edge.
AOI_BOUNDS = (-14.0, 24.0, 62.0, 72.5)
AOI = box(*AOI_BOUNDS)

BUILD.mkdir(parents=True, exist_ok=True)
PUBLIC_DATA.mkdir(parents=True, exist_ok=True)


def load_geojson(path: Path | str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def polys(g):
    """Iterate polygons of a (multi)polygon / collection."""
    if g is None or g.is_empty:
        return
    if isinstance(g, Polygon):
        yield g
    elif isinstance(g, (MultiPolygon, GeometryCollection)):
        for p in g.geoms:
            yield from polys(p)


def lines(g):
    if g is None or g.is_empty:
        return
    if isinstance(g, LineString):
        yield g
    elif isinstance(g, (MultiLineString, GeometryCollection)):
        for p in g.geoms:
            yield from lines(p)


def as_multipolygon(g) -> MultiPolygon:
    ps = [p for p in polys(g) if not p.is_empty and p.area > 0]
    return MultiPolygon(ps)


def round_coords(obj, nd=3):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], nd), round(obj[1], nd)]
        return [round_coords(o, nd) for o in obj]
    return obj


def feature(geom, props: dict, nd=3) -> dict:
    m = mapping(geom)
    return {"type": "Feature", "properties": props,
            "geometry": {"type": m["type"], "coordinates": round_coords(m["coordinates"], nd)}}


def write_json(path: Path, data, compact=True):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        if compact:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"wrote {path.relative_to(ROOT)} ({os.path.getsize(path)/1024:.0f} KB)")


def km_to_deg(km: float, lat: float) -> tuple[float, float]:
    """(dlon, dlat) for a distance in km at a latitude."""
    return km / (111.32 * math.cos(math.radians(lat))), km / 110.57


def geodesic_area_km2(g) -> float:
    """Approximate area on the sphere via an equal-area (sinusoidal) transform."""
    from shapely.ops import transform
    R = 6371.0088

    def f(x, y, z=None):
        import numpy as np
        x = np.asarray(x); y = np.asarray(y)
        return (np.radians(x) * R * np.cos(np.radians(y)), np.radians(y) * R)
    return transform(f, g).area
