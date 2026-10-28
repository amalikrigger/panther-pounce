#!/usr/bin/env python3
"""
Panther Pounce - pixel-art sprite generator.

Draws every game sprite in code and writes the PNGs into ../sprites/.
It uses only the Python standard library (no Pillow), so any school
computer with Python 3 can run it from the repo root:

    python tools/make_sprites.py

How it works: each sprite is drawn on a small grid of "retro pixels"
(for example 15x15 for the panther), then scaled up with
nearest-neighbour sampling to the exact size the game expects.

IMPORTANT: the physics engine sizes each body from its image size
(box = whole image, circle radius = image height / 2). Every sprite
keeps the exact pixel size of the file it replaces, so levels still
line up. If you change a size here, the physics changes too.
"""
import math
import os
import random
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, '..', 'sprites'))

# Moon on the title screen and static background: 'blood' or 'harvest'.
# (The live background reads its moon colors from css/theme.css.)
MOON = 'blood'

# Keep these in sync with css/theme.css.
PALETTE = {
    'ink': '#0b0418', 'night': '#1a0b33', 'purple': '#2e1257',
    'violet': '#4b1d7a', 'plum': '#6b2a7a',
    'gold': '#f6bc1b', 'goldhi': '#ffe48a', 'golddk': '#b8860b',
    'maroon': '#701114', 'blood': '#b3121b',
    'pumpkin': '#ff7a1a', 'pumpkinhi': '#ffb347', 'pumpkinlo': '#b84a00',
    'toxic': '#7cff4f', 'toxicdk': '#2f6e2a',
    'ghost': '#eae6ff', 'ghostlo': '#a99fd6',
    'ghoul': '#6fcf4a', 'ghoulhi': '#a6ef7a', 'ghoullo': '#3e8f34', 'ghouldk': '#24582a',
    'hair': '#1b1424', 'fur': '#1b1424', 'furhi': '#3a2d4d',
    'stone': '#6d6a78', 'stonehi': '#9a97a6', 'stonelo': '#45424f', 'mortar': '#2c2a33',
    'wood': '#6b4226', 'woodhi': '#8f5e36', 'woodlo': '#432814', 'wooddk': '#2a170b',
    'bark': '#3b2a22', 'barkhi': '#5c4436', 'barklo': '#22160f',
    'bone': '#e8dfc4', 'iron': '#3a3a44', 'ironhi': '#8a8a98',
    'moss': '#3f6b2a', 'mosshi': '#5f8f3a', 'stem': '#4f6b2a',
    'soilhi': '#4a2a45', 'soil': '#2e1a33', 'soillo': '#170c1c',
    'silfar': '#22103f', 'silmid': '#150828', 'silnear': '#07030f',
    'window': '#ffb347', 'black': '#07030f', 'white': '#ffffff',
}

# fill, highlight, crater, glow (glow is pre-blended with the sky)
MOONS = {
    'blood': ('#c62a2f', '#ef5a4c', '#8e1a22', '#4a0f2a'),
    'harvest': ('#f6bc1b', '#ffe48a', '#c98a10', '#5a3a1a'),
}

# Ordered-dither matrix: gives gradients that chunky, retro, banded look.
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

# 5x7 pixel font. 'X' = filled. Rows separated by '/'.
FONT = {
    'A': '.XXX./X...X/X...X/XXXXX/X...X/X...X/X...X',
    'B': 'XXXX./X...X/X...X/XXXX./X...X/X...X/XXXX.',
    'C': '.XXX./X...X/X..../X..../X..../X...X/.XXX.',
    'D': 'XXXX./X...X/X...X/X...X/X...X/X...X/XXXX.',
    'E': 'XXXXX/X..../X..../XXXX./X..../X..../XXXXX',
    'F': 'XXXXX/X..../X..../XXXX./X..../X..../X....',
    'G': '.XXX./X...X/X..../X.XXX/X...X/X...X/.XXXX',
    'H': 'X...X/X...X/X...X/XXXXX/X...X/X...X/X...X',
    'I': '.XXX./..X../..X../..X../..X../..X../.XXX.',
    'J': '..XXX/...X./...X./...X./...X./X..X./.XX..',
    'K': 'X...X/X..X./X.X../XX.../X.X../X..X./X...X',
    'L': 'X..../X..../X..../X..../X..../X..../XXXXX',
    'M': 'X...X/XX.XX/X.X.X/X.X.X/X...X/X...X/X...X',
    'N': 'X...X/X...X/XX..X/X.X.X/X..XX/X...X/X...X',
    'O': '.XXX./X...X/X...X/X...X/X...X/X...X/.XXX.',
    'P': 'XXXX./X...X/X...X/XXXX./X..../X..../X....',
    'Q': '.XXX./X...X/X...X/X...X/X.X.X/X..X./.XX.X',
    'R': 'XXXX./X...X/X...X/XXXX./X.X../X..X./X...X',
    'S': '.XXXX/X..../X..../.XXX./....X/....X/XXXX.',
    'T': 'XXXXX/..X../..X../..X../..X../..X../..X..',
    'U': 'X...X/X...X/X...X/X...X/X...X/X...X/.XXX.',
    'V': 'X...X/X...X/X...X/X...X/X...X/.X.X./..X..',
    'W': 'X...X/X...X/X...X/X.X.X/X.X.X/X.X.X/.X.X.',
    'X': 'X...X/X...X/.X.X./..X../.X.X./X...X/X...X',
    'Y': 'X...X/X...X/.X.X./..X../..X../..X../..X..',
    'Z': 'XXXXX/....X/...X./..X../.X.../X..../XXXXX',
    '0': '.XXX./X...X/X..XX/X.X.X/XX..X/X...X/.XXX.',
    '1': '..X../.XX../..X../..X../..X../..X../.XXX.',
    '2': '.XXX./X...X/....X/...X./..X../.X.../XXXXX',
    '3': 'XXXX./....X/....X/.XXX./....X/....X/XXXX.',
    '4': '...X./..XX./.X.X./X..X./XXXXX/...X./...X.',
    '5': 'XXXXX/X..../XXXX./....X/....X/X...X/.XXX.',
    '6': '..XX./.X.../X..../XXXX./X...X/X...X/.XXX.',
    '7': 'XXXXX/....X/...X./..X../.X.../.X.../.X...',
    '8': '.XXX./X...X/X...X/.XXX./X...X/X...X/.XXX.',
    '9': '.XXX./X...X/X...X/.XXXX/....X/...X./.XX..',
    '!': '..X../..X../..X../..X../..X../...../..X..',
    '-': '...../...../...../.XXX./...../...../.....',
    '.': '...../...../...../...../...../...../..X..',
    ' ': '...../...../...../...../...../...../.....',
}


