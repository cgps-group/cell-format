/**
 * CellGen containment renderer.
 *
 * This alternative to the circular renderer makes the grammar visible:
 * chromosomes are solid blue containers and all other biological entities
 * are dashed orange containers. Nested boxes represent physical containment.
 */

import type { Cell, CellSet, CellularElement } from './types'

const FONT = 'Inter, Arial, sans-serif'
const CELL_GAP = 28
const REPLICON_GAP = 12
const CHILD_GAP = 8
const OUTER_PAD = 20
const INNER_PAD = 12
const HEADER_HEIGHT = 42

const CHROMOSOME_FILL = '#eef4fd'
const CHROMOSOME_STROKE = '#3975dc'
const ENTITY_FILL = '#fff7eb'
const ENTITY_STROKE = '#e77914'
const GENE_FILL = '#d92d2d'

interface NodeLayout {
  node: CellularElement
  width: number
  height: number
  children: NodeLayout[]
  genePill: boolean
}

interface CellLayout {
  nodes: NodeLayout[]
  width: number
  height: number
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function labelFor(node: CellularElement): string {
  if (node.label) return node.label
  return node.kind === 'chromosome' ? 'chromosome' : 'unnamed entity'
}

function detailFor(node: CellularElement): string {
  const details: string[] = []
  if (node.kind === 'chromosome') {
    details.push(node.attributes.topology || 'chromosome')
  } else if (node.attributes.type) {
    details.push(node.attributes.type.replace(/_/g, ' '))
  } else {
    details.push('non-chromosomal entity')
  }
  if (node.attributes.mobility) details.push(node.attributes.mobility)
  return details.join(' · ')
}

function estimatedTextWidth(value: string, fontSize: number): number {
  return Math.max(0, value.length * fontSize * 0.56)
}

function layoutNode(node: CellularElement): NodeLayout {
  const genePill = node.kind === 'entity' && node.attributes.type === 'gene' && node.children.length === 0
  if (genePill) {
    return {
      node,
      children: [],
      genePill: true,
      width: Math.max(116, estimatedTextWidth(labelFor(node), 12) + 34),
      height: 34,
    }
  }

  const children = node.children.map(layoutNode)
  const childWidth = children.length ? Math.max(...children.map((child) => child.width)) : 0
  const ownWidth = Math.max(
    estimatedTextWidth(labelFor(node), 13) + INNER_PAD * 2,
    estimatedTextWidth(detailFor(node), 10) + INNER_PAD * 2,
  )
  const width = Math.max(190, ownWidth, childWidth + INNER_PAD * 2)
  const childrenHeight = children.reduce((sum, child) => sum + child.height, 0)
    + Math.max(0, children.length - 1) * CHILD_GAP
  const height = children.length
    ? HEADER_HEIGHT + childrenHeight + INNER_PAD
    : 62

  return { node, width, height, children, genePill: false }
}

function layoutCell(cell: Cell, showTitle: boolean): CellLayout {
  const nodes = cell.replicons.map(layoutNode)
  const contentWidth = nodes.length ? Math.max(...nodes.map((node) => node.width)) : 190
  const contentHeight = nodes.reduce((sum, node) => sum + node.height, 0)
    + Math.max(0, nodes.length - 1) * REPLICON_GAP
  return {
    nodes,
    width: contentWidth + OUTER_PAD * 2,
    height: contentHeight + OUTER_PAD * 2 + (showTitle ? 28 : 0),
  }
}

class ContainmentSVG {
  private parts: string[] = []

  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string,
    stroke: string,
    dashed: boolean,
    radius = 10,
  ): void {
    this.parts.push(
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="2"${dashed ? ' stroke-dasharray="7 5"' : ''}/>`
    )
  }

  text(
    x: number,
    y: number,
    value: string,
    size: number,
    fill: string,
    weight = 400,
    anchor = 'start',
  ): void {
    this.parts.push(
      `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" ` +
      `font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(value)}</text>`
    )
  }

  line(x: number, height: number): void {
    this.parts.push(
      `<line x1="${x}" y1="${OUTER_PAD}" x2="${x}" y2="${height - OUTER_PAD}" ` +
      'stroke="#cbd3dc" stroke-width="1.5" stroke-dasharray="6 5"/>'
    )
  }

  toString(width: number, height: number): string {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
      `viewBox="0 0 ${width} ${height}" role="img" aria-label="CellGen containment diagram" ` +
      'style="background:white">\n  ' + this.parts.join('\n  ') + '\n</svg>'
    )
  }
}

function renderNode(svg: ContainmentSVG, layout: NodeLayout, x: number, y: number): void {
  const { node, width, height, genePill } = layout
  if (genePill) {
    svg.rect(x, y, width, height, GENE_FILL, GENE_FILL, false, height / 2)
    svg.text(x + width / 2, y + 22, labelFor(node), 12, '#ffffff', 700, 'middle')
    return
  }

  const chromosome = node.kind === 'chromosome'
  svg.rect(
    x,
    y,
    width,
    height,
    chromosome ? CHROMOSOME_FILL : ENTITY_FILL,
    chromosome ? CHROMOSOME_STROKE : ENTITY_STROKE,
    !chromosome,
  )
  svg.text(x + INNER_PAD, y + 19, labelFor(node), 13, chromosome ? CHROMOSOME_STROKE : ENTITY_STROKE, 700)
  svg.text(x + INNER_PAD, y + 34, detailFor(node), 10, '#687384')

  let childY = y + HEADER_HEIGHT
  layout.children.forEach((child) => {
    renderNode(svg, child, x + INNER_PAD, childY)
    childY += child.height + CHILD_GAP
  })
}

function renderCell(
  svg: ContainmentSVG,
  layout: CellLayout,
  x: number,
  showTitle: boolean,
  cellIndex: number,
): void {
  let y = OUTER_PAD
  if (showTitle) {
    svg.text(x + OUTER_PAD, y + 15, `Cell ${cellIndex + 1}`, 13, '#364152', 700)
    y += 28
  }

  layout.nodes.forEach((node) => {
    renderNode(svg, node, x + OUTER_PAD, y)
    y += node.height + REPLICON_GAP
  })
}

export function renderContainmentSVG(cellSet: CellSet): string {
  if (!cellSet.cells.length) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"/>'
  }

  const showTitles = cellSet.cells.length > 1
  const layouts = cellSet.cells.map((cell) => layoutCell(cell, showTitles))
  const width = Math.round(layouts.reduce((sum, layout) => sum + layout.width, 0)
    + Math.max(0, layouts.length - 1) * CELL_GAP)
  const height = Math.round(Math.max(...layouts.map((layout) => layout.height)))
  const svg = new ContainmentSVG()

  let x = 0
  layouts.forEach((layout, index) => {
    renderCell(svg, layout, x, showTitles, index)
    x += layout.width
    if (index < layouts.length - 1) {
      svg.line(x + CELL_GAP / 2, height)
      x += CELL_GAP
    }
  })

  return svg.toString(width, height)
}
