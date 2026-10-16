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

**[cell-format.vercel.app](https://cell-format.vercel.app/)**: paste a CellGen string and get an SVG diagram, or upload a GenBank or GFF3 file to generate a CellGen representation automatically.

## Use CellGen in Python

CellGen includes a Python parser, validator, canonical serialiser, SVG renderer and annotated-record importer. From a cloned checkout, install it with:

```bash
python -m pip install "./python[genbank]"
```

It can also be installed directly from the main repository:

```bash
python -m pip install "cellgen[genbank] @ git+https://github.com/cgps-group/cell-format.git#subdirectory=python"
```

Parse and inspect a record:

```python
from cellgen import parse, to_cellgen

record = parse('({}Tn4401)chromosome,{}pKPC[type="plasmid"]')
chromosome = record.cells[0].replicons[0]

print(chromosome.label)                # chromosome
print(chromosome.children[0].label)    # Tn4401
print(to_cellgen(record))              # canonical CellGen text
```

Invalid input raises a positioned `ParseError`:

```python
from cellgen import ParseError, parse

try:
    parse('({}Tn4401')
except ParseError as error:
    print(error.code, error.line, error.column)
    print(error.as_dict())
```

The command-line interface exposes the same implementation:

```bash
cellgen validate '()chromosome,{}pKPC[type="plasmid"]'
cellgen render '({}Tn4401)chromosome' --output diagram.svg
cellgen convert assembly.gbk
cellgen convert annotation.gff3
```

See the [Python guide](docs/python.md) for the complete public API and GenBank, GFF3 and MOB-suite examples.

## Use the TypeScript parser

The browser application uses the reference TypeScript implementation in [`webapp/src/cellgen`](webapp/src/cellgen). Its public source entry point is [`webapp/src/cellgen/index.ts`](webapp/src/cellgen/index.ts):

```typescript
import { parseCellGen, toCellGen } from './cellgen'

const result = parseCellGen('()chromosome,{}pKPC[type="plasmid"]')
if (result.ok) {
  console.log(toCellGen(result.value))
} else {
  console.error(result.error.code, result.error.line, result.error.column)
}
```

The TypeScript implementation is currently distributed as repository source rather than as an npm package. See the [TypeScript guide](docs/typescript.md) and the [format specification](docs/specification.md) when integrating it or implementing CellGen in another language.

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
- `;` separates cells in a multi-cell set
- `,` separates replicons within a cell
- `[key="value"]` adds optional attributes to any element

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

- **Live parser:** type or paste a CellGen string; errors are shown inline with position
- **SVG renderer:** circular diagrams use blue for chromosomes, green for top-level non-chromosomal entities, and coloured arcs for contained entities
- **GenBank / GFF3 import:** upload an annotated assembly file to generate the CellGen string
- **Download:** export the diagram as SVG or the format string as plain text
- **No server required:** everything runs in the browser

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
