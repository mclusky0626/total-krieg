"""Download commander portraits from Wikipedia / Wikimedia Commons, politely.

For every person in src/data/people.json that has no portrait yet:
  1. lead image of the English Wikipedia article (free images only)  — batched, 40 titles/request
  2. else the Wikidata P18 image                                       — batched, 50 items/request
  3. else the lead image of the de/ru/pl/fr/it/... article via Wikidata sitelinks
Licence/author metadata come from Commons in batches; each image is then downloaded once
as a standard 250 px thumbnail, cropped to 4:5 and saved as public/portraits/<id>.jpg.
Credits go to src/data/portraits.json (written after every image).

Usage: python3 scripts/fetch_portraits.py [--force] [id ...]
"""
from __future__ import annotations

import hashlib
import html
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image, ImageOps

from common import APP_DATA, ROOT

UA = "TotalKriegMap/0.1 (https://github.com/mclusky0626/total-krieg; educational WWII map)"
OUT = ROOT / "public" / "portraits"
OUT.mkdir(parents=True, exist_ok=True)
CREDITS = APP_DATA / "portraits.json"
THUMB = 250  # a standard Wikimedia thumbnail width
_last = [0.0]


def get(url, params=None, binary=False, tries=8, gap=1.5):
    if params:
        url += "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        wait = gap - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
            return data if binary else json.loads(data)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            ra = e.headers.get("Retry-After") if e.headers else None
            delay = int(ra) if ra and ra.isdigit() else min(300, 20 * 2 ** i)
            print(f"   … HTTP {e.code}, waiting {delay}s", flush=True)
            time.sleep(delay)
        except Exception as e:  # noqa: BLE001
            print(f"   … {e}, retrying", flush=True)
            time.sleep(5 * (i + 1))
    print("   ! gave up:", url[:120], flush=True)
    return None


def api(lang):
    return f"https://{lang}.wikipedia.org/w/api.php"


def page_images(lang, titles):
    """title → (file name or None, wikidata id or None)"""
    out = {}
    for i in range(0, len(titles), 40):
        chunk = titles[i:i + 40]
        d = get(api(lang), {"action": "query", "format": "json", "redirects": 1, "titles": "|".join(chunk),
                            "prop": "pageimages|pageprops", "piprop": "name", "ppprop": "wikibase_item"})
        if not d:
            continue
        q = d.get("query", {})
        back = {t: t for t in chunk}
        for key in ("normalized", "redirects"):
            for n in q.get(key, []):
                back[n["to"]] = back.get(n["from"], n["from"])
        for p in q.get("pages", {}).values():
            if "missing" in p:
                continue
            orig = back.get(p.get("title"), p.get("title"))
            out[orig] = (p.get("pageimage"), p.get("pageprops", {}).get("wikibase_item"))
    return out


def wikidata(qids):
    """qid → (P18 file or None, {site: title})"""
    out = {}
    qids = [q for q in qids if q]
    for i in range(0, len(qids), 50):
        d = get("https://www.wikidata.org/w/api.php", {"action": "wbgetentities", "ids": "|".join(qids[i:i + 50]),
                                                       "props": "claims|sitelinks", "format": "json"})
        if not d:
            continue
        for qid, e in d.get("entities", {}).items():
            img = None
            for c in e.get("claims", {}).get("P18", []):
                img = c.get("mainsnak", {}).get("datavalue", {}).get("value")
                if img:
                    break
            out[qid] = (img, {k: v["title"] for k, v in e.get("sitelinks", {}).items()})
    return out


def commons(files):
    """file name → {thumb, page, author, license}"""
    out = {}
    files = sorted({f for f in files if f})
    for i in range(0, len(files), 40):
        chunk = files[i:i + 40]
        d = get("https://commons.wikimedia.org/w/api.php", {
            "action": "query", "format": "json", "titles": "|".join("File:" + f for f in chunk),
            "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": THUMB})
        if not d:
            continue
        q = d.get("query", {})
        back = {}
        for n in q.get("normalized", []):
            back[n["to"]] = n["from"]
        for p in q.get("pages", {}).values():
            ii = (p.get("imageinfo") or [None])[0]
            if not ii:
                continue
            md = ii.get("extmetadata", {})

            def clean(k):
                v = re.sub(r"<[^>]+>", " ", md.get(k, {}).get("value", ""))
                return re.sub(r"\s+", " ", html.unescape(v)).strip()[:160]
            name = back.get(p["title"], p["title"])[5:]
            out[name.replace(" ", "_")] = out[name] = {
                "thumb": ii.get("thumburl") or ii.get("url"), "page": ii.get("descriptionurl"),
                "author": clean("Artist") or clean("Credit"), "license": clean("LicenseShortName")}
    return out


