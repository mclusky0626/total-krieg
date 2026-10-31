"""GeoNames-based place lookup (cities1000, CC BY 4.0, https://www.geonames.org/)."""
from __future__ import annotations

import csv
import sys
import unicodedata
from functools import lru_cache

from common import SRC

csv.field_size_limit(sys.maxsize)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower().replace("’", "'").replace("-", " ").strip()


@lru_cache(maxsize=1)
def _index():
    idx: dict[str, list[tuple]] = {}
    with open(SRC / "cities1000.txt", encoding="utf-8") as f:
        for row in csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
            lat, lon = float(row[4]), float(row[5])
            if not (-20 < lon < 70 and 20 < lat < 75):
                continue
            rec = (row[1], lon, lat, row[8], int(row[14] or 0), row[7])
            names = {norm(row[1]), norm(row[2])}
            for alt in row[3].split(","):
                if alt and len(alt) < 40:
                    names.add(norm(alt))
            for n in names:
                idx.setdefault(n, []).append(rec + (n == norm(row[1]) or n == norm(row[2]),))
    return idx


def lookup(name: str, cc: str | None = None, near: tuple[float, float] | None = None):
    """Return (lon, lat, matched_name, population) or None.

    Prefers primary-name matches, then the given country, then population
    (or proximity to `near`, if given)."""
    cands = _index().get(norm(name), [])
    if cc:
        ccs = cc.split("/")
        c2 = [c for c in cands if c[3] in ccs]
        cands = c2 or cands
    if not cands:
        return None
    if near:
        cands.sort(key=lambda c: (c[1] - near[0]) ** 2 + (c[2] - near[1]) ** 2)
    else:
        cands.sort(key=lambda c: (not c[6], -c[4]))
    c = cands[0]
    return (round(c[1], 4), round(c[2], 4), c[0], c[4])
