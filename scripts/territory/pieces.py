"""Pre-war (1939-08-31) political pieces.

Base borders: CShapes 2.0 (Schvitz et al. 2022, CC BY-NC-SA 4.0) clipped to the
Natural Earth 10 m coastline. Pieces are then carved so later annexations and
occupation zones can be assigned per piece.
"""
from __future__ import annotations

from shapely.geometry import shape
from shapely.ops import unary_union

from common import AOI, SRC, load_geojson, polys
from territory.geo import bbox, fix, poly

CSHAPES_CODES = {
    "United Kingdom": "GBR", "Ireland": "IRL", "Netherlands": "NLD", "Belgium": "BEL",
    "Luxembourg": "LUX", "France": "FRA", "Switzerland": "CHE", "Spain": "ESP",
    "Portugal": "PRT", "Germany (Prussia)": "DEU", "Poland": "POL", "Austria": "AUT",
    "Hungary": "HUN", "Czechoslovakia": "CSK", "Italy/Sardinia": "ITA", "Malta": "MLT",
    "Albania": "ALB", "Yugoslavia": "YUG", "Greece": "GRC", "Cyprus": "CYP",
    "Bulgaria": "BGR", "Rumania": "ROU", "Russia (Soviet Union)": "SOV", "Estonia": "EST",
    "Latvia": "LVA", "Lithuania": "LTU", "Finland": "FIN", "Sweden": "SWE", "Norway": "NOR",
    "Denmark": "DNK", "Iceland": "ISL", "Morocco": "MAR", "Spanish Morocco": "SMA",
    "Spanish West Africa": "SWA", "Algeria": "DZA", "Tunisia": "TUN", "Libya": "LBY",
    "Iran (Persia)": "IRN", "Turkey (Ottoman Empire)": "TUR", "Iraq": "IRQ", "Egypt": "EGY",
    "Syria": "SYR", "Lebanon": "LBN", "Jordan": "JOR", "Palestine": "PAL",
    "Saudi Arabia": "SAU", "Qatar": "QAT", "United Arab Emirates": "TRU", "Oman": "OMN",
    "Afghanistan": "AFG", "Mali": "FWA", "Mauritania": "FWA", "Niger": "FWA",
    "Chad": "FEA", "Sudan": "SDN", "India": "IND",
}


from functools import lru_cache


@lru_cache(maxsize=1)
def _cshapes():
    return load_geojson(SRC / "CShapes-2.0.geojson")["features"]


def cs_at(name: str, y: int, m: int, d: int):
    for ft in _cshapes():
        p = ft["properties"]
        s = (p["gwsyear"], p["gwsmonth"], p["gwsday"]); e = (p["gweyear"], p["gwemonth"], p["gweday"])
        if p["cntry_name"] == name and s <= (y, m, d) <= e:
            return fix(shape(ft["geometry"]))
    raise KeyError((name, y, m, d))


def land_mask():
    import pickle
    from common import BUILD
    cache = BUILD / "landmask.pkl"
    if cache.exists():
        return pickle.load(open(cache, "rb"))
    g = _land_mask()
    pickle.dump(g, open(cache, "wb"))
    return g


def _land_mask():
    land = load_geojson(SRC / "ne_10m_land.geojson")
    parts = []
    for ft in land["features"]:
        g = shape(ft["geometry"])
        if g.intersects(AOI):
            for p in polys(g.intersection(AOI)):
                if p.area > 0.0015:
                    parts.append(p.simplify(0.008, preserve_topology=True))
    land = unary_union(parts)
    lakes = load_geojson(SRC / "ne_10m_lakes.geojson")
    big = []
    for ft in lakes["features"]:
        p = ft["properties"]
        if p["featurecla"] == "Reservoir":
            continue
        g = shape(ft["geometry"])
        if g.intersects(AOI) and g.area > 0.03:
            big.append(g.simplify(0.006, preserve_topology=True))
    return fix(land.difference(unary_union(big)))


_NE0 = None


def ne_country(name):
    global _NE0
    if _NE0 is None:
        _NE0 = load_geojson(SRC / "ne_10m_admin_0_countries.geojson")["features"]
    for ft in _NE0:
        p = ft["properties"]
        if name in (p["ADMIN"], p["NAME"], p["ADM0_A3"]):
            return fix(shape(ft["geometry"]))
    raise KeyError(name)


