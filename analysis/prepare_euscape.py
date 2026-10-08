#!/usr/bin/env python3
"""Screen the EuSCAPE archive and extract resolved blaKPC-bearing contigs."""

from __future__ import annotations

import argparse
import csv
import hashlib
import re
import tarfile
import urllib.parse
from dataclasses import dataclass
from pathlib import Path


KPC_RE = re.compile(r"\bKPC(?:[- ]?\d+)?\b", re.IGNORECASE)


@dataclass(frozen=True)
class Candidate:
    sample: str
    member: str
    contig_count: int
    largest_contig_bp: int
    kpc_contig: str
    kpc_contig_bp: int
    kpc_start: int
    kpc_end: int
    kpc_label: str


def _attributes(value: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for item in value.split(";"):
        if "=" not in item:
            continue
        key, raw = item.split("=", 1)
        result[key] = urllib.parse.unquote(raw)
    return result


def _screen_member(archive: tarfile.TarFile, member: tarfile.TarInfo) -> Candidate | None:
    contigs: dict[str, int] = {}
    hits: list[tuple[str, int, int, str]] = []
    handle = archive.extractfile(member)
    if handle is None:
        return None

    for raw in handle:
        line = raw.decode("utf-8", "replace").rstrip("\n")
        if line == "##FASTA":
            break
        if line.startswith("##sequence-region"):
            fields = line.split()
            contigs[fields[1]] = int(fields[3])
            continue
        if line.startswith("#"):
            continue
        fields = line.split("\t")
        if len(fields) < 9:
            continue
        attrs = _attributes(fields[8])
        description = " ".join(
            value for key in ("gene", "product") if (value := attrs.get(key))
        )
        match = KPC_RE.search(description)
        if match:
            hits.append((fields[0], int(fields[3]), int(fields[4]), match.group(0)))

    if len(hits) != 1:
        return None
    kpc_contig, start, end, label = hits[0]
    if kpc_contig not in contigs:
        return None
    sample = member.name.rsplit("/", 1)[-1].removesuffix("_unicycler.gff")
    return Candidate(
        sample=sample,
        member=member.name,
        contig_count=len(contigs),
        largest_contig_bp=max(contigs.values()),
        kpc_contig=kpc_contig,
        kpc_contig_bp=contigs[kpc_contig],
        kpc_start=start,
        kpc_end=end,
        kpc_label=label,
    )


def screen_archive(path: Path) -> list[Candidate]:
    candidates: list[Candidate] = []
    with tarfile.open(path, "r:gz") as archive:
        for member in archive.getmembers():
            if not member.name.endswith("_unicycler.gff"):
                continue
            candidate = _screen_member(archive, member)
            if candidate is not None:
                candidates.append(candidate)
    return sorted(candidates, key=lambda item: item.sample)


def select_candidates(candidates: list[Candidate], limit: int) -> list[Candidate]:
    resolved = [
        item
        for item in candidates
        if item.largest_contig_bp >= 5_000_000 and item.kpc_contig_bp < 500_000
    ]
    return sorted(resolved, key=lambda item: (item.contig_count, item.sample))[:limit]


def _extract_contig(archive: tarfile.TarFile, candidate: Candidate) -> str:
    member = archive.getmember(candidate.member)
    handle = archive.extractfile(member)
    if handle is None:
        raise ValueError(f"Could not read {candidate.member}")

    in_fasta = False
    wanted = False
    sequence: list[str] = []
    for raw in handle:
        line = raw.decode("utf-8", "replace").strip()
        if line == "##FASTA":
            in_fasta = True
            continue
        if not in_fasta:
            continue
        if line.startswith(">"):
            identifier = line[1:].split()[0]
            if wanted:
                break
            wanted = identifier == candidate.kpc_contig
            continue
        if wanted:
            sequence.append(line)

    result = "".join(sequence)
    if len(result) != candidate.kpc_contig_bp:
        raise ValueError(
            f"Expected {candidate.kpc_contig_bp} bp for {candidate.sample}, found {len(result)}"
        )
    return result


def _write_table(path: Path, candidates: list[Candidate], selected: set[str]) -> None:
    columns = [
        "sample",
        "selected",
        "contig_count",
        "largest_contig_bp",
        "kpc_contig",
        "kpc_contig_bp",
        "kpc_start",
        "kpc_end",
        "kpc_label",
    ]
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, delimiter="\t")
        writer.writeheader()
        for item in candidates:
            row = {key: getattr(item, key) for key in columns if key != "selected"}
            row["selected"] = "yes" if item.sample in selected else "no"
            writer.writerow(row)


def prepare(archive_path: Path, output: Path, limit: int) -> list[Candidate]:
    output.mkdir(parents=True, exist_ok=True)
    fasta_dir = output / "fasta"
    fasta_dir.mkdir(exist_ok=True)
    candidates = screen_archive(archive_path)
    selected = select_candidates(candidates, limit)
    selected_names = {item.sample for item in selected}
    _write_table(output / "screening.tsv", candidates, selected_names)

    with tarfile.open(archive_path, "r:gz") as archive:
        for item in selected:
            sequence = _extract_contig(archive, item)
            (fasta_dir / f"{item.sample}.fasta").write_text(
                f">{item.kpc_contig}\n{sequence}\n"
            )

    checksum = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    (output / "archive.sha256").write_text(f"{checksum}  {archive_path.name}\n")
    return selected


def main() -> None:
    repo = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("--output", type=Path, default=repo / "analysis" / "data" / "euscape")
    parser.add_argument("--limit", type=int, default=10)
    args = parser.parse_args()
    selected = prepare(args.archive, args.output, args.limit)
    for item in selected:
        print(
            f"{item.sample}\t{item.contig_count} contigs\t"
            f"KPC contig {item.kpc_contig_bp:,} bp"
        )


if __name__ == "__main__":
    main()
