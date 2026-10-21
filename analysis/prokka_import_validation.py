"""Download reference records, optionally run Prokka, and audit CellGen imports.

Run from the repository root with PYTHONPATH=python. Requires Biopython; Docker
is needed only for --run-prokka. Large inputs and outputs stay in --workdir.
"""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.request import urlopen

from Bio import SeqIO
import Bio
from cellgen.genbank import from_genbank_file, from_gff_file
from cellgen.parser import parse
from cellgen.serialise import to_cellgen

IMAGE = "staphb/prokka@sha256:6bb2522e077ef08a8be7a3856fe80372ede3b832becba0728e1ddbe83d89a042"
REFERENCES = {"ecoli-k12": "U00096.3", "pbr322": "J01749.1",
              "pacyc184": "X06403.1", "phix174": "J02482.1",
              "pkpqil": "GU595196.1", "tn21": "AF071413.3"}


def prepare(workdir):
    inputs = workdir / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)
    sources = []
    for sample, accession in REFERENCES.items():
        for fmt in ("fasta", "embl"):
            path = inputs / f"{sample}.{fmt}"
            url = f"https://www.ebi.ac.uk/ena/browser/api/{fmt}/{accession}?download=false"
            if not path.exists():
                with urlopen(url, timeout=120) as response:
                    path.write_bytes(response.read())
            data = path.read_bytes()
            sources.append(dict(name=sample, accession=accession, format=fmt, url=url,
                                sha256=hashlib.sha256(data).hexdigest(), bytes=len(data)))
        record = SeqIO.read(inputs / f"{sample}.embl", "embl")
        SeqIO.write(record, inputs / f"{sample}.gbk", "genbank")
        # Preserve sequence; replace the ENA pipe-delimited header with accession.version.
        lines = (inputs / f"{sample}.fasta").read_text().splitlines()
        lines[0] = ">" + accession
        (inputs / f"{sample}.prokka.fna").write_text("\n".join(lines) + "\n")
    (workdir / "sources.json").write_text(json.dumps(sources, indent=2) + "\n")


def run_prokka(workdir):
    runs = [(sample, sample, []) for sample in REFERENCES]
    runs.append(("pbr322-metadata", "pbr322", ["--addgenes", "--plasmid", "pBR322"]))
    for name, sample, extra in runs:
        log = workdir / f"{name}.run.log"
        if log.exists() and "Annotation finished successfully" in log.read_text():
            continue
        command = ["docker", "run", "--rm", "--platform", "linux/amd64",
                   "-v", f"{workdir}:/work", IMAGE, "prokka", "--cpus", "4",
                   "--outdir", f"/work/prokka/{name}", "--prefix", name,
                   "--locustag", "TEST", *extra, f"/work/inputs/{sample}.prokka.fna"]
        with log.open("w") as output:
            subprocess.run(command, stdout=output, stderr=subprocess.STDOUT, check=True)


def node_tree(node):
    return dict(label=node.label, attributes=node.attributes,
                children=[node_tree(child) for child in node.children])


def count_nodes(node):
    return sum(1 + count_nodes(child) for child in node.children)


def audit(workdir):
    cases = []
    for sample in REFERENCES:
        cases.append((sample, "reference", workdir / "inputs" / f"{sample}.gbk"))
    for sample in [*REFERENCES, "pbr322-metadata"]:
        for ext in ("gbk", "gff"):
            path = workdir / "prokka" / sample / f"{sample}.{ext}"
            if not path.exists():
                raise FileNotFoundError(f"Run Prokka first: {path}")
            cases.append((sample, "prokka", path))
            if ext == "gff":
                without_fasta = path.with_suffix(".no-fasta.gff")
                without_fasta.write_text(path.read_text().split("##FASTA")[0])
                cases.append((sample, "prokka-no-fasta", without_fasta))
    rows = []
    for sample, source, path in cases:
        converter = from_genbank_file if path.suffix == ".gbk" else from_gff_file
        modes = [("default", {}), ("all-genes", {"retain_uncontained_genes": True})]
        if source.startswith("prokka"):
            modes.append(("selected-CDS", {"selected_feature_ids": {"TEST_00002"}}))
            if sample == "pbr322-metadata" and path.suffix == ".gff":
                modes.append(("selected-gene", {"selected_feature_ids": {"TEST_00002_gene"}}))
        for mode, options in modes:
            result = converter(path, **options)
            text = to_cellgen(result)
            parse(text)
            root = result.cells[0].replicons[0]
            if mode.startswith("selected"):
                assert len(root.children) == 1, (sample, source, mode)
            rows.append(dict(sample=sample, source=source, mode=mode,
                             file=str(path.relative_to(workdir)),
                             type=root.attributes["type"], length=root.attributes.get("length"),
                             retained=count_nodes(root), tree=node_tree(root)))
    (workdir / "parity-inputs.json").write_text(json.dumps(rows) + "\n")
    summary = dict(image=IMAGE, biopython=Bio.__version__,
                   cases=[{key: value for key, value in row.items() if key != "tree"} for row in rows])
    (workdir / "results.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(f"Python: {len(rows)} import/parse checks passed; results: {workdir / 'results.json'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workdir", type=Path, required=True)
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--run-prokka", action="store_true")
    args = parser.parse_args()
    directory = args.workdir.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    if args.prepare:
        prepare(directory)
    if args.run_prokka:
        run_prokka(directory)
    audit(directory)
