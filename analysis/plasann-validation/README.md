# PlasAnn GenBank import validation

The public pBR322 (J01749.1) and pKpQIL (GU595196.1) reference sequences were run
through the [PlasAnn web service](https://plasann.rochester.edu/analysis) on
21 October 2026. Input was FASTA, enhanced UniProt annotation was disabled and
the other service defaults were used. Both jobs completed and supplied GenBank,
CSV and plasmid-map outputs. The hosted service did not expose its software or
database version; the available PyPI version was 1.1.6, which is not proof of
the hosted version.

The downloaded GenBank files are archived, unmodified, in
[`tests/fixtures/plasann/`](../../tests/fixtures/plasann/).
Their sequences were checked against the original FASTA and were unchanged.
File and sequence checksums are in [results.json](results.json).

| Input | Length (bp) | CDS | MGE features | Default import before repair | Default import after repair |
| --- | ---: | ---: | ---: | ---: | ---: |
| pBR322 | 4,361 | 6 | 2 | 0 | 5 |
| pKpQIL | 113,637 | 141 | 6 | 0 | 24 |

Default counts include retained MGE features and their contained genes. All-gene
retention gives 8 and 147 features respectively. Before repair, both replicons
were also unclassified; after repair both are classified as plasmids. See
[before-after.json](before-after.json).

## Compatibility changes

PlasAnn uses the custom GenBank feature type `MGE`. CellGen now maps this to
the generic `mobile_element` entity type, retaining its label and coordinates.
It does not infer a more specific element class from a name. PlasAnn's source
`/mol_type="plasmid DNA"` is also recognised as explicit plasmid metadata.
Without that metadata, the presence of an MGE does not classify its parent
record as a plasmid.

PlasAnn's `ORIT`, `ORIV`, `Replicon` and `NC_RNA` features are outside the current
importer feature set and remain omitted. Thus this is conversion of the supported
structural/gene annotations, rather than a lossless conversion of every feature.
The generated record identifier is retained; PlasAnn's custom output name replaced
the original accession, so the source accession is recorded separately in the audit.

Eight configurations passed: default retention, all-gene retention, exact selection
of an uncontained gene and a control without plasmid metadata, for each record.
Python and TypeScript produced equivalent complete trees, including labels,
coordinates, attributes and nesting. The previous 77 Prokka/reference comparisons
also passed with the updated browser importer.

## Annotation discrepancy

The pKpQIL output contains `Tn4401a` at 8882–18788 and a gene labelled `blaKPC-2`
at 15984–16865. The deposited GU595196.1 record identifies the CDS at those same
coordinates as **KPC-3** (protein ADE43963.1). The input and output nucleotide
sequences are identical. CellGen preserves PlasAnn's label; it does not silently
replace it with the reference label. This experiment therefore demonstrates
interoperability, rather than validating PlasAnn's allele names or MGE predictions.
The manuscript's curated reference examples were not changed.

## Reproduce the import checks

Install the Python package with its `test` extra and install webapp dependencies.
From the repository root:

```sh
PYTHONPATH=python python analysis/plasann_import_validation.py \
  --output-dir /tmp/cellgen-plasann
./webapp/node_modules/.bin/tsc \
  webapp/src/cellgen/genbank.ts webapp/src/cellgen/parser.ts \
  --strict --target es2022 --module es2022 --skipLibCheck \
  --outDir /tmp/cellgen-plasann/browser
printf '{"type":"module"}\n' > /tmp/cellgen-plasann/browser/package.json
node analysis/check-import-parity.mjs /tmp/cellgen-plasann /tmp/cellgen-plasann/browser
```

To repeat the annotation experiment, obtain the accession-version FASTA records
from ENA and submit them through the PlasAnn analysis page with the options above.
The archived outputs are the fixed inputs for the importer regression tests;
future hosted annotations may differ as the service changes.
