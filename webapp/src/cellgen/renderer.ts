/**
 * CellGen SVG renderer.
 * Produces circular diagrams matching the CellGen spec sample image style.
 */

import type { Cell, CellSet, ChromosomeNode, EntityNode } from './types'

const CHR_FILL = '#dde8f8'
const CHR_STROKE = '#3a6fba'
const CHR_SW = 8

const ENTITY_FILL = '#e6f5e6'
const ENTITY_STROKE = '#3a9943'
const ENTITY_SW = 5

const CHR_R = 90
const ENTITY_R = 44
const PAD = 24
const FONT = 'Inter, Arial, sans-serif'

const ARC_BAND_CHR = 16   // radial thickness of the outermost arc band on chromosomes
const ARC_BAND_ENTITY = 10   // radial thickness of the outermost arc band on ENTITY circles
const ARC_TAPER = 0.90    // each deeper nesting level is this fraction narrower (10% reduction)
const ARC_HALF = 0.28     // half-width of each depth-0 arc marker (radians ≈ 16°)

const TYPE_COLOURS: Record<string, string> = {
  transposon: '#e05252',
  integron: '#9b59b6',
  insertion_sequence: '#f39c12',
  phage: '#16a085',
  starship: '#6c5ce7',
  gene: '#c0392b',
  gene_cluster: '#d35400',
  plasmid: ENTITY_STROKE,
  element: '#aaaaaa',
  other: '#888888',
}

function elementColour(_label: string, _index: number, customColour?: string, type?: string): string {
  if (customColour) return customColour
  if (type && TYPE_COLOURS[type]) return TYPE_COLOURS[type]
  return '#aaaaaa'
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

class SVGBuilder {
  private parts: string[] = []
  private minX = Number.POSITIVE_INFINITY
  private minY = Number.POSITIVE_INFINITY
  private maxX = Number.NEGATIVE_INFINITY
  private maxY = Number.NEGATIVE_INFINITY

  private include(x0: number, y0: number, x1: number, y1: number): void {
    this.minX = Math.min(this.minX, x0)
    this.minY = Math.min(this.minY, y0)
    this.maxX = Math.max(this.maxX, x1)
    this.maxY = Math.max(this.maxY, y1)
  }

  circle(cx: number, cy: number, r: number, fill: string, stroke: string, sw: number): void {
    const extent = r + sw / 2
    this.include(cx - extent, cy - extent, cx + extent, cy + extent)
    this.parts.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`,
    )
  }

  rectRotated(
    cx: number, cy: number, w: number, h: number,
    fill: string, deg: number,
    stroke = '', sw = 0,
  ): void {
    const extent = Math.hypot(w, h) / 2 + sw / 2
    this.include(cx - extent, cy - extent, cx + extent, cy + extent)
    const strokeAttr = stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''
    this.parts.push(
      `<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" ` +
      `width="${w}" height="${h}" fill="${fill}" rx="2"${strokeAttr} ` +
      `transform="rotate(${deg.toFixed(1)},${cx.toFixed(1)},${cy.toFixed(1)})"/>`,
    )
  }

  text(x: number, y: number, content: string, size = 13, anchor = 'middle', fill = '#333'): void {
    const width = content.length * size * 0.58
    const x0 = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2
    this.include(x0, y - size, x0 + width, y + size * 0.3)
    this.parts.push(
      `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" ` +
      `font-size="${size}" fill="${fill}" font-family="${FONT}">${esc(content)}</text>`,
    )
  }

  arc(cx: number, cy: number, outerR: number, innerR: number, a0: number, a1: number, fill: string, stroke = '', sw = 0): void {
    this.include(cx - outerR - sw / 2, cy - outerR - sw / 2, cx + outerR + sw / 2, cy + outerR + sw / 2)
    const cos0 = Math.cos(a0), sin0 = Math.sin(a0)
    const cos1 = Math.cos(a1), sin1 = Math.sin(a1)
    const large = (a1 - a0) > Math.PI ? 1 : 0
    const d = [
      `M ${(cx + outerR * cos0).toFixed(2)},${(cy + outerR * sin0).toFixed(2)}`,
      `A ${outerR.toFixed(2)},${outerR.toFixed(2)} 0 ${large},1 ${(cx + outerR * cos1).toFixed(2)},${(cy + outerR * sin1).toFixed(2)}`,
      `L ${(cx + innerR * cos1).toFixed(2)},${(cy + innerR * sin1).toFixed(2)}`,
      `A ${innerR.toFixed(2)},${innerR.toFixed(2)} 0 ${large},0 ${(cx + innerR * cos0).toFixed(2)},${(cy + innerR * sin0).toFixed(2)}`,
      'Z',
    ].join(' ')
    const strokeAttr = stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''
    this.parts.push(`<path d="${d}" fill="${fill}"${strokeAttr}/>`)
  }

  line(x1: number, y1: number, x2: number, y2: number, stroke = '#ccc', sw = 1.5, dash = ''): void {
    this.include(Math.min(x1, x2) - sw / 2, Math.min(y1, y2) - sw / 2, Math.max(x1, x2) + sw / 2, Math.max(y1, y2) + sw / 2)
    const da = dash ? ` stroke-dasharray="${dash}"` : ''
    this.parts.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" ` +
      `x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ` +
      `stroke="${stroke}" stroke-width="${sw}"${da}/>`,
    )
  }

  toSVG(width: number, height: number): string {
    const cropPadding = 24
    const hasContent = Number.isFinite(this.minX)
    const viewX = hasContent ? this.minX - cropPadding : 0
    const viewY = hasContent ? this.minY - cropPadding : 0
    const outputWidth = hasContent ? this.maxX - this.minX + cropPadding * 2 : width
    const outputHeight = hasContent ? this.maxY - this.minY + cropPadding * 2 : height
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `width="${Math.round(outputWidth)}" height="${Math.round(outputHeight)}" ` +
      `viewBox="${viewX.toFixed(1)} ${viewY.toFixed(1)} ${outputWidth.toFixed(1)} ${outputHeight.toFixed(1)}" ` +
      `style="background:white">\n  ` +
      this.parts.join('\n  ') +
      '\n</svg>'
    )
  }
}

