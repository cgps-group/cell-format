import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseGenBank, parseGFF } from '../cellgen/genbank'
import { parseCellGen } from '../cellgen/parser'

const fixture = (name: string) => readFileSync(
  new URL(`../../../tests/fixtures/${name}`, import.meta.url),
  'utf8',
)

function parse(input: string) {
  const result = parseCellGen(input)
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.value
}

describe('GenBank conversion', () => {
  it('counts omitted genes and retains them when explicitly selected', () => {
    const source = fixture('assembly.gbk')
    const standard = parseGenBank(source)
    const selected = parseGenBank(source, { retainUncontainedGenes: true })
    expect(standard.omittedGenes).toBe(1)
    expect(selected.omittedGenes).toBe(0)
    expect(parse(selected.cellgen).cells[0].replicons[0].children.some(child => child.label === 'coreA')).toBe(true)
    const specific = parseGenBank(source, { selectedFeatureIds: ['coreA'] })
    expect(specific.omittedGenes).toBe(0)
    expect(parse(specific.cellgen).cells[0].replicons[0].children.map(child => child.label)).toEqual(['Tn4401', 'coreA'])
  })
  it('converts a chromosome and plasmid assembly with nested features', () => {
    const converted = parseGenBank(fixture('assembly.gbk'))
    expect(converted.cellgen).toBe(fixture('assembly.cellgen').trim())
    const parsed = parse(converted.cellgen)

    expect(parsed.cells).toHaveLength(1)
    expect(parsed.cells[0].replicons).toHaveLength(2)

    const [chromosome, plasmid] = parsed.cells[0].replicons
    expect(chromosome.kind).toBe('chromosome')
    expect(chromosome.attributes.type).toBe('chromosome')
    expect(chromosome.children[0].label).toBe('Tn4401')
    expect(chromosome.children[0].children[0].label).toBe('blaKPC-2')
    expect(chromosome.children.some(child => child.label === 'coreA')).toBe(false)

    expect(plasmid.kind).toBe('entity')
    expect(plasmid.attributes.type).toBe('plasmid')
    expect(plasmid.children[0].label).toBe('class1_integron')
    expect(plasmid.children[0].children.map(child => child.label)).toEqual([
      'intI1',
      'blaCTX-M-15',
    ])
  })

  it('converts a standalone full-span mobile element as an entity', () => {
    const converted = parseGenBank(fixture('tncentral_element.gbk'))
    expect(converted.cellgen).toBe(fixture('tncentral_element.cellgen').trim())
    const parsed = parse(converted.cellgen)
    const element = parsed.cells[0].replicons[0]

    expect(element.kind).toBe('entity')
    expect(element.label).toBe('Tn4401')
    expect(element.attributes.type).toBe('transposon')
    expect(element.children.map(child => child.label)).toEqual(['ISKpn7', 'blaKPC-2'])
  })
})

describe('GFF3 conversion', () => {
  const gff = `##gff-version 3
##sequence-region contig_1 1 100
contig_1\t.\tmobile_genetic_element\t10\t80\t.\t+\t.\tID=m1;Name=Tn1
contig_1\t.\tgene\t20\t30\t.\t+\t.\tID=g1;Name=blaX
contig_1\t.\tgene\t90\t95\t.\t-\t.\tID=g2;Name=outside
contig_1\t.\tmobile_genetic_element\t81\t89\t.\t-\t.\tID=m2;Name=Tn1
##FASTA
>contig_1
AAAAAAAAAA`
  it('keeps duplicate labels at distinct coordinates and an unknown source contig', () => {
    const result = parseGFF(gff)
    const root = parse(result.cellgen).cells[0].replicons[0]
    expect(root.kind).toBe('entity')
    expect(root.attributes.type).toBe('unknown')
    expect(root.children.map(child => child.label)).toEqual(['Tn1', 'Tn1'])
    expect(root.children[0].attributes.start).toBe('10')
    expect(root.children[0].children[0].label).toBe('blaX')
    expect(result.omittedGenes).toBe(1)
    expect(parseGFF(gff, { retainUncontainedGenes: true }).omittedGenes).toBe(0)
    expect(parseGFF(gff, { selectedFeatureIds: ['g2'] }).omittedGenes).toBe(0)
  })
  it('reports malformed feature rows', () => {
    expect(() => parseGFF('##gff-version 3\ncontig\tgene')).toThrow(/nine GFF3 columns/)
  })
  it('collapses a gene and its CDS with explicit Parent and does not infer length from a partial region', () => {
    const result = parseGFF('##sequence-region ctg 100 200\nctg\t.\tgene\t120\t150\t.\t+\t.\tID=g1;Name=blaX\nctg\t.\tCDS\t120\t150\t.\t+\t0\tID=cds1;Parent=g1;Name=blaX', { selectedFeatureIds: ['g1'] })
    const root = parse(result.cellgen).cells[0].replicons[0]
    expect(root.children.map(child => child.label)).toEqual(['blaX'])
    expect(root.attributes.length).toBeUndefined()
    expect(root.attributes.region_start).toBe('100')
  })
})
