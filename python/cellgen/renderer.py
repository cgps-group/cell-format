"""
SVG renderer for CellGen CellSet objects.

Produces circular diagrams matching the CellGen spec sample images:
  - Chromosomes: large blue circles
  - Plasmids / other ENTITYs: smaller green circles, positioned top-right of chromosome
  - Nested ENTITYs: coloured rectangles on the parent circle border
  - Labels: inside chromosomes, above plasmids
  - Multiple cells: laid out side by side with a dashed separator
"""

from __future__ import annotations
import math
import xml.etree.ElementTree as ET
from .types import Cell, CellSet, ChromosomeNode, EntityNode

CHR_FILL = "#dde8f8"
CHR_STROKE = "#3a6fba"
CHR_STROKE_W = 8

ENTITY_FILL = "#e6f5e6"
ENTITY_STROKE = "#3a9943"
ENTITY_STROKE_W = 5

ELEMENT_COLOURS = ["#e05252", "#9b59b6", "#f39c12", "#16a085", "#2980b9", "#e74c3c"]

CHR_R = 90.0
ENTITY_R = 44.0
PAD = 24.0
LABEL_FONT = "Inter, Arial, sans-serif"


def _element_colour(label: str, index: int) -> str:
    l = label.lower()
    if any(k in l for k in ("transposon", "tn")):
        return "#e05252"
    if any(k in l for k in ("integron", "int")):
        return "#9b59b6"
    if any(k in l for k in ("phage", "prophage")):
        return "#f39c12"
    if any(k in l for k in ("is", "insertion")):
        return "#f39c12"
    return ELEMENT_COLOURS[index % len(ELEMENT_COLOURS)]


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


class _SVGBuilder:
    def __init__(self) -> None:
        self.parts: list[str] = []

    def circle(self, cx: float, cy: float, r: float, fill: str, stroke: str, sw: int) -> None:
        self.parts.append(
            f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
        )

    def rect_rotated(self, cx: float, cy: float, w: float, h: float, fill: str, deg: float) -> None:
        self.parts.append(
            f'<rect x="{cx - w/2:.1f}" y="{cy - h/2:.1f}" width="{w:.1f}" height="{h:.1f}" '
            f'fill="{fill}" rx="2" '
            f'transform="rotate({deg:.1f},{cx:.1f},{cy:.1f})"/>'
        )

    def text(self, x: float, y: float, content: str, size: int = 13,
             anchor: str = "middle", fill: str = "#333", bold: bool = False) -> None:
        weight = ' font-weight="600"' if bold else ""
        self.parts.append(
            f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}" '
            f'font-size="{size}" fill="{fill}" font-family="{LABEL_FONT}"{weight}>'
            f'{_esc(content)}</text>'
        )

    def line(self, x1: float, y1: float, x2: float, y2: float,
             stroke: str = "#ccc", sw: float = 1.5, dash: str = "") -> None:
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.parts.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{stroke}" stroke-width="{sw}"{da}/>'
        )

    def to_svg(self, width: float, height: float) -> str:
        body = "\n  ".join(self.parts)
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'width="{width:.0f}" height="{height:.0f}" '
            f'viewBox="0 0 {width:.0f} {height:.0f}" '
            f'style="background:white">\n  {body}\n</svg>'
        )


def _render_nested(elements: list[EntityNode], px: float, py: float, pr: float,
                   svg: _SVGBuilder, start_angle: float = -math.pi / 2) -> None:
    n = len(elements)
    for i, el in enumerate(elements):
        angle = start_angle + (2 * math.pi * i / n)
        bx = px + pr * math.cos(angle)
        by = py + pr * math.sin(angle)
        colour = _element_colour(el.label, i)
        deg = math.degrees(angle) + 90
        svg.rect_rotated(bx, by, 18, 11, colour, deg)
        # Label offset outward
        lx = px + (pr + 26) * math.cos(angle)
        ly = py + (pr + 26) * math.sin(angle)
        if el.label:
            svg.text(lx, ly + 4, el.label, size=12, fill="#444")


