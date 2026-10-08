#!/usr/bin/env python3
"""Compose the Figure 3 hierarchy heatmap and CellGen containment views."""

from __future__ import annotations

import csv
import re
from xml.sax.saxutils import escape
from pathlib import Path

import cairosvg
import matplotlib.pyplot as plt
import numpy as np
from cellgen import parse


def svg_parts(path: Path) -> tuple[str, str]:
    text = path.read_text()
    match = re.search(r'viewBox="([^"]+)"', text)
    if not match:
        raise ValueError(f"No viewBox in {path}")
    svg_start = text.index("<svg")
    body_start = text.index(">", svg_start) + 1
    return match.group(1), text[body_start:text.rindex("</svg>")]


def make_heatmap(pairwise: Path, output: Path) -> list[str]:
    rows = list(csv.DictReader(pairwise.open(), delimiter="\t"))
    samples = sorted({row["sample_a"] for row in rows})
    index = {sample: i for i, sample in enumerate(samples)}
    matrix = np.zeros((len(samples), len(samples)), dtype=float)
    for row in rows:
        matrix[index[row["sample_a"]], index[row["sample_b"]]] = float(
            row["hierarchy_similarity_percent"]
        )

    labels = [sample.removeprefix("EuSCAPE_") for sample in samples]
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9})
    fig, ax = plt.subplots(figsize=(7.8, 7.2), facecolor="white")
    image = ax.imshow(matrix, cmap="Blues", vmin=0, vmax=100)
    ax.set_xticks(range(len(labels)), labels, rotation=45, ha="right")
    ax.set_yticks(range(len(labels)), labels)
    ax.tick_params(length=0)
    for i in range(len(samples)):
        for j in range(len(samples)):
            value = matrix[i, j]
            ax.text(j, i, f"{value:.0f}", ha="center", va="center",
                    color="white" if value > 55 else "#172033", fontsize=8)
    colourbar = fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    colourbar.set_label("Shared hierarchy (%)")
    ax.set_title("Shared KPC-carrier hierarchy (%)", loc="left",
                 fontsize=13, fontweight="bold", pad=14)
    ax.set_xlabel("EuSCAPE assembly")
    ax.set_ylabel("EuSCAPE assembly")
    fig.tight_layout()
    fig.savefig(output, format="svg", facecolor="white")
    plt.close(fig)
    output.write_text("\n".join(line.rstrip() for line in output.read_text().splitlines()) + "\n")
    return samples


def compose(repo: Path) -> Path:
    results = repo / "analysis" / "euscape_results"
    figures = repo / "figures"
    figures.mkdir(exist_ok=True)
    heatmap = results / "figure3_heatmap.svg"
    make_heatmap(results / "figure3_pairwise.tsv", heatmap)

    heat_view, heat_body = svg_parts(heatmap)
    width, height = 1800, 1050
    cards = []
    for index, sample in enumerate(("AT022", "BE098", "DE016", "IE024")):
        record = parse((results / f"figure3_EuSCAPE_{sample}_carrier.cellgen").read_text())
        carrier = record.cells[0].replicons[0].children[0]
        lines = []
        def walk(node, depth=0):
            lines.append((depth, node.label))
            for child in node.children:
                walk(child, depth + 1)
        walk(carrier)
        x = 1090 + (index % 2) * 350
        y = 100 + (index // 2) * 455
        row_text = "\n".join(
            f'<text x="{x + 18 + depth * 18}" y="{y + 86 + row * 32}" font-size="19" fill="#334155">'
            f'{escape(label)}</text>' for row, (depth, label) in enumerate(lines[:9])
        )
        cards.append(f'<rect x="{x}" y="{y}" width="328" height="412" rx="16" fill="#F8FAFC" stroke="#CBD5E1"/>'
                     f'<text x="{x + 18}" y="{y + 40}" font-size="25" font-weight="700" fill="#172033">{sample}</text>'
                     f'{row_text}')
    example_svgs = "\n".join(cards)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<rect width="100%" height="100%" fill="white"/>
<style>text {{ font-family: Inter, Arial, sans-serif; }}</style>
<text x="45" y="55" font-size="30" font-weight="700" fill="#172033">A</text>
<svg x="55" y="65" width="1010" height="930" viewBox="{heat_view}">{heat_body}</svg>
<text x="1110" y="55" font-size="30" font-weight="700" fill="#172033">B</text>
{example_svgs}
</svg>'''
    stem = figures / "Figure_3_euscape_hierarchy_comparison"
    svg_path = stem.with_suffix(".svg")
    svg_path.write_text(svg)
    cairosvg.svg2pdf(bytestring=svg.encode(), write_to=str(stem.with_suffix(".pdf")))
    cairosvg.svg2png(bytestring=svg.encode(), write_to=str(stem.with_suffix(".png")),
                     output_width=1800, output_height=1050)
    return svg_path


def main() -> None:
    repo = Path(__file__).resolve().parent.parent
    print(compose(repo))


if __name__ == "__main__":
    main()
