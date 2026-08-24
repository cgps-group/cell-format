export interface Attributes {
  [key: string]: string
}

export interface EntityNode {
  kind: 'entity'
  label: string
  children: EntityNode[]
  attributes: Attributes
}

export interface ChromosomeNode {
  kind: 'chromosome'
  label: string
  children: EntityNode[]
  attributes: Attributes
}

export type CellularElement = ChromosomeNode | EntityNode

export interface Cell {
  replicons: CellularElement[]
}

export interface CellSet {
  cells: Cell[]
}

export interface ParseError {
  code: string
  message: string
  position: number
  line: number
  column: number
  found: string
  expected: string
  context: string
}

export type ParseResult =
  | { ok: true; value: CellSet }
  | { ok: false; error: ParseError }
