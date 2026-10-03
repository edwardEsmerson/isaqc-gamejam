#!/usr/bin/env python3
"""Render a reproducible, non-Unity preview of the authored first-room layout.

The script reads current art PNGs and extracts room dimensions, platform arrays,
and placements from DemoProjectBuilder.cs. It reuses the source art generator's
standard-library Canvas/PNG encoder; it does not add a Unity asset or dependency.
"""

from __future__ import annotations

import argparse
import ast
from functools import lru_cache
from pathlib import Path
import re
import runpy
import struct
import zlib


ROOT = Path(__file__).resolve().parents[1]
ART_ROOT = ROOT / "unity/Assets/Art/Generated/Demo"
BUILDER_PATH = ROOT / "unity/Assets/Editor/DemoProjectBuilder.cs"
BRIDGE_PATH = ROOT / "unity/Assets/Scripts/Quantum/QuantumBridge.cs"
OUTPUT_PATH = ROOT / "docs/images/demo-preview.png"
ART_SOURCE = ROOT / "scripts/generate-demo-art.py"


def parse_number(expression: str, variables: dict[str, float] | None = None) -> float:
    """Evaluate the small numeric expressions used by the builder's coordinates."""
    variables = variables or {}
    expression = re.sub(r"\bplatform\.(\w+)", lambda match: str(variables[match.group(1)]), expression)
    expression = re.sub(r"(?<=\d)[fF]\b", "", expression).strip()
    tree = ast.parse(expression, mode="eval")

    def visit(node: ast.AST) -> float:
        if isinstance(node, ast.Expression):
            return visit(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.Name) and node.id in variables:
            return float(variables[node.id])
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            value = visit(node.operand)
            return value if isinstance(node.op, ast.UAdd) else -value
        if isinstance(node, ast.BinOp):
            left, right = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                return left / right
        raise ValueError(f"Unsupported builder coordinate expression: {expression}")

    return visit(tree)


def match_or_fail(pattern: str, source: str, description: str) -> re.Match[str]:
    match = re.search(pattern, source, re.DOTALL)
    if match is None:
        raise ValueError(f"Could not read {description} from the project source.")
    return match


def parse_rectangles(source: str, name: str) -> list[tuple[int, int, int, int]]:
    block = match_or_fail(
        rf"RectInt\[\]\s+{re.escape(name)}\s*=\s*\{{(.*?)\}};",
        source,
        f"{name} platform array",
    ).group(1)
    rectangles = [tuple(map(int, values)) for values in re.findall(
        r"new RectInt\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)", block
    )]
    if not rectangles:
        raise ValueError(f"No platform rectangles found in {name}.")
    return rectangles


def parse_vector2(expressions: tuple[str, str], variables: dict[str, float]) -> tuple[float, float]:
    return tuple(parse_number(expression, variables) for expression in expressions)  # type: ignore[return-value]


def find_instantiated_position(source: str, prefab: str, variables: dict[str, float]) -> tuple[float, float]:
    position = match_or_fail(
        rf'InstantiatePrefab\("{re.escape(prefab)}",\s*[^,]+,\s*new Vector2\(([^,]+),\s*([^)]+)\)\)',
        source,
        f"{prefab} prefab placement",
    )
    return parse_vector2((position.group(1), position.group(2)), variables)


def sprite_reference(source: str, object_name: str) -> str:
    reference = match_or_fail(
        rf'AddSprite\(root\.transform,\s*"{re.escape(object_name)}",\s*"([^"]+)"',
        source,
        f"{object_name} sprite reference",
    )
    return reference.group(1) + ".png"


def sprite_local_position(source: str, object_name: str) -> tuple[float, float]:
    match = match_or_fail(
        rf'AddSprite\(root\.transform,\s*"{re.escape(object_name)}",\s*"[^"]+",\s*'
        r'(?:new Vector2\(([^,]+),\s*([^)]+)\)|Vector2\.up)',
        source,
        f"{object_name} sprite offset",
    )
    if match.group(1) is None:
        return (0.0, 1.0)
    return (parse_number(match.group(1)), parse_number(match.group(2)))


