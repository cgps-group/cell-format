import { describe, expect, it } from 'vitest'
import { parseCellGen } from '../cellgen/parser'
import { toCellGen } from '../cellgen/serialise'
import { createDocumentState, editDocument, editorReducer, textChange } from '../editor/document'
import type { EditorEntity } from '../editor/document'

function parse(text: string) {
  const parsed = parseCellGen(text)
  if (!parsed.ok) throw new Error(parsed.error.message)
  return parsed.value
}

const source =
  '{}pFirst[type="plasmid", accession="AB123.1"], ({ { {}gene[type="gene", start="42", note="keep me"] }cassette[type="novel_cassette"] }Tn3[type="transposon"])chr[organism="E. coli", topology="circular"]'

describe('document editing', () => {
  it('preserves replicon order, arbitrary metadata and nested types when renaming a gene', () => {
    const before = createDocumentState(source)
    const chromosome = before.document.cells[0].replicons[1]
    const gene = chromosome.children[0].children[0].children[0]
    const after = editorReducer(before, {
      type: 'updateNode',
      cellId: before.document.cells[0].id,
      nodeId: gene.id,
      changes: { label: 'gene, with "quotes" and \\slashes' },
    })
    const expected = parse(source)
    expected.cells[0].replicons[1].children[0].children[0].children[0].label =
      'gene, with "quotes" and \\slashes'
    expect(parse(after.text)).toEqual(expected)
    expect(parse(before.text)).toEqual(parse(source))
    expect(after.text).not.toContain('cell/0')
  })

  it('changes only the selected entity among duplicate labels and retains sibling IDs after removal', () => {
    const before = createDocumentState('{ {}same[note="first"], {}same[note="second"] }p')
    const cell = before.document.cells[0]
    const [first, second] = cell.replicons[0].children
    const changed = editDocument(before.document, {
      type: 'updateNode',
      cellId: cell.id,
      nodeId: second.id,
      changes: { label: 'renamed' },
    })
    const removed = editDocument(changed, { type: 'removeNode', cellId: cell.id, nodeId: first.id })
    expect(removed.cells[0].replicons[0].children).toEqual([{ ...second, label: 'renamed' }])
    expect(before.document.cells[0].replicons[0].children).toEqual([first, second])
  })

  it('adds a deeply nested entity and serialises its labels and metadata safely', () => {
    const before = createDocumentState('({ {}Tn21[type="transposon"] }p)chr')
    const cell = before.document.cells[0]
    const parent = cell.replicons[0].children[0].children[0]
    const node: EditorEntity = {
      kind: 'entity',
      id: 'new-gene',
      label: 'aadA1 cassette',
      attributes: { type: 'gene_cassette', note: 'a "quoted" value' },
      children: [],
    }
    const after = editorReducer(before, {
      type: 'addEntity',
      cellId: cell.id,
      parentId: parent.id,
      node,
    })
    const parsed = parse(after.text)
    expect(parsed.cells[0].replicons[0].children[0].children[0].children[0]).toEqual({
      kind: 'entity',
      label: node.label,
      attributes: node.attributes,
      children: [],
    })
    expect(toCellGen(parsed)).toBe(after.text)
  })

  it('preserves custom attributes while changing a type and resetting colour', () => {
    const before = createDocumentState(
      '{}custom[type="novel_type", colour="#ff0000", accession="A.1"]',
    )
    const cell = before.document.cells[0]
    const after = editorReducer(before, {
      type: 'updateNode',
      cellId: cell.id,
      nodeId: cell.replicons[0].id,
      changes: { label: 'custom', entityType: 'gene_cluster', colour: '' },
    })
    expect(parse(after.text).cells[0].replicons[0].attributes).toEqual({
      type: 'gene_cluster',
      accession: 'A.1',
    })
  })

  it('keeps incomplete text separate from the editable document and recovers on valid replacement', () => {
    const initial = createDocumentState(source)
    const incomplete = editorReducer(initial, textChange('(unfinished'))
    expect(incomplete.text).toBe('(unfinished')
    expect(incomplete.document).toBe(initial.document)
    const recovered = editorReducer(incomplete, textChange('{}replacement[custom="retained"]'))
    expect(parse(recovered.text)).toEqual(parse(toCellGen(recovered.document)))
    expect(recovered.document.cells[0].replicons).toHaveLength(1)
    expect(recovered.document.cells[0].replicons[0].label).toBe('replacement')
  })

  it('clears the builder explicitly for empty text and supports adding/removing cells', () => {
    const cleared = editorReducer(createDocumentState(source), textChange(''))
    expect(cleared.document.cells[0].replicons).toEqual([])
    const extra = editDocument(cleared.document, {
      type: 'addCell',
      cell: { id: 'extra', replicons: [] },
    })
    const removed = editDocument(extra, { type: 'removeCell', cellId: 'cell/0' })
    expect(removed.cells.map((cell) => cell.id)).toEqual(['extra'])
    expect(editDocument(removed, { type: 'removeCell', cellId: 'extra' }).cells).toHaveLength(1)
  })
})
