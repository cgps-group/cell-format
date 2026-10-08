"""
GenBank and GFF3 → CellGen converter.

Requires BioPython for GenBank parsing.
GFF3 parsing is built-in (no extra dependency).

Usage:
    from cellgen.genbank import from_genbank_file, from_gff_file, from_mobsuite

    cell_set = from_genbank_file("assembly.gbk")
    cell_set = from_gff_file("annotation.gff")
    cell_set = from_mobsuite("mob_recon_results/")
"""

from __future__ import annotations
import re
from urllib.parse import unquote
from pathlib import Path
from .types import Attributes, Cell, CellSet, CellularElement, ChromosomeNode, EntityNode

# Feature types considered MGEs
_MGE_FEATURE_TYPES = {
    "mobile_element", "transposon", "insertion_sequence",
    "integron", "repeat_region", "misc_feature",
}

# Keywords in /mobile_element_type or /note qualifiers
_TRANSPOSON_KW = {"transposon", "tn", "is", "insertion"}
_INTEGRON_KW = {"integron", "intg", "integrase"}
_PHAGE_KW = {"phage", "prophage", "bacteriophage"}

# MOB-suite chromosome classification
_CHR_MOB_TYPES = {"chromosome", "chromosome,chromosome"}


def _classify_qualifier(qualifier_text: str) -> str:
    """Return a cleaned label from a GenBank qualifier string."""
    # strip mobile_element_type prefix e.g. "transposon:Tn3"
    label = qualifier_text.split(":")[-1]
    label = re.sub(r"[^a-zA-Z0-9_\-. ]", "", label).strip()
    return label


# ── GenBank ───────────────────────────────────────────────────────────────────

def from_genbank_file(path: str | Path, *, retain_uncontained_genes: bool = False,
                      selected_feature_ids: set[str] | None = None) -> CellSet:
    """Parse an assembly or standalone element GenBank file into one cell.

    Multi-record files are treated as assemblies. A single record whose
    full span is annotated as a mobile element is represented as a bare
    entity, which covers TnCentral and Matryoshka-style element records.
    """
    try:
        from Bio import SeqIO  # type: ignore[import-untyped]
    except ImportError as e:
        raise ImportError("BioPython is required for GenBank parsing: pip install biopython") from e

    records = list(SeqIO.parse(str(path), "genbank"))
    if not records:
        raise ValueError(f"No GenBank records found in {path}")

    replicons: list[CellularElement] = []
    for record in records:
        roots = _extract_gb_hierarchy(record, retain_uncontained_genes=retain_uncontained_genes,
                                      selected_feature_ids=selected_feature_ids or set())
        full_span = _full_span_mobile_root(record, roots)
        if len(records) == 1 and full_span is not None:
            replicons.append(full_span)
            continue

        rep_type = _classify_gb_record(record)
        label = record.id or record.name
        size = len(record.seq) if record.seq else None
        attrs: Attributes = {"type": rep_type, "accession": record.id}
        topology = record.annotations.get("topology")
        if topology:
            attrs["topology"] = str(topology)
        if size is not None:
            attrs["length"] = str(size)
        if rep_type == "chromosome":
            replicons.append(ChromosomeNode(label=label, children=roots, attributes=attrs, size_bp=size))
        else:
            replicons.append(EntityNode(label=label, children=roots, attributes=attrs, size_bp=size))

    return CellSet(cells=[Cell(replicons=replicons)])


def _classify_gb_record(record) -> str:  # type: ignore[no-untyped-def]
    """Chromosome or plasmid based on DEFINITION / keywords."""
    definition = f"{record.description} {record.id} {record.name}".lower()
    if "plasmid" in definition:
        return "plasmid"
    if "chromosome" in definition:
        return "chromosome"
    # Check source feature
    for feat in record.features:
        if feat.type == "source":
            if "plasmid" in feat.qualifiers:
                return "plasmid"
            if "chromosome" in feat.qualifiers:
                return "chromosome"
    return "unknown"


def _feature_type(feat) -> str | None:  # type: ignore[no-untyped-def]
    raw = feat.type.lower()
    if raw in {"mobile_element", "transposon", "insertion_sequence", "integron"}:
        qualifier = feat.qualifiers.get("mobile_element_type", [raw])[0].lower()
        if "insertion sequence" in qualifier or raw == "insertion_sequence":
            return "insertion_sequence"
        if "integron" in qualifier or raw == "integron":
            return "integron"
        if "transposon" in qualifier or raw == "transposon":
            return "transposon"
        return "mobile_element"
    if raw in {"cds", "gene"}:
        return "gene"
    if raw == "misc_feature":
        note = " ".join(feat.qualifiers.get("note", [])).lower()
        if "integron" in note:
            return "integron"
    return None


def _feature_label(feat, entity_type: str) -> str:  # type: ignore[no-untyped-def]
    keys = ("mobile_element_type", "gene", "label", "locus_tag", "product", "note")
    for key in keys:
        values = feat.qualifiers.get(key)
        if values:
            label = values[0].split(":", 1)[-1].strip()
            if label:
                return label
    return entity_type


