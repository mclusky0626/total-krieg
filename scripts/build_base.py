"""Physical base layers: land, lakes, rivers, railways (Natural Earth, public domain).

Output: .cache/build/base.geojson.json  (converted to TopoJSON by build_topo.mjs)
"""
from shapely.geometry import shape
from shapely.ops import unary_union

from common import AOI, BUILD, SRC, feature, lines, load_geojson, polys, write_json

# Reservoirs that existed (or are natural lakes later dammed) in 1939-45.
KEEP_RESERVOIRS = {
    "Lake Il'Men'", "Ozero Kubenskoye", "Ivankovo Reservoir", "Lake Imandra",
    "Lake Kovdozero", "Oulujärvi", "Koitere", "Rikkavesi", "Mjøsa", "Ondozero",
    "Umbozero Lake", "Kemijärvi", "Stora Lulevatten", "Akkajaure",
}


def build_land():
    land = load_geojson(SRC / "ne_10m_land.geojson")
    parts = []
    for ft in land["features"]:
        g = shape(ft["geometry"])
        if not g.intersects(AOI):
            continue
        g = g.intersection(AOI)
        for p in polys(g):
            if p.area < 0.0015:
                continue
            parts.append(p.simplify(0.008, preserve_topology=True))
    return unary_union(parts)


def build_lakes():
    d = load_geojson(SRC / "ne_10m_lakes.geojson")
    out = []
    for ft in d["features"]:
        p = ft["properties"]
        g = shape(ft["geometry"])
        if not g.intersects(AOI) or g.area < 0.004:
            continue
        if p["featurecla"] == "Reservoir" and p["name"] not in KEEP_RESERVOIRS:
            continue
        g = g.intersection(AOI).simplify(0.006, preserve_topology=True)
        out.append((g, {"name": p.get("name_en") or p.get("name"), "ko": p.get("name_ko"), "r": p["scalerank"]}))
    return out


def build_rivers():
    out = []
    major = load_geojson(SRC / "ne_10m_rivers_lake_centerlines_scale_rank.geojson")
    for ft in major["features"]:
        p = ft["properties"]
        if p["featurecla"] in ("Canal",) or p["scalerank"] > 9:
            continue
        g = shape(ft["geometry"])
        if not g.intersects(AOI):
            continue
        g = g.intersection(AOI).simplify(0.006)
        for ln in lines(g):
            if ln.length < 0.02:
                continue
            out.append((ln, {"name": p.get("name_en") or p.get("name"), "ko": p.get("name_ko"),
                             "r": p["scalerank"]}))
    eur = load_geojson(SRC / "ne_10m_rivers_europe.geojson")
    for ft in eur["features"]:
        p = ft["properties"]
        if "Lake" in (p["featurecla"] or "") or p["scalerank"] > 11:
            continue
        g = shape(ft["geometry"])
        if not g.intersects(AOI):
            continue
        g = g.intersection(AOI).simplify(0.006)
        for ln in lines(g):
            if ln.length < 0.05:
                continue
            out.append((ln, {"name": p.get("name_en") or p.get("name"), "ko": p.get("name_ko"),
                             "r": p["scalerank"]}))
    return out


def build_rails():
    d = load_geojson(SRC / "ne_10m_railroads.geojson")
    out = []
    for ft in d["features"]:
        p = ft["properties"]
        if p["featurecla"] != "Railroad" or p["scalerank"] > 8:
            continue
        g = shape(ft["geometry"])
        if not g.intersects(AOI):
            continue
        g = g.intersection(AOI).simplify(0.008)
        for ln in lines(g):
            if ln.length < 0.03:
                continue
            out.append((ln, {"r": p["scalerank"]}))
    return out


def main():
    land = build_land()
    lakes = build_lakes()
    rivers = build_rivers()
    rails = build_rails()
    print("land polys", sum(1 for _ in polys(land)), "lakes", len(lakes), "rivers", len(rivers), "rails", len(rails))
    npts = lambda gs: sum(len(g.coords) for g, _ in gs)
    print("river pts", npts(rivers), "rail pts", npts(rails))
    out = {
        "land": {"type": "FeatureCollection", "features": [feature(land, {})]},
        "lakes": {"type": "FeatureCollection", "features": [feature(g, p) for g, p in lakes]},
        "rivers": {"type": "FeatureCollection", "features": [feature(g, p) for g, p in rivers]},
        "rails": {"type": "FeatureCollection", "features": [feature(g, p) for g, p in rails]},
    }
    write_json(BUILD / "base.geo.json", out)


if __name__ == "__main__":
    main()