_NE1 = None


def ne_admin1(country_a3, names=None, regions=None):
    global _NE1
    if _NE1 is None:
        _NE1 = load_geojson(SRC / "ne_10m_admin_1_states_provinces.geojson")["features"]
    out = []
    for ft in _NE1:
        p = ft["properties"]
        if p["adm0_a3"] != country_a3:
            continue
        if names and p["name"] not in names:
            continue
        if regions and p.get("region") not in regions:
            continue
        out.append(shape(ft["geometry"]))
    if not out:
        raise KeyError((country_a3, names, regions))
    return fix(unary_union(out))


class Pieces:
    """id → {geom, country, ko, en}"""

    def __init__(self):
        self.p: dict[str, dict] = {}

    def add(self, pid, geom, country, ko, en):
        self.p[pid] = {"geom": geom, "country": country, "ko": ko, "en": en}

    def carve(self, src_id, region, new_id, ko, en, country=None, min_area=1e-4):
        src = self.p[src_id]
        part = fix(src["geom"].intersection(region))
        if part.is_empty or part.area < min_area:
            print(f"  ! carve {new_id} from {src_id}: empty")
            return
        rest = fix(src["geom"].difference(region))
        src["geom"] = rest
        self.add(new_id, part, country or src["country"], ko, en)

    def __getitem__(self, k):
        return self.p[k]

    def items(self):
        return self.p.items()


def build_pieces() -> Pieces:
    land = land_mask()
    feats = []
    for ft in _cshapes():
        p = ft["properties"]
        s = (p["gwsyear"], p["gwsmonth"], p["gwsday"]); e = (p["gweyear"], p["gwemonth"], p["gweday"])
        if not (s <= (1939, 8, 31) <= e):
            continue
        g = fix(shape(ft["geometry"]))
        if not g.intersects(AOI):
            continue
        code = CSHAPES_CODES.get(p["cntry_name"])
        if not code:
            print("  ? unmapped", p["cntry_name"])
            continue
        feats.append((code, g))
    # merge same codes (e.g. French West Africa parts)
    by = {}
    for code, g in feats:
        by[code] = fix(unary_union([by[code], g])) if code in by else g
    covered = unary_union(list(by.values()))
    geoms = {c: fix(g.intersection(land)) for c, g in by.items()}
    # land not covered by any CShapes polygon → nearest country
    gaps = fix(land.difference(covered))
    from shapely.strtree import STRtree
    codes = list(by.keys())
    tree = STRtree([by[c] for c in codes])
    extra: dict[str, list] = {}
    for gp in polys(gaps):
        if gp.area < 2e-5:
            continue
        idx = tree.nearest(gp)
        extra.setdefault(codes[int(idx)], []).append(gp)
    for c, gl in extra.items():
        geoms[c] = fix(unary_union([geoms[c]] + gl))
    P = Pieces()
    from territory.names import COUNTRY_NAMES
    for c, g in geoms.items():
        if g.is_empty:
            continue
        ko, en = COUNTRY_NAMES.get(c, (c, c))
        P.add(c, g, c, ko, en)
    carve_prewar(P)
    return P


