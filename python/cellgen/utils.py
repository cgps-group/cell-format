"""Utility helpers."""
from __future__ import annotations
from pathlib import Path


def parse_fasta_headers(path: Path) -> list[tuple[str, int | None]]:
    """Return (header, total_bp) tuples from a FASTA file."""
    results = []
    current_header = ""
    current_bp = 0
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if line.startswith(">"):
                if current_header:
                    results.append((current_header, current_bp))
                current_header = line[1:].split()[0]
                current_bp = 0
            else:
                current_bp += len(line)
    if current_header:
        results.append((current_header, current_bp))
    return results
