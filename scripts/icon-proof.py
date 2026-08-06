#!/usr/bin/env python3
"""Show one artwork at the sizes iOS actually renders. Writes nothing but the sheet.

    scripts/icon-proof.py ~/Desktop/logo.png
    scripts/icon-proof.py logo.svg --bg '#ffffff' --scale 0.88 --open

An icon that only works at 1024 is not an icon. 60px is the size that decides it.
"""
import argparse, base64, pathlib, subprocess, sys, tempfile

SIZES = [1024, 180, 120, 60]
SHEET_BG = "#6e6e73"   # neutral mid-grey: neither a light nor a dark home screen


def art_svg(src: pathlib.Path, bg: str | None, scale: float) -> str:
    if src.suffix.lower() == ".svg":
        t = src.read_text()
        inner = t[t.index(">", t.index("<svg")) + 1: t.rindex("</svg>")]
        body = f'<g transform="translate({512*(1-scale):.1f},{512*(1-scale):.1f}) scale({scale})">{inner}</g>'
    else:
        b64 = base64.b64encode(src.read_bytes()).decode()
        s = 1024 * scale
        off = (1024 - s) / 2
        body = (f'<image x="{off:.1f}" y="{off:.1f}" width="{s:.1f}" height="{s:.1f}" '
                f'href="data:image/png;base64,{b64}"/>')
    ground = f'<rect width="1024" height="1024" fill="{bg}"/>' if bg else ""
    return ground + body


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("--bg", default="#0b0c0f")
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--out", default="icon-proof.png")
    ap.add_argument("--open", action="store_true", dest="open_it")
    a = ap.parse_args()

    src = pathlib.Path(a.source).expanduser().resolve()
    if not src.exists():
        print(f"no such file: {src}", file=sys.stderr)
        return 1

    art = art_svg(src, a.bg, a.scale)
    # Each tile is drawn at 300 and the artwork scaled into it, so what you see is
    # the real downscale, not a big render shrunk by the viewer.
    pad, gap, label_h = 60, 40, 70
    xs, x = [], pad
    for px in SIZES:
        xs.append(x)
        x += max(px, 60) + gap
    w = x - gap + pad
    h = pad + SIZES[0] + label_h

    tiles = []
    for i, (px, tx) in enumerate(zip(SIZES, xs)):
        ty = pad + (SIZES[0] - px) // 2
        tiles.append(
            f'<clipPath id="k{i}"><rect x="{tx}" y="{ty}" width="{px}" height="{px}" '
            f'rx="{px*0.2237:.1f}"/></clipPath>'
            f'<g clip-path="url(#k{i})"><g transform="translate({tx},{ty}) scale({px/1024})">{art}</g></g>'
            f'<text x="{tx + px/2:.0f}" y="{pad + SIZES[0] + 40}" fill="#e8e8ea" '
            f'font-family="monospace" font-size="20" text-anchor="middle">{px}px</text>')

    sheet = (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
             f'width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
             f'<rect width="{w}" height="{h}" fill="{SHEET_BG}"/>{"".join(tiles)}</svg>')

    with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False) as f:
        f.write(sheet)
        tmp = f.name
    out = pathlib.Path(a.out).resolve()
    subprocess.run(["rsvg-convert", "-w", str(w), tmp, "-o", str(out)], check=True)
    print(f"wrote {out}")
    if a.open_it:
        subprocess.run(["open", str(out)])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
