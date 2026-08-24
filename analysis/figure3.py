#!/usr/bin/env python3
"""Generate the reproducible CellGen complete-genome comparison for Figure 3."""

from __future__ import annotations

import argparse
import csv
import json
from dataclasses import dataclass
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

from cellgen.genbank import from_genbank_file
from cellgen.serialise import to_cellgen


ASSEMBLIES = [
    ("GCF_000009885.1", "NTUH-K2044"),
    ("GCF_000016305.1", "MGH 78578"),
    ("GCF_000240185.1", "HS11286"),
]


@dataclass
class GenomeSummary:
    assembly: str
    strain: str
    cellgen: str
    chromosome_accession: str
    chromosome_bp: int
    plasmid_accessions: list[str]
    plasmid_sizes: list[int]

    @property
    def plasmid_count(self) -> int:
        return len(self.plasmid_sizes)

    @property
    def plasmid_bp(self) -> int:
        return sum(self.plasmid_sizes)

    @property
    def total_bp(self) -> int:
        return self.chromosome_bp + self.plasmid_bp

    @property
    def plasmid_percent(self) -> float:
        return 100 * self.plasmid_bp / self.total_bp


def read_assembly(data_root: Path, assembly: str, strain: str) -> GenomeSummary:
    path = data_root / "ncbi_dataset" / "data" / assembly / "genomic.gbff"
    if not path.exists():
        raise FileNotFoundError(
            f"Missing {path}. Run analysis/fetch_figure3_data.sh first."
        )
    cell_set = from_genbank_file(path)
    replicons = cell_set.cells[0].replicons
    chromosomes = [r for r in replicons if r.attributes.get("type") == "chromosome"]
    plasmids = [r for r in replicons if r.attributes.get("type") == "plasmid"]
    if len(chromosomes) != 1:
        raise ValueError(f"Expected one chromosome in {assembly}, found {len(chromosomes)}")
    chromosome = chromosomes[0]
    return GenomeSummary(
        assembly=assembly,
        strain=strain,
        cellgen=to_cellgen(cell_set),
        chromosome_accession=chromosome.label,
        chromosome_bp=chromosome.size_bp or 0,
        plasmid_accessions=[p.label for p in plasmids],
        plasmid_sizes=[p.size_bp or 0 for p in plasmids],
    )