def _extract_gb_hierarchy(record, *, retain_uncontained_genes: bool = False,
                          selected_feature_ids: set[str] | None = None) -> list[EntityNode]:  # type: ignore[no-untyped-def]
    entries: list[tuple[int, int, str, EntityNode]] = []
    selected_feature_ids = selected_feature_ids or set()
    for feat in record.features:
        entity_type = _feature_type(feat)
        if entity_type is None or feat.location is None:
            continue
        start = int(feat.location.start) + 1
        end = int(feat.location.end)
        strand_value = getattr(feat.location, "strand", None)
        strand = "+" if strand_value == 1 else "-" if strand_value == -1 else "."
        attrs: Attributes = {
            "type": entity_type,
            "start": str(start),
            "end": str(end),
            "strand": strand,
        }
        node = EntityNode(
            label=_feature_label(feat, entity_type),
            attributes=attrs,
            size_bp=end - start + 1,
        )
        identifiers = {str(value) for key in ("gene", "locus_tag", "label")
                       for value in feat.qualifiers.get(key, [])}
        entries.append((start, end, entity_type, node, identifiers))

    # A gene can be a child but never a coordinate-derived parent. Each node is
    # attached to its smallest strict enclosing non-gene feature.
    roots: list[EntityNode] = []
    for start, end, entity_type, node, identifiers in entries:
        parents = [entry for entry in entries
                   if entry[2] != "gene" and entry[0] <= start and end <= entry[1]
                   and (entry[0], entry[1]) != (start, end)]
        if parents:
            parent = min(parents, key=lambda entry: (entry[1] - entry[0], entry[0]))[3]
            parent.children.append(node)
        elif entity_type != "gene" or retain_uncontained_genes or identifiers & selected_feature_ids:
            roots.append(node)

    def sort_children(node: EntityNode) -> None:
        node.children.sort(key=lambda child: int(child.attributes.get("start", "0")))
        for child in node.children:
            sort_children(child)

    # Keep genes when they describe the contents of a structural entity, but
    # omit uncontained genes rather than flattening a whole annotation into the
    # replicon root.
    roots.sort(key=lambda node: int(node.attributes.get("start", "0")))
    for root in roots:
        sort_children(root)
    return roots


def _full_span_mobile_root(record, roots: list[EntityNode]) -> EntityNode | None:  # type: ignore[no-untyped-def]
    length = len(record.seq)
    for root in roots:
        if (root.attributes.get("type") != "gene"
                and root.attributes.get("start") == "1"
                and root.attributes.get("end") == str(length)):
            root.attributes.setdefault("accession", record.id)
            return root
    return None


# ── GFF3 ──────────────────────────────────────────────────────────────────────

