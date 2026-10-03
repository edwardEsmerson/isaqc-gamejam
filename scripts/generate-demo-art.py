#!/usr/bin/env python3
"""Rebuild Quriosity's original, locally authored placeholder pixel art.

Run from anywhere: python3 scripts/generate-demo-art.py
No Pillow, network, PixelLab, random seed, or external artwork is required.
Small silhouettes are authored pixel patterns; architecture and tiles use an
explicit shared palette and deterministic pixel motifs. All output is confined
to Assets/Art. Existing unrelated art and folder GUIDs are left alone.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import uuid
import zlib


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "unity/Assets/Art"
OUTPUT = ART / "Generated/Demo"
NAMESPACE = uuid.UUID("74e85b66-ce64-47b9-aaf6-8c0c64739b9d")
PALETTE = {
    ".": "00000000", "o": "171a32", "n": "11152b", "v": "24203f",
    "p": "34304f", "b": "253650", "g": "385565", "t": "407d82",
    "m": "65b69a", "l": "a3dfbd", "a": "dbf4d2", "h": "e37bab",
    "H": "ffb2cf", "r": "a34883", "s": "f3c5b5", "S": "ffe0c5",
    "w": "f8f0e8", "c": "b8ced6", "d": "4a678c", "B": "719ad3",
    "k": "293f63", "y": "f5d08a", "Y": "fff0bb", "q": "69d6da",
    "Q": "c0fcf0", "u": "9877c6", "U": "d2b4f1", "e": "705066",
}


def rgba(color: str) -> tuple[int, int, int, int]:
    value = PALETTE.get(color, color).lstrip("#")
    if len(value) == 6:
        value += "ff"
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4, 6))


class Canvas:
    def __init__(self, width: int, height: int, color: str = "."):
        self.width, self.height = width, height
        self.pixels = [rgba(color)] * (width * height)

    def pixel(self, x: int, y: int, color: str) -> None:
        if 0 <= x < self.width and 0 <= y < self.height:
            self.pixels[y * self.width + x] = rgba(color)

    def rect(self, x: int, y: int, width: int, height: int, color: str) -> None:
        for py in range(y, y + height):
            for px in range(x, x + width):
                self.pixel(px, py, color)

    def line(self, x0: int, y0: int, x1: int, y1: int, color: str) -> None:
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        error = dx + dy
        while True:
            self.pixel(x0, y0, color)
            if x0 == x1 and y0 == y1:
                return
            twice = 2 * error
            if twice >= dy:
                error += dy
                x0 += sx
            if twice <= dx:
                error += dx
                y0 += sy

    def pattern(self, rows: list[str], x: int = 0, y: int = 0) -> None:
        if x < 0 or y < 0 or y + len(rows) > self.height or any(x + len(row.rstrip('.')) > self.width for row in rows):
            raise ValueError("Authored pixel pattern exceeds its canvas")
        for py, row in enumerate(rows):
            for px, color in enumerate(row):
                if color != ".":
                    self.pixel(x + px, y + py, color)

    def png(self) -> bytes:
        def chunk(kind: bytes, data: bytes) -> bytes:
            return (struct.pack(">I", len(data)) + kind + data
                    + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff))
        raw = bytearray()
        for y in range(self.height):
            raw.append(0)  # Lossless PNG scanlines, no filtering or palette quantization.
            for pixel in self.pixels[y * self.width:(y + 1) * self.width]:
                raw.extend(pixel)
        return (b"\x89PNG\r\n\x1a\n"
                + chunk(b"IHDR", struct.pack(">IIBBBBB", self.width, self.height, 8, 6, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


def guid(path: Path) -> str:
    return uuid.uuid5(NAMESPACE, path.relative_to(ROOT).as_posix()).hex


def folder(path: Path) -> None:
    if path == ART.parent:
        return
    folder(path.parent)
    path.mkdir(exist_ok=True)
    meta = path.with_name(path.name + ".meta")
    if not meta.exists():
        meta.write_text(f"fileFormatVersion: 2\nguid: {guid(path)}\nfolderAsset: yes\n"
                        "DefaultImporter:\n  externalObjects: {}\n  userData:\n"
                        "  assetBundleName:\n  assetBundleVariant:\n", encoding="utf-8")


def sprite_meta(path: Path) -> str:
    # Full-rect sprites keep consistent frame sizes and tile physics uses Grid,
    # not an auto-traced outline. Explicit Default settings prevent compression.
    return f"""fileFormatVersion: 2