def carve_prewar(P: Pieces):
    # Germany 1937 vs Sudetenland (CShapes Germany polygon of 1938-09-30 includes it)
    P.carve("DEU", poly([(18.40, 54.62), (18.62, 54.46), (18.95, 54.38), (19.30, 54.36), (19.32, 54.20),
                         (19.10, 54.08), (18.88, 54.04), (18.62, 54.10), (18.42, 54.28)], smooth=0),
            "DEU-DAN", "단치히 자유시", "Free City of Danzig")
    de37 = cs_at("Germany (Prussia)", 1937, 6, 1)
    sud = fix(P["DEU"]["geom"].difference(de37.buffer(0.01))).intersection(bbox(11.5, 48.4, 19.0, 51.2))
    P.carve("DEU", sud, "DEU-SUD", "주데텐란트", "Sudetenland")
    # Hungary: First Vienna Award strip (Nov 1938)
    hu20 = cs_at("Hungary", 1937, 6, 1)
    P.carve("HUN", fix(P["HUN"]["geom"].difference(hu20.buffer(0.01))), "HUN-SSK", "남부 슬로바키아·루테니아 (1938 병합)", "Southern Slovakia & Ruthenia (1938)")
    # Czechoslovakia rump → Bohemia-Moravia / Slovakia / Carpatho-Ukraine
    P.carve("CSK", ne_country("Czechia").buffer(0.03), "CSK-BM", "보헤미아·모라비아", "Bohemia-Moravia")
    P.carve("CSK", ne_country("Ukraine").buffer(0.03), "CSK-CU", "카르파티아 우크라이나", "Carpatho-Ukraine")
    P["CSK"]["ko"], P["CSK"]["en"] = "슬로바키아", "Slovakia"
    # Memel territory (to Germany, March 1939)
    P.carve("LTU", poly([(20.9, 55.25), (21.0, 56.0), (21.25, 56.08), (21.55, 55.95), (21.9, 55.75),
                         (22.15, 55.45), (22.15, 55.25), (21.85, 55.07), (21.4, 55.28), (21.15, 55.2)], smooth=0),
            "LTU-MEM", "메멜란트", "Memel Territory")
    # Poland: Wilno region (to Lithuania Oct 1939)
    P.carve("POL", poly([(24.45, 54.55), (24.8, 54.98), (25.3, 55.18), (25.85, 55.15), (26.15, 54.95),
                         (26.05, 54.55), (25.75, 54.28), (25.25, 54.15), (24.85, 54.25)], smooth=1),
            "POL-WIL", "빌뉴스 지역", "Wilno region")
    # Poland: Soviet zone after 28 Sep 1939 (Pisa–Narew–Bug–San)
    soviet_zone = poly([
        (21.6, 55.5), (21.85, 53.45), (21.9, 53.25), (22.1, 53.1), (22.0, 52.95), (21.95, 52.75),
        (22.15, 52.6), (22.45, 52.48), (22.75, 52.4), (23.05, 52.28), (23.2, 52.08), (23.55, 51.75),
        (23.65, 51.45), (23.85, 51.1), (24.0, 50.85), (24.1, 50.6), (24.0, 50.4), (23.55, 50.4),
        (23.05, 50.15), (22.75, 49.95), (22.78, 49.78), (22.6, 49.55), (22.7, 49.3), (22.85, 49.05),
        (24.5, 47.5), (35, 47.5), (35, 56)], smooth=0)
    P.carve("POL", soviet_zone, "POL-E", "폴란드 동부 (서벨라루스·서우크라이나)", "Eastern Poland")
    # Poland: territories annexed to the Reich (Oct 1939); remainder = General Government
    annexed = poly([
        (14, 55), (21.6, 55.5), (21.9, 53.45), (21.85, 53.1), (21.6, 52.85), (21.15, 52.62),
        (20.75, 52.45), (20.4, 52.38), (20.05, 52.3), (19.85, 52.08), (19.75, 51.88), (19.7, 51.72),
        (19.45, 51.55), (19.2, 51.35), (19.0, 51.05), (19.15, 50.75), (19.45, 50.55), (19.55, 50.3),
        (19.6, 50.05), (19.6, 49.8), (19.45, 49.55), (19.2, 49.35), (14, 49)], smooth=0)
    P.carve("POL", annexed, "POL-W", "제국 병합 지역 (단치히-서프로이센·바르테란트·동상부슐레지엔)", "Annexed to the Reich")
    P["POL"]["ko"], P["POL"]["en"] = "폴란드 중부 (총독부)", "General Government"
    # Finland: areas ceded to the USSR in March 1940 (and Petsamo 1944)
    fi = P["FIN"]["geom"]
    su40 = cs_at("Russia (Soviet Union)", 1940, 3, 12)
    P.carve("FIN", su40.buffer(0.005).difference(bbox(26, 68.6, 33, 71)), "FIN-KAR", "카렐리야·살라 할양지 (1940)", "Ceded Karelia & Salla (1940)")
    su45 = cs_at("Russia (Soviet Union)", 1945, 8, 15)
    P.carve("FIN", su45.buffer(0.01).intersection(bbox(26, 68.6, 33, 71)), "FIN-PET", "페차모 (1944 할양)", "Petsamo")
    # Romania: Bessarabia + N. Bukovina (USSR, June 1940); S. Dobruja (Bulgaria, Sept 1940);
    # Northern Transylvania (Hungary, Aug 1940)
    su40b = cs_at("Russia (Soviet Union)", 1940, 6, 28)
    P.carve("ROU", su40b.buffer(0.005), "ROU-BES", "베사라비아·북부코비나", "Bessarabia & N. Bukovina")
    bg40 = cs_at("Bulgaria", 1940, 9, 7)
    P.carve("ROU", bg40.buffer(0.005), "ROU-DOB", "남도브루자", "Southern Dobruja")
    ntrans = poly([
        (21.3, 46.75), (21.65, 46.83), (22.0, 46.86), (22.4, 46.79), (22.75, 46.74), (23.15, 46.71),
        (23.5, 46.69), (23.85, 46.62), (24.2, 46.52), (24.5, 46.43), (24.75, 46.31), (25.1, 46.2),
        (25.35, 46.0), (25.55, 45.74), (25.85, 45.76), (26.1, 45.66), (26.42, 45.55), (26.2, 45.95),
        (26.08, 46.35), (25.98, 46.7), (25.78, 47.05), (25.45, 47.32), (25.1, 47.62), (24.9, 47.78),
        (24.9, 48.3), (22.0, 48.4), (21.2, 47.6)], smooth=0)
    P.carve("ROU", ntrans, "ROU-NTR", "북트란실바니아", "Northern Transylvania")
    # Italy: Dodecanese stays Italian; nothing to carve.
    carve_yugoslavia(P)
    carve_greece(P)
    carve_france(P)
    # Belgium: Eupen-Malmedy (annexed 1940)
    P.carve("BEL", poly([(5.95, 50.75), (6.2, 50.78), (6.42, 50.35), (6.3, 50.2), (6.05, 50.2), (5.95, 50.35)], smooth=0),
            "BEL-EM", "외펜-말메디", "Eupen-Malmedy")
    # Soviet Union: Transnistria (Romanian administration 1941-44), Crimea (for labels)
    P.carve("SOV", poly([(28.7, 48.65), (29.4, 48.95), (30.4, 48.9), (31.2, 48.25), (31.55, 47.8), (31.9, 47.3),
                         (32.05, 46.7), (31.3, 46.55), (30.8, 46.5), (30.3, 46.0), (29.9, 46.3), (29.6, 46.8),
                         (29.15, 47.6), (28.75, 48.15)], smooth=1),
            "SOV-TRN", "트란스니스트리아", "Transnistria")


