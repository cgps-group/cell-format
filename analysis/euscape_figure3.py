#!/usr/bin/env python3
"""Build CellGen hierarchies and Figure 3 metrics from Matryoshka output."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Feature:
    element_type: str
    family: str
    name: str
    start: int
    end: int
    score: float
    attributes: dict[str, object]
    children: list["Feature"] = field(default_factory=list)


FORBIDDEN = {
    ("IS", "AMR"), ("IS", "cassette"), ("IS", "attC"),
    ("IS", "integrase"), ("IS", "integron"), ("IS", "transposon"),
    ("AMR", "AMR"), ("AMR", "IS"), ("res_site", "AMR"),
    ("res_site", "IS"),
}


def flatten(nodes: list[dict[str, object]]) -> list[Feature]:
    result: list[Feature] = []
    for node in nodes:
        result.append(Feature(
            element_type=str(node["element_type"]),
            family=str(node.get("family") or ""),
            name=str(node.get("name") or ""),
            start=int(node.get("start") or 0),
            end=int(node.get("end") or 0),
            score=float(node.get("score") or 0),
            attributes=dict(node.get("attributes") or {}),
        ))
        result.extend(flatten(list(node.get("children") or [])))
    return result


def type_name(feature: Feature) -> str:
    return "gene" if feature.element_type in {"AMR", "integrase"} else feature.element_type.lower()


def identity(feature: Feature) -> str:
    kind = type_name(feature)
    name = feature.name or feature.family or kind
    if feature.element_type == "IS" and re.fullmatch(r"IS[^_]+_\d+(?:\|.*)?", name):
        name = feature.family or name.split("_", 1)[0]
    if feature.element_type == "res_site":
        name = feature.family or name
    return f"{kind}:{name.lower()}"


def overlap(a: Feature, b: Feature) -> float:
    shared = max(0, min(a.end, b.end) - max(a.start, b.start) + 1)
    shortest = min(a.end - a.start + 1, b.end - b.start + 1)
    return shared / shortest if shortest > 0 else 0


def duplicate(a: Feature, b: Feature) -> bool:
    if type_name(a) != type_name(b) or overlap(a, b) < 0.8:
        return False
    if a.element_type == "IS":
        return a.family == b.family or a.name == b.name
    return identity(a) == identity(b)


def specificity(feature: Feature) -> tuple[float, int, int]:
    generic = bool(re.fullmatch(r"IS[^_]+_\d+(?:\|.*)?", feature.name))
    source = str(feature.attributes.get("source", ""))
    return (feature.score, not generic, source == "reference_scan")


def collapse_duplicate_calls(features: list[Feature]) -> list[Feature]:
    retained: list[Feature] = []
    for feature in sorted(features, key=specificity, reverse=True):
        if feature.element_type == "replicon":
            continue
        if not any(duplicate(feature, prior) for prior in retained):
            retained.append(feature)
    return retained


def contains(parent: Feature, child: Feature) -> bool:
    # Matryoshka labels this site as belonging to Tn4401. Its coordinates
    # happen to fall inside an IS21 call in DE016; do not infer IS parentage.
    if (parent.element_type == "IS" and child.element_type == "res_site"
            and child.family == "Tn4401"):
        return False
    return (
        parent is not child
        and parent.start <= child.start
        and child.end <= parent.end
        and (parent.start, parent.end) != (child.start, child.end)
        and (parent.element_type, child.element_type) not in FORBIDDEN
    )


def rebuild_hierarchy(features: list[Feature]) -> list[Feature]:
    for feature in features:
        feature.children = []
    ordered = sorted(features, key=lambda f: (f.end - f.start, f.start, identity(f)))
    parents: dict[int, Feature] = {}
    for index, child in enumerate(ordered):
        candidates = [item for item in ordered[index + 1:] if contains(item, child)]
        if candidates:
            parents[id(child)] = min(candidates, key=lambda f: (f.end - f.start, f.start))
    for child in ordered:
        if id(child) in parents:
            parents[id(child)].children.append(child)
    for feature in ordered:
        feature.children.sort(key=lambda f: (f.start, f.end, identity(f)))
    return sorted(
        [item for item in ordered if id(item) not in parents],
        key=lambda f: (f.start, f.end, identity(f)),
    )


def replicon_identity(features: list[Feature]) -> str:
    families = sorted({item.family or item.name for item in features if item.element_type == "replicon"})
    return "plasmid:" + "+".join(families).lower()


def label(feature: Feature) -> str:
    if feature.element_type == "IS" and re.fullmatch(r"IS[^_]+_\d+(?:\|.*)?", feature.name):
        return feature.family or feature.name.split("_", 1)[0]
    return feature.name or feature.family or type_name(feature)


def quote(value: str) -> str:
    if re.fullmatch(r"[A-Za-z0-9_.:-]+", value):
        return value
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def feature_cellgen(feature: Feature) -> str:
    children = ",".join(feature_cellgen(child) for child in feature.children)
    attrs = {"type": type_name(feature), "start": str(feature.start), "end": str(feature.end)}
    if feature.family and feature.family.lower() != label(feature).lower():
        attrs["family"] = feature.family
    attr_text = ",".join(f'{key}="{value}"' for key, value in attrs.items())
    return f"{{{children}}}{quote(label(feature))}[{attr_text}]"


def counters(roots: list[Feature], parent: str) -> tuple[Counter[str], Counter[tuple[str, str]]]:
    nodes: Counter[str] = Counter({parent: 1})
    edges: Counter[tuple[str, str]] = Counter()

    def visit(feature: Feature, parent_id: str) -> None:
        feature_id = identity(feature)
        nodes[feature_id] += 1
        edges[(parent_id, feature_id)] += 1
        for child in feature.children:
            visit(child, feature_id)

    for root in roots:
        visit(root, parent)
    return nodes, edges


def multiset_difference(a: Counter[object], b: Counter[object]) -> int:
    return sum(abs(a[key] - b[key]) for key in a.keys() | b.keys())


def max_depth(roots: list[Feature]) -> int:
    def depth(feature: Feature) -> int:
        return 1 + max((depth(child) for child in feature.children), default=0)
    return 1 + max((depth(root) for root in roots), default=0)


def kpc_path(roots: list[Feature]) -> str:
    def find(nodes: list[Feature], path: list[str]) -> list[str] | None:
        for node in nodes:
            current = path + [label(node)]
            if "KPC" in node.name.upper():
                return current
            result = find(node.children, current)
            if result:
                return result
        return None
    return " > ".join(find(roots, ["plasmid"]) or [])


def kpc_carrier(roots: list[Feature]) -> Feature:
    def find(nodes: list[Feature], path: list[Feature]) -> list[Feature] | None:
        for node in nodes:
            current = path + [node]
            if "KPC" in node.name.upper():
                return current
            result = find(node.children, current)
            if result:
                return result
        return None

    path = find(roots, [])
    if not path or len(path) < 2:
        raise ValueError("KPC gene is not nested within a carrier element")
    return path[-2]


def hierarchy_facts(
    nodes: Counter[str], edges: Counter[tuple[str, str]]
) -> Counter[tuple[str, ...]]:
    facts: Counter[tuple[str, ...]] = Counter()
    for node, count in nodes.items():
        facts[("entity", node)] += count
    for (parent, child), count in edges.items():
        facts[("contains", parent, child)] += count
    return facts


def jaccard_counts(
    a: Counter[tuple[str, ...]], b: Counter[tuple[str, ...]]
) -> tuple[int, int, float]:
    keys = a.keys() | b.keys()
    shared = sum(min(a[key], b[key]) for key in keys)
    union = sum(max(a[key], b[key]) for key in keys)
    similarity = 100.0 * shared / union if union else 100.0
    return shared, union, similarity


def build(data: Path, results: Path) -> None:
    analyses: dict[str, dict[str, object]] = {}
    screening = {
        row["sample"]: row
        for row in csv.DictReader((data / "screening.tsv").open(), delimiter="\t")
        if row["selected"] == "yes"
    }
    for path in sorted((data / "matryoshka").glob("*.json")):
        raw = flatten(json.loads(path.read_text()))
        roots = rebuild_hierarchy(collapse_duplicate_calls(raw))
        parent = replicon_identity(raw)
        # Replicon families remain in the CellGen attributes but do not change
        # the biological identity of the common top-level plasmid container.
        nodes, edges = counters(roots, "plasmid")
        families = parent.split(":", 1)[1]
        record = (
            "{" + ",".join(feature_cellgen(root) for root in roots) + "}" + path.stem
            + f'[type="plasmid",replicon="{families}",length="{screening[path.stem]["kpc_contig_bp"]}"]'
        )
        carrier = kpc_carrier(roots)
        carrier_nodes, carrier_edges = counters([carrier], "plasmid")
        analyses[path.stem] = {
            "record": record, "roots": roots, "nodes": nodes, "edges": edges,
            "carrier": carrier, "carrier_nodes": carrier_nodes,
            "carrier_edges": carrier_edges,
            "carrier_facts": hierarchy_facts(carrier_nodes, carrier_edges),
            "replicon": families,
        }

    results.mkdir(parents=True, exist_ok=True)
    (results / "figure3_records.cellgen").write_text(
        " ;\n".join(str(analyses[s]["record"]) for s in sorted(analyses)) + "\n"
    )
    with (results / "figure3_metrics.tsv").open("w", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t")
        writer.writerow([
            "sample", "carrier_entity_count", "carrier_relationship_count",
            "carrier_maximum_depth", "full_entity_count", "full_relationship_count",
            "replicon", "kpc_path",
        ])
        for sample in sorted(analyses):
            item = analyses[sample]
            writer.writerow([
                sample, sum(item["carrier_nodes"].values()),
                sum(item["carrier_edges"].values()), max_depth([item["carrier"]]),
                sum(item["nodes"].values()), sum(item["edges"].values()),
                item["replicon"], kpc_path(item["roots"]),
            ])

    samples = sorted(analyses)
    with (results / "figure3_pairwise.tsv").open("w", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t")
        writer.writerow([
            "sample_a", "sample_b", "shared_hierarchy_facts",
            "union_hierarchy_facts", "different_hierarchy_facts",
            "hierarchy_similarity_percent",
        ])
        for a in samples:
            for b in samples:
                shared, union, similarity = jaccard_counts(
                    analyses[a]["carrier_facts"], analyses[b]["carrier_facts"]
                )
                writer.writerow([a, b, shared, union, union - shared, f"{similarity:.1f}"])

    detail_examples = (
        "EuSCAPE_AT022",
        "EuSCAPE_BE098",
        "EuSCAPE_DE016",
        "EuSCAPE_IE024",
    )
    for sample in detail_examples:
        (results / f"figure3_{sample}.cellgen").write_text(str(analyses[sample]["record"]) + "\n")
        carrier_record = (
            "{" + feature_cellgen(analyses[sample]["carrier"]) + "}" + sample
            + '[type="plasmid",view="KPC_carrier"]'
        )
        (results / f"figure3_{sample}_carrier.cellgen").write_text(carrier_record + "\n")

    provenance = {
        "source": "EuSCAPE hybrid assemblies supplied as euscape.tar.gz",
        "selection": "First ten assemblies, ordered by assembly contig count then sample ID, with one exact KPC annotation, a largest contig of at least 5 Mb and a KPC-bearing contig below 500 kb.",
        "detectors": ["AMRFinder+ 4.2.7 (database 2026-08-07.1)", "ISEScan 1.7.3", "IntegronFinder 2.0.3"],
        "annotation": "Matryoshka plus its bundled reference scan",
        "normalisation": "Overlapping duplicate calls from multiple detectors were collapsed, retaining the highest-scoring and most specific call. The comparison was anchored on the Tn4401-family subtree containing blaKPC. Coordinates and sample-specific labels were excluded.",
        "comparison": "Each carrier hierarchy was represented as a multiset of entity facts and parent-child containment facts. Pairwise similarity is the multiset Jaccard index: shared facts divided by union facts, reported as a percentage.",
        "samples": samples,
        "detail_examples": list(detail_examples),
    }
    (results / "figure3_provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")


def main() -> None:
    repo = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=repo / "analysis" / "data" / "euscape")
    parser.add_argument("--results", type=Path, default=repo / "analysis" / "results")
    args = parser.parse_args()
    build(args.data, args.results)
    sys.path.insert(0, str(repo / "python"))
    from cellgen import parse
    parse((args.results / "figure3_records.cellgen").read_text())


if __name__ == "__main__":
    main()