def crop_portrait(data: bytes) -> Image.Image:
    im = Image.open(io.BytesIO(data))
    im = ImageOps.exif_transpose(im).convert("RGB")
    w, h = im.size
    target = 4 / 5
    if w / h > target:  # wide → centre crop
        nw = int(h * target)
        x0 = (w - nw) // 2
        im = im.crop((x0, 0, x0 + nw, h))
    else:  # tall → keep the top, where faces usually are
        nh = int(w / target)
        y0 = int(min(h - nh, h * 0.04))
        im = im.crop((0, y0, w, y0 + nh))
    return im.resize((240, 300), Image.LANCZOS)


def save(credits):
    with open(CREDITS, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(credits.items())), f, ensure_ascii=False, indent=1)


def main():
    force = "--force" in sys.argv
    only = {a for a in sys.argv[1:] if not a.startswith("--")}
    people = json.load(open(APP_DATA / "people.json", encoding="utf-8"))
    credits = json.load(open(CREDITS, encoding="utf-8")) if CREDITS.exists() else {}
    todo = [p for p in people if (not only or p["id"] in only) and (force or p["id"] not in credits)]
    print(f"{len(todo)} people to fetch", flush=True)
    if not todo:
        return
    # 1. English lead images + Wikidata ids (batched)
    en = page_images("en", [p["wiki"] for p in todo])
    chosen: dict[str, tuple[str, str]] = {}
    need_wd = []
    for p in todo:
        f, q = en.get(p["wiki"], (None, None))
        if f:
            chosen[p["id"]] = (f, "enwiki")
        elif q:
            need_wd.append((p, q))
    # 2. Wikidata P18 / other-language lead images (batched)
    wd = wikidata([q for _, q in need_wd])
    other: dict[str, list] = {}
    for p, q in need_wd:
        img, links = wd.get(q, (None, {}))
        if img:
            chosen[p["id"]] = (img, "wikidata")
            continue
        for lang in ("de", "ru", "pl", "fr", "it", "uk", "ro", "hu", "fi", "nl"):
            t = links.get(f"{lang}wiki")
            if t:
                other.setdefault(lang, []).append((p["id"], t))
    for lang, items in other.items():
        res = page_images(lang, [t for _, t in items])
        for pid, t in items:
            if pid not in chosen and res.get(t, (None, None))[0]:
                chosen[pid] = (res[t][0], f"{lang}wiki")
    # 3. Commons metadata (batched)
    meta = commons([f for f, _ in chosen.values()])
    print(f"images found for {len(chosen)}/{len(todo)}; downloading…", flush=True)
    missing = [p["id"] for p in todo if p["id"] not in chosen]
    for p in todo:
        if p["id"] not in chosen:
            continue
        fname, via = chosen[p["id"]]
        info = meta.get(fname) or meta.get(fname.replace(" ", "_"))
        if not info or not info.get("thumb"):
            # build the standard thumbnail URL ourselves
            n = fname.replace(" ", "_")
            h = hashlib.md5(n.encode()).hexdigest()
            q = urllib.parse.quote(n)
            info = {"thumb": f"https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{THUMB}px-{q}",
                    "page": f"https://commons.wikimedia.org/wiki/File:{q}", "author": "", "license": ""}
        data = get(info["thumb"], binary=True, gap=2.0)
        if not data:
            missing.append(p["id"])
            continue
        try:
            im = crop_portrait(data)
        except Exception as e:  # noqa: BLE001
            print(f" - {p['id']:16} bad image: {e}", flush=True)
            missing.append(p["id"])
            continue
        im.save(OUT / f"{p['id']}.jpg", "JPEG", quality=82, optimize=True, progressive=True)
        credits[p["id"]] = {"file": f"{p['id']}.jpg", "src": fname, "page": info["page"],
                            "author": info["author"], "license": info["license"], "via": via}
        save(credits)
        print(f" + {p['id']:16} {fname[:56]} [{info['license']}] via {via}", flush=True)
    save(credits)
    print(f"done: {len(credits)} portraits; without image: {missing}", flush=True)


if __name__ == "__main__":
    main()