def carve_yugoslavia(P: Pieces):
    yu = "YUG"
    P.carve(yu, ne_admin1("SVN", regions=["Gorenjska", "Koroška", "Podravska", "Savinjska", "Zasavska", "Spodnjeposavska"]).buffer(0.01),
            "YUG-SLN", "북부 슬로베니아 (독일 병합)", "Northern Slovenia")
    P.carve(yu, ne_admin1("SVN", regions=["Osrednjeslovenska", "Jugovzhodna Slovenija", "Notranjsko-kraška", "Goriška", "Obalno-kraška"]).buffer(0.01),
            "YUG-SLS", "류블랴나 주 (이탈리아 병합)", "Province of Ljubljana")
    P.carve(yu, unary_union([ne_admin1("SVN", regions=["Pomurska"]), ne_admin1("HRV", names=["Medimurska"])]).buffer(0.01),
            "YUG-PRK", "프레크무레·메디무레", "Prekmurje & Međimurje")
    P.carve(yu, unary_union([ne_admin1("SRB", names=["Severno-Backi", "Zapadno-Backi", "Južno-Backi"]),
                             poly([(18.45, 45.95), (18.95, 45.95), (18.95, 45.62), (18.6, 45.6), (18.4, 45.75)], smooth=0)]).buffer(0.01),
            "YUG-BAC", "바치카·바라냐", "Bačka & Baranja")
    P.carve(yu, ne_admin1("SRB", names=["Severno-Banatski", "Srednje-Banatski", "Južno-Banatski"]).buffer(0.01),
            "YUG-BAN", "바나트", "Banat")
    P.carve(yu, poly([(15.15, 44.25), (15.55, 43.95), (16.05, 43.7), (16.45, 43.55), (16.6, 43.42), (16.2, 43.2),
                      (15.6, 43.55), (15.0, 44.0), (14.75, 44.6), (14.5, 45.15), (14.9, 45.15), (15.05, 44.65)], smooth=0),
            "YUG-DAL", "달마티아 (이탈리아 병합)", "Governorate of Dalmatia")
    P.carve(yu, ne_country("Montenegro").buffer(0.01), "YUG-MNE", "몬테네그로", "Montenegro")
    P.carve(yu, unary_union([ne_admin1("KOS", regions=["Peć", "Pristina", "Prizren", "Đakovica", "Uroševac", "Gnjilane"]),
                             ne_admin1("MKD", regions=["Polog", "Southwestern"])]).buffer(0.01),
            "YUG-KOS", "코소보·서마케도니아 (알바니아 편입)", "Kosovo & W. Macedonia")
    P.carve(yu, unary_union([ne_country("North Macedonia"), ne_admin1("SRB", names=["Pirotski", "Pcinjski"])]).buffer(0.01),
            "YUG-MAC", "바르다르 마케도니아 (불가리아 병합)", "Vardar Macedonia")
    P.carve(yu, unary_union([ne_country("Croatia"), ne_country("Bosnia and Herzegovina"),
                             ne_admin1("SRB", names=["Sremski"])]).buffer(0.01),
            "YUG-NDH", "크로아티아·보스니아 (크로아티아 독립국)", "Croatia–Bosnia (NDH)")
    P[yu]["ko"], P[yu]["en"] = "세르비아", "Serbia"


