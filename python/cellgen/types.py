from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


Attributes = dict[str, str]


@dataclass
class EntityNode:
    label: str
    children: list[EntityNode] = field(default_factory=list)
    attributes: Attributes = field(default_factory=dict)
    size_bp: Optional[int] = None  # genomic size, if known


@dataclass
class ChromosomeNode:
    label: str
    children: list[EntityNode] = field(default_factory=list)
    attributes: Attributes = field(default_factory=dict)
    size_bp: Optional[int] = None


CellularElement = ChromosomeNode | EntityNode


@dataclass
class Cell:
    replicons: list[CellularElement]


@dataclass
class CellSet:
    cells: list[Cell]
