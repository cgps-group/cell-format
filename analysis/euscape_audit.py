#!/usr/bin/env python3
"""Write inspectable detector-call and comparison-fact tables from saved outputs."""

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

from euscape_figure3 import (collapse_duplicate_calls, counters, flatten,
                             hierarchy_facts, kpc_carrier, rebuild_hierarchy,
                             identity)


def describe(fact: tuple[str, ...]) -> str:
    return ">".join(fact)


def write(data: Path, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    facts: dict[str, Counter[tuple[str, ...]]] = {}
    with (output / "detector_calls.tsv").open("w", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t")
        writer.writerow(["sample", "type", "family", "name", "start", "end",
                         "score", "source", "reference_accession", "retained", "parent"])
        for path in sorted((data / "matryoshka").glob("*.json")):
            raw = flatten(json.loads(path.read_text()))
            retained = collapse_duplicate_calls(raw)
            retained_ids = {id(call) for call in retained}
            roots = rebuild_hierarchy(retained)
            parents: dict[int, str] = {}
            def visit(nodes, parent: str) -> None:
                for node in nodes:
                    parents[id(node)] = parent
                    visit(node.children, identity(node))
            visit(roots, "plasmid")
            carrier = kpc_carrier(roots)
            nodes, edges = counters([carrier], "plasmid")
            facts[path.stem] = hierarchy_facts(nodes, edges)
            for call in raw:
                writer.writerow([
                    path.stem, call.element_type, call.family, call.name,
                    call.start, call.end, call.score,
                    call.attributes.get("source", ""),
                    call.attributes.get("source_accession", ""),
                    "yes" if id(call) in retained_ids else "no",
                    parents.get(id(call), "-"),
                ])
    with (output / "pairwise_facts.tsv").open("w", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t")
        writer.writerow(["sample_a", "sample_b", "shared_facts", "a_only_facts", "b_only_facts"])
        for a, left in facts.items():
            for b, right in facts.items():
                shared = left & right
                a_only = left - right
                b_only = right - left
                expand = lambda values: "; ".join(describe(fact) for fact in values.elements())
                writer.writerow([a, b, expand(shared) or "-", expand(a_only) or "-", expand(b_only) or "-"])


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path(__file__).parent / "euscape_evidence")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "euscape_results")
    args = parser.parse_args()
    write(args.data, args.output)
