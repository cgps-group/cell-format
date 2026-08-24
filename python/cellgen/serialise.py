"""
Serialise a CellSet back to a CellGen format string.
"""

from __future__ import annotations
from .types import Cell, CellSet, CellularElement, ChromosomeNode, EntityNode


_BARE_LABEL_CHARS = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.:-")


def to_cellgen(cell_set: CellSet) -> str:
    """Convert a CellSet back to a CellGen format string."""
    return " ; ".join(_cell_str(c) for c in cell_set.cells)


def _cell_str(cell: Cell) -> str:
    return ", ".join(_replicon_str(r) for r in cell.replicons)


def _replicon_str(r: CellularElement) -> str:
    if isinstance(r, ChromosomeNode):
        inner = ", ".join(_entity_str(m) for m in r.children)
        attrs = _attrs_str(r.attributes)
        return f"({inner}){_label_str(r.label)}{attrs}"
    else:
        return _entity_str(r)


def _entity_str(m: EntityNode) -> str:
    inner = ", ".join(_entity_str(c) for c in m.children)
    attrs = _attrs_str(m.attributes)
    return f"{{{inner}}}{_label_str(m.label)}{attrs}"


def _attrs_str(attrs: dict[str, str]) -> str:
    if not attrs:
        return ""
    pairs = ", ".join(f'{k}="{_escape(v)}"' for k, v in attrs.items())
    return f"[{pairs}]"


def _escape(value: str) -> str:
    return (value.replace("\\", "\\\\").replace('"', '\\"')
            .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t"))


def _label_str(label: str) -> str:
    if not label:
        return ""
    if all(char in _BARE_LABEL_CHARS for char in label):
        return label
    return f'"{_escape(label)}"'
