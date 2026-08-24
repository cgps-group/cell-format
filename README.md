# CellGen

A compact, human-readable notation for describing cellular genome organisation, inspired by the Newick format for phylogenetic trees.

## Overview

Long-read sequencing now routinely produces complete genome assemblies, revealing chromosomes and the biological entities contained within or alongside them. These entities may be plasmids, mobile genetic elements, genes, gene clusters or other structures. CellGen records their containment relationships in a single line of text.

**Key features**

- Describes chromosomes and any other labelled biological entity
- Captures nested containment (e.g. an integron inside a plasmid)
- Represents multiple cells in one string (e.g. two strains sharing a plasmid)
- Supports free-text labels and key-value attributes
- Machine-parseable and human-readable

## Web app

**[cell-format.vercel.app](https://cell-format.vercel.app/)** — paste a CellGen string and get an SVG diagram. Or upload a GenBank/GFF3 file to generate a CellGen representation automatically.

## Format definition

### Grammar

```
CellSet      → Cell (';' Cell)*
Cell         → CellularElement (',' CellularElement)*
CellularElement → Chromosome | Entity
Chromosome   → '(' Entity* ')' Label AttributeSet?
Entity       → '{' Entity* '}' Label AttributeSet?
Label        → string | empty
AttributeSet → '[' KeyValue (',' KeyValue)* ']'
KeyValue     → Key '=' '"' Value '"'
```

- `( ... )` means chromosome, and only chromosome.
- `{ ... }` means any other biological entity. Its class is supplied by its label or a `type` attribute, for example `plasmid`, `transposon`, `gene`, `gene_cluster` or `starship`.
- `;` — separates cells in a multi-cell set
- `,` — separates replicons within a cell
- `[key="value"]` — optional attributes on any element

### Examples

**Single chromosome with an integron**
```
({}integron)my_chr
```

**Chromosome and a plasmid**
```
()chr1, {}pBAD
```

**Chromosome and plasmid where the plasmid is also integrated in the chromosome**
```
({}plasmid1)chromosome, {}plasmid1
```

**Chromosome with a transposon; plasmid carrying a transposon and an integron**
```
( {}transposon1 )chromosome , { {}transposon2, {}integron }plasmid
```

**Two cells sharing the same plasmid**
```
()chromosome1, {}plasmidA ; ()chromosome2, {}plasmidA
```

**Chromosome with attributes**
```
()chromosome[organism="Escherichia coli", strain="K-12"]
```

**Plasmid with nested integrons, each carrying identical gene cassettes**
```
()chromosome, { {}integronA }plasmid1, { {}integronA }plasmid2
```

**Fungal chromosome containing a Starship (schematic)**
```
({ {}DUF3435_captain[type="gene", role="captain"], {}cargo_gene_cluster[type="gene_cluster", role="cargo"] }Starship[type="starship", representation="schematic"])chromosome[organism="Macrophomina phaseolina"]
```

This example represents the characteristic architecture described for fungal Starships: a chromosome-integrated element containing a DUF3435 tyrosine recombinase (the captain) and downstream cargo. It is a structural illustration, not a transcription of one annotated sequence. See [Gluck-Thaler et al. (2022)](https://doi.org/10.1093/molbev/msac109).

## Web app (`webapp/`)

A fully client-side React and TypeScript application.

### Features

- **Live parser** — type or paste a CellGen string; errors shown inline with position
- **SVG renderer** — circular diagrams: blue for chromosomes, green for top-level non-chromosomal entities, and coloured arcs for contained entities
- **GenBank / GFF3 import** — upload an annotated assembly file to auto-generate the CellGen string
- **Download** — export the diagram as SVG or the format string as plain text
- **No server required** — everything runs in the browser

### Run locally

```bash
cd webapp
npm install
npm run dev
```

### Build

```bash
cd webapp
npm run build   # output in webapp/dist/
```

## Authors

Centre for Genomic Pathogen Surveillance, University of Oxford

- Julio Diaz Caballero
- Nabil-Fareed Alikhan
- Khalil AbuDahab
- David Aanensen