def read_rgba_png(path: Path) -> tuple[int, int, list[tuple[int, int, int, int]]]:
    """Read generated art PNGs (8-bit RGBA, filter 0) without Pillow."""
    data = path.read_bytes()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError(f"Not a PNG: {path}")
    cursor = 8
    width = height = color_type = bit_depth = interlace = -1
    compressed = bytearray()
    while cursor < len(data):
        length = struct.unpack_from(">I", data, cursor)[0]
        kind = data[cursor + 4:cursor + 8]
        payload = data[cursor + 8:cursor + 8 + length]
        cursor += 12 + length
        if kind == b"IHDR":
            width, height, bit_depth, color_type, compression, filtering, interlace = struct.unpack(
                ">IIBBBBB", payload
            )
            if compression != 0 or filtering != 0:
                raise ValueError(f"Unsupported PNG encoding: {path}")
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            break
    if bit_depth != 8 or color_type != 6 or interlace != 0:
        raise ValueError(f"Expected non-interlaced 8-bit RGBA art from generate-demo-art.py: {path}")

    raw = zlib.decompress(compressed)
    stride = width * 4
    if len(raw) != height * (stride + 1):
        raise ValueError(f"Unexpected PNG data length: {path}")
    pixels: list[tuple[int, int, int, int]] = []
    offset = 0
    for _ in range(height):
        if raw[offset] != 0:
            raise ValueError(f"Expected unfiltered art scanlines: {path}")
        row = raw[offset + 1:offset + 1 + stride]
        pixels.extend(tuple(row[index:index + 4]) for index in range(0, stride, 4))
        offset += stride + 1
    return width, height, pixels