def _measure_cell(cell: Cell) -> tuple[float, float]:
    """Return (width, height) needed for this cell."""
    chrs = [r for r in cell.replicons if isinstance(r, ChromosomeNode)]
    entities = [r for r in cell.replicons if isinstance(r, EntityNode)]

    n_chr = max(len(chrs), 1)
    n_entity = len(entities)

    # Height: tallest column
    chr_col_h = n_chr * (CHR_R * 2 + PAD) + PAD + 30
    entity_col_h = n_entity * (ENTITY_R * 2 + PAD + 30) + PAD + 30 if n_entity else 0
    height = max(chr_col_h, entity_col_h, CHR_R * 2 + PAD * 2 + 60)

    # Width: chr column + entity column (if any)
    chr_col_w = CHR_R * 2 + PAD * 2
    entity_col_w = (ENTITY_R * 2 + PAD * 2 + 50) if n_entity else 0
    width = chr_col_w + entity_col_w + PAD

    return width, height


def _render_cell(cell: Cell, ox: float, oy: float, height: float, svg: _SVGBuilder) -> float:
    chrs = [r for r in cell.replicons if isinstance(r, ChromosomeNode)]
    entities = [r for r in cell.replicons if isinstance(r, EntityNode)]

    # Chromosome column
    n_chr = max(len(chrs), 1)
    chr_col_w = CHR_R * 2 + PAD * 2

    if chrs:
        total_chr_h = len(chrs) * CHR_R * 2 + (len(chrs) - 1) * PAD
        start_y = oy + (height - total_chr_h) / 2
        for i, ch in enumerate(chrs):
            cx = ox + CHR_R + PAD
            cy = start_y + i * (CHR_R * 2 + PAD) + CHR_R
            svg.circle(cx, cy, CHR_R, CHR_FILL, CHR_STROKE, CHR_STROKE_W)
            if ch.label:
                svg.text(cx, cy + 5 + (CHR_R * 0.4 if not ch.children else 0),
                         ch.label, size=15, fill="#333")
            _render_nested(ch.children, cx, cy, CHR_R, svg)

    # ENTITY column (right of chromosomes)
    entity_col_x = ox + chr_col_w + PAD

    if entities:
        total_entity_h = len(entities) * ENTITY_R * 2 + (len(entities) - 1) * PAD
        label_space = len(entities) * 30  # space for labels above
        start_my = oy + (height - total_entity_h - label_space) / 2 + 30
        for i, entity in enumerate(entities):
            mx = entity_col_x + ENTITY_R + PAD
            my = start_my + i * (ENTITY_R * 2 + PAD + 30) + ENTITY_R
            svg.circle(mx, my, ENTITY_R, ENTITY_FILL, ENTITY_STROKE, ENTITY_STROKE_W)
            if entity.label:
                svg.text(mx, my - ENTITY_R - 10, entity.label, size=13, fill="#333")
            _render_nested(entity.children, mx, my, ENTITY_R, svg)

        return entity_col_x + ENTITY_R * 2 + PAD * 2 + 50

    return ox + chr_col_w + PAD


def render_svg(cell_set: CellSet) -> str:
    """Render a CellSet to an SVG string. Width and height are computed automatically."""
    cells = cell_set.cells
    if not cells:
        return '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"/>'

    cell_dims = [_measure_cell(c) for c in cells]
    total_width = sum(w for w, _ in cell_dims) + (len(cells) - 1) * PAD + PAD * 2
    height = max(h for _, h in cell_dims) + PAD * 2

    svg = _SVGBuilder()
    x = PAD
    for i, (cell, (w, _)) in enumerate(zip(cells, cell_dims)):
        _render_cell(cell, x, PAD, height, svg)
        x += w
        if i < len(cells) - 1:
            svg.line(x + PAD / 2, PAD, x + PAD / 2, height + PAD, dash="6,4")
            x += PAD

    return svg.to_svg(total_width, height + PAD * 2)
