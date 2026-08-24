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