/** Pick SVG text-anchor so labels spread away from their arc position naturally. */
function arcAnchor(angle: number): string {
  const c = Math.cos(angle)
  if (c > 0.3) return 'start'
  if (c < -0.3) return 'end'
  return 'middle'
}

/** Total outward extent of arc bands for a subtree at a given initial band width. */
function totalBandExtent(elements: EntityNode[], bandW: number): number {
  if (!elements.length || bandW < 3) return 0
  const childExtent = Math.max(0, ...elements.map(el =>
    el.children.length ? totalBandExtent(el.children, bandW * ARC_TAPER) : 0
  ))
  return bandW + childExtent
}

interface LabelSpec {
  label: string
  outerR: number   // arc edge where the spoke starts
  arcMid: number   // actual arc midpoint angle
  fontSize: number
}

/**
 * Recursively collect all labelled elements in a subtree with their arc geometry.
 * arcInnerR / bandW / a0..a1 describe el's own arc.
 */
function collectSubtreeLabels(
  el: EntityNode,
  arcInnerR: number,
  bandW: number,
  a0: number,
  a1: number,
  fontSize: number,
): LabelSpec[] {
  if (bandW < 3) return []
  const outerR = arcInnerR + bandW
  const mid = (a0 + a1) / 2
  const items: LabelSpec[] = el.label ? [{ label: el.label, outerR, arcMid: mid, fontSize }] : []

  const childBandW = bandW * ARC_TAPER
  const nc = el.children.length
  if (nc && childBandW >= 3) {
    const span = a1 - a0
    const gap = 0.025
    const arcSpan = Math.max(0.01, (span - gap * nc) / nc)
    el.children.forEach((child, i) => {
      const ea0 = a0 + i * (arcSpan + gap)
      const ea1 = ea0 + arcSpan
      items.push(...collectSubtreeLabels(child, outerR, childBandW, ea0, ea1, Math.max(9, fontSize - 1)))
    })
  }
  return items
}

/** Draw arcs for child elements — labels are handled by the fan in renderArcs. */
function renderNestedArcs(
  elements: EntityNode[],
  cx: number, cy: number,
  innerR: number, bandW: number,
  a0: number, a1: number,
  svg: SVGBuilder,
  depth: number,
): void {
  const n = elements.length
  if (!n || bandW < 3) return
  const outerR = innerR + bandW
  const span = a1 - a0
  const gap = 0.025
  const arcSpan = Math.max(0.01, (span - gap * n) / n)

  elements.forEach((el, i) => {
    const ea0 = a0 + i * (arcSpan + gap)
    const ea1 = ea0 + arcSpan
    const colour = elementColour(el.label, i + depth * 7, el.attributes.colour, el.attributes.type)
    svg.arc(cx, cy, outerR, innerR, ea0, ea1, colour, 'white', 0.5)
    if (el.children.length) {
      renderNestedArcs(el.children, cx, cy, outerR, bandW * ARC_TAPER, ea0, ea1, svg, depth + 1)
    }
  })
}

