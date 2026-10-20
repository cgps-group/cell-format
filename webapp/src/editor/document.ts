import { parseCellGen } from '../cellgen/parser'
import { toCellGen } from '../cellgen/serialise'
import type { Cell, CellSet, ChromosomeNode, EntityNode } from '../cellgen/types'

export interface EditorEntity extends EntityNode {
  id: string
  children: EditorEntity[]
}

export interface EditorChromosome extends ChromosomeNode {
  id: string
  children: EditorEntity[]
}

export type EditorNode = EditorEntity | EditorChromosome
export interface EditorCell extends Cell {
  id: string
  replicons: EditorNode[]
}
export interface EditorDocument extends CellSet {
  cells: EditorCell[]
}

export interface NodeChanges {
  label: string
  entityType?: string
  colour?: string
}

export type DocumentAction =
  | { type: 'addCell'; cell: EditorCell }
  | { type: 'removeCell'; cellId: string }
  | { type: 'addReplicon'; cellId: string; node: EditorNode }
  | { type: 'addEntity'; cellId: string; parentId: string; node: EditorEntity }
  | { type: 'updateNode'; cellId: string; nodeId: string; changes: NodeChanges }
  | { type: 'removeNode'; cellId: string; nodeId: string }

export interface DocumentState {
  text: string
  document: EditorDocument
}

export type EditorAction =
  | DocumentAction
  | {
      type: 'replaceText'
      text: string
      document?: EditorDocument
    }

function identifyEntity(node: EntityNode, id: string): EditorEntity {
  return {
    ...node,
    kind: 'entity',
    id,
    children: node.children.map((child, index) => identifyEntity(child, `${id}/${index}`)),
  }
}

export function identifyDocument(value: CellSet): EditorDocument {
  return {
    cells: value.cells.map((cell, cellIndex) => ({
      id: `cell/${cellIndex}`,
      replicons: cell.replicons.map((node, index) => {
        const id = `cell/${cellIndex}/node/${index}`
        return {
          ...node,
          id,
          children: node.children.map((child, childIndex) =>
            identifyEntity(child, `${id}/${childIndex}`),
          ),
        }
      }),
    })),
  }
}

function emptyDocument(): EditorDocument {
  return { cells: [{ id: 'cell/0', replicons: [] }] }
}

// Invalid text drafts leave the editable model intact.
export function textChange(text: string): Extract<EditorAction, { type: 'replaceText' }> {
  const parsed = parseCellGen(text)
  return {
    type: 'replaceText',
    text,
    document: parsed.ok
      ? identifyDocument(parsed.value)
      : text.trim() === ''
        ? emptyDocument()
        : undefined,
  }
}

export function createDocumentState(text: string): DocumentState {
  return { text, document: textChange(text).document ?? emptyDocument() }
}

type NodePatch = Partial<Pick<EditorNode, 'label' | 'attributes' | 'children'>>

function updateNodes<T extends EditorNode>(
  nodes: T[],
  nodeId: string,
  update: (node: EditorNode) => NodePatch,
): T[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return { ...node, ...update(node) }
    return { ...node, children: updateNodes(node.children, nodeId, update) }
  })
}

function removeNode<T extends EditorNode>(nodes: T[], nodeId: string): T[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({
      ...node,
      children: removeNode(node.children, nodeId),
    }))
}

function changeNode(node: EditorNode, changes: NodeChanges): NodePatch {
  const attributes = { ...node.attributes }
  if (changes.entityType !== undefined && node.kind === 'entity') {
    if (changes.entityType === 'element') delete attributes.type
    else attributes.type = changes.entityType
  }
  if (changes.colour !== undefined) {
    if (changes.colour) attributes.colour = changes.colour
    else delete attributes.colour
  }
  return { label: changes.label, attributes }
}

export function editDocument(document: EditorDocument, action: DocumentAction): EditorDocument {
  if (action.type === 'addCell') return { cells: [...document.cells, action.cell] }
  if (action.type === 'removeCell') {
    const cells = document.cells.filter((cell) => cell.id !== action.cellId)
    return { cells: cells.length ? cells : emptyDocument().cells }
  }
  return {
    cells: document.cells.map((cell) => {
      if (cell.id !== action.cellId) return cell
      switch (action.type) {
        case 'addReplicon':
          return { ...cell, replicons: [...cell.replicons, action.node] }
        case 'addEntity':
          return {
            ...cell,
            replicons: updateNodes(cell.replicons, action.parentId, (node) => ({
              children: [...node.children, action.node],
            })),
          }
        case 'updateNode':
          return {
            ...cell,
            replicons: updateNodes(cell.replicons, action.nodeId, (node) =>
              changeNode(node, action.changes),
            ),
          }
        case 'removeNode':
          return { ...cell, replicons: removeNode(cell.replicons, action.nodeId) }
      }
    }),
  }
}

export function editorReducer(state: DocumentState, action: EditorAction): DocumentState {
  if (action.type === 'replaceText')
    return { text: action.text, document: action.document ?? state.document }
  const document = editDocument(state.document, action)
  return { document, text: toCellGen(document) }
}
