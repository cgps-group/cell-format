"""Validate archived, unmodified PlasAnn web outputs through CellGen.

Run with PYTHONPATH=python, then use check-import-parity.mjs for TypeScript.
"""

import argparse
import hashlib
import json
from pathlib import Path

from Bio import SeqIO
from cellgen.genbank import from_genbank_file
from cellgen.parser import parse
from cellgen.serialise import to_cellgen
from prokka_import_validation import node_tree, count_nodes


def audit(output):
    fixtures = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "plasann"
    rows = []
    sources = []
    for sample, accession, selected, mobile_count, gene_count in [
        ("pbr322", "J01749.1", "roM", 2, 6),
        ("pkpqil", "GU595196.1", "yihA", 6, 141),
    ]:
        path = fixtures / f"{sample}.gbk"
        data = path.read_bytes()
        record = SeqIO.read(path, "genbank")
        sources.append(dict(sample=sample, reference_accession=accession,
                            file=path.name, sha256=hashlib.sha256(data).hexdigest(),
                            sequence_sha256=hashlib.sha256(str(record.seq).upper().encode()).hexdigest(),
                            length=len(record.seq), cds=gene_count, mge=mobile_count))
        (output / path.name).write_bytes(data)
        control = output / f"{sample}-no-metadata.gbk"
        control.write_text(data.decode().replace('/mol_type="plasmid DNA"', '/mol_type="genomic DNA"'))
        modes = [("default", {}, path.name),
                 ("all-genes", {"retain_uncontained_genes": True}, path.name),
                 ("selected-gene", {"selected_feature_ids": {selected}}, path.name),
                 ("no-metadata", {}, control.name)]
        for mode, options, filename in modes:
            result = from_genbank_file(output / filename, **options)
            text = to_cellgen(result)
            assert to_cellgen(parse(text)) == text
            root = result.cells[0].replicons[0]
            assert root.attributes["type"] == ("unknown" if mode == "no-metadata" else "plasmid")
            assert sum(child.attributes["type"] == "mobile_element" for child in root.children) == mobile_count
            if mode == "all-genes":
                assert count_nodes(root) == mobile_count + gene_count
            if mode == "selected-gene":
                assert any(child.label == selected for child in root.children)
            (output / f"{sample}-{mode}.cellgen").write_text(text + "\n")
            rows.append(dict(sample=sample, source="plasann-web", mode=mode, file=filename,
                             selected_ids=[selected] if mode == "selected-gene" else [],
                             retained=count_nodes(root), type=root.attributes["type"],
                             length=root.attributes["length"], tree=node_tree(root)))
    (output / "parity-inputs.json").write_text(json.dumps(rows) + "\n")
    summary = dict(service="https://plasann.rochester.edu/analysis", date="2026-10-21",
                   service_version="not exposed by hosted output", enhanced_uniprot=False,
                   sources=sources,
                   cases=[{key: value for key, value in row.items() if key != "tree"} for row in rows])
    (output / "results.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(f"Python: {len(rows)} PlasAnn import/parse checks passed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    audit(args.output_dir)
