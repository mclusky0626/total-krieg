"""Resolve scripts/data/places.txt against GeoNames → src/data/places.json."""
from common import APP_DATA, ROOT, write_json
from gazetteer import lookup


def parse():
    rows = []
    for line in open(ROOT / "scripts" / "data" / "places.txt", encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        parts += [""] * (8 - len(parts))
        key, q, cc, ko, en, rank, ov, flags = parts[:8]
        rows.append(dict(key=key, q=q, cc=cc, ko=ko, en=en, rank=int(rank or 0), ov=ov, flags=flags))
    return rows


def resolve(rows):
    out, missing = {}, []
    for r in rows:
        ov = r["ov"]
        if ov and not ov.startswith("~"):
            lon, lat = map(float, ov.split(","))
        else:
            near = tuple(map(float, ov[1:].split(","))) if ov else None
            hit = lookup(r["q"], r["cc"] or None, near)
            if not hit:
                missing.append(r["key"])
                continue
            lon, lat = hit[0], hit[1]
        item = {"ko": r["ko"], "en": r["en"], "lon": lon, "lat": lat, "rank": r["rank"]}
        if r["flags"]:
            item["flags"] = r["flags"]
        out[r["key"]] = item
    return out, missing


if __name__ == "__main__":
    rows = parse()
    places, missing = resolve(rows)
    if missing:
        print("MISSING:", missing)
    write_json(APP_DATA / "places.json", places, compact=False)
    print(len(places), "places")