/**
 * Render top-level arc markers and place all subtree labels without collision.
 * 1 label → straight spoke to label ring.
 * 2+ labels → stacked vertically on the natural side (right for top/right arcs,
 *             left for left arcs), with diagonal spokes to each label.
 */
function renderArcs(
  elements: EntityNode[],
  cx: number, cy: number,
  baseR: number, bandW: number,
  svg: SVGBuilder,
  startAngle = -Math.PI / 2,
): void {
  const n = elements.length
  if (!n) return
  const innerR = baseR
  const outerR = baseR + bandW
  const halfSpan = Math.min(ARC_HALF, Math.PI / n - 0.04)

  const maxChildExtent = Math.max(0, ...elements.map(el =>
    el.children.length ? totalBandExtent(el.children, bandW * ARC_TAPER) : 0
  ))
  const labelRing = outerR + maxChildExtent + 14

  elements.forEach((el, i) => {
    const center = startAngle + (2 * Math.PI * i) / n
    const a0 = center - halfSpan
    const a1 = center + halfSpan
    const colour = elementColour(el.label, i, el.attributes.colour, el.attributes.type)

    svg.arc(cx, cy, outerR, innerR, a0, a1, colour, 'white', 0.5)
    if (el.children.length) {
      renderNestedArcs(el.children, cx, cy, outerR, bandW * ARC_TAPER, a0, a1, svg, 1)
    }

    // Collect all labels in this element's subtree
    const specs = collectSubtreeLabels(el, innerR, bandW, a0, a1, 11)
    if (!specs.length) return

    // Sort outermost arc first (shallowest nesting = smallest outerR)
    specs.sort((a, b) => a.outerR - b.outerR)

    const nl = specs.length
    const LINE_H = 15

    if (nl === 1) {
      // Single label: straight spoke radially outward
      const spec = specs[0]
      svg.line(
        cx + spec.outerR * Math.cos(spec.arcMid),
        cy + spec.outerR * Math.sin(spec.arcMid),
        cx + labelRing * Math.cos(center),
        cy + labelRing * Math.sin(center),
        '#bbb', 0.7,
      )
      const lx = cx + (labelRing + 5) * Math.cos(center)
      const ly = cy + (labelRing + 5) * Math.sin(center) + 4
      svg.text(lx, ly, spec.label, spec.fontSize, arcAnchor(center), '#444')
    } else {
      // Multiple labels: stack vertically on one side, spokes to each label.
      // Sort by arc-edge y so top arcs connect to top labels — no crossing spokes.
      specs.sort((a, b) =>
        (cy + a.outerR * Math.sin(a.arcMid)) - (cy + b.outerR * Math.sin(b.arcMid))
      )
      const goRight = Math.cos(center) >= -0.3
      // Stack x: just past the arc bands' actual horizontal reach + clearance
      const horizReach = Math.max(innerR, ...specs.map(s => s.outerR * Math.abs(Math.cos(s.arcMid))))
      const stackX = cx + (goRight ? 1 : -1) * (horizReach + 20)
      // Stack centred at the average y of the arc edges (keeps spokes short)
      const avgArcY = specs.reduce((s, sp) => s + cy + sp.outerR * Math.sin(sp.arcMid), 0) / nl
      const anchor = goRight ? 'start' : 'end'
      const textX = stackX + (goRight ? 3 : -3)

      specs.forEach((spec, j) => {
        const ry = avgArcY + (j - (nl - 1) / 2) * LINE_H
        svg.line(
          cx + spec.outerR * Math.cos(spec.arcMid),
          cy + spec.outerR * Math.sin(spec.arcMid),
          stackX, ry,
          '#bbb', 0.7,
        )
        svg.text(textX, ry + 4, spec.label, spec.fontSize, anchor, '#444')
      })
    }
  })
}

/** Radial extent of arc bands + label spoke + text clearance from a circle edge. */
const LABEL_CLEAR = 150

function arcLabelExtent(children: EntityNode[], band: number): number {
  if (!children.length) return 0
  return band + totalBandExtent(children, band * ARC_TAPER) + 14 + LABEL_CLEAR
}

interface CellLayout { chrRingR: number; entityRingR: number; totalR: number }

/**
 * Compute ring radii for a cell.
 * – Chromosomes occupy an inner ring (radius 0 when there is only one).
 * – ENTITYs orbit in an outer ring, spaced to avoid overlap.
 */
