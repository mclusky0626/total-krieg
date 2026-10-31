"""Step 2 of the relief build: sample Natural Earth I shaded relief (public domain)
on the projected grid from build_relief.mjs, recolour it to a muted olive
"war map" palette, push land colours into the sea (the app paints the sea from
vector data) and write public/img/relief.webp + public/data/relief.json.
"""
import json

import numpy as np
from PIL import Image, ImageFilter

from common import BUILD, ROOT, SRC, write_json

Image.MAX_IMAGE_PIXELS = None


def bilinear(img, x, y):
    h, w = img.shape[:2]
    x = np.clip(x, 0, w - 1.001); y = np.clip(y, 0, h - 1.001)
    x0 = np.floor(x).astype(np.int32); y0 = np.floor(y).astype(np.int32)
    fx = (x - x0)[..., None]; fy = (y - y0)[..., None]
    a = img[y0, x0]; b = img[y0, x0 + 1]; c = img[y0 + 1, x0]; d = img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def main():
    meta = json.load(open(BUILD / "relief_meta.json"))
    w, h = meta["width"], meta["height"]
    lon = np.fromfile(BUILD / "relief_lon.f32", dtype=np.float32).reshape(h, w)
    lat = np.fromfile(BUILD / "relief_lat.f32", dtype=np.float32).reshape(h, w)

    src = Image.open(SRC / "ne1" / "NE1_50M_SR_W" / "NE1_50M_SR_W.tif")
    ppd = src.width / 360.0
    # crop generously around the AOI to keep memory small
    W, S, E, N = -60, 10, 120, 90
    cx0, cy0 = int((W + 180) * ppd), int((90 - N) * ppd)
    crop = np.asarray(src.crop((cx0, cy0, int((E + 180) * ppd), int((90 - S) * ppd)))).astype(np.float32)
    X = (lon + 180) * ppd - cx0 - 0.5
    Y = (90 - lat) * ppd - cy0 - 0.5
    rgb = bilinear(crop, X, Y)

    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    sea = (b > r + 40) & (b > g + 10)

    # ---- grade towards a dark olive palette --------------------------------
    lum = (0.30 * r + 0.59 * g + 0.11 * b) / 255.0
    # land-cover "greenness" (forest/tundra are greener than steppe/desert)
    green = np.clip((g - b) / 255.0 * 2.2 + (g - r) / 255.0 * 3.0, -0.3, 0.6)
    dryness = np.clip((r - g) / 255.0 * 6 + (r + g - 2 * b) / 255.0 * 0.6 - 0.25, 0, 1)
    base_green = np.array([96, 112, 70], np.float32)     # olive
    base_forest = np.array([62, 84, 56], np.float32)     # dark forest green
    base_dry = np.array([150, 138, 96], np.float32)      # steppe / desert tan
    t_forest = np.clip(green * 2.4, 0, 1)[..., None]
    col = base_green * (1 - t_forest) + base_forest * t_forest
    col = col * (1 - dryness[..., None] * 0.85) + base_dry * dryness[..., None] * 0.85
    # relief shading from the luminance relative to a blurred version
    land = (~sea).astype(np.float32)

    def blur(a, rad):
        im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
        return np.asarray(im.filter(ImageFilter.GaussianBlur(rad))).astype(np.float32) / 255.0
    # land-only local mean, so coasts do not get a bright rim
    Lb = blur(lum * land, 9) / np.maximum(blur(land, 9), 1e-3)
    shade = np.clip(1.0 + (lum - Lb) * 3.2, 0.55, 1.45)
    shade = np.where(sea, 1.0, shade)
    col = col * shade[..., None] * (0.80 + lum[..., None] * 0.26)
    col = np.clip(col, 0, 255)

    # ---- push land colours into the sea (vector sea is drawn on top) ---------
    out = col.copy()
    bad = sea.copy()
    for _ in range(14):
        if not bad.any():
            break
        acc = np.zeros_like(out); cnt = np.zeros(bad.shape, np.float32)
        good = ~bad
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            gs = np.roll(good, (dy, dx), axis=(0, 1)); vs = np.roll(out, (dy, dx), axis=(0, 1))
            acc += vs * gs[..., None]; cnt += gs
        fill = bad & (cnt > 0)
        out[fill] = acc[fill] / cnt[fill][:, None]
        bad &= ~fill
    out[bad] = np.array([70, 86, 60], np.float32)

    img = Image.fromarray(out.astype(np.uint8), "RGB")
    dst = ROOT / "public" / "img" / "relief.webp"
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, "WEBP", quality=78, method=6)
    img.resize((w // 4, h // 4)).save(BUILD / "relief_preview.jpg", quality=85)
    print("relief", img.size, dst.stat().st_size // 1024, "KB")
    write_json(ROOT / "public" / "data" / "relief.json",
               {"src": "img/relief.webp", "bounds": meta["bounds"], "width": w, "height": h})


if __name__ == "__main__":
    main()
