#!/usr/bin/env python3
"""Export one source artwork to every icon asset app.json references.

    scripts/export-icon.py design/brand/chromaticly-icon.svg
    scripts/export-icon.py logo.png --bg '#ffffff' --scale 0.88

Source may be SVG or PNG. Needs rsvg-convert (brew install librsvg).
"""
import argparse, base64, pathlib, subprocess, sys, tempfile

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT = REPO / "assets/images"

# Android crops the adaptive layers to a 66.7% centred zone. Everything outside
# it can be masked away on some launchers, so the mark is inset for those two.
ANDROID_SAFE = 0.78


sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _iconlib import fit_png, silhouette  # noqa: E402


def ground_only(bg: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" '
            f'height="1024"><rect width="1024" height="1024" fill="{bg}"/></svg>')


def rounded_card(src: pathlib.Path, bg: str, scale: float) -> str:
    """The splash art on its own rounded card, so a light mark can sit on a dark
    splash without a full-screen colour change."""
    inner = wrap(src, None, scale)
    body = inner[inner.index(">", inner.index("<svg")) + 1: inner.rindex("</svg>")]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'viewBox="0 0 1024 1024" width="1024" height="1024">'
            f'<rect width="1024" height="1024" rx="229" fill="{bg}"/>{body}</svg>')


def wrap(src: pathlib.Path, bg: str | None, scale: float) -> str:
    """A 1024 SVG holding the source, optionally over an opaque ground."""
    if src.suffix.lower() == ".svg":
        inner = src.read_text()
        inner = inner[inner.index(">", inner.index("<svg")) + 1: inner.rindex("</svg>")]
        art = f'<g transform="translate({512*(1-scale):.1f},{512*(1-scale):.1f}) scale({scale})">{inner}</g>'
    else:
        b64 = base64.b64encode(src.read_bytes()).decode()
        s = 1024 * scale
        off = (1024 - s) / 2
        art = (f'<image x="{off:.1f}" y="{off:.1f}" width="{s:.1f}" height="{s:.1f}" '
               f'href="data:image/png;base64,{b64}"/>')
    ground = f'<rect width="1024" height="1024" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'viewBox="0 0 1024 1024" width="1024" height="1024">{ground}{art}</svg>')


def render(svg_text: str, dest: pathlib.Path, px: int) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False) as f:
        f.write(svg_text)
        tmp = f.name
    subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), tmp, "-o", str(dest)], check=True)


def has_alpha(p: pathlib.Path) -> bool:
    r = subprocess.run(["sips", "-g", "hasAlpha", str(p)], capture_output=True, text=True)
    return "yes" in r.stdout


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("--bg", default="#0b0c0f", help="opaque ground for the iOS/web assets")
    ap.add_argument("--scale", type=float, default=1.0, help="scale the artwork inside the square")
    ap.add_argument("--fit", type=float, default=None, metavar="F",
                    help="crop to the art's own alpha bounds and centre it at F of the square (e.g. 0.86)")
    a = ap.parse_args()

    src = pathlib.Path(a.source).resolve()
    if not src.exists():
        print(f"no such file: {src}", file=sys.stderr)
        return 1
    if a.fit:
        src = fit_png(src, a.fit)
        print(f"fitted to {a.fit:.0%} of the square, centred on the artwork's own bounds\n")

    # The Android background layer is the ground alone — the artwork lives in the
    # foreground layer, which the launcher parallaxes over it.
    render(ground_only(a.bg), OUT / "android-icon-background.png", 1024)
    render(rounded_card(src, a.bg, a.scale), OUT / "splash-icon.png", 512)
    print(f"{'splash-icon.png':32} 512x512  {(OUT / 'splash-icon.png').stat().st_size // 1024} KB")
    jobs = [
        ("icon.png", a.bg, a.scale, 1024),
        ("favicon.png", a.bg, a.scale, 64),
        ("android-icon-foreground.png", None, a.scale * ANDROID_SAFE, 1024),
    ]
    for name, bg, scale, px in jobs:
        render(wrap(src, bg, scale), OUT / name, px)
        print(f"{name:32} {px}x{px}  {(OUT / name).stat().st_size // 1024} KB")

    # The App Store artwork is rejected outright if it carries an alpha channel.
    # Inset to match the foreground layer: the launcher crops both the same way.
    mono_src = wrap(src, None, a.scale * ANDROID_SAFE)
    with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False) as f:
        f.write(mono_src)
    render(mono_src, OUT / "_mono-tmp.png", 1024)
    silhouette(OUT / "_mono-tmp.png", OUT / "android-icon-monochrome.png")
    (OUT / "_mono-tmp.png").unlink()
    print(f"{'android-icon-monochrome.png':32} 1024x1024  "
          f"{(OUT / 'android-icon-monochrome.png').stat().st_size // 1024} KB")

    bad = [n for n, want in [("icon.png", False), ("favicon.png", False),
                             ("android-icon-background.png", False),
                             ("android-icon-foreground.png", True),
                             ("android-icon-monochrome.png", True)]
           if has_alpha(OUT / n) != want]
    if bad:
        print("\nALPHA WRONG: " + ", ".join(bad), file=sys.stderr)
        return 1
    print("\nalpha correct on every file")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
