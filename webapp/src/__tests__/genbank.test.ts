import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseGenBank } from '../cellgen/genbank'
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
    expect(plasmid.children[0].label).toBe('intI1')
    expect(plasmid.children[0].children[0].label).toBe('blaCTX-M-15')
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
