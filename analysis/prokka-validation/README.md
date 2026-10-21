# Reference-record and Prokka import validation

Six public reference sequences were downloaded from ENA on 21 October 2026,
reannotated with Prokka 1.14.6 and imported through both CellGen implementations.
All **77 configurations passed**: each generated valid CellGen, and Python and
TypeScript agreed on every retained label, attribute, coordinate and nesting
relationship. These checks assess conversion, rather than annotation accuracy.

## Inputs and results

Counts below are retained gene/CDS entities with **all-gene retention enabled**
in the fresh Prokka outputs. GenBank and GFF3 gave the same counts.

| Reference | Accession.version | Length (bp) | Prokka gene/CDS entities |
| --- | --- | ---: | ---: |
| E. coli K-12 MG1655 chromosome | [U00096.3](https://www.ebi.ac.uk/ena/browser/view/U00096.3) | 4,641,652 | 4,305 |
| pBR322 cloning plasmid | [J01749.1](https://www.ebi.ac.uk/ena/browser/view/J01749.1) | 4,361 | 5 |
| pACYC184 cloning plasmid | [X06403.1](https://www.ebi.ac.uk/ena/browser/view/X06403.1) | 4,245 | 5 |
| Coliphage phiX174 | [J02482.1](https://www.ebi.ac.uk/ena/browser/view/J02482.1) | 5,386 | 6 |
| pKpQIL plasmid | [GU595196.1](https://www.ebi.ac.uk/ena/browser/view/GU595196.1) | 113,637 | 128 |
| Tn21 | [AF071413.3](https://www.ebi.ac.uk/ena/browser/view/AF071413.3) | 19,672 | 21 |

The deposited annotations were also tested. ENA supplied EMBL records, which
were converted to GenBank with Biopython 1.88; CellGen does not directly import
EMBL. Before running Prokka, FASTA headers were reduced to accession.version;
nucleotide sequences were unchanged.

The matrix contains 12 deposited-annotation checks (six records × default and
all-gene retention), 63 Prokka checks (seven runs × GenBank, GFF3 and GFF3 without
FASTA × default, all-gene and exact-CDS-ID selection), and two exact-gene-ID checks
on the additional `--addgenes` run. The seventh run used pBR322 with
`--addgenes --plasmid pBR322` to test paired features and explicit plasmid metadata.

## Findings

- Prokka outputs were accepted. Default imports retained no genes in these
  outputs because they lacked supported structural parent features. All-gene
  retention and exact-ID selection recovered the intended annotated genes.
- The deposited pKpQIL record classified as a plasmid; default Prokka outputs
  lacked that metadata and remained `type="unknown"`. Supplying `--plasmid pBR322`
  made the extra GenBank output classify as a plasmid. Its GFF lacked that metadata.
- The deposited K-12 record says “complete genome” without a chromosome qualifier.
  It therefore remained unknown despite its known biological identity. The importer
  does not identify replicons from accession lookups or sequence analysis.
- Tn21 exposed a false classification: miscellaneous features mentioning an
  integron, including crossover sites and conserved segments, became whole
  integrons. Recognition now requires an explicit integron name. The actual In2
  mobile-element annotation remains an integron.
- Annotation content differed between deposited and reannotated files. The
  deposited phiX174 record has 11 CDS features; this default bacterial Prokka run
  produced six. The legacy pACYC184 record contains no supported gene/CDS features.
  These differences are not failed file imports.

## Repairs and provenance

Regression tests cover GFF sequence length being counted twice with embedded
FASTA; duplicate GenBank gene/CDS pairs; lost exact-selection IDs after collapsing
GFF gene/CDS pairs; wrapped GenBank definitions, locations and qualifiers; and
overbroad integron-note classification. Distinct overlapping genes remain distinct.

Actual Prokka pBR322 outputs and the deposited Tn21 annotation are committed in
`tests/fixtures/prokka/`. Input URLs and checksums are in [sources.json](sources.json),
per-configuration results in [results.json](results.json), and generated-file
checksums in [artifacts.json](artifacts.json). Larger raw files and logs are retained
in the manuscript review archive.

## Reproduce

Install the Python package with its `test` extra and run `npm ci` in `webapp`.
Docker must support Linux/amd64. From the repository root:

```sh
PYTHONPATH=python python analysis/prokka_import_validation.py \
  --workdir /tmp/cellgen-prokka --prepare --run-prokka
./webapp/node_modules/.bin/tsc \
  webapp/src/cellgen/genbank.ts webapp/src/cellgen/parser.ts \
  --strict --target es2022 --module es2022 --skipLibCheck \
  --outDir /tmp/cellgen-prokka/browser
printf '{"type":"module"}\n' > /tmp/cellgen-prokka/browser/package.json
node analysis/check-import-parity.mjs /tmp/cellgen-prokka /tmp/cellgen-prokka/browser
```

Prokka used default bacterial annotation settings, up to four CPUs and `TEST` as
the locus-tag prefix. Deposited annotations were not supplied as annotation hints.
Pinned image: `staphb/prokka@sha256:6bb2522e077ef08a8be7a3856fe80372ede3b832becba0728e1ddbe83d89a042`.
See the [Prokka documentation](https://github.com/tseemann/prokka) and
[Seemann (2014)](https://doi.org/10.1093/bioinformatics/btu153).
