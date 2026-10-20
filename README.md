# CellGen

CellGen is a compact text format for describing cellular genome organisation. It records chromosomes, other biological entities such as plasmids and genes, and what is contained within them.

**[Open the visualiser](https://cell-format.vercel.app/)** to build a record, paste your own notation or import an annotated GenBank or GFF3 file.

## Reading the format

| Notation | Meaning |
| --- | --- |
| `()chromosome` | A chromosome labelled `chromosome` |
| `{}pBAD[type="plasmid"]` | A plasmid labelled `pBAD` |
| `{…}label` or `(…)label` | Entities inside the brackets are contained within the labelled entity or chromosome |
| `,` | Separates entities at the same level within a cell |
| `;` | Separates cells |
| `[key="value"]` | Adds attributes, such as an entity's type or an accession |

Parentheses mean chromosome, and only chromosome. Curly braces can represent any other biological entity; use a `type` attribute to state its class. Labels follow the closing bracket. Empty brackets mean that no contained entities are recorded.

## A chromosome and a plasmid

```text
()chr1, {}pBAD[type="plasmid"]
```

The chromosome and plasmid are separate entities in one cell.

<img src="docs/images/chromosome-and-plasmid.png" width="260" alt="Circular view showing chromosome chr1 and a separate plasmid pBAD in one cell.">

## Nested containment

```text
{
  { {}blaKPC-3[type="gene"] }Tn4401[type="transposon"]
}pKpQIL[type="plasmid"]
```

The gene `blaKPC-3` is inside the transposon `Tn4401`, which is inside the plasmid `pKpQIL`. Nesting the brackets records those relationships directly.

<img src="docs/images/nested-containment.png" width="340" alt="Containment view showing blaKPC-3 inside Tn4401 inside plasmid pKpQIL.">

## Two cells

```text
()chr1, {}pA[type="plasmid"] ; ()chr2, {}pB[type="plasmid"]
```

A semicolon separates the cells. Each cell here contains a chromosome and a plasmid.

<img src="docs/images/two-cells.png" width="620" alt="Circular view of two cells: chr1 with plasmid pA, and chr2 with plasmid pB.">

These images are static exports from the visualiser's circular and containment views.

## Documentation

- [Web visualiser](docs/visualiser.md): build and edit records, import annotations, export diagrams and run the app locally.
- [Python](docs/python.md): installation, parser API and command-line tools.
- [TypeScript](docs/typescript.md): parser and renderer APIs, and integration with other applications.
- [Format specification](docs/specification.md): grammar, labels, attributes and syntax rules.
- [More examples](docs/examples.md) and [published biological structures](examples/real_world.md).
- [GenBank and GFF3 import](docs/import.md): annotation handling and import options.
- [Validation](docs/validation.md): diagnostics and conformance checks.
- [Authors](docs/credits.md).