def rgba(c):
    """'name' | '#rrggbb' | ('name', alpha) | (r, g, b, a) -> (r, g, b, a) or None."""
    if c is None:
        return None
    alpha = 255
    if isinstance(c, tuple):
        if len(c) == 4:
            return c
        c, alpha = c
    c = PALETTE.get(c, c)
    return (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), alpha)


class Img:
    """A tiny pixel canvas. None = transparent."""

    def __init__(self, w, h, fill=None):
        self.w, self.h = w, h
        f = rgba(fill)
        self.px = [[f] * w for _ in range(h)]

    def _put(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c

    def set(self, x, y, c):
        self._put(int(math.floor(x)), int(math.floor(y)), rgba(c))

    def rect(self, x, y, w, h, c):
        c = rgba(c)
        x, y, w, h = int(x), int(y), int(w), int(h)
        for yy in range(max(0, y), min(self.h, y + h)):
            row = self.px[yy]
            for xx in range(max(0, x), min(self.w, x + w)):
                row[xx] = c

    def ellipse(self, cx, cy, rx, ry, c):
        c = rgba(c)
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                    self._put(x, y, c)

    def disc(self, cx, cy, r, c):
        self.ellipse(cx, cy, r, r, c)

    def line(self, x0, y0, x1, y1, c, t=1):
        x0, y0, x1, y1 = (int(round(v)) for v in (x0, y0, x1, y1))
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.rect(x0, y0, t, t, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def ascii(self, x, y, rows, pal, s=1):
        """Stamp ASCII art. pal maps characters to colors; other chars are skipped."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if pal.get(ch) is not None:
                    self.rect(x + i * s, y + j * s, s, s, pal[ch])

    def blit(self, src, x, y, s=1):
        for j in range(src.h):
            for i in range(src.w):
                if src.px[j][i] is not None:
                    self.rect(x + i * s, y + j * s, s, s, src.px[j][i])

    def outline(self, c):
        """Add a 1-pixel outline around everything drawn so far."""
        c = rgba(c)
        src = [row[:] for row in self.px]
        for y in range(self.h):
            for x in range(self.w):
                if src[y][x] is not None:
                    continue
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h and src[ny][nx] is not None:
                        self.px[y][x] = c
                        break
        return self

    def vgrad(self, x, y, w, h, stops):
        """Dithered vertical gradient through a list of colors."""
        cols = [rgba(s) for s in stops]
        segs = len(cols) - 1
        for yy in range(h):
            t = yy / max(1, h - 1) * segs
            k = min(int(t), segs - 1)
            f = t - k
            for xx in range(w):
                X, Y = x + xx, y + yy
                lim = (BAYER[Y % 4][X % 4] + 0.5) / 16
                self._put(X, Y, cols[k + 1] if f > lim else cols[k])

    def glow(self, cx, cy, r0, r1, c):
        """Dithered halo between radius r0 and r1, densest on the inside."""
        c = rgba(c)
        for y in range(int(cy - r1) - 1, int(cy + r1) + 2):
            for x in range(int(cx - r1) - 1, int(cx + r1) + 2):
                d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
                if r0 <= d <= r1 and 1 - (d - r0) / (r1 - r0) > (BAYER[y % 4][x % 4] + 0.5) / 16:
                    self._put(x, y, c)

    def text(self, x, y, s, c, scale=1, outline=None, ot=1, shadow=None):
        """Draw text with the 5x7 font. c may be a function(glyph_row) for gradients."""
        def draw(ox, oy, col):
            cx = x
            for ch in s.upper():
                for j, row in enumerate(FONT.get(ch, FONT[' ']).split('/')):
                    cc = col(j) if callable(col) else col
                    for i, v in enumerate(row):
                        if v == 'X':
                            self.rect(cx + i * scale + ox, y + j * scale + oy, scale, scale, cc)
                cx += 6 * scale

        if shadow:
            for dx in range(-ot, ot + 1):
                for dy in range(-ot, ot + 1):
                    draw(dx + scale, dy + scale, shadow)
        if outline:
            for dx in range(-ot, ot + 1):
                for dy in range(-ot, ot + 1):
                    if dx or dy:
                        draw(dx, dy, outline)
        draw(0, 0, c)

    def save(self, name, W=None, H=None):
        """Scale (nearest neighbour) to W x H and write an RGBA PNG."""
        W, H = W or self.w, H or self.h
        xmap = [x * self.w // W for x in range(W)]
        cache, raw = {}, bytearray()
        for Y in range(H):
            sy = Y * self.h // H
            if sy not in cache:
                src = self.px[sy]
                row = bytearray()
                for sx in xmap:
                    row += bytes(src[sx] or (0, 0, 0, 0))
                cache[sy] = bytes(row)
            raw += b'\x00' + cache[sy]

        def chunk(tag, data):
            return (struct.pack('>I', len(data)) + tag + data +
                    struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

        png = (b'\x89PNG\r\n\x1a\n' +
               chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)) +
               chunk(b'IDAT', zlib.compress(bytes(raw), 9)) +
               chunk(b'IEND', b''))
        with open(os.path.join(OUT_DIR, name), 'wb') as f:
            f.write(png)
        print('  %-16s %4d x %d' % (name, W, H))


def text_width(s, scale=1):
    return (6 * len(s) - 1) * scale


def tri(g, x, base, w, c):
    """Stepped triangle (pixel roof) sitting on y=base."""
    r = 0
    while r * 2 < w:
        g.rect(x + r, base - r - 1, w - 2 * r, 1, c)
        r += 1


# ---------------------------------------------------------------- characters

PANTHER = [
    '...............',
    '..K.........K..',
    '.KKK.......KKK.',
    '.KMKKKKKKKKKMK.',
    '.KKKKKKKKKKKKK.',
    '.KKGGGKKKGGGKK.',
    '.KKGBGKKKGBGKK.',
    '.KKGGGKKKGGGKK.',
    '.KKKKKKKKKKKKK.',
    '.KkKKKKNKKKKkK.',
    '.KKKKKMKMKKKKK.',
    '..KKKKWKWKKKK..',
    '...KKKKKKKKK...',
    '.....KKKKK.....',
    '...............',
]


def panther():
    """The hero: a black panther head with gold eyes and a gold rim."""
    g = Img(15, 15)
    g.ascii(0, 0, PANTHER, {'K': 'fur', 'k': 'furhi', 'M': 'maroon', 'G': 'gold',
                            'B': 'black', 'N': 'blood', 'W': 'bone'})
    return g.outline('gold')


def ghoul():
    """Enemy: a round Frankenstein ghoul with neck bolts. Circle body."""
    g = Img(26, 26)
    cx, cy, r = 13, 14, 10.5
    for y in range(26):
        for x in range(26):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            if dx * dx + dy * dy <= r * r:
                col = 'ghoul'
                if dx + dy > r * 0.8:
                    col = 'ghoullo'
                elif dx + dy < -r * 0.9:
                    col = 'ghoulhi'
                g.set(x, y, col)
    g.rect(5, 3, 16, 5, 'hair')                 # flat-top hair
    g.rect(6, 4, 14, 1, 'furhi')
    for x in range(5, 21, 2):                   # fringe
        g.set(x, 8, 'hair')
    for bx in (1, 22):                          # neck bolts
        g.rect(bx, 15, 3, 3, 'iron')
        g.set(bx, 15, 'ironhi')
    g.rect(6, 10, 14, 1, 'hair')                # unibrow
    g.rect(7, 11, 4, 3, 'white')
    g.rect(15, 11, 4, 3, 'white')
    g.rect(7, 12, 2, 2, 'black')                # looking toward the slingshot
    g.rect(15, 12, 2, 2, 'black')
    g.line(19, 15, 19, 19, 'ghouldk')           # stitched scar
    for yy in (16, 18):
        g.set(18, yy, 'ghouldk')
        g.set(20, yy, 'ghouldk')
    g.rect(9, 18, 8, 2, 'black')                # grin
    g.set(8, 17, 'black')
    g.set(17, 17, 'black')
    g.set(10, 18, 'bone')
    g.set(15, 18, 'bone')
    return g.outline('black')


JACK_EYE = ['..Y..', '.YYY.', 'YYYYY']
JACK_NOSE = ['.Y.', 'YYY']
JACK_MOUTH = ['YY.YYYYYYYYY.YY', '.YYYYY.Y.YYYYY.', '...YYYYYYYYY...']


def jack():
    """Jack-o'-lantern (replaces the boulder)."""
    g = Img(25, 24)
    cx, cy, rx, ry = 12.5, 13.5, 11.5, 9.5
    for y in range(24):
        for x in range(25):
            u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if u * u + v * v <= 1:
                col = 'pumpkin'
                if abs(abs(u) - 0.45) < 0.09 or v > 0.65 or u > 0.78:
                    col = 'pumpkinlo'
                elif u < -0.45 and v < -0.2:
                    col = 'pumpkinhi'
                g.set(x, y, col)
    g.rect(11, 1, 3, 4, 'stem')
    g.set(14, 1, 'stem')
    pal = {'Y': 'goldhi'}
    g.ascii(5, 9, JACK_EYE, pal)
    g.ascii(15, 9, JACK_EYE, pal)
    g.ascii(11, 12, JACK_NOSE, pal)
    g.ascii(5, 15, JACK_MOUTH, pal)
    return g.outline('black')


def tombstone():
    g = Img(22, 25)
    g.disc(11, 10, 9, 'stone')
    g.rect(2, 10, 18, 14, 'stone')
    g.rect(3, 6, 1, 17, 'stonehi')
    g.text(3, 10, 'RIP', 'stonelo')
    g.rect(2, 22, 18, 2, 'moss')
    return g.outline('black')


# ---------------------------------------------------------------- blocks

def crate():
    """Decayed timber crate (wood1). Full-image box body."""
    rnd = random.Random(11)
    g = Img(27, 27, 'wood')
    for y in range(27):
        if y % 6 == 5:
            g.rect(0, y, 27, 1, 'wooddk')
        elif y % 6 == 0:
            g.rect(0, y, 27, 1, 'woodhi')
    for _ in range(50):
        g.rect(rnd.randrange(27), rnd.randrange(27), rnd.choice((1, 2, 3)), 1,
               rnd.choice(('woodlo', 'woodhi')))
    g.line(3, 23, 23, 3, 'woodhi', 2)           # diagonal brace
    g.line(5, 24, 24, 5, 'woodlo')
    for side in ((0, 0, 27, 2), (0, 25, 27, 2), (0, 0, 2, 27), (25, 0, 2, 27)):
        g.rect(*side, 'woodlo')
    for side in ((0, 0, 27, 1), (0, 26, 27, 1), (0, 0, 1, 27), (26, 0, 1, 27)):
        g.rect(*side, 'wooddk')
    for x, y in ((3, 3), (23, 3), (3, 23), (23, 23)):
        g.set(x, y, 'ironhi')
        g.set(x + 1, y + 1, 'iron')
    for _ in range(8):                          # rot and moss creeping up
        g.set(rnd.randrange(2, 25), rnd.randrange(21, 25), rnd.choice(('moss', 'mosshi')))
    return g


def plank():
    """Rotten plank (wood2)."""
    rnd = random.Random(7)
    g = Img(67, 6, 'wood')
    g.rect(0, 0, 67, 1, 'wooddk')
    g.rect(0, 1, 67, 1, 'woodhi')
    g.rect(0, 5, 67, 1, 'wooddk')
    for _ in range(14):
        g.rect(rnd.randrange(2, 60), rnd.randrange(2, 5), rnd.randrange(3, 9), 1, 'woodlo')
    for x in (2, 64):
        g.set(x, 2, 'ironhi')
        g.set(x, 3, 'iron')
    g.line(30, 1, 33, 4, 'wooddk')
    g.rect(0, 0, 1, 6, 'wooddk')
    g.rect(66, 0, 1, 6, 'wooddk')
    return g


def masonry(w, h, seed, moss=True):
    """Weathered crypt stone bricks (dirt / platform)."""
    rnd = random.Random(seed)
    g = Img(w, h, 'stone')
    bh, bw = 6, 12
    for y in range(h):
        if y % bh == 0:
            g.rect(0, y, w, 1, 'mortar')
            continue
        off = ((y // bh) % 2) * (bw // 2)
        for x in range(w):
            if (x + off) % bw == 0:
                g.set(x, y, 'mortar')
            elif y % bh == 1:
                g.set(x, y, 'stonehi')
            elif y % bh == bh - 1:
                g.set(x, y, 'stonelo')
    stone = rgba('stone')
    for _ in range(w * h // 12):
        x, y = rnd.randrange(w), rnd.randrange(h)
        if g.px[y][x] == stone:
            g.set(x, y, rnd.choice(('stonelo', 'stonehi')))
    for _ in range(max(1, w * h // 300)):       # cracks
        x, y = rnd.randrange(w), rnd.randrange(h)
        for _ in range(rnd.randrange(4, 9)):
            g.set(x, y, 'mortar')
            x += rnd.choice((-1, 0, 1))
            y += 1
    g.rect(0, 0, 1, h, 'mortar')
    g.rect(w - 1, 0, 1, h, 'mortar')
    g.rect(0, h - 1, w, 1, 'mortar')
    if moss:
        for x in range(w):
            d = rnd.choice((0, 1, 1, 2, 3))
            g.rect(x, 0, 1, d, 'moss')
            if d:
                g.set(x, 0, 'mosshi')
    return g


def crypt():
    """Crypt pillar (platform)."""
    g = masonry(64, 65, 17)
    g.disc(32, 34, 7, 'mortar')
    g.rect(25, 34, 14, 31, 'mortar')
    g.disc(32, 35, 5.5, 'black')
    g.rect(27, 35, 11, 30, 'black')
    return g


# ---------------------------------------------------------------- slingshot

def bark_column(g, y, cx, w):
    left = int(round(cx - w / 2))
    g.rect(left, y, w, 1, 'bark')
    g.set(left, y, 'barkhi')
    g.set(left + w - 1, y, 'barklo')
    return left


def sling_back():
    """Gnarled dead-tree trunk (sling1). Rubber ties on near the top right."""
    rnd = random.Random(5)
    g = Img(13, 66)
    for y in range(66):
        cx = 10 - 4 * y / 65
        w = 1 if y == 0 else 2 if y < 45 else 3 if y < 60 else 4 + (y - 60) // 2
        left = bark_column(g, y, cx, w)
        if 7 <= y <= 12:                         # orange tape where the band ties on
            g.rect(left - 1, y, w + 2, 1, 'pumpkin' if y % 2 else 'ink')
        elif rnd.random() < 0.12:
            g.set(left + rnd.randrange(w), y, 'barklo')
    return g.outline('black')


def sling_front():
    """Front fork arm (sling2), leaning up and to the left."""
    rnd = random.Random(6)
    g = Img(14, 41)
    for y in range(41):
        cx = 4 + 8.5 * y / 40
        w = 2 if y < 30 else 3
        left = bark_column(g, y, cx, w)
        if 7 <= y <= 12:
            g.rect(left - 1, y, w + 2, 1, 'pumpkin' if y % 2 else 'ink')
        elif rnd.random() < 0.12:
            g.set(left + rnd.randrange(w), y, 'barklo')
    return g.outline('black')


def rubber():
    """Band segment (sling3). The game stretches it sideways."""
    g = Img(5, 16)
    for y, col in enumerate(['ink', 'pumpkinlo', 'pumpkin', 'pumpkinhi'] + ['pumpkin'] * 8 +
                            ['pumpkin', 'pumpkinlo', 'pumpkinlo', 'ink']):
        g.rect(0, y, 5, 1, col)
    return g


# ---------------------------------------------------------------- effects

def trail_puff():
    """Ghostly flight-trail dot (smoke)."""
    g = Img(11, 11)
    g.disc(5.5, 5.5, 4.5, ('ghostlo', 170))
    g.disc(5, 5, 3, ('ghost', 220))
    return g


def poof_strip():
    """5-frame 'poof' animation, stacked vertically (smoke_big)."""
    rnd = random.Random(9)
    g = Img(16, 80)
    frames = [(3, 'goldhi', 1.0, True), (4.5, 'pumpkin', 0.9, False),
              (6, 'toxic', 0.7, False), (7, 'ghostlo', 0.45, False), (7.5, 'ghost', 0.2, False)]
    for i, (r, col, dens, filled) in enumerate(frames):
        for y in range(16):
            for x in range(16):
                d = math.hypot(x + 0.5 - 8, y + 0.5 - 8)
                hit = d <= r if filled else r - 1.6 <= d <= r
                if hit and rnd.random() < dens:
                    g.set(x, i * 16 + y, col)
    return g


# ---------------------------------------------------------------- UI

ICON_GRID = (['XXX.XXX.XXX'] * 3 + ['...........']) * 2 + ['XXX.XXX.XXX'] * 3
ICON_PLAY = ['XX.........', 'XXXX.......', 'XXXXXX.....', 'XXXXXXXX...', 'XXXXXXXXXX.',
             'XXXXXXXXXXX', 'XXXXXXXXXX.', 'XXXXXXXX...', 'XXXXXX.....', 'XXXX.......',
             'XX.........']
ICON_BACK = ['....X......', '...XX......', '..XXXXXXXXX', '.XXXXXXXXXX', '..XXXXXXXXX',
             '...XX......', '....X......']

LOCK = [
    '................',
    '.....SSSSSS.....',
    '....SS....SS....',
    '....S......S....',
    '....S......S....',
    '..OOOOOOOOOOOO..',
    '..OHHHHHHHHHHO..',
    '..OGGGGGGGGGGO..',
    '..OGGGGKKGGGGO..',
    '..OGGGGKKGGGGO..',
    '..OGGGGKKGGGGO..',
    '..OGGGGGGGGGGO..',
    '..OGGGGGGGGGGO..',
    '..OddddddddddO..',
    '..OOOOOOOOOOOO..',
    '................',
]

BAT = ['XX.....XX', '.XXX.XXX.', '...XXX...']


def button(g, x, y, w, h, fill='violet', rim='pumpkin', hi='plum', lo='purple'):
    """Chunky arcade button with cut corners."""
    g.rect(x + 1, y, w - 2, h, 'black')
    g.rect(x, y + 1, w, h - 2, 'black')
    g.rect(x + 2, y + 1, w - 4, h - 2, rim)
    g.rect(x + 1, y + 2, w - 2, h - 4, rim)
    g.rect(x + 3, y + 3, w - 6, h - 6, fill)
    g.rect(x + 3, y + 3, w - 6, 1, hi)
    g.rect(x + 3, y + h - 4, w - 6, 1, lo)


def ring_arrow(g, cx, cy, r, t, col):
    """Circular 'restart' arrow."""
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            a = math.degrees(math.atan2(dy, dx))
            if r - t <= math.hypot(dx, dy) <= r and not (-90 < a < -20):
                g.set(x, y, col)
    h = int(t) + 2
    hx, hy = int(cx), int(cy - r + t / 2)
    for i in range(h):
        g.rect(hx + i, hy - (h - 1 - i), 1, 2 * (h - 1 - i) + 1, col)


def icon(g, kind, cx, cy, s, col='goldhi', shadow='ink'):
    for ox, c in ((1, shadow), (0, col)):
        if kind == 'restart':
            ring_arrow(g, cx + ox, cy + ox, 5.5 * s, 2 * s, c)
            continue
        rows = {'grid': ICON_GRID, 'next': ICON_PLAY, 'back': ICON_BACK}[kind]
        w, h = len(rows[0]) * s, len(rows) * s
        g.ascii(int(cx - w / 2) + ox, int(cy - h / 2) + ox, rows, {'X': c}, s)


def menu_button(kind):
    g = Img(25, 25)
    button(g, 0, 0, 25, 25)
    icon(g, kind, 12.5, 12.5, 1)
    return g


def play_button():
    g = Img(56, 27)
    button(g, 0, 0, 56, 27, fill='pumpkin', rim='goldhi', hi='pumpkinhi', lo='pumpkinlo')
    g.text((56 - text_width('PLAY', 2)) // 2, 6, 'PLAY', 'ink', 2)
    return g


def lock():
    g = Img(16, 16)
    g.ascii(0, 0, LOCK, {'S': 'ironhi', 'O': 'black', 'H': 'goldhi', 'G': 'gold',
                         'K': 'black', 'd': 'golddk'})
    return g.outline('black')


def cobweb(g, x0, y0, sx, sy, size=16, col='ghostlo'):
    for deg in (0, 30, 60, 90):
        a = math.radians(deg)
        g.line(x0, y0, x0 + sx * size * math.cos(a), y0 + sy * size * math.sin(a), col)
    for rr in (5, 10, 15):
        for k in range(0, 91, 4):
            a = math.radians(k)
            g.set(x0 + sx * rr * math.cos(a), y0 + sy * rr * math.sin(a), col)


def popup(won):
    """Win / lose panel. Button art lines up with the click areas in style.css."""
    g = Img(271, 149)
    rim = 'pumpkin' if won else 'blood'
    g.rect(2, 0, 267, 102, 'black')
    g.rect(0, 2, 271, 98, 'black')
    g.rect(1, 1, 269, 100, 'black')
    g.rect(3, 1, 265, 100, rim)
    g.rect(1, 3, 269, 96, rim)
    g.rect(2, 2, 267, 98, rim)
    g.rect(4, 4, 263, 94, 'black')
    g.vgrad(5, 5, 261, 92, ['purple', 'night'])
    cobweb(g, 5, 5, 1, 1)
    cobweb(g, 265, 5, -1, 1)
    deco = jack() if won else tombstone()
    g.blit(deco, 10, 96 - deco.h)
    g.blit(deco, 261 - deco.w, 96 - deco.h)
    if won:
        spots = [(33, 'grid'), (110, 'restart'), (187, 'next')]
    else:
        spots = [(82, 'grid'), (159, 'restart')]
    for x, kind in spots:
        button(g, x, 103, 50, 46, rim=rim)
        icon(g, kind, x + 25, 126, 2)
    return g


# ---------------------------------------------------------------- scenery

def moon(g, cx, cy, r):
    fill, hi, crater, glow = MOONS[MOON]
    g.glow(cx, cy, r, r + 12, glow)
    g.disc(cx, cy, r, hi)
    g.disc(cx + 1.5, cy + 1.5, r - 1, fill)
    for fx, fy, fr in ((0.3, -0.2, 0.2), (-0.35, 0.3, 0.13), (0.15, 0.45, 0.1), (-0.2, -0.45, 0.08)):
        g.disc(cx + fx * r, cy + fy * r, fr * r, crater)


def night_sky(g, horizon, mx, my, mr, rnd):
    g.vgrad(0, 0, g.w, horizon, ['ink', 'night', 'purple', 'violet', 'plum'])
    g.rect(0, horizon, g.w, g.h - horizon, 'plum')
    for _ in range(g.w * horizon // 90):
        g.set(rnd.randrange(g.w), rnd.randrange(int(horizon * 0.6)),
              rnd.choice(('white', 'ghostlo', 'goldhi')))
    for _ in range(6):
        x, y = rnd.randrange(2, g.w - 2), rnd.randrange(2, int(horizon * 0.5))
        for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
            g.set(x + dx, y + dy, 'white')
    moon(g, mx, my, mr)


def hills(g, base, amp, color, seed, freq):
    rnd = random.Random(seed)
    p1, p2 = rnd.random() * 6, rnd.random() * 6
    for x in range(g.w):
        top = int(base - amp * (0.6 * math.sin(x * freq + p1) + 0.4 * math.sin(x * freq * 2.3 + p2)))
        g.rect(x, top, 1, g.h - top, color)


def haunted_house(g, x, base, col):
    g.rect(x + 6, base - 40, 4, 10, col)        # chimney
    g.rect(x, base - 26, 40, 26, col)
    tri(g, x - 3, base - 26, 46, col)
    g.rect(x + 28, base - 46, 12, 20, col)      # tower
    tri(g, x + 26, base - 46, 16, col)
    g.rect(x + 33, base - 58, 1, 5, col)
    for wx, wy in ((6, 20), (16, 20), (31, 40), (31, 28)):
        g.rect(x + wx, base - wy, 4, 5, 'window')
        g.rect(x + wx + 1, base - wy, 1, 5, col)   # window frame cross
        g.rect(x + wx, base - wy + 2, 4, 1, col)


def ferris_wheel(g, cx, cy, r, col='silfar'):
    g.line(cx, cy, cx - r * 0.6, cy + r + 10, col, 2)
    g.line(cx, cy, cx + r * 0.6, cy + r + 10, col, 2)
    steps = int(2 * math.pi * r * 1.5)
    for k in range(steps):
        a = k / steps * 2 * math.pi
        g.set(cx + math.cos(a) * r, cy + math.sin(a) * r, col)
    bulbs = ('pumpkin', 'toxic', 'goldhi')
    for i in range(8):
        a = i / 8 * 2 * math.pi + 0.2
        ex, ey = cx + math.cos(a) * r, cy + math.sin(a) * r
        g.line(cx, cy, ex, ey, col)
        g.rect(ex - 1, ey, 3, 3, col)           # gondola
        g.set(ex, ey - 1, bulbs[i % 3])


def tent(g, x, base, w, h):
    for i in range(w):
        col = 'maroon' if (i // 3) % 2 else 'silfar'
        g.rect(x + i, base - h, 1, h, col)
    tri(g, x - 2, base - h, w + 4, 'silfar')
    g.rect(x + w // 2, base - h - w // 2 - 5, 1, 4, 'silfar')
    g.rect(x + w // 2 + 1, base - h - w // 2 - 5, 3, 2, 'pumpkin')


def graveyard(g, ground, col, rnd):
    x = 2
    while x < g.w:
        kind = rnd.random()
        if kind < 0.45:
            w, h = 5 + rnd.randrange(3), 6 + rnd.randrange(5)
            g.rect(x, ground - h, w, h, col)
            g.disc(x + w / 2, ground - h, w / 2, col)
        elif kind < 0.7:
            w = 6
            g.rect(x + 2, ground - 12, 2, 12, col)
            g.rect(x, ground - 9, 6, 2, col)
        elif kind < 0.85:
            w = 20
            for px in range(x, x + w, 3):
                g.rect(px, ground - 10, 1, 10, col)
                g.set(px, ground - 11, col)
            g.rect(x, ground - 8, w, 1, col)
            g.rect(x, ground - 3, w, 1, col)
        else:
            w = 5
            g.rect(x + 1, ground - 16, 3, 16, col)
            tri(g, x, ground - 16, 5, col)
        x += w + 6 + rnd.randrange(14)


def dead_tree(g, x, y, length, angle, depth, col, rnd, t=2):
    if depth == 0 or length < 2:
        return
    x2, y2 = x + math.cos(angle) * length, y - math.sin(angle) * length
    g.line(x, y, x2, y2, col, t)
    for da in (-0.5, 0.45):
        dead_tree(g, x2, y2, length * rnd.uniform(0.55, 0.75),
                  angle + da + rnd.uniform(-0.2, 0.2), depth - 1, col, rnd, max(1, t - 1))


def static_background():
    """bg.png - fallback shown if the live background (parallax.js) can't run."""
    rnd = random.Random(31)
    g = Img(300, 188)
    night_sky(g, 150, 200, 38, 20, rnd)
    hills(g, 112, 6, 'silfar', 1, 0.05)
    ferris_wheel(g, 245, 92, 16)
    hills(g, 123, 3, 'silmid', 2, 0.08)
    haunted_house(g, 70, 121, 'silmid')
    dead_tree(g, 140, 125, 10, math.pi / 2, 4, 'silmid', rnd)
    graveyard(g, 130, 'silnear', rnd)
    g.rect(0, 129, 300, 59, 'silnear')
    return g


def title_screen():
    """title.png - the front page (1000x600)."""
    rnd = random.Random(2026)
    g = Img(250, 150)
    night_sky(g, 130, 218, 30, 20, rnd)
    for bx, by in ((30, 30), (196, 46), (226, 60), (12, 58)):
        g.ascii(bx, by, BAT, {'X': 'silnear'})
    hills(g, 110, 5, 'silfar', 3, 0.05)
    ferris_wheel(g, 176, 86, 18)
    tent(g, 214, 112, 18, 8)
    hills(g, 124, 3, 'silmid', 4, 0.08)
    haunted_house(g, 4, 122, 'silmid')
    dead_tree(g, 232, 128, 9, math.pi / 2 + 0.2, 4, 'silmid', rnd)
    graveyard(g, 139, 'silnear', rnd)
    g.rect(0, 138, 250, 12, 'silnear')

    ramp = ['goldhi', 'goldhi', 'gold', 'pumpkinhi', 'pumpkin', 'pumpkin', 'pumpkinlo']
    for word, y in (('PANTHER', 14), ('POUNCE', 50)):
        g.text((250 - text_width(word, 4)) // 2, y, word, lambda j: ramp[j], 4,
               outline='black', ot=2, shadow='maroon')
    sub = 'BOO BASH 2026'
    g.text((250 - text_width(sub)) // 2, 86, sub, 'toxic', 1, outline='black')

    g.blit(panther(), 14, 94, 3)
    g.blit(ghoul(), 196, 96, 2)
    g.blit(jack(), 80, 118)
    g.blit(jack(), 156, 120)
    return g


def rotate_prompt():
    """turndevice.png - shown when a phone/tablet is held upright."""
    g = Img(294, 138)
    g.vgrad(0, 0, 294, 138, ['ink', 'night', 'purple'])
    moon(g, 250, 26, 12)
    # upright phone
    g.rect(92, 22, 26, 44, 'ghost')
    g.rect(94, 25, 22, 36, 'night')
    g.rect(103, 62, 4, 2, 'ghostlo')
    # arrow
    g.rect(126, 43, 28, 3, 'pumpkin')
    for i in range(6):
        g.rect(154 + i, 39 + i, 1, 11 - 2 * i, 'pumpkin')
    # sideways phone with the panther inside
    g.rect(168, 31, 46, 26, 'pumpkin')
    g.rect(171, 33, 38, 22, 'night')
    g.rect(210, 42, 2, 4, 'pumpkinlo')
    g.blit(panther(), 182, 36)
    msg = 'ROTATE YOUR DEVICE'
    g.text((294 - text_width(msg, 2)) // 2, 96, msg, 'goldhi', 2, outline='black', shadow='maroon')
    return g


def ground():
    """Graveyard soil with grass, slime and buried bones (ground)."""
    rnd = random.Random(13)
    g = Img(800, 29)
    g.vgrad(0, 0, 800, 29, ['soilhi', 'soil', 'soillo'])
    for _ in range(600):
        g.set(rnd.randrange(800), rnd.randrange(4, 29), rnd.choice(('stonelo', 'soilhi', 'soillo')))
    skull = ['.XXX.', 'XXXXX', 'XoXoX', 'XXXXX', '.X.X.']
    bone = ['X...X', 'XXXXX', 'X...X']
    for _ in range(14):
        g.ascii(rnd.randrange(795), rnd.randrange(9, 22), skull, {'X': 'bone', 'o': 'soillo'})
    for _ in range(26):
        g.ascii(rnd.randrange(795), rnd.randrange(8, 25), bone, {'X': 'bone'})
    for x in range(800):
        g.set(x, 1, 'moss')
        g.set(x, 2, 'toxicdk')
        if rnd.random() < 0.5:
            g.set(x, 0, 'mosshi')
    for _ in range(10):                          # toxic slime puddles
        x, w = rnd.randrange(790), rnd.randrange(4, 10)
        g.rect(x, 2, w, 1, 'toxic')
        g.rect(x + rnd.randrange(w), 3, 1, rnd.randrange(1, 4), 'toxic')
    return g


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print('Writing sprites to', OUT_DIR)
    panther().save('bird.png', 45, 44)
    ghoul().save('enemy.png', 78, 77)
    crate().save('wood1.png', 81, 81)
    plank().save('wood2.png', 202, 19)
    masonry(27, 27, 3).save('dirt.png', 81, 81)
    jack().save('boulder.png', 76, 73)
    crypt().save('platform.png', 191, 195)
    sling_back().save('sling1.png', 38, 199)
    sling_front().save('sling2.png', 42, 123)
    rubber().save('sling3.png', 5, 16)
    trail_puff().save('smoke.png', 11, 11)
    poof_strip().save('smoke_big.png', 32, 160)
    menu_button('back').save('menu_back.png', 50, 50)
    menu_button('restart').save('menu_refresh.png', 50, 50)
    play_button().save('play.png', 168, 82)
    lock().save('lock.png', 32, 32)
    popup(True).save('win_popup.png', 542, 298)
    popup(False).save('lose_popup.png', 541, 298)
    ground().save('ground.png', 2400, 87)
    static_background().save('bg.png', 1200, 750)
    title_screen().save('title.png', 1000, 600)
    rotate_prompt().save('turndevice.png', 1762, 829)


if __name__ == '__main__':
    main()