guid: {guid(path)}
TextureImporter:
  internalIDToNameTable: []
  externalObjects: {{}}
  serializedVersion: 13
  mipmaps:
    mipMapMode: 0
    enableMipMap: 0
    sRGBTexture: 1
    linearTexture: 0
    fadeOut: 0
    borderMipMap: 0
    mipMapsPreserveCoverage: 0
    alphaTestReferenceValue: 0.5
    mipMapFadeDistanceStart: 1
    mipMapFadeDistanceEnd: 3
  isReadable: 0
  streamingMipmaps: 0
  streamingMipmapsPriority: 0
  vTOnly: 0
  ignoreMipmapLimit: 0
  grayScaleToAlpha: 0
  generateCubemap: 6
  cubemapConvolution: 0
  seamlessCubemap: 0
  textureFormat: 1
  maxTextureSize: 2048
  textureSettings:
    serializedVersion: 2
    filterMode: 0
    aniso: 1
    mipBias: 0
    wrapU: 1
    wrapV: 1
    wrapW: 1
  nPOTScale: 0
  lightmap: 0
  compressionQuality: 100
  spriteMode: 1
  spriteExtrude: 1
  spriteMeshType: 0
  alignment: 0
  spritePivot: {{x: 0.5, y: 0.5}}
  spritePixelsToUnits: 16
  spriteBorder: {{x: 0, y: 0, z: 0, w: 0}}
  alphaUsage: 1
  alphaIsTransparency: 1
  spriteTessellationDetail: -1
  textureType: 8
  textureShape: 1
  singleChannelComponent: 0
  platformSettings:
  - serializedVersion: 3
    buildTarget: DefaultTexturePlatform
    maxTextureSize: 2048
    resizeAlgorithm: 0
    textureFormat: -1
    textureCompression: 0
    compressionQuality: 100
    crunchedCompression: 0
    allowsAlphaSplitting: 0
    overridden: 0
    ignorePlatformSupport: 0
    androidETC2FallbackOverride: 0
    forceMaximumCompressionQuality_BC6H_BC7: 0
  spriteSheet:
    serializedVersion: 2
    sprites: []
    outline: []
    physicsShape: []
    bones: []
    spriteID: {uuid.uuid5(NAMESPACE, path.stem).hex}
    internalID: 0
    vertices: []
    indices:
    edges: []
    weights: []
    secondaryTextures: []
    nameFileIdTable: {{}}
  mipmapLimitGroupName:
  pSDRemoveMatte: 0
  userData: Original locally authored Quriosity placeholder. See scripts/generate-demo-art.py.
  assetBundleName:
  assetBundleVariant:
