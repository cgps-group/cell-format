/**
 * Unit tests for the SVG renderer.
 */
import { describe, it, expect } from 'vitest'
import { parseCellGen } from '../cellgen/parser'
import { renderSVG } from '../cellgen/renderer'
import { renderContainmentSVG } from '../cellgen/containmentRenderer'

function parse(input: string) {
  const result = parseCellGen(input)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

function svg(input: string) {
  return renderSVG(parse(input))
}

describe('renderSVG', () => {
  it('returns valid SVG markup', () => {
    const out = svg('()chr1')
    expect(out).toMatch(/^<svg /)
    expect(out).toMatch(/<\/svg>$/)
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('renders a chromosome circle', () => {
    const out = svg('()chr1')
    expect(out).toContain('#dde8f8')  // CHR_FILL
    expect(out).toContain('#3a6fba')  // CHR_STROKE
    expect(out).toContain('<circle')
  })

  it('renders the chromosome label', () => {
    const out = svg('()myChromosome')
    expect(out).toContain('myChromosome')
  })

  it('renders a plasmid circle', () => {
    const out = svg('{}pBAD')
    expect(out).toContain('#e6f5e6')  // ENTITY_FILL
    expect(out).toContain('#3a9943')  // ENTITY_STROKE
  })

  it('renders nested entities as arc sectors', () => {
    const out = svg('({}Tn3)chr1')
    expect(out).toContain('<path')   // arc elements use SVG path
    expect(out).toContain('Tn3')
  })

  it('renders a schematic fungal Starship with its nested entities', () => {
    const out = svg('({ {}DUF3435_captain[type="gene"], {}cargo_gene_cluster[type="gene_cluster"] }Starship[type="starship"])chromosome')
    expect(out).toContain('Starship')
    expect(out).toContain('DUF3435_captain')
    expect(out).toContain('cargo_gene_cluster')
    expect(out).toContain('#6c5ce7')
  })

  it('shows containment for deeply nested elements', () => {
    const out = svg('{ { {}blaKPC-2 }Tn4401 }pKpQIL')
    // Arc borders use white stroke to visually separate sectors
    expect(out).toContain('stroke="white"')
    // Outermost child label present; deeply nested label omitted (too small)
    expect(out).toContain('Tn4401')
    expect(out).toContain('pKpQIL')
  })

  it('renders multiple cells with a separator line', () => {
    const out = svg('()chrA ; ()chrB')
    expect(out).toContain('stroke-dasharray')  // dashed separator
  })

  it('canvas grows to include additional replicons', () => {
    const single = svg('()chr1')
    const withPlasmid = svg('()chr1,{}pBAD')
    const hSingle = parseInt(single.match(/height="(\d+)"/)?.[1] ?? '0')
    const hDouble = parseInt(withPlasmid.match(/height="(\d+)"/)?.[1] ?? '0')
    expect(hDouble).toBeGreaterThan(hSingle)
  })

  it('uses a tight viewBox around rendered content', () => {
    const out = svg('({{}blaKPC-2[type="gene"]}Tn4401[type="transposon"])chromosome,{{{}blaCTX-M-15[type="gene"]}intI1[type="integron"]}pKPC')
    const width = parseInt(out.match(/width="(\d+)"/)?.[1] ?? '0')
    expect(width).toBeLessThan(700)
    expect(out).not.toContain('viewBox="0 0')
  })

  it('returns empty SVG for empty cell set', () => {
    // The renderer handles empty input gracefully
    const out = renderSVG({ cells: [] })
    expect(out).toContain('<svg')
  })

  it('escapes ampersands in labels', () => {
    // Build a CellSet manually with a label containing & to test SVG escaping
    const cs = {
      cells: [{
        replicons: [{
          kind: 'chromosome' as const,
          label: 'E&Coli',
          children: [],
          attributes: {},
        }],
      }],
    }
    const out = renderSVG(cs)
    expect(out).not.toContain('E&Coli')  // raw & must be escaped
    expect(out).toContain('&amp;')
  })
})

describe('renderContainmentSVG', () => {
  it('renders chromosomes as solid blue containers', () => {
    const out = renderContainmentSVG(parse('()chr1'))
    expect(out).toContain('chr1')
    expect(out).toContain('stroke="#3975dc"')
    expect(out).not.toContain('stroke="#3975dc" stroke-width="2" stroke-dasharray')
  })

  it('renders non-chromosomal entities as dashed orange containers', () => {
    const out = renderContainmentSVG(parse('{}pKPC[type="plasmid"]'))
    expect(out).toContain('pKPC')
    expect(out).toContain('stroke="#e77914"')
    expect(out).toContain('stroke-dasharray="7 5"')
  })

  it('shows nested containment and renders genes as labelled pills', () => {
    const out = renderContainmentSVG(parse('({{}blaKPC-2[type="gene"]}Tn4401[type="transposon"])chromosome'))
    expect(out).toContain('chromosome')
    expect(out).toContain('Tn4401')
    expect(out).toContain('blaKPC-2')
    expect(out).toContain('fill="#d92d2d"')
    expect(out).toContain('CellGen containment diagram')
  })

  it('labels multiple cells and separates them', () => {
    const out = renderContainmentSVG(parse('()chrA ; ()chrB'))
    expect(out).toContain('Cell 1')
    expect(out).toContain('Cell 2')
    expect(out).toContain('stroke-dasharray="6 5"')
  })
})
