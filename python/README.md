# CellGen Python package

The reference Python implementation of the [CellGen format](https://github.com/cgps-group/cell-format). It provides:

- a recursive-descent parser and positioned validation errors
- canonical CellGen serialisation
- SVG rendering
- GenBank, GFF3 and MOB-suite conversion
- a command-line interface

## Installation

From the repository root:

```bash
python -m pip install "./python[genbank]"
```

From inside this directory:

```bash
python -m pip install ".[genbank]"
```

The `genbank` extra installs Biopython. Parsing, validation, serialisation, SVG rendering and GFF3 conversion have no runtime dependencies.

## Python API

```python
from cellgen import ParseError, is_valid, parse, render_svg, to_cellgen, validate

text = '({}Tn4401)chromosome,{}pKPC[type="plasmid"]'
record = parse(text)

print(record.cells[0].replicons[0].label)
print(to_cellgen(record))
print(is_valid(text))
print(validate(text))

svg = render_svg(record)
with open("cellgen.svg", "w", encoding="utf-8") as output:
    output.write(svg)

try:
    parse('({}Tn4401')
except ParseError as error:
    print(error.as_dict())
```

`parse()` returns a `CellSet` dataclass containing cells, replicons and nested entities. `validate()` returns a list of display-ready diagnostic strings. Catch `ParseError` and use `as_dict()` when structured error fields are required.

## Annotated records

```python
from cellgen import to_cellgen
from cellgen.genbank import from_genbank_file, from_gff_file, from_mobsuite

record = from_genbank_file("assembly.gbk")
record = from_gff_file("annotation.gff3")
record = from_mobsuite("mob_recon_output/")

print(to_cellgen(record))
```

## Command line

```bash
cellgen validate '()chromosome,{}pKPC[type="plasmid"]'
cellgen render '({}Tn4401)chromosome' --output diagram.svg
cellgen convert assembly.gbk
cellgen convert annotation.gff3
cellgen convert mob_recon_output --mobsuite
```

Run `cellgen --help` or `cellgen <command> --help` for all options.
