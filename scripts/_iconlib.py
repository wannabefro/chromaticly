"""Shared helper: normalise artwork to fill the icon square."""
import pathlib, tempfile

CANVAS = 1024


def fit_png(src: pathlib.Path, fit: float) -> pathlib.Path:
    """Crop to the artwork's own alpha bounds, then centre it at `fit` of the square.

    Art exported from a design tool usually carries uneven margins, so scaling the
    file as a whole leaves the mark small and off-centre inside the icon mask.
    """
    from PIL import Image

    im = Image.open(src).convert("RGBA")
    box = im.getbbox()
    if box is None:
        return src
    art = im.crop(box)
    target = int(CANVAS * fit)
    scale = target / max(art.width, art.height)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))),
                     Image.LANCZOS)
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(art, ((CANVAS - art.width) // 2, (CANVAS - art.height) // 2), art)
    tmp = pathlib.Path(tempfile.mkdtemp()) / "fitted.png"
    out.save(tmp)
    return tmp


def relight_ink(src: pathlib.Path, dest: pathlib.Path, to=(246, 244, 238),
                cutoff: int = 110, max_chroma: int = 60) -> None:
    """Recolour the artwork's near-black ink so it reads on a dark backdrop.

    Only low-chroma dark pixels move, so the coloured wedges are untouched. The
    ramp is soft rather than a threshold, or antialiased edges between ink and
    colour turn to jagged fringes.
    """
    from PIL import Image

    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hi, lo = max(r, g, b), min(r, g, b)
            if hi >= cutoff or (hi - lo) >= max_chroma:
                continue
            t = min(1.0, (cutoff - hi) / 40.0)
            px[x, y] = (round(r + (to[0] - r) * t), round(g + (to[1] - g) * t),
                        round(b + (to[2] - b) * t), a)
    im.save(dest)


def silhouette(src: pathlib.Path, dest: pathlib.Path, colour=(255, 255, 255)) -> None:
    """Android's themed-icon layer: the artwork's own alpha, flattened to one colour.

    Semi-transparent edge pixels are pushed to fully opaque — a soft-edged mask
    renders as a grey haze once the launcher recolours it.
    """
    from PIL import Image

    alpha = Image.open(src).convert("RGBA").getchannel("A").point(lambda v: 255 if v > 32 else 0)
    out = Image.new("RGBA", alpha.size, colour + (0,))
    out.putalpha(alpha)
    out.paste(Image.new("RGB", alpha.size, colour), (0, 0), alpha)
    out.putalpha(alpha)
    out.save(dest)
