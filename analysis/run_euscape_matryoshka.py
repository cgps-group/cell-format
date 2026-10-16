#!/usr/bin/env python3
"""Run the Matryoshka detector workflow on selected EuSCAPE contigs."""

from __future__ import annotations

import argparse
import csv
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


def selected_samples(screening: Path) -> list[str]:
    with screening.open(newline="") as handle:
        rows = csv.DictReader(handle, delimiter="\t")
        return [row["sample"] for row in rows if row["selected"] == "yes"]


def run(command: list[str], cwd: Path, log: Path) -> None:
    result = subprocess.run(command, cwd=cwd, text=True, capture_output=True)
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text(result.stdout + result.stderr)
    if result.returncode:
        raise RuntimeError(f"Command failed ({result.returncode}); see {log}")


def process_sample(sample: str, data: Path, matryoshka: Path, threads: int) -> str:
    fasta = data / "fasta" / f"{sample}.fasta"
    detector = data / "detectors" / sample
    output = data / "matryoshka" / f"{sample}.json"
    detector.mkdir(parents=True, exist_ok=True)
    output.parent.mkdir(parents=True, exist_ok=True)

    amrfinder = detector / "amrfinder" / "annotations.tsv"
    amrfinder.parent.mkdir(exist_ok=True)
    if not amrfinder.exists():
        run(
            [
                "pixi", "run", "-e", "amrfinder", "amrfinder",
                "--nucleotide", str(fasta), "--output", str(amrfinder),
                "--threads", str(threads),
            ],
            matryoshka,
            detector / "amrfinder.log",
        )

    isescan_dir = detector / "isescan"
    isescan = isescan_dir / "fasta" / f"{sample}.fasta.tsv"
    if not isescan.exists():
        run(
            [
                "pixi", "run", "-e", "isescan", "isescan.py",
                "--seqfile", str(fasta), "--output", str(isescan_dir),
                "--nthread", str(threads),
            ],
            matryoshka,
            detector / "isescan.log",
        )

    integron_dir = detector / "integron"
    integrons = (
        integron_dir / f"Results_Integron_Finder_{sample}" / f"{sample}.integrons"
    )
    if not integrons.exists():
        run(
            [
                "pixi", "run", "-e", "integron", "integron_finder",
                str(fasta), "--outdir", str(integron_dir),
                "--cpu", str(threads), "--local-max", "--quiet",
            ],
            matryoshka,
            detector / "integron.log",
        )

    if not output.exists():
        run(
            [
                "pixi", "run", "-e", "default", "python", "-m", "matryoshka",
                "annotate", str(fasta), "--isescan", str(isescan),
                "--amrfinder", str(amrfinder), "--integrons", str(integrons),
                "--format", "json", "--out", str(output),
            ],
            matryoshka,
            detector / "matryoshka.log",
        )
    return sample


def main() -> None:
    repo = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser()
    parser.add_argument("matryoshka", type=Path)
    parser.add_argument("--data", type=Path, default=repo / "analysis" / "data" / "euscape")
    parser.add_argument("--jobs", type=int, default=3)
    parser.add_argument("--threads", type=int, default=2)
    args = parser.parse_args()

    samples = selected_samples(args.data / "screening.tsv")
    with ThreadPoolExecutor(max_workers=args.jobs) as executor:
        futures = {
            executor.submit(process_sample, sample, args.data, args.matryoshka, args.threads): sample
            for sample in samples
        }
        for future in as_completed(futures):
            sample = futures[future]
            future.result()
            print(f"completed {sample}", flush=True)


if __name__ == "__main__":
    main()
