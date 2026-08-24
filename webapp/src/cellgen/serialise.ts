/**
 * Serialise a CellSet back to a CellGen format string.
 */

import type { Cell, CellSet, CellularElement, EntityNode } from './types'

export function toCellGen(cellSet: CellSet): string {
  return cellSet.cells.map(cellStr).join(' ; ')
}

function cellStr(cell: Cell): string {
  return cell.replicons.map(repliconStr).join(', ')
}

function repliconStr(r: CellularElement): string {
  if (r.kind === 'chromosome') {
    const inner = r.children.map(entityStr).join(', ')
    const attrs = attrsStr(r.attributes)
    return `(${inner})${labelStr(r.label)}${attrs}`
  }
  return entityStr(r)
}

function entityStr(m: EntityNode): string {
  const inner = m.children.map(entityStr).join(', ')
  const attrs = attrsStr(m.attributes)
  return `{${inner}}${labelStr(m.label)}${attrs}`
}

function attrsStr(attrs: Record<string, string>): string {
  const pairs = Object.entries(attrs)
  if (!pairs.length) return ''
  return '[' + pairs.map(([k, v]) => `${k}="${escapeText(v)}"`).join(', ') + ']'
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
}

function labelStr(label: string): string {
  if (!label) return ''
  return /^[A-Za-z0-9_.:-]+$/.test(label) ? label : `"${escapeText(label)}"`
}
