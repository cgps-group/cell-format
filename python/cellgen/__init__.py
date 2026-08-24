"""
cellgen — Python library for CellGen cellular genome organisation strings.

Quick start::

    from cellgen import parse, validate, is_valid, render_svg, to_cellgen

    cell_set = parse("()chr1, {}pBAD")
    print(to_cellgen(cell_set))   # round-trip

    svg = render_svg(cell_set)
    with open("diagram.svg", "w") as f:
        f.write(svg)

    errors = validate("()unclosed")
    print(errors)   # positioned diagnostic with a source excerpt and caret

GenBank / GFF3 import::

    from cellgen.genbank import from_genbank_file, from_gff_file, from_mobsuite

    cell_set = from_genbank_file("assembly.gbk")
    cell_set = from_gff_file("annotation.gff3")
    cell_set = from_mobsuite("mob_recon_output/")
"""

from .parser import ParseError, is_valid, parse, validate
from .renderer import render_svg
from .serialise import to_cellgen

__version__ = "0.1.0"
__all__ = [
    "parse",
    "validate",
    "is_valid",
    "render_svg",
    "to_cellgen",
    "ParseError",
    "__version__",
]