def write_results(summaries: list[GenomeSummary], output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    with (output / "figure3_metrics.tsv").open("w", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t")
        writer.writerow([
            "assembly", "strain", "chromosome_accession", "chromosome_bp",
            "plasmid_count", "plasmid_bp", "plasmid_percent", "plasmid_accessions",
        ])
        for item in summaries:
            writer.writerow([
                item.assembly, item.strain, item.chromosome_accession,
                item.chromosome_bp, item.plasmid_count, item.plasmid_bp,
                f"{item.plasmid_percent:.3f}", ";".join(item.plasmid_accessions),
            ])
    (output / "figure3_records.cellgen").write_text(
        " ;\n".join(item.cellgen for item in summaries) + "\n"
    )
    provenance = {
        "source": "NCBI RefSeq complete genome GenBank records",
        "retrieved": "2026-08-24",
        "assemblies": [item.assembly for item in summaries],
        "conversion": "CellGen Python GenBank importer",
        "note": "Uncontained CDS/gene features are omitted; genes nested in annotated mobile elements are retained.",
    }
    (output / "figure3_provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")


def draw_architecture(ax, summaries: list[GenomeSummary]) -> None:
    ax.set_xlim(0, 1)
    ax.set_ylim(-0.5, len(summaries) - 0.5)
    ax.axis("off")
    blue = "#3377E6"
    orange = "#F08A16"
    for index, item in enumerate(summaries):
        y = len(summaries) - 1 - index
        ax.text(0.0, y + 0.18, item.strain, fontsize=11, fontweight="bold", va="center")
        ax.text(0.0, y - 0.15, item.assembly, fontsize=8, color="#64748B", va="center")
        chromosome = FancyBboxPatch(
            (0.18, y - 0.22), 0.35, 0.44,
            boxstyle="round,pad=0.015,rounding_size=0.025",
            facecolor="#EAF2FF", edgecolor=blue, linewidth=1.6,
        )
        ax.add_patch(chromosome)
        ax.text(0.355, y + 0.04, "chromosome", color=blue, fontsize=9,
                fontweight="bold", ha="center", va="center")
        ax.text(0.355, y - 0.10, f"{item.chromosome_bp / 1e6:.2f} Mb",
                color="#334155", fontsize=8, ha="center", va="center")

        start = 0.57
        available = 0.41
        gap = 0.012
        widths = [max(0.045, min(0.105, 0.035 + 0.00025 * size ** 0.5))
                  for size in item.plasmid_sizes]
        scale = min(1.0, (available - gap * max(0, len(widths) - 1)) / sum(widths))
        widths = [width * scale for width in widths]
        x = start
        for size, width in zip(item.plasmid_sizes, widths):
            plasmid = FancyBboxPatch(
                (x, y - 0.22), width, 0.44,
                boxstyle="round,pad=0.008,rounding_size=0.022",
                facecolor="#FFF2DF", edgecolor=orange, linewidth=1.4,
            )
            ax.add_patch(plasmid)
            label = f"{size / 1000:.0f}k" if size >= 10_000 else f"{size / 1000:.1f}k"
            ax.text(x + width / 2, y, label, color="#A85508", fontsize=7,
                    fontweight="bold", ha="center", va="center", rotation=90 if width < 0.05 else 0)
            x += width + gap

    ax.text(0.18, len(summaries) - 0.62, "( ) chromosomal replicon", color=blue, fontsize=8)
    ax.text(0.57, len(summaries) - 0.62, "{ } plasmids", color=orange, fontsize=8)


def metric_panel(ax, summaries: list[GenomeSummary], values, title: str, suffix: str) -> None:
    colors = ["#4C78A8", "#72A78A", "#D47A3A"]
    labels = [item.strain for item in summaries]
    y = list(range(len(summaries)))[::-1]
    ax.barh(y, values, color=colors, height=0.55)
    ax.set_yticks(y, labels, fontsize=8)
    ax.set_title(title, loc="left", fontsize=10, fontweight="bold", pad=8)
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.tick_params(axis="y", length=0)
    ax.tick_params(axis="x", labelsize=7, colors="#64748B")
    ax.grid(axis="x", color="#E2E8F0", linewidth=0.7)
    ax.set_axisbelow(True)
    maximum = max(values) if values else 1
    ax.set_xlim(0, maximum * 1.25)
    for yi, value in zip(y, values):
        formatted = f"{value:.1f}{suffix}" if isinstance(value, float) else f"{value}{suffix}"
        ax.text(value + maximum * 0.025, yi, formatted, va="center", fontsize=8, color="#334155")


def make_figure(summaries: list[GenomeSummary], figures: Path) -> None:
    figures.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9})
    fig = plt.figure(figsize=(12, 7.4), facecolor="white")
    grid = fig.add_gridspec(2, 3, height_ratios=[1.65, 1], hspace=0.34, wspace=0.5)
    architecture = fig.add_subplot(grid[0, :])
    draw_architecture(architecture, summaries)
    metric_panel(fig.add_subplot(grid[1, 0]), summaries,
                 [item.plasmid_count for item in summaries], "Plasmid count", "")
    metric_panel(fig.add_subplot(grid[1, 1]), summaries,
                 [item.plasmid_bp / 1000 for item in summaries], "Total plasmid DNA", " kb")
    metric_panel(fig.add_subplot(grid[1, 2]), summaries,
                 [item.plasmid_percent for item in summaries], "Plasmid fraction", "%")
    fig.suptitle("Complete Klebsiella pneumoniae genomes differ in whole-cell architecture",
                 x=0.10, y=0.97, ha="left", fontsize=16, fontweight="bold", color="#172033")
    fig.text(0.10, 0.925,
             "CellGen retains chromosome and plasmid membership from complete multi-record GenBank assemblies.",
             ha="left", fontsize=9.5, color="#52606D")
    fig.text(0.075, 0.882, "A", ha="left", fontsize=12, fontweight="bold", color="#172033")
    fig.text(0.075, 0.405, "B", ha="left", fontsize=12, fontweight="bold", color="#172033")
    fig.text(0.10, 0.018,
             "Source: NCBI RefSeq complete assemblies GCF_000009885.1, GCF_000016305.1 and GCF_000240185.1; retrieved 24 August 2026.",
             ha="left", fontsize=7.5, color="#64748B")
    fig.subplots_adjust(left=0.10, right=0.98, top=0.90, bottom=0.09)
    stem = figures / "Figure_3_complete_genome_comparison"
    fig.savefig(stem.with_suffix(".svg"), facecolor="white")
    fig.savefig(stem.with_suffix(".pdf"), facecolor="white")
    fig.savefig(stem.with_suffix(".png"), dpi=300, facecolor="white")
    plt.close(fig)


def main() -> None:
    repo = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, default=repo / "analysis" / "data")
    parser.add_argument("--results", type=Path, default=repo / "analysis" / "results")
    parser.add_argument("--figures", type=Path, default=repo / "figures")
    args = parser.parse_args()
    summaries = [read_assembly(args.data_root, assembly, strain)
                 for assembly, strain in ASSEMBLIES]
    write_results(summaries, args.results)
    make_figure(summaries, args.figures)


if __name__ == "__main__":
    main()
