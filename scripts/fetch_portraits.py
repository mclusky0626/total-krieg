"""Download commander portraits from Wikipedia / Wikimedia Commons.

For every person in src/data/people.json:
  1. lead image of the English Wikipedia article (free images only),
  2. else Wikidata P18 image,
  3. else lead image of the de/ru/pl/fr/it Wikipedia article found via Wikidata sitelinks.
The image is cropped to 4:5, resized to 240×300 and saved to public/portraits/<id>.jpg.
Author / licence / source are recorded in src/data/portraits.json for on-page attribution.
Usage: python3 scripts/fetch_portraits.py [--force] [id ...]
"""
from __future__ import annotations

import html
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.error
import urllib.request

from PIL import Image, ImageOps

from common import APP_DATA, ROOT

UA = "TotalKriegMap/0.1 (https://github.com/mclusky0626/total-krieg; educational WWII map)"
OUT = ROOT / "public" / "portraits"
OUT.mkdir(parents=True, exist_ok=True)
CREDITS = APP_DATA / "portraits.json"


_last = [0.0]


def get(url, params=None, binary=False, tries=6):
    if params:
        url += "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        wait = 0.7 - (time.time() - _last[0])  # polite throttle
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
            return data if binary else json.loads(data)
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < tries - 1:
                ra = e.headers.get("Retry-After")
                delay = int(ra) if ra and ra.isdigit() else 8 * (i + 1)
                time.sleep(min(delay, 60))
                continue
            if i == tries - 1 or e.code == 404:
                print("   ! request failed", url[:110], e)
                return None
            time.sleep(2 * (i + 1))
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                print("   ! request failed", url[:110], e)
                return None
            time.sleep(2 * (i + 1))


def wiki_api(lang):
    return f"https://{lang}.wikipedia.org/w/api.php"


def page_images(lang, titles):
    """title → (resolved title, file name or None, wikibase item)"""
    out = {}
    for i in range(0, len(titles), 40):
        chunk = titles[i:i + 40]
        d = get(wiki_api(lang), {"action": "query", "format": "json", "redirects": 1, "titles": "|".join(chunk),
                                 "prop": "pageimages|pageprops", "piprop": "name", "ppprop": "wikibase_item"})
        if not d:
            continue
        q = d.get("query", {})
        back = {t: t for t in chunk}
        for n in q.get("normalized", []):
            back[n["to"]] = back.get(n["from"], n["from"])
        for r in q.get("redirects", []):
            back[r["to"]] = back.get(r["from"], r["from"])
        for p in q.get("pages", {}).values():
            orig = back.get(p.get("title"), p.get("title"))
            if "missing" in p:
                continue
            out[orig] = (p["title"], p.get("pageimage"), p.get("pageprops", {}).get("wikibase_item"))
    return out


def search_title(lang, name):
    d = get(wiki_api(lang), {"action": "query", "format": "json", "list": "search", "srsearch": name, "srlimit": 3})
    if not d:
        return None
    sur = name.split()[-1].lower()
    for r in d.get("query", {}).get("search", []):
        if sur[:5] in r["title"].lower():
            return r["title"]
    return None


def wikidata_search(name):
    d = get("https://www.wikidata.org/w/api.php", {"action": "wbsearchentities", "search": name, "language": "en",
                                                   "type": "item", "limit": 5, "format": "json"})
    if not d:
        return None
    for r in d.get("search", []):
        desc = (r.get("description") or "").lower()
        if any(w in desc for w in ("general", "military", "officer", "marshal", "commander", "soldier", "admiral")):
            return r["id"]
    return None


def wikidata_image(qid):
    d = get("https://www.wikidata.org/w/api.php", {"action": "wbgetentities", "ids": qid, "props": "claims|sitelinks",
                                                   "format": "json"})
    if not d:
        return None, {}
    e = d.get("entities", {}).get(qid, {})
    img = None
    for c in e.get("claims", {}).get("P18", []):
        img = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if img:
            break
    return img, {k: v["title"] for k, v in e.get("sitelinks", {}).items()}


