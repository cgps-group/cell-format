# CellGen

CellGen is a compact format for recording the genomic organisation of a cell. Parentheses denote chromosomes. Curly braces denote every other biological entity, including plasmids, transposons, integrons and genes. Nesting records physical containment.

```text
({{}blaKPC-2[type="gene"]}Tn4401[type="transposon"])chromosome,
{{{}blaCTX-M-15[type="gene"]}intI1[type="integron"]}pKPC[type="plasmid"]
```

The repository provides Python and TypeScript parsers, validation, canonical serialisation, GenBank and GFF3 import, and circular and containment SVG views.

## Try it

The browser visualiser is available at [cell-format.vercel.app](https://cell-format.vercel.app/).

## Python

```bash
python -m pip install "./python[genbank]"
cellgen validate '()chromosome,{}pKPC[type="plasmid"]'
```

Continue with the [Python parser and command-line guide](python.md), the [TypeScript parser guide](typescript.md), or the [format specification](specification.md).
