"""Command-line interface for the cellgen package."""
from __future__ import annotations
import argparse
import sys
from . import parse, validate, render_svg, to_cellgen


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="cellgen",
        description="Parse, validate, and render CellGen format strings.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # validate
    p_val = sub.add_parser("validate", help="Check if a CellGen string is valid")
    p_val.add_argument("string", help="CellGen format string")

    # render
    p_svg = sub.add_parser("render", help="Render a CellGen string to SVG")
    p_svg.add_argument("string", help="CellGen format string")
    p_svg.add_argument("-o", "--output", default="-", help="Output file (default: stdout)")

    # convert from GenBank / GFF
    p_conv = sub.add_parser("convert", help="Convert GenBank or GFF3 → CellGen string")
    p_conv.add_argument("file", help="GenBank (.gb/.gbk) or GFF3 (.gff/.gff3) file")
    p_conv.add_argument("--svg", help="Also render SVG to this file")
    p_conv.add_argument("--mobsuite", action="store_true",
                        help="Input is a MOB-suite output directory")

    args = parser.parse_args()

    if args.command == "validate":
        errors = validate(args.string)
        if errors:
            for e in errors:
                print(f"ERROR: {e}", file=sys.stderr)
            sys.exit(1)
        print("Valid.")

    elif args.command == "render":
        errors = validate(args.string)
        if errors:
            for e in errors:
                print(f"ERROR: {e}", file=sys.stderr)
            sys.exit(1)
        cell_set = parse(args.string)
        svg = render_svg(cell_set)
        if args.output == "-":
            print(svg)
        else:
            with open(args.output, "w") as f:
                f.write(svg)
            print(f"Written to {args.output}")

    elif args.command == "convert":
        from pathlib import Path
        path = Path(args.file)
        if args.mobsuite:
            from .genbank import from_mobsuite
            cell_set = from_mobsuite(path)
        else:
            from .genbank import from_genbank_file, from_gff_file
            ext = path.suffix.lower()
            if ext in (".gb", ".gbk", ".genbank"):
                cell_set = from_genbank_file(path)
            elif ext in (".gff", ".gff3"):
                cell_set = from_gff_file(path)
            else:
                print(f"Unknown file extension '{ext}'. Use .gb, .gbk, .gff, or .gff3.", file=sys.stderr)
                sys.exit(1)
        wstr = to_cellgen(cell_set)
        print(wstr)
        if args.svg:
            svg = render_svg(cell_set)
            with open(args.svg, "w") as f:
                f.write(svg)
            print(f"SVG written to {args.svg}")


if __name__ == "__main__":
    main()
