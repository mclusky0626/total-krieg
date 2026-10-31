"""Sides, belligerence and the dated political baseline (annexations,
occupations, puppet states) applied before front-line zones."""
from __future__ import annotations

AXIS_CORE = {"DEU", "HRV", "SVK"}


def side(c: str, d: str) -> str:
    """'axis' | 'allies' | 'neutral' | 'vichy' | 'pact' (USSR before Barbarossa)."""
    if c in AXIS_CORE:
        return "axis"
    if c == "ITA":
        return "neutral" if d < "1940-06-10" else ("axis" if d < "1943-09-08" else "allies")
    if c == "HUN":
        return "neutral" if d < "1940-11-20" else "axis"
    if c == "ROU":
        return "neutral" if d < "1940-11-23" else ("axis" if d < "1944-08-23" else "allies")
    if c == "BGR":
        return "neutral" if d < "1941-03-01" else ("axis" if d < "1944-09-09" else "allies")
    if c == "FIN":
        return "neutral" if d < "1941-06-25" else ("axis" if d < "1944-09-19" else "allies")
    if c == "VIC":
        return "vichy"
    if c == "SOV":
        return "pact" if d < "1941-06-22" else "allies"
    if c in ("GBR", "FRA", "POL", "WAL", "USA", "CSK"):
        return "allies"
    if c in ("NOR", "DNK"):
        return "neutral" if d < "1940-04-09" else "allies"
    if c in ("NLD", "BEL", "LUX"):
        return "neutral" if d < "1940-05-10" else "allies"
    if c == "GRC":
        return "neutral" if d < "1940-10-28" else "allies"
    if c == "YUG":
        return "neutral" if d < "1941-04-06" else "allies"
    if c == "ALB":
        return "allies"
    if c == "EGY":
        return "neutral" if d < "1940-06-10" else "allies"
    if c == "IRQ":
        return "neutral" if d < "1941-06-01" else "allies"
    if c == "IRN":
        return "neutral" if d < "1941-08-25" else "allies"
    return "neutral"


def at_war(a: str, b: str, d: str) -> bool:
    sa, sb = side(a, d), side(b, d)
    if "neutral" in (sa, sb) or "vichy" in (sa, sb) or "pact" in (sa, sb):
        return False
    if sa == sb:
        return False
    # Bulgaria never fought the USSR before Sept 1944
    if {a, b} == {"BGR", "SOV"} and d < "1944-09-05":
        return False
    return True


def axis_controllers(d: str) -> set[str]:
    return {c for c in ("DEU", "ITA", "HUN", "ROU", "BGR", "FIN", "SVK", "HRV") if side(c, d) == "axis"}


# prewar country → controller when liberated/conquered, per liberator
LIB_SOV = {
    "SOV": ("SOV", "core"), "EST": ("SOV", "annexed"), "LVA": ("SOV", "annexed"), "LTU": ("SOV", "annexed"),
    "FIN": ("SOV", "annexed"), "POL": ("POL", "liberated"), "DEU": ("SOV", "occupied"), "AUT": ("SOV", "occupied"),
    "CSK": ("CSK", "liberated"), "HUN": ("SOV", "occupied"), "ROU": ("ROU", "core"), "YUG": ("YUG", "liberated"),
    "GRC": ("GRC", "liberated"), "BGR": ("BGR", "core"), "NOR": ("NOR", "liberated"), "ALB": ("ALB", "liberated"),
    "ITA": ("YUG", "liberated"), "DNK": ("SOV", "occupied"),
}
LIB_SOV_PIECE = {
    "POL-E": ("SOV", "annexed"), "POL-WIL": ("SOV", "annexed"), "ROU-BES": ("SOV", "annexed"),
    "SOV-TRN": ("SOV", "core"), "FIN-KAR": ("SOV", "annexed"), "FIN-PET": ("SOV", "annexed"),
    "LTU-MEM": ("SOV", "occupied"), "CSK-CU": ("SOV", "occupied"), "ROU-NTR": ("ROU", "core"),
    "DEU-DAN": ("POL", "liberated"),
}
LIB_WEST = {
    "FRA": ("FRA", "liberated"), "BEL": ("BEL", "liberated"), "NLD": ("NLD", "liberated"),
    "LUX": ("LUX", "liberated"), "DEU": ("WAL", "occupied"), "AUT": ("WAL", "occupied"),
    "ITA": ("ITA", "liberated"), "CSK": ("CSK", "liberated"), "DNK": ("DNK", "liberated"),
    "NOR": ("NOR", "liberated"), "GRC": ("GRC", "liberated"), "ALB": ("ALB", "liberated"),
    "YUG": ("YUG", "liberated"), "LBY": ("GBR", "occupied"), "TUN": ("FRA", "colony"),
    "DZA": ("FRA", "colony"), "MAR": ("FRA", "colony"), "EGY": ("EGY", "core"), "GBR": ("GBR", "core"),
}
LIB_WEST_PIECE = {"BEL-EM": ("BEL", "liberated"), "FRA-ALS": ("FRA", "liberated")}