"""


def sprite_meta_matches_unity_settings(actual: str, expected: str) -> bool:
    """Accept Unity's expanded importer metadata while guarding art settings.

    Unity adds sprite IDs, rectangles, and version-specific importer defaults to
    .meta files when it imports PNGs. Those fields are editor-owned; validate
    the stable GUID and the visual/import settings our generator requires.
    """
    required = (
        f"guid: {guid_from_meta(expected)}",
        "enableMipMap: 0",
        "filterMode: 0",
        "spriteMode: 1",
        "spritePixelsToUnits: 16",
        "textureType: 8",
        "textureCompression: 0",
    )
    return all(value in actual for value in required)


def guid_from_meta(meta: str) -> str:
    match = re.search(r"(?m)^guid: ([0-9a-f]{32})$", meta)
    if match is None:
        raise ValueError("Generated sprite metadata has no stable GUID")
    return match.group(1)


ASSETS: dict[str, Canvas] = {}


def emit(name: str, canvas: Canvas) -> None:
    ASSETS[name] = canvas


def tiles() -> None:
    for style in ("stone-fill", "stone-top", "stone-left", "stone-right", "stone-single"):
        c = Canvas(16, 16, "g")
        c.rect(0, 0, 16, 2, "t")
        c.line(0, 7, 15, 7, "b")
        c.line(0, 15, 15, 15, "b")
        c.line(5, 2, 5, 6, "b")
        c.line(11, 8, 11, 14, "b")
        c.line(6, 2, 6, 5, "t")
        c.line(12, 9, 12, 12, "t")
        c.rect(1, 9, 3, 1, "t")
        c.pixel(3, 12, "b")
        c.pixel(8, 4, "t")
        c.pixel(9, 13, "t")
        if style != "stone-fill":
            c.rect(0, 0, 16, 1, "l")
            c.rect(0, 1, 16, 2, "m")
            for x, depth in ((1, 5), (2, 4), (7, 4), (12, 5), (13, 4)):
                c.line(x, 2, x, depth, "m")
            for x in (3, 9, 14):
                c.pixel(x, 0, "a")
        if style in ("stone-left", "stone-single"):
            c.line(0, 3, 0, 15, "m")
            c.pixel(0, 0, ".")
            c.pixel(0, 15, "b")
        if style in ("stone-right", "stone-single"):
            c.line(15, 3, 15, 15, "b")
            c.pixel(15, 0, ".")
        emit("Tiles/" + style, c)
    for name, edge, glow, base in (("bridge-zero", "q", "Q", "t"),
                                    ("bridge-one", "u", "U", "p")):
        c = Canvas(16, 16)
        c.rect(0, 0, 16, 16, "o")
        c.rect(1, 1, 14, 13, base)
        c.line(0, 0, 15, 0, glow)
        c.line(0, 2, 15, 2, edge)
        c.line(0, 15, 15, 15, edge)
        c.pattern(["..o..", ".o.o.", "o...o", ".o.o.", "..o.."], 6, 6)
        c.pixel(8, 8, glow)
        c.rect(2, 5, 1, 8, edge)
        c.rect(13, 5, 1, 8, edge)
        emit("Tiles/" + name, c)
    c = Canvas(16, 16)
    c.pattern([
        "...o.......o....", "..owo.....owo...", "..owo.....owo...",
        ".owcwo...owcwo..", ".owcwo...owcwo..", "owccwwo.owccwwo.",
        "owccccwowccccwo.", "oggggggggggggggo", "otttttttttttttto",
        "obbbbbbbbbbbbbbo",
    ], 0, 6)
    emit("Props/spikes", c)


HEAD = [
    "....oooooo......", "...orhHHhro.....", "..orhHHHHhro....",
    "..ohHHHHHHhro...", "..ohhHhssssho...", "..ohhssSsosso...",
    "...ohssSssssso..", "..orhossSsso....", "..orroossso.....",
]
BODY = ["....oowwwo......", "...oswwwwso.....", "...oswwcwso.....",
        "....owwwwo......", "....odBBdo......", "....odBBdo......"]
LEGS = [
    ["....odoodo......", "....od..do......", "....od..do......", "...ocd..dco.....", "...ooo..ooo....."],
    ["...odooBBo......", "..odo...oBo.....", "..oo.....oBo....", ".ocd.....dco....", ".ooo.....ooo...."],
    ["....odooBo......", "....od..oBo.....", "...odo...oo.....", "...ocd...co.....", "...ooo...oo....."],
    ["....oddBBo......", ".....odBo.......", ".....odBo.......", "....ocdco.......", "....ooooo......."],
    ["....oBoodo......", "...oBo...odo....", "..oBo.....oo....", "..ocd.....co....", "..ooo.....ooo..."],
    ["....oBoodo......", "...oBo..odo.....", "...oo...odo.....", "...oc...dco.....", "...oo...ooo....."],
]


def characters() -> None:
    for i in range(4):
        c = Canvas(16, 24)
        y = 2
        c.pattern(HEAD, 0, y)
        c.pattern(BODY, 0, y + 9)
        c.pattern(LEGS[0], 0, 17)  # Boots stay on the same baseline during breathing.
        if i == 1:
            c.pixel(4, 5, "H")
        elif i == 2:
            c.pixel(4, 8, "r")
            c.pixel(7, 14, "w")
        if i == 3:  # Brief blink, keeping the pink hair silhouette readable.
            c.pixel(9, y + 5, "s")
            c.pixel(9, y + 6, "o")
        emit(f"Characters/fleabag-idle-{i}", c)
    for i in range(6):
        c = Canvas(16, 24)
        y = 2
        c.pattern(HEAD, 0, y)
        c.pattern(BODY, 0, y + 9)
        c.pattern(LEGS[(i + 1) % 6], 0, 17)
        c.pixel(3, y + 10, "s")
        emit(f"Characters/fleabag-run-{i}", c)
    c = Canvas(16, 24)
    c.pattern(HEAD, 0, 2)
    c.pattern(["...oowwwo.......", "..oswwwwwso.....", "..oowwwcwo......",
               "....owwwwo......", "....odBBBo......", "...odooBBo......",
               "...odo.oBo......", "...ooo.odo......", ".......ooo......"], 0, 11)
    emit("Characters/fleabag-jump", c)
    c = Canvas(24, 24)
    c.pattern(HEAD, 6, 3)
    c.pattern(["....oowwwo......", "..ooswwwwso.....", ".odBocwwwwo.....",
               "odBBoodBBBo.....", "oooo...odBo.....", ".......odBo.....",
               "......ooooo....."], 5, 12)
    c.line(1, 10, 4, 10, "H")
    c.line(0, 14, 3, 14, "q")
    c.line(2, 18, 5, 18, "Q")
    emit("Characters/fleabag-dash", c)
    c = Canvas(16, 16)
    c.pattern([
        "..oo......oo....", "..oco....oco....", "..ocwoooowco....",
        "..owwwwwwwwo....", ".owwcwwwcwwwo...", ".owwokwwokwwo...",
        ".owwwwhwwwwwo...", "..owwwowwwwo....", "...oowwwwoo...o.",
        "...owwwwwwo..oco", "..owwwcwwwwo.oco", "..owwwcwwwwocwo.",
        "..owwwwwwwwwwo..", "...owwowwowwo...", "...ooooooooo....",
    ])
    emit("Characters/hilary", c)
    c = Canvas(24, 32)
    c.pattern([
        "........cc..cc..........", "......ocwwocwco.........", ".....ocwwwwwwwwco.......",
        "....ocwwccwwcwwwo.......", ".....occsssscccco.......", ".....ossSssssso.........",
        ".....ooyysoyyso.........", "......ossSssssso........", ".......osossso..........",
        "........osso............", "......oowwwwoo..........", ".....owcwwwcwwo.........",
        "....owwocwooowwo........", "....owwouuoowwwo........", "....owwouuowwwwo........",
        "....oswowwowwso.........", "....oswowwowwso.........", ".....oowwwwwwoo.........",
        "......owwcwwwo..........", "......owwcwwwo..........", "......owwcwwwo..........",
        "......owwowwwo..........", ".......okooko...........", ".......ok..ko...........",
        ".......ok..ko...........", "......ooo..ooo..........",
    ], 0, 3)
    emit("Characters/schrodinger", c)


def arch(c: Canvas, x: int, y: int, width: int, height: int, edge: str, fill: str | None) -> None:
    # Stair-stepped pointed arch, not a smoothed vector curve.
    middle = width // 2
    for row in range(height):
        inset = max(0, middle - row * 2) if row < middle else 0
        span = width - inset * 2
        if span > 0:
            c.rect(x + inset, y + row, min(2, span), 1, edge)
            c.rect(x + inset + max(0, span - 2), y + row, min(2, span), 1, edge)
            if row >= height - 2:
                c.rect(x + inset, y + row, span, 1, edge)
            if span > 4 and row < height - 2 and fill is not None:
                c.rect(x + inset + 2, y + row, span - 4, 1, fill)


def props() -> None:
    c = Canvas(24, 24)
    c.pattern([
        "..oooooooooooooooooooo..", ".oyyyyyyyyyyyyyyyyyyyyo.", ".oyYyyyyyyyyyyyyyyyYyyo.",
        ".oyeeeeeeeeeeeeeeeeeyyo.", ".oyeeyeeeeeeeeeeeyeeyyo.", ".oyeeeyeeeeeeeeeyeeyyyo.",
        ".oyeeeeyeeeeeeyeeeeyyo.", ".oyeeeeeyeeeeyeeeeeyyo.", ".oyeeeeeeooooeeeeeeyyo.",
        ".oyeeeeeeoyyoeeeeeeyyo.", ".oyeeeeeeooooeeeeeeyyo.", ".oyeeeeeyeeeeyeeeeeyyo.",
        ".oyeeeeyeeeeeeyeeeeyyo.", ".oyeeeyeeeeeeeeyeeeyyo.", ".oyeeyeeeeeeeeeeyeeyyo.",
        ".oyeeeeeeeeeeeeeeeeyyo.", ".oyyyyyyyyyyyyyyyyyyyo.", "..oooooooooooooooooooo..",
    ], 0, 4)
    emit("Props/hilary-box", c)
    c = Canvas(32, 48)
    arch(c, 2, 1, 28, 46, "g", "o")
    arch(c, 5, 5, 22, 40, "m", "b")
    arch(c, 8, 9, 16, 34, "t", "n")
    c.rect(15, 18, 2, 25, "g")
    c.rect(10, 22, 3, 8, "t")
    c.rect(19, 22, 3, 8, "t")
    c.pixel(13, 34, "y")
    c.pixel(18, 34, "y")
    c.rect(1, 44, 30, 3, "m")
    c.rect(0, 47, 32, 1, "g")
    c.pattern(["..q..", ".qQq.", "qQQQq", ".qQq.", "..q.."], 14, 12)
    emit("Props/exit-door", c)
    c = Canvas(16, 32)
    c.pattern(["......oo........", ".....oqQo.......", "....oqQQqo......",
               ".....oqQo.......", "......oo........"], 0, 1)
    c.rect(7, 7, 2, 19, "o")
    c.rect(8, 7, 1, 18, "t")
    c.pattern(["ooqqqqqqo...", "oQQqqqqqQo..", "oQqqqqqqo...", "oqqqqqqo....",
               "oqqqqqQo....", "ooooooo....."], 6, 8)
    c.rect(3, 27, 10, 2, "o")
    c.rect(4, 27, 8, 1, "m")
    c.rect(1, 29, 14, 3, "g")
    c.rect(2, 29, 12, 1, "l")
    emit("Props/checkpoint", c)
    c = Canvas(24, 24)
    c.pattern([
        ".....oooooooooooo.......", "....otttttttttttto......", "....otonnnnnnnnoto......",
        "....otonqq..uu.noto.....", "....otonQQ..UU.noto.....", "....oton.q..u..noto.....",
        "....oton..QQ...noto.....", "....oton..qq...noto.....", "....otonnnnnnnnoto......",
        "....otttttttttttto......", ".....oooooooooooo.......", ".......oggggo...........",
        ".......oggggo...........", "...ooooggggggoooo.......", "..otttttttttttttto......",
        "..otqQooyYoouUotto......", "..oggggggggggggggo......", "...oooooooooooooo.......",
        "....oggggggggggo........", "....oggggggggggo........", "....oooooooooooo........",
    ], 0, 2)
    emit("Props/quantum-console", c)
    c = Canvas(16, 24)
    c.line(8, 0, 8, 6, "g")
    c.pattern(["....ooooo.......", "...ogggggo......", "...oyYYYyo......",
               "...oyYQYyo......", "...oyYYYyo......", "...oyYYYyo......",
               "....oyyyo.......", ".....ooo........"], 0, 6)
    c.pixel(7, 15, "y")
    c.pixel(6, 17, "e")
    emit("Decor/lantern", c)
    c = Canvas(16, 16)
    c.pattern([".......m........", "....m..lm.......", "....lm.ml..m....",
               "..m.ml.ml.ml....", "..lm.mlmlml.....", "...lmmlmml...m..",
               ".m..lmmlm...ml..", ".lm..mmlm.mml...", "..lmm.mlmlm.....",
               "....lmlml.......", "......ml........", ".....oggo.......",
               "....otttto......", ".....oggo.......", "......oo........"], 0, 1)
    emit("Decor/fern", c)
    c = Canvas(32, 48)
    arch(c, 1, 1, 30, 45, "g", "n")
    arch(c, 4, 5, 24, 39, "t", "b")
    arch(c, 7, 8, 18, 34, "g", "n")
    c.line(16, 13, 16, 41, "g")
    c.line(8, 29, 24, 29, "g")
    c.rect(0, 45, 32, 3, "g")
    emit("Decor/stone-arch", c)
    c = Canvas(16, 24)
    c.pattern([".....oooooo.....", "....oggggggo....", "...ogttttttgo...",
               "....oggggggo....", ".....oggggo....."], 0, 0)
    c.rect(6, 5, 4, 15, "g")
    c.line(6, 5, 6, 19, "t")
    c.line(9, 5, 9, 19, "b")
    c.pattern([".....oggggo.....", "....ogttttgo....", "...oggggggggo...",
               "...oooooooooo..."], 0, 20)
    emit("Decor/column", c)
    c = Canvas(16, 16)
    c.pattern([".......q........", "......qQq.......", ".......q........",
               "................", "..u.............", ".uUu............",
               "..u.............", "..........q.....", ".........qQq....",
               "..........q....."], 0, 2)
    emit("Decor/quantum-motes", c)


def background() -> None:
    c = Canvas(640, 360, "n")
    for y, color in ((0, "17152e"), (60, "1a1832"), (120, "1b1d37"),
                     (180, "1b243d"), (240, "18283c"), (300, "142237")):
        c.rect(0, y, 640, 60, color)
    # Authored star coordinates and constellation, intentionally sparse.
    stars = [(52, 34), (87, 61), (118, 23), (163, 54), (204, 36), (237, 83),
             (265, 21), (302, 50), (349, 30), (387, 65), (428, 20), (470, 79),
             (511, 24), (560, 51), (592, 21), (580, 110), (93, 118), (208, 125),
             (352, 105), (430, 131), (273, 139), (141, 90), (526, 127)]
    for i, (x, y) in enumerate(stars):
        c.pixel(x, y, "727494" if i % 3 else "9b9ab3")
        if i % 4 == 0:
            c.pixel(x - 1, y, "4b4f70")
            c.pixel(x + 1, y, "4b4f70")
            c.pixel(x, y - 1, "4b4f70")
            c.pixel(x, y + 1, "4b4f70")
    for a, b in zip([(265, 21), (302, 50), (349, 30)], [(302, 50), (349, 30), (387, 65)]):
        c.line(*a, *b, "33334f")
    # Crescent moon, drawn as nested stair-stepped discs.
    for y, extent in enumerate([4, 8, 10, 12, 13, 14, 15, 15, 16, 16, 16, 16,
                                16, 16, 15, 15, 14, 13, 12, 10, 8, 4]):
        c.rect(480 - extent, 38 + y, extent * 2, 1, "a8b6be")
        c.rect(483 - max(0, extent - 3), 36 + y, max(0, extent - 3) * 2, 1, "1a1832")
    # Distant stepped mountains and tiny roofs, all lower contrast than the room.
    ridge = [(0, 211), (32, 180), (57, 193), (100, 148), (148, 201), (190, 183),
             (225, 209), (274, 166), (332, 207), (385, 177), (442, 206), (494, 164),
             (548, 199), (588, 177), (640, 215)]
    for (x0, y0), (x1, y1) in zip(ridge, ridge[1:]):
        for x in range(x0, x1):
            top = y0 + (y1 - y0) * (x - x0) // (x1 - x0)
            c.rect(x, top, 1, 360 - top, "202b45")
    for x, y, w in ((32, 221, 28), (118, 239, 22), (187, 218, 31),
                    (281, 227, 21), (373, 221, 32), (484, 232, 26), (564, 212, 30)):
        c.rect(x, y, w, 104, "26324a")
        for step in range(w // 2):
            c.rect(x + step, y - step // 2, w - step * 2, 1, "26324a")
        for wy in range(y + 12, 320, 18):
            c.rect(x + 6, wy, 3, 5, "3c455d")
            c.rect(x + w - 9, wy, 3, 5, "3c455d")
    # Observatory wall: pointed arches, ribs, columns, keystones and masonry.
    for x in (24, 176, 328, 480):
        # Preserve the authored night skyline inside each window.
        arch(c, x, 72, 136, 272, "2c304a", None)
        arch(c, x + 5, 80, 126, 259, "343950", None)
        arch(c, x + 10, 88, 116, 245, "242c45", None)
        c.line(x + 68, 139, x + 68, 330, "303a51")
        c.line(x + 12, 210, x + 123, 210, "303a51")
        c.line(x + 12, 282, x + 123, 282, "303a51")
        for yy in (157, 247, 313):
            c.rect(x + 65, yy, 7, 3, "414661")
        c.rect(x - 6, 139, 8, 208, "30364d")
        c.line(x - 6, 139, x - 6, 346, "41435a")
        c.rect(x - 9, 132, 14, 7, "3a3d55")
        c.rect(x - 9, 338, 14, 9, "3a3d55")
    # Upper ribbed lintel leaves room for the HUD and the starry roof.
    c.rect(0, 7, 640, 4, "2b2d46")
    c.line(0, 12, 639, 12, "393b55")
    for x in range(16, 640, 32):
        c.rect(x, 8, 6, 2, "4c4a62")
    c.rect(0, 347, 640, 13, "111c2d")
    c.rect(0, 347, 640, 2, "29394c")
    for x in range(0, 640, 16):
        c.line(x, 349, x + 5, 359, "1a2a3c")
    # Ivy on the room edges, not over the playable silhouettes.
    for x, direction in ((8, 1), (632, -1)):
        c.line(x, 17, x, 340, "26404c")
        for i, y in enumerate(range(22, 338, 13)):
            dx = direction * (3 + i % 3)
            c.line(x, y, x + dx, y + 3, "365558")
            c.rect(x + dx, y + 2, 3, 2, "365558")
            c.pixel(x + dx, y + 1, "476563")
    emit("Backgrounds/observatory-night", c)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify deterministic output without writing files")
    args = parser.parse_args()
    tiles()
    characters()
    props()
    background()
    manifest = {
        "authorship": "Original authored pixel patterns and palette; generated locally, not with PixelLab.",
        "generator": "scripts/generate-demo-art.py",
        "pixelsPerUnit": 16,
        "referenceResolution": [640, 360],
        "palette": PALETTE,
        "assets": [],
    }
    failures = []
    for name, canvas in sorted(ASSETS.items()):
        path = OUTPUT / (name + ".png")
        data = canvas.png()
        meta = sprite_meta(path).encode("utf-8")
        manifest["assets"].append({"path": path.relative_to(ART).as_posix(),
                                   "size": [canvas.width, canvas.height],
                                   "sha256": hashlib.sha256(data).hexdigest()})
        if args.check:
            if not path.exists() or path.read_bytes() != data:
                failures.append(str(path.relative_to(ROOT)))
            meta_path = path.with_suffix(".png.meta")
            if not meta_path.exists() or not sprite_meta_matches_unity_settings(
                    meta_path.read_text(encoding="utf-8"), meta.decode("utf-8")):
                failures.append(str(path.relative_to(ROOT)) + ".meta")
        else:
            folder(path.parent)
            path.write_bytes(data)
            path.with_suffix(".png.meta").write_bytes(meta)
    manifest_path = ART / "Source/demo-art-manifest.json"
    manifest_data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    if args.check:
        if not manifest_path.exists() or manifest_path.read_bytes() != manifest_data:
            failures.append(str(manifest_path.relative_to(ROOT)))
        if failures:
            raise SystemExit("Art differs from its authored source:\n" + "\n".join(failures))
        print(f"Verified {len(ASSETS)} deterministic PNGs, sprite import settings, and art manifest.")
    else:
        folder(manifest_path.parent)
        manifest_path.write_bytes(manifest_data)
        meta_path = manifest_path.with_suffix(".json.meta")
        meta_path.write_text(f"fileFormatVersion: 2\nguid: {guid(manifest_path)}\nTextScriptImporter:\n"
                             "  externalObjects: {}\n  userData:\n  assetBundleName:\n"
                             "  assetBundleVariant:\n", encoding="utf-8")
        print(f"Generated {len(ASSETS)} original PNGs in {OUTPUT.relative_to(ROOT)} with stable .meta files.")


if __name__ == "__main__":
    main()
