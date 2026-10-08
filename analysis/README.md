# Figure 3 analysis

Figure 3 compares the replicon architecture of three complete *Klebsiella pneumoniae* RefSeq genomes:

| Strain | Assembly | Chromosomes | Plasmids |
| --- | --- | ---: | ---: |
| NTUH-K2044 | GCF_000009885.1 | 1 | 1 |
| MGH 78578 | GCF_000016305.1 | 1 | 5 |
| HS11286 | GCF_000240185.1 | 1 | 6 |

Download the source GenBank files and regenerate all outputs:

```bash
./analysis/fetch_figure3_data.sh
python -m pip install -e './python[analysis]'
python analysis/figure3.py
```

The script writes the CellGen records, metrics and provenance to `analysis/results/`, then exports SVG, PDF and PNG versions of Figure 3 to `figures/`.

The comparison uses chromosome and plasmid membership recorded in complete multi-record GenBank assemblies. It does not infer horizontal transfer or discover unannotated mobile elements.

## Ten EuSCAPE KPC carriers

The later ten-genome KPC-carrier analysis is separate from the three RefSeq genomes above. Its saved source sequences, detector outputs, reconstructed records and exact comparison facts are in [`euscape_results/REVIEW.md`](euscape_results/REVIEW.md). The analysis and figure generation scripts are `prepare_euscape.py`, `run_euscape_matryoshka.py`, `euscape_figure3.py`, `euscape_audit.py` and `euscape_make_figure3.py`. The saved records can be reproduced without rerunning external detectors:

```bash
PYTHONPATH=python python analysis/euscape_figure3.py --data analysis/euscape_evidence --results analysis/euscape_results
PYTHONPATH=python python analysis/euscape_audit.py
PYTHONPATH=python python analysis/euscape_make_figure3.py
```

The resulting [`Figure_3_euscape_hierarchy_comparison.svg`](../figures/Figure_3_euscape_hierarchy_comparison.svg) compares only annotated KPC-carrier subtrees. Expert review of element boundaries and names is still required before a biological claim.