def commons_info(fname):
    d = get("https://commons.wikimedia.org/w/api.php", {
        "action": "query", "format": "json", "titles": f"File:{fname}", "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": 250})
    if not d:
        return None
    for p in d.get("query", {}).get("pages", {}).values():
        ii = (p.get("imageinfo") or [None])[0]
        if not ii:
            return None
        md = ii.get("extmetadata", {})

        def clean(k):
            v = md.get(k, {}).get("value", "")
            v = re.sub(r"<[^>]+>", "", v)
            return html.unescape(v).strip()[:160]
        return {"thumb": ii.get("thumburl") or ii.get("url"), "page": ii.get("descriptionurl"),
                "author": clean("Artist"), "license": clean("LicenseShortName"), "credit": clean("Credit")}
    return None


def crop_portrait(data: bytes) -> Image.Image:
    im = Image.open(io.BytesIO(data))
    im = ImageOps.exif_transpose(im).convert("RGB")
    w, h = im.size
    target = 4 / 5
    if w / h > target:  # too wide → centre crop
        nw = int(h * target)
        x0 = (w - nw) // 2
        im = im.crop((x0, 0, x0 + nw, h))
    else:  # too tall → keep the top (faces sit in the upper part)
        nh = int(w / target)
        y0 = int(min(h - nh, h * 0.04))
        im = im.crop((0, y0, w, y0 + nh))
    return im.resize((240, 300), Image.LANCZOS)


def main():
    force = "--force" in sys.argv
    only = {a for a in sys.argv[1:] if not a.startswith("--")}
    people = json.load(open(APP_DATA / "people.json", encoding="utf-8"))
    credits = json.load(open(CREDITS, encoding="utf-8")) if CREDITS.exists() else {}
    todo = [p for p in people if (not only or p["id"] in only) and (force or p["id"] not in credits)]
    print(f"{len(todo)} people to fetch")
    en = page_images("en", [p["wiki"] for p in todo])
    missing = []
    for p in todo:
        hit = en.get(p["wiki"])
        if not hit:
            t = search_title("en", p["en"])
            if t:
                hit = page_images("en", [t]).get(t)
        fname, qid = (hit[1], hit[2]) if hit else (None, None)
        if not qid and not fname:
            qid = wikidata_search(p["en"])
        src = "enwiki"
        if not fname and qid:
            img, links = wikidata_image(qid)
            if img:
                fname, src = img, "wikidata"
            else:
                for lang in ("de", "ru", "pl", "fr", "it", "uk", "ro", "hu", "fi"):
                    t = links.get(f"{lang}wiki")
                    if not t:
                        continue
                    r = page_images(lang, [t]).get(t)
                    if r and r[1]:
                        fname, src = r[1], f"{lang}wiki"
                        break
        if not fname:
            missing.append(p["id"])
            print(f" - {p['id']:16} no image ({'no article' if not hit else 'article has no free image'})")
            continue
        info = commons_info(fname)
        if not info or not info.get("thumb"):
            missing.append(p["id"])
            print(f" - {p['id']:16} {fname}: not on Commons")
            continue
        data = get(info["thumb"], binary=True)
        if not data:
            missing.append(p["id"])
            continue
        try:
            im = crop_portrait(data)
        except Exception as e:  # noqa: BLE001
            print(f" - {p['id']:16} bad image: {e}")
            missing.append(p["id"])
            continue
        im.save(OUT / f"{p['id']}.jpg", "JPEG", quality=82, optimize=True, progressive=True)
        credits[p["id"]] = {"file": f"{p['id']}.jpg", "src": fname, "page": info["page"],
                            "author": info["author"] or info["credit"], "license": info["license"], "via": src}
        print(f" + {p['id']:16} {fname[:60]} [{info['license']}] via {src}")
        time.sleep(0.15)
    with open(CREDITS, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(credits.items())), f, ensure_ascii=False, indent=1)
    print(f"done: {len(credits)} portraits, missing: {missing}")


if __name__ == "__main__":
    main()