def baseline(pieces, d: str) -> dict[str, tuple[str, str]]:
    """Political state on date d (ISO string), before front-line zones."""
    S: dict[str, tuple[str, str]] = {}
    for pid, p in pieces.items():
        S[pid] = (p["country"], "core")

    def put(ids, ctrl, status):
        for i in ([ids] if isinstance(ids, str) else ids):
            if i in S:
                S[i] = (ctrl, status)

    # colonies, mandates and protectorates
    put(["LBY"], "ITA", "colony")
    put(["DZA", "TUN", "MAR", "SYR", "LBN", "FWA", "FEA"], "FRA", "colony")
    put(["PAL", "JOR", "CYP", "MLT", "SDN", "IND", "TRU", "QAT"], "GBR", "colony")
    put(["SMA", "SWA"], "ESP", "colony")
    # 1938-39 (already in force on 1 Sept 1939)
    put(["AUT", "DEU-SUD", "LTU-MEM"], "DEU", "annexed")
    put("CSK-BM", "DEU", "protectorate")
    put("CSK", "SVK", "client")
    put(["HUN-SSK", "CSK-CU"], "HUN", "annexed")
    put("ALB", "ITA", "protectorate")
    put("DEU-DAN", "DEU", "annexed")  # proclaimed 1 Sept 1939
    if d >= "1939-10-06":
        put("POL-W", "DEU", "annexed"); put("POL", "DEU", "occupied")
        put("POL-E", "SOV", "annexed"); put("POL-WIL", "LTU", "annexed")
    if d >= "1940-03-13":
        put("FIN-KAR", "SOV", "annexed")
    if d >= "1940-04-09":
        put(["DNK", "NOR"], "DEU", "occupied")
    if d >= "1940-05-28":
        put(["NLD", "BEL", "LUX"], "DEU", "occupied"); put("BEL-EM", "DEU", "annexed")
    if d >= "1940-06-17":
        put(["EST", "LVA", "LTU", "POL-WIL"], "SOV", "annexed" if d >= "1940-08-03" else "occupied")
    if d >= "1940-06-22":
        put("FRA-OCC", "DEU", "occupied"); put("FRA-ALS", "DEU", "annexed")
        put(["FRA", "FRA-ITZ"], "VIC", "client")
        put(["DZA", "TUN", "MAR", "SYR", "LBN", "FWA"], "VIC", "colony")
        put("LUX", "DEU", "annexed")
    if d >= "1940-06-28":
        put("ROU-BES", "SOV", "annexed")
    if d >= "1940-08-30":
        put("ROU-NTR", "HUN", "annexed")
    if d >= "1940-09-07":
        put("ROU-DOB", "BGR", "annexed")
    if d >= "1941-04-17":
        put(["YUG-SLN"], "DEU", "annexed"); put(["YUG", "YUG-BAN"], "DEU", "occupied")
        put(["YUG-SLS", "YUG-DAL"], "ITA", "annexed"); put("YUG-MNE", "ITA", "occupied")
        put("YUG-KOS", "ITA", "annexed")
        put(["YUG-PRK", "YUG-BAC"], "HUN", "annexed")
        put("YUG-MAC", "BGR", "annexed")
        put("YUG-NDH", "HRV", "client")
    if d >= "1941-04-30":
        put("GRC-GER", "DEU", "occupied"); put("GRC", "ITA", "occupied"); put("GRC-BUL", "BGR", "annexed")
    if d >= "1941-07-14":
        put(["SYR", "LBN"], "FRA", "colony")
    if d >= "1942-11-11":
        put(["MAR", "DZA"], "FRA", "colony")
        put("FRA", "DEU", "occupied"); put("FRA-ITZ", "ITA", "occupied")
        put("TUN", "DEU", "occupied")
    if d >= "1943-05-13":
        put("TUN", "FRA", "colony")
    if d >= "1943-09-08":
        # Italian zones taken over by Germany after the armistice
        for pid, (c, s) in list(S.items()):
            if c == "ITA" and pid not in ("LBY",):
                S[pid] = ("DEU", "occupied")  # incl. Italy itself (RSI); the Italy front op restores the south
        put("LBY", "GBR", "occupied")
    elif d >= "1943-01-23":
        put("LBY", "GBR", "occupied")
    if d >= "1944-09-09":
        put("ROU-DOB", "BGR", "annexed")
    if d >= "1944-10-01":
        # Bulgaria withdraws from occupied Yugoslav and Greek lands
        put("YUG-MAC", "YUG", "liberated"); put("GRC-BUL", "GRC", "liberated")
    if d >= "1944-09-19":
        put("FIN-PET", "SOV", "annexed")
    return S