def from_gff_file(path: str | Path, *, retain_uncontained_genes: bool = False,
                  selected_feature_ids: set[str] | None = None) -> CellSet:
    """Parse one GFF3 annotation set into one cell; FASTA sequence is optional."""
    seq_info: dict[str, dict] = {}
    mge_types = {"mobile_genetic_element", "transposable_element", "transposon",
                 "insertion_sequence", "integron", "repeat_region"}
    in_fasta = False
    fasta_id: str | None = None

    def info_for(seq_id: str) -> dict:
        return seq_info.setdefault(seq_id, {"type": _guess_type_from_id(seq_id),
                                            "size": None, "features": [], "fasta_length": 0,
                                            "region": None})

    with open(path) as fh:
        for number, raw in enumerate(fh, 1):
            line = raw.strip()
            if line == "##FASTA":
                in_fasta = True
                continue
            if in_fasta:
                if line.startswith(">"):
                    fasta_id = line[1:].split()[0]
                    info_for(fasta_id)
                elif line and fasta_id:
                    info_for(fasta_id)["fasta_length"] += len(line)
                continue
            if not line:
                continue
            if line.startswith("##sequence-region"):
                parts = line.split()
                if len(parts) != 4 or not parts[2].isdigit() or not parts[3].isdigit() or int(parts[2]) > int(parts[3]):
                    raise ValueError(f"Invalid sequence-region at line {number}")
                info_for(parts[1])["region"] = (int(parts[2]), int(parts[3]))
                if parts[2] == "1":
                    info_for(parts[1])["size"] = int(parts[3])
                continue
            if line.startswith("#"):
                continue
            cols = line.split("\t")
            if len(cols) != 9:
                raise ValueError(f"Expected nine GFF3 columns at line {number}")
            seq_id, _, feature_type, start_text, end_text, _, strand, _, attrs_text = cols
            if not start_text.isdigit() or not end_text.isdigit() or int(start_text) < 1 or int(end_text) < int(start_text):
                raise ValueError(f"Invalid GFF3 coordinates at line {number}")
            start, end = int(start_text), int(end_text)
            kind = feature_type.lower()
            info = info_for(seq_id)
            if kind in {"chromosome", "plasmid"}:
                info["type"] = kind
            if kind not in mge_types | {"gene", "cds"}:
                continue
            attributes = _parse_gff_attrs(attrs_text)
            label = unquote(attributes.get("Name") or attributes.get("gene") or attributes.get("ID") or kind)
            node = EntityNode(label=label, size_bp=end - start + 1,
                              attributes={"type": "gene" if kind == "cds" else kind,
                                          "start": str(start), "end": str(end), "strand": strand})
            identifiers = {unquote(attributes[key]) for key in ("ID", "Name", "gene", "locus_tag") if key in attributes}
            info["features"].append((start, end, "gene" if kind in {"gene", "cds"} else kind,
                                     node, identifiers, attributes.get("ID"), attributes.get("Parent")))

    if not seq_info:
        raise ValueError(f"No GFF3 sequence records found in {path}")
    replicons: list[CellularElement] = []
    for seq_id, info in seq_info.items():
        entries = info["features"]
        # GFF3 commonly gives a gene and its CDS the same span. The CDS Parent
        # explicitly identifies the gene; represent that biological locus once.
        gene_ids = {(entry[0], entry[1], entry[5]) for entry in entries
                    if entry[2] == "gene" and entry[5]}
        entries = [entry for entry in entries if not (entry[2] == "gene" and entry[6]
                   and (entry[0], entry[1], entry[6]) in gene_ids)]
        roots: list[EntityNode] = []
        for start, end, kind, node, identifiers, _, _ in entries:
            parents = [entry for entry in entries if entry[2] != "gene"
                       and entry[0] <= start and end <= entry[1]
                       and (entry[0], entry[1]) != (start, end)]
            if parents:
                min(parents, key=lambda entry: (entry[1] - entry[0], entry[0]))[3].children.append(node)
            elif kind != "gene" or retain_uncontained_genes or identifiers & (selected_feature_ids or set()):
                roots.append(node)
        def sort_nodes(nodes: list[EntityNode]) -> None:
            nodes.sort(key=lambda node: (int(node.attributes["start"]), int(node.attributes["end"])))
            for node in nodes:
                sort_nodes(node.children)
        sort_nodes(roots)
        size = info["size"] or info["fasta_length"] or None
        attrs: Attributes = {"type": info["type"], "accession": seq_id}
        if info["region"]:
            attrs["region_start"], attrs["region_end"] = map(str, info["region"])
        if size is not None:
            attrs["length"] = str(size)
        if info["type"] == "chromosome":
            replicons.append(ChromosomeNode(label=seq_id, children=roots, attributes=attrs, size_bp=size))
        else:
            replicons.append(EntityNode(label=seq_id, children=roots, attributes=attrs, size_bp=size))
    return CellSet(cells=[Cell(replicons=replicons)])


def _parse_gff_attrs(s: str) -> dict[str, str]:
    attrs: dict[str, str] = {}
    for part in s.split(";"):
        if "=" in part:
            k, _, v = part.partition("=")
            attrs[k.strip()] = v.strip()
    return attrs


def _guess_type_from_id(seq_id: str) -> str:
    l = seq_id.lower()
    if "plasmid" in l:
        return "plasmid"
    if "chromosome" in l:
        return "chromosome"
    return "unknown"


# ── MOB-suite ─────────────────────────────────────────────────────────────────

def from_mobsuite(results_dir: str | Path) -> CellSet:
    """
    Parse MOB-suite (mob_recon) output directory → CellSet.

    Expected files:
      chromosome.fasta / chromosome.gbk  — chromosomal contigs
      plasmid_*.fasta / plasmid_*.gbk    — plasmid contigs
      mobtyper_results.txt               — replicon type classifications
    """
    results_dir = Path(results_dir)
    replicons: list[CellularElement] = []

    # Read contig report if present
    contig_report = results_dir / "contig_report.txt"
    mob_results: dict[str, dict] = {}
    if contig_report.exists():
        with open(contig_report) as fh:
            headers = fh.readline().strip().split("\t")
            for line in fh:
                row = dict(zip(headers, line.strip().split("\t")))
                mob_results[row.get("contig_id", "")] = row

    # chromosome.fasta → ChromosomeNode
    chr_fasta = results_dir / "chromosome.fasta"
    if chr_fasta.exists():
        from .utils import parse_fasta_headers
        for header, size in parse_fasta_headers(chr_fasta):
            replicons.append(ChromosomeNode(label=header, size_bp=size))

    # plasmid_*.fasta → EntityNode
    for plas_file in sorted(results_dir.glob("plasmid_*.fasta")):
        from .utils import parse_fasta_headers
        for header, size in parse_fasta_headers(plas_file):
            label = plas_file.stem  # e.g. plasmid_1
            # Get replicon type from mob_results if available
            attrs: Attributes = {}
            if header in mob_results:
                row = mob_results[header]
                if row.get("rep_type(s)"):
                    attrs["rep_type"] = row["rep_type(s)"]
                if row.get("mob_type(s)"):
                    attrs["mob_type"] = row["mob_type(s)"]
            replicons.append(EntityNode(label=label, size_bp=size, attributes=attrs))

    if not replicons:
        raise ValueError(
            f"No MOB-suite output files found in {results_dir}. "
            "Expected chromosome.fasta and/or plasmid_*.fasta."
        )

    return CellSet(cells=[Cell(replicons=replicons)])