def make_preview() -> bytes:
    builder = BUILDER_PATH.read_text(encoding="utf-8")
    bridge_source = BRIDGE_PATH.read_text(encoding="utf-8")
    art_module = runpy.run_path(str(ART_SOURCE))
    canvas_type = art_module["Canvas"]

    camera = match_or_fail(
        r"private static void CreateCamera\(\)(.*?)private static void CreateBackground",
        builder,
        "camera settings",
    ).group(1)

    def assignment(name: str) -> int:
        return int(match_or_fail(rf"pixels\.{name}\s*=\s*(\d+);", camera, name).group(1))

    ppu = assignment("assetsPPU")
    width, height = assignment("refResolutionX"), assignment("refResolutionY")
    camera_position = match_or_fail(
        r"root\.transform\.position\s*=\s*new Vector3\(([^,]+),\s*([^,]+),\s*([^)]+)\)",
        camera,
        "camera center",
    )
    center_x = parse_number(camera_position.group(1))
    center_y = parse_number(camera_position.group(2))
    left_world = center_x - width / (2 * ppu)
    top_world = center_y + height / (2 * ppu)
    canvas = canvas_type(width, height)

    @lru_cache(maxsize=None)
    def load_sprite(relative_path: str) -> tuple[int, int, list[tuple[int, int, int, int]]]:
        return read_rgba_png(ART_ROOT / relative_path)

    def paste(
        relative_path: str,
        position: tuple[float, float],
        opacity: float = 1.0,
        tint: tuple[float, float, float] = (1.0, 1.0, 1.0),
    ) -> None:
        sprite_width, sprite_height, sprite_pixels = load_sprite(relative_path)
        x = round((position[0] - left_world) * ppu - sprite_width / 2)
        y = round((top_world - position[1]) * ppu - sprite_height / 2)
        for source_y in range(sprite_height):
            target_y = y + source_y
            if not 0 <= target_y < height:
                continue
            for source_x in range(sprite_width):
                target_x = x + source_x
                if not 0 <= target_x < width:
                    continue
                red, green, blue, alpha = sprite_pixels[source_y * sprite_width + source_x]
                source_alpha = (alpha / 255.0) * opacity
                if source_alpha <= 0:
                    continue
                red, green, blue = (round(red * tint[0]), round(green * tint[1]), round(blue * tint[2]))
                index = target_y * width + target_x
                dest_red, dest_green, dest_blue, dest_alpha = canvas.pixels[index]
                dest_alpha_float = dest_alpha / 255.0
                output_alpha = source_alpha + dest_alpha_float * (1.0 - source_alpha)
                if output_alpha == 0:
                    continue
                output_rgb = tuple(
                    round((source * source_alpha + dest * dest_alpha_float * (1.0 - source_alpha)) / output_alpha)
                    for source, dest in ((red, dest_red), (green, dest_green), (blue, dest_blue))
                )
                canvas.pixels[index] = (*output_rgb, round(output_alpha * 255))

    background = load_sprite("Backgrounds/observatory-night.png")
    if background[0:2] != (width, height):
        raise ValueError("The authored background must match the builder's camera reference resolution.")
    canvas.pixels[:] = background[2]

    player_offset = parse_number(
        match_or_fail(r"PlayerStandingOffset\s*=\s*([0-9.]+)f", builder, "player standing offset").group(1)
    )
    demo_platforms = parse_rectangles(builder, "DemoPlatforms")
    zero_platforms = parse_rectangles(builder, "ZeroPlatforms")
    one_platforms = parse_rectangles(builder, "OnePlatforms")
    exit_surface = demo_platforms[-1][1] + demo_platforms[-1][3]
    variables = {"PlayerStandingOffset": player_offset, "exitSurface": float(exit_surface)}

    # Draw decorations with negative sorting orders before the solid tilemap.
    decoration_method = match_or_fail(
        r"private static void CreateRoomDecorations\(RectInt\[\] platforms\)(.*?)private static void CreateDemoSigns",
        builder,
        "room decorations",
    ).group(1)
    ferns: list[tuple[str, tuple[float, float]]] = []
    for platform_x, platform_y, platform_width, platform_height in demo_platforms:
        platform_values = {
            "x": float(platform_x),
            "width": float(platform_width),
            "yMin": float(platform_y),
            "yMax": float(platform_y + platform_height),
        }
        if platform_width >= 4:
            expressions = match_or_fail(
                r'AddSprite\(root\.transform,\s*"Fern",\s*"[^"]+",\s*new Vector2\(([^,]+),\s*([^)]+)\)',
                decoration_method,
                "fern placement",
            )
            position = parse_vector2((expressions.group(1), expressions.group(2)), platform_values)
            ferns.append((sprite_reference(builder, "Fern"), position))
        if platform_y > 3:
            expressions = match_or_fail(
                r'AddSprite\(root\.transform,\s*"Hanging lantern",\s*"[^"]+",\s*new Vector2\(([^,]+),\s*([^)]+)\)',
                decoration_method,
                "lantern placement",
            )
            position = parse_vector2((expressions.group(1), expressions.group(2)), platform_values)
            paste(sprite_reference(builder, "Hanging lantern"), position)

    for name, relative_path, position_pattern in (
        ("Old arch / decorative", "Decor/stone-arch.png", r'"Old arch / decorative"[^;]*?new Vector2\(([^,]+),\s*([^)]+)\)'),
        ("Upper observatory arch / decorative", "Decor/stone-arch.png", r'"Upper observatory arch / decorative"[^;]*?new Vector2\(([^,]+),\s*([^)]+)\)'),
        ("Console particles / decorative", "Decor/quantum-motes.png", r'"Console particles / decorative"[^;]*?new Vector2\(([^,]+),\s*([^)]+)\)'),
    ):
        position_match = match_or_fail(position_pattern, decoration_method, f"{name} placement")
        tint = (1.0, 1.0, 1.0)
        if name != "Console particles / decorative":
            tint_match = match_or_fail(
                re.escape(name) + r'[^;]*?new Color\(([^)]+)\)',
                decoration_method,
                f"{name} tint",
            )
            values = [parse_number(value.strip()) for value in tint_match.group(1).split(",")]
            tint = (values[0], values[1], values[2])
        paste(relative_path, parse_vector2((position_match.group(1), position_match.group(2)), {}), tint=tint)

    for platform_x, platform_y, platform_width, platform_height in demo_platforms:
        for y in range(platform_y, platform_y + platform_height):
            for x in range(platform_x, platform_x + platform_width):
                tile_name = "stone-fill"
                if y == platform_y + platform_height - 1:
                    tile_name = (
                        "stone-single" if platform_width == 1
                        else "stone-left" if x == platform_x
                        else "stone-right" if x == platform_x + platform_width - 1
                        else "stone-top"
                    )
                paste(f"Tiles/{tile_name}.png", (x + 0.5, y + 0.5))

    ghost_alpha = parse_number(
        match_or_fail(r"ghostAlphaMultiplier\s*=\s*([0-9.]+)f", bridge_source, "bridge ghost opacity").group(1)
    )
    for rectangles, tile_name in ((zero_platforms, "bridge-zero"), (one_platforms, "bridge-one")):
        for x, y, rectangle_width, rectangle_height in rectangles:
            for tile_x in range(rectangle_width):
                position = (x + tile_x + 0.5, y + rectangle_height / 2)
                paste(f"Tiles/{tile_name}.png", position, opacity=ghost_alpha)

    for relative_path, position in ferns:
        paste(relative_path, position)

    spike_range = match_or_fail(
        r"CreateSpikes\(actors\.transform,\s*(\d+),\s*(\d+)\);",
        builder,
        "demo spike range",
    )
    spike_position = match_or_fail(
        r'InstantiatePrefab\("hazard-spikes",\s*spikes\.transform,\s*new Vector2\(([^,]+),\s*([^)]+)\)\)',
        builder,
        "spike placement",
    )
    spike_sprite = sprite_reference(builder, "Spikes")
    for x in range(int(spike_range.group(1)), int(spike_range.group(2))):
        position = parse_vector2((spike_position.group(1), spike_position.group(2)), {"x": float(x)})
        offset = sprite_local_position(builder, "Spikes")
        paste(spike_sprite, (position[0] + offset[0], position[1] + offset[1]))

    actor_sprites = sorted((
        ("checkpoint", "Flag and stone plinth", 10),
        ("quantum-console", "Console", 9),
        ("exit-door", "Observatory door", 8),
        ("hilary-in-box", "Box", 8),
        ("hilary-in-box", "Hilary", 9),
    ), key=lambda item: item[2])
    for prefab, sprite_name, _order in actor_sprites:
        root_position = find_instantiated_position(builder, prefab, variables)
        local = sprite_local_position(builder, sprite_name)
        paste(sprite_reference(builder, sprite_name), (root_position[0] + local[0], root_position[1] + local[1]))

    villain_position = find_instantiated_position(builder, "schrodinger", variables)
    villain_sprite = match_or_fail(
        r'renderer\.sprite\s*=\s*RequireSprite\("([^"]+)"\)', builder, "Schrodinger sprite"
    ).group(1) + ".png"
    paste(villain_sprite, villain_position)

    player_root = find_instantiated_position(builder, "fleabag", variables)
    player_local = sprite_local_position(builder, "Animated pixel art")
    paste(sprite_reference(builder, "Animated pixel art"),
          (player_root[0] + player_local[0], player_root[1] + player_local[1]))

    # Keep the variable referenced so changes to the builder's standing offset
    # are checked by this script even though the root expression already uses it.
    if player_root[1] < player_offset:
        raise ValueError("Unexpected Fleabag spawn relative to the builder's standing offset.")
    return canvas.png()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify preview output without writing files")
    args = parser.parse_args()
    image = make_preview()
    if args.check:
        if not OUTPUT_PATH.exists() or OUTPUT_PATH.read_bytes() != image:
            raise SystemExit(f"Preview differs from its sources: {OUTPUT_PATH.relative_to(ROOT)}")
        print(f"Verified authored layout preview: {OUTPUT_PATH.relative_to(ROOT)}.")
    else:
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_PATH.write_bytes(image)
        print(f"Rendered {OUTPUT_PATH.relative_to(ROOT)} (640x360; not a Unity capture).")


if __name__ == "__main__":
    main()
