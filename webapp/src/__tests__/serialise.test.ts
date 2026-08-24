/**
 * Unit tests for the CellGen serialiser.
 */
import { describe, it, expect } from 'vitest'
import { parseCellGen } from '../cellgen/parser'
import { toCellGen } from '../cellgen/serialise'

function roundTrip(input: string) {
  const result = parseCellGen(input)
  if (!result.ok) throw new Error(result.error.message)
  return toCellGen(result.value)
}

describe('toCellGen', () => {
  it('serialises a lone chromosome', () => {
    expect(roundTrip('()chr1')).toContain('()chr1')
  })

  it('serialises chromosome and plasmid', () => {
    const out = roundTrip('()chr1,{}pBAD')
    expect(out).toContain('()')
    expect(out).toContain('{}pBAD')
  })

  it('preserves nested entities inside chromosome', () => {
    const out = roundTrip('({}Tn3)chromosome')
    expect(out).toContain('{}Tn3')
    expect(out).toContain('(')
    expect(out).toContain('chromosome')
  })

  it('preserves deeply nested entities', () => {
    const out = roundTrip('{ { {}blaKPC-2 }Tn4401 }pKpQIL')
    expect(out).toContain('blaKPC-2')
    expect(out).toContain('Tn4401')
    expect(out).toContain('pKpQIL')
  })

  it('separates multiple cells with " ; "', () => {
    const out = roundTrip('()chrA ; ()chrB')
    expect(out).toContain(' ; ')
  })

  it('serialises attributes', () => {
    const out = roundTrip('()chr[organism="E. coli"]')
    expect(out).toContain('organism="E. coli"')
  })

  it('serialises multiple attributes', () => {
    const out = roundTrip('()chr[organism="E. coli", strain="K-12"]')
    expect(out).toContain('organism="E. coli"')
    expect(out).toContain('strain="K-12"')
  })

  it('produces idempotent output on second parse', () => {
    const first = roundTrip('()chr1,{}pBAD')
    const second = roundTrip(first)
    expect(second).toBe(first)
  })
})
