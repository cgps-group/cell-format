# Python parser and command line

The `cellgen` package is the reference Python implementation. It includes the parser, validator, canonical serialiser, SVG renderer and annotated-record converters.

## Install

From a cloned repository:

```bash
python -m pip install "./python[genbank]"
```

Or install the Python subdirectory directly from the main repository:

```bash
python -m pip install "cellgen[genbank] @ git+https://github.com/cgps-group/cell-format.git#subdirectory=python"
```

The `genbank` extra installs Biopython. It is only required for GenBank input.

## Parse and serialise

```python
from cellgen import parse, to_cellgen

record = parse('({}Tn4401)chromosome,{}pKPC[type="plasmid"]')

for cell in record.cells:
    for replicon in cell.replicons:
        print(replicon.label, replicon.attributes)

print(to_cellgen(record))
```

`parse()` returns the dataclass hierarchy below:

```text
CellSet
  cells: list[Cell]
    replicons: list[ChromosomeNode | EntityNode]
      label: str
      attributes: dict[str, str]
      children: list[EntityNode]
      size_bp: int | None
```

## Validate input

Use `validate()` for display-ready messages and `is_valid()` for a boolean check:

```python
from cellgen import is_valid, validate

errors = validate('({}Tn4401')
print(errors[0])
print(is_valid('()chromosome'))
```

Use `parse()` and catch `ParseError` when software needs structured diagnostics:

```python
from cellgen import ParseError, parse

try:
    parse('({}Tn4401')
except ParseError as error:
    diagnostic = error.as_dict()
    print(diagnostic["code"])
    print(diagnostic["line"], diagnostic["column"])
    print(diagnostic["context"])
```

The structured fields are `code`, `message`, `position`, `line`, `column`, `found`, `expected` and `context`.

## Render SVG

```python
from cellgen import parse, render_svg

svg = render_svg(parse('({}Tn4401)chromosome'))
with open("diagram.svg", "w", encoding="utf-8") as output:
    output.write(svg)
```

## Convert annotated records

```python
from cellgen import to_cellgen
from cellgen.genbank import from_genbank_file, from_gff_file, from_mobsuite

genbank_record = from_genbank_file("assembly.gbk")
gff_record = from_gff_file("annotation.gff3")
mob_suite_record = from_mobsuite("mob_recon_output/")

print(to_cellgen(genbank_record))
```

Conversion interprets annotations already present in a file. It does not predict unannotated mobile elements.

## Command line

```bash
cellgen validate '()chromosome,{}pKPC[type="plasmid"]'
cellgen render '({}Tn4401)chromosome' --output diagram.svg
cellgen convert assembly.gbk
cellgen convert annotation.gff3
cellgen convert mob_recon_output --mobsuite
```

A failed validation exits with status 1. Successful validation exits with status 0.

## Public API

The package root exports:

| Name | Purpose |
| --- | --- |
| `parse(text)` | Parse text into a `CellSet`; raise `ParseError` on invalid input |
| `validate(text)` | Return display-ready validation messages |
| `is_valid(text)` | Return whether text is valid |
| `to_cellgen(cell_set)` | Produce canonical CellGen text |
| `render_svg(cell_set)` | Produce a circular SVG representation |
| `ParseError` | Positioned exception with `as_dict()` structured fields |

Annotated-record converters are exported from `cellgen.genbank`.