def carve_greece(P: Pieces):
    P.carve("GRC", ne_admin1("GRC", names=["Anatoliki Makedonia kai Thraki"]).difference(bbox(25.9, 40.6, 27, 42)).buffer(0.01),
            "GRC-BUL", "동마케도니아·서트라키아 (불가리아 점령)", "E. Macedonia & W. Thrace")
    P.carve("GRC", unary_union([ne_admin1("GRC", names=["Kentriki Makedonia", "Attiki", "Ayion Oros"]),
                                bbox(25.9, 40.6, 27, 42), bbox(23.4, 34.8, 25.5, 35.75),
                                bbox(25.0, 38.1, 26.8, 40.0)]).buffer(0.01),
            "GRC-GER", "독일 점령 지구 (테살로니키·아테네·크레타)", "German zone")
    P["GRC"]["ko"], P["GRC"]["en"] = "그리스 (이탈리아 점령 지구)", "Italian zone"


def carve_france(P: Pieces):
    P.carve("FRA", ne_admin1("FRA", names=["Bas-Rhin", "Haute-Rhin", "Moselle"]).buffer(0.01),
            "FRA-ALS", "알자스-모젤", "Alsace-Moselle")
    occ = poly([
        (6.12, 46.2), (5.85, 46.42), (5.45, 46.72), (5.2, 46.85), (4.92, 46.76), (4.45, 46.6), (4.12, 46.45),
        (3.9, 46.5), (3.42, 46.52), (3.0, 46.72), (2.5, 46.93), (2.12, 47.17), (1.7, 47.27), (1.28, 47.31),
        (1.0, 47.12), (0.72, 46.95), (0.55, 46.72), (0.52, 46.38), (0.66, 46.05), (0.36, 45.72), (0.2, 45.35),
        (-0.05, 44.95), (-0.15, 44.6), (-0.32, 44.22), (-0.45, 43.9), (-0.62, 43.52), (-0.88, 43.3),
        (-1.05, 43.2), (-1.3, 43.05), (-6, 43.05), (-6, 52), (8.5, 52), (8.5, 47.5), (7.0, 47.3), (6.4, 46.5)], smooth=0)
    P.carve("FRA", occ, "FRA-OCC", "점령 지구 (북부·대서양 연안)", "Occupied zone")
    P.carve("FRA", unary_union([ne_admin1("FRA", names=["Alpes-Maritimes", "Var", "Alpes-de-Haute-Provence", "Hautes-Alpes",
                                                         "Savoie", "Haute-Savoie", "Isère", "Drôme"]),
                                ne_admin1("FRA", regions=["Corse"]) if True else None]).buffer(0.01),
            "FRA-ITZ", "론강 동쪽 (1942 이탈리아 점령)", "East of the Rhône")
    P["FRA"]["ko"], P["FRA"]["en"] = "자유 지구 (비시)", "Free zone (Vichy)"