function computeCellLayout(cell: Cell): CellLayout {
  const chrs = cell.replicons.filter((r): r is ChromosomeNode => r.kind === 'chromosome')
  const entities = cell.replicons.filter((r): r is EntityNode => r.kind === 'entity')
  const nChr = chrs.length
  const nEntity = entities.length

  // Chromosome ring radius (0 for a single chromosome placed at the cell centre)
  const chrRingR = nChr > 1 ? (CHR_R + PAD / 2) / Math.sin(Math.PI / nChr) : 0

  // Farthest label reach from chr arcs (from cell centre)
  const chrLabelOuterR = nChr > 0
    ? chrRingR + CHR_R + chrs.reduce((mx, ch) => Math.max(mx, arcLabelExtent(ch.children, ARC_BAND_CHR)), 0)
    : 0

  // ENTITY ring
  let entityRingR = 0
  let entityPhysOuterR = 0
  let entityLabelOuterR = 0

  if (nEntity > 0) {
    const baseR = (nChr > 0 ? chrLabelOuterR + PAD : 0) + ENTITY_R
    const minNonOverlap = nEntity > 1 ? (ENTITY_R + PAD / 2) / Math.sin(Math.PI / nEntity) : 0
    entityRingR = Math.max(baseR, minNonOverlap)

    const entityBandExt = entities.reduce((mx, entity) =>
      Math.max(mx, entity.children.length ? ARC_BAND_ENTITY + totalBandExtent(entity.children, ARC_BAND_ENTITY * ARC_TAPER) : 0), 0)
    const entityLabelExt = entities.reduce((mx, entity) => Math.max(mx, arcLabelExtent(entity.children, ARC_BAND_ENTITY)), 0)

    entityPhysOuterR = entityRingR + ENTITY_R + entityBandExt
    entityLabelOuterR = entityRingR + ENTITY_R + entityLabelExt
  }

  const totalR = Math.max(
    chrLabelOuterR,
    nEntity > 0 ? entityPhysOuterR + 20 : 0,
    entityLabelOuterR,
    CHR_R + 20,
  )

  return { chrRingR, entityRingR, totalR }
}

/** Render one cell centred at (cx, cy). */
function renderCell(cell: Cell, cx: number, cy: number, svg: SVGBuilder): void {
  const { chrRingR, entityRingR } = computeCellLayout(cell)
  const chrs = cell.replicons.filter((r): r is ChromosomeNode => r.kind === 'chromosome')
  const entities = cell.replicons.filter((r): r is EntityNode => r.kind === 'entity')
  const nChr = chrs.length
  const nEntity = entities.length

  // Chromosomes — inner ring (single chr sits at cell centre)
  chrs.forEach((ch, i) => {
    const angle = nChr > 1 ? -Math.PI / 2 + (2 * Math.PI * i) / nChr : 0
    const ccx = cx + chrRingR * Math.cos(angle)
    const ccy = cy + chrRingR * Math.sin(angle)
    svg.circle(ccx, ccy, CHR_R, CHR_FILL, CHR_STROKE, CHR_SW)
    renderArcs(ch.children, ccx, ccy, CHR_R, ARC_BAND_CHR, svg, -Math.PI / 2)
    if (ch.label) svg.text(ccx, ccy + 5, ch.label, 15)
  })

  // ENTITYs — outer ring; arc markers face outward from the cell centre
  entities.forEach((entity, i) => {
    const angle = nEntity > 1 ? -Math.PI / 2 + (2 * Math.PI * i) / nEntity : -Math.PI / 2
    const mx = cx + entityRingR * Math.cos(angle)
    const my = cy + entityRingR * Math.sin(angle)
    svg.circle(mx, my, ENTITY_R, ENTITY_FILL, ENTITY_STROKE, ENTITY_SW)
    renderArcs(entity.children, mx, my, ENTITY_R, ARC_BAND_ENTITY, svg, angle)
    if (entity.label) svg.text(mx, my + 4, entity.label, 11)
  })
}

export function renderSVG(cellSet: CellSet): string {
  const cells = cellSet.cells
  if (!cells.length) return '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"/>'

  const layouts = cells.map(computeCellLayout)
  const totalW = layouts.reduce((s, l) => s + l.totalR * 2, 0) + (cells.length + 1) * PAD
  const height = Math.max(...layouts.map(l => l.totalR * 2)) + PAD * 2

  const svg = new SVGBuilder()
  let x = PAD
  cells.forEach((cell, i) => {
    const { totalR } = layouts[i]
    const cx = x + totalR
    const cy = height / 2
    renderCell(cell, cx, cy, svg)
    x += totalR * 2 + PAD
    if (i < cells.length - 1) {
      svg.line(x - PAD / 2, PAD, x - PAD / 2, height - PAD, '#ccc', 1.5, '6,4')
    }
  })

  return svg.toSVG(totalW, height)
}
