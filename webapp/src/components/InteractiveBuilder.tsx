/**
 * Interactive genome builder for chromosomes and other contained entities.
 * Supports recursive nesting: e.g. blaKPC-2 inside Tn4401 inside pKpQIL.
 */

import { useState, useEffect } from 'react'
import type { CellSet, ChromosomeNode, EntityNode } from '../cellgen/types'

type ElementType = 'chromosome' | 'plasmid' | 'transposon' | 'integron' | 'insertion_sequence' | 'phage' | 'starship' | 'gene' | 'gene_cluster' | 'element'

const ELEMENT_LABELS: Record<ElementType, string> = {
  chromosome: 'Chromosome',
  plasmid: 'Plasmid',
  transposon: 'Transposon',
  integron: 'Integron',
  insertion_sequence: 'Insertion sequence',
  phage: 'Prophage',
  starship: 'Starship',
  gene: 'Gene',
  gene_cluster: 'Gene cluster',
  element: 'Element',
}

const DEFAULT_COLOURS: Record<string, string> = {
  chromosome: '#3a6fba',
  plasmid: '#3a9943',
  transposon: '#e05252',
  integron: '#9b59b6',
  insertion_sequence: '#f39c12',
  phage: '#16a085',
  starship: '#6c5ce7',
  gene: '#c0392b',
  gene_cluster: '#d35400',
  element: '#aaaaaa',
}

function resolveColour(type: ElementType, customColour?: string): string {
  return customColour || DEFAULT_COLOURS[type] || '#888'
}

function elementDot(type: ElementType, customColour?: string) {
  const colour = resolveColour(type, customColour)
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: type === 'chromosome' || type === 'plasmid' ? '50%' : 2,
        background: colour,
        marginRight: 6,
        flexShrink: 0,
        verticalAlign: 'middle',
      }}
    />
  )
}

// Recursive Entity item — children can themselves have children
interface EntityItem {
  type: ElementType
  label: string
  colour?: string   // custom colour; undefined = use type default
  entities: EntityItem[]
}

interface BuilderState {
  cells: Array<{
    chromosomes: Array<{ label: string; entities: EntityItem[] }>
    entities: EntityItem[]
  }>
}

function entityItemStr(m: EntityItem, nested = false): string {
  const inner = m.entities.map((child) => entityItemStr(child, true)).join(', ')
  const defaultCol = DEFAULT_COLOURS[m.type] || '#aaa'
  const attrParts: string[] = []
  // A top-level plasmid remains the conventional default; every other typed
  // entity is explicit because braces do not imply a biological class.
  if (m.type !== 'element' && (nested || m.type !== 'plasmid')) {
    attrParts.push(`type="${m.type}"`)
  }
  if (m.colour && m.colour !== defaultCol) {
    attrParts.push(`colour="${m.colour}"`)
  }
  const attrs = attrParts.length ? `[${attrParts.join(', ')}]` : ''
  return `{${inner}}${m.label}${attrs}`
}

function stateToCellGen(state: BuilderState): string {
  return state.cells
    .map((cell) => {
      const parts: string[] = []
      for (const chr of cell.chromosomes) {
        const inner = chr.entities.map((m) => entityItemStr(m, true)).join(', ')
        parts.push(`(${inner})${chr.label}`)
      }
      for (const entity of cell.entities) {
        parts.push(entityItemStr(entity, false))
      }
      return parts.join(', ')
    })
    .join(' ; ')
}

function entityNodeToItem(m: EntityNode, nested = false): EntityItem {
  const explicitType = m.attributes.type as ElementType | undefined
  const type: ElementType = explicitType ?? (nested ? 'element' : 'plasmid')
  return {
    type,
    label: m.label,
    colour: m.attributes.colour || undefined,
    entities: m.children.map((child) => entityNodeToItem(child, true)),
  }
}

function cellSetToBuilderState(cs: CellSet): BuilderState {
  return {
    cells: cs.cells.map((cell) => ({
      chromosomes: cell.replicons
        .filter((r): r is ChromosomeNode => r.kind === 'chromosome')
        .map((ch) => ({ label: ch.label, entities: ch.children.map((m) => entityNodeToItem(m, true)) })),
      entities: cell.replicons
        .filter((r): r is EntityNode => r.kind === 'entity')
        .map((m) => entityNodeToItem(m, false)),
    })),
  }
}

// Path into the EntityItem tree: array of indices navigating into .entities
type EntityPath = number[]

function getAtPath(root: EntityItem[], path: EntityPath): EntityItem {
  let node = root[path[0]]
  for (let i = 1; i < path.length; i++) node = node.entities[path[i]]
  return node
}

// Modal identifies *where* to add or what to edit
type ModalTarget =
  | { kind: 'cell' }
  | { kind: 'chr'; chrIdx: number }
  | { kind: 'chr-entity'; chrIdx: number; path: EntityPath }
  | { kind: 'entity'; path: EntityPath }
  | { kind: 'edit-chr'; chrIdx: number }
  | { kind: 'edit-chr-entity'; chrIdx: number; path: EntityPath }
  | { kind: 'edit-entity'; path: EntityPath }

interface ModalState {
  cellIdx: number
  target: ModalTarget
  isEdit: boolean
}

interface Props {
  onUpdate: (cellGenString: string) => void
  syncFrom?: CellSet | null
  syncVersion?: number
}

export function InteractiveBuilder({ onUpdate, syncFrom, syncVersion }: Props) {
  const [state, setState] = useState<BuilderState>({ cells: [{ chromosomes: [], entities: [] }] })
  const [modal, setModal] = useState<ModalState | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<ElementType>('chromosome')
  const [newColour, setNewColour] = useState('')

  useEffect(() => {
    if (syncFrom) {
      setState(cellSetToBuilderState(syncFrom))
    } else {
      setState({ cells: [{ chromosomes: [], entities: [] }] })
    }
  }, [syncVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: BuilderState) => {
    setState(next)
    onUpdate(stateToCellGen(next))
  }

  const openModal = (cellIdx: number, target: ModalTarget) => {
    setModal({ cellIdx, target, isEdit: false })
    setNewLabel('')
    setNewType(target.kind === 'cell' ? 'chromosome' : 'element')
    setNewColour('')
  }

  const openEdit = (cellIdx: number, target: ModalTarget, currentLabel: string, currentType: ElementType, currentColour?: string) => {
    setModal({ cellIdx, target, isEdit: true })
    setNewLabel(currentLabel)
    setNewType(currentType)
    setNewColour(currentColour || '')
  }

  const confirmAdd = () => {
    if (!modal) return
    const label = newLabel.trim()
    const defaultCol = DEFAULT_COLOURS[newType] || '#888'
    const colour = newColour && newColour !== defaultCol ? newColour : undefined
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    const cell = next.cells[modal.cellIdx]

    if (modal.isEdit) {
      const t = modal.target
      if (t.kind === 'edit-chr') {
        cell.chromosomes[t.chrIdx].label = label
      } else if (t.kind === 'edit-chr-entity') {
        const root = cell.chromosomes[t.chrIdx].entities
        const item = t.path.length === 1 ? root[t.path[0]] : getAtPath(root, t.path)
        item.label = label
        item.type = newType
        item.colour = colour
      } else if (t.kind === 'edit-entity') {
        const item = t.path.length === 1 ? cell.entities[t.path[0]] : getAtPath(cell.entities, t.path)
        item.label = label
        item.type = newType
        item.colour = colour
      }
    } else {
      if (modal.target.kind === 'cell') {
        if (newType === 'chromosome') {
          cell.chromosomes.push({ label, entities: [] })
        } else {
          cell.entities.push({ type: newType, label, colour, entities: [] })
        }
      } else if (modal.target.kind === 'chr') {
        cell.chromosomes[modal.target.chrIdx].entities.push({ type: newType, label, colour, entities: [] })
      } else if (modal.target.kind === 'chr-entity') {
        const { chrIdx, path } = modal.target
        const root = cell.chromosomes[chrIdx].entities
        const target = path.length === 1 ? root[path[0]] : getAtPath(root, path)
        target.entities.push({ type: newType, label, colour, entities: [] })
      } else if (modal.target.kind === 'entity') {
        const { path } = modal.target
        const root = cell.entities
        if (path.length === 1) {
          root[path[0]].entities.push({ type: newType, label, colour, entities: [] })
        } else {
          getAtPath(root, path).entities.push({ type: newType, label, colour, entities: [] })
        }
      }
    }

    update(next)
    setModal(null)
  }

  const removeCell = (idx: number) => {
    const cells = state.cells.filter((_, i) => i !== idx)
    update({ cells: cells.length ? cells : [{ chromosomes: [], entities: [] }] })
  }

  const removeChromosome = (ci: number, chri: number) => {
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    next.cells[ci].chromosomes.splice(chri, 1)
    update(next)
  }

  const removeEntity = (ci: number, path: EntityPath) => {
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    const root = next.cells[ci].entities
    if (path.length === 1) {
      root.splice(path[0], 1)
    } else {
      const parent = getAtPath(root, path.slice(0, -1))
      parent.entities.splice(path[path.length - 1], 1)
    }
    update(next)
  }

  const removeChrNestedEntity = (ci: number, chrIdx: number, path: EntityPath) => {
    const next = JSON.parse(JSON.stringify(state)) as BuilderState
    const root = next.cells[ci].chromosomes[chrIdx].entities
    if (path.length === 1) {
      root.splice(path[0], 1)
    } else {
      const parent = getAtPath(root, path.slice(0, -1))
      parent.entities.splice(path[path.length - 1], 1)
    }
    update(next)
  }

  const isChrEdit = modal?.target.kind === 'edit-chr'

  const typeOptions =
    modal?.target.kind === 'cell'
      ? (['chromosome', 'plasmid', 'starship', 'transposon', 'integron', 'insertion_sequence', 'phage', 'gene', 'gene_cluster', 'element'] as ElementType[])
      : (['element', 'gene', 'gene_cluster', 'transposon', 'integron', 'insertion_sequence', 'phage', 'starship', 'plasmid'] as ElementType[])

  function renderEntityItem(ci: number, path: EntityPath, item: EntityItem, depth: number) {
    const colour = resolveColour(item.type, item.colour)
    return (
      <div key={path.join('-')} className="entity-card" style={{ borderLeftColor: colour }}>
        <div className="entity-card-header">
          {elementDot(item.type, item.colour)}
          <button
            className="builder-label-btn entity-card-label"
            onClick={() => openEdit(ci, { kind: 'edit-entity', path }, item.label, item.type, item.colour)}
            title="Click to edit"
          >
            {item.label || `(${item.type})`}
          </button>
          <button className="builder-remove-btn" title="Remove" onClick={() => removeEntity(ci, path)}>×</button>
        </div>
        {item.entities.map((child, ni) => renderEntityItem(ci, [...path, ni], child, depth + 1))}
        <button
          className="entity-add-inside-btn"
          onClick={() => openModal(ci, { kind: 'entity', path })}
        >
          + Add inside {item.label || item.type}
        </button>
      </div>
    )
  }

  function renderChrEntityItem(ci: number, chrIdx: number, path: EntityPath, item: EntityItem) {
    const colour = resolveColour(item.type, item.colour)
    return (
      <div key={path.join('-')} className="entity-card" style={{ borderLeftColor: colour }}>
        <div className="entity-card-header">
          {elementDot(item.type, item.colour)}
          <button
            className="builder-label-btn entity-card-label"
            onClick={() => openEdit(ci, { kind: 'edit-chr-entity', chrIdx, path }, item.label, item.type, item.colour)}
            title="Click to edit"
          >
            {item.label || `(${item.type})`}
          </button>
          <button className="builder-remove-btn" title="Remove" onClick={() => removeChrNestedEntity(ci, chrIdx, path)}>×</button>
        </div>
        {item.entities.map((child, ni) => renderChrEntityItem(ci, chrIdx, [...path, ni], child))}
        <button
          className="entity-add-inside-btn"
          onClick={() => openModal(ci, { kind: 'chr-entity', chrIdx, path })}
        >
          + Add inside {item.label || item.type}
        </button>
      </div>
    )
  }

  return (
    <div className="builder">
      {state.cells.map((cell, ci) => (
        <div key={ci} className="builder-cell">
          <div className="builder-cell-header">
            <span className="builder-cell-title">Cell {ci + 1}</span>
            {state.cells.length > 1 && (
              <button className="builder-remove-btn" onClick={() => removeCell(ci)} title="Remove cell">×</button>
            )}
          </div>

          {cell.chromosomes.map((chr, chri) => (
            <div key={chri} className="builder-replicon builder-chr">
              <div className="builder-replicon-header">
                {elementDot('chromosome')}
                <button
                  className="builder-label-btn"
                  onClick={() => openEdit(ci, { kind: 'edit-chr', chrIdx: chri }, chr.label, 'chromosome')}
                  title="Click to edit"
                >
                  {chr.label || '(chromosome)'}
                </button>
                <button className="builder-remove-btn" onClick={() => removeChromosome(ci, chri)}>×</button>
              </div>
              {chr.entities.map((m, mi) => renderChrEntityItem(ci, chri, [mi], m))}
              <button
                className="builder-add-nested-btn"
                onClick={() => openModal(ci, { kind: 'chr', chrIdx: chri })}
              >
                + Add entity to chromosome
              </button>
            </div>
          ))}

          {cell.entities.map((entity, mi) => {
            const colour = resolveColour(entity.type, entity.colour)
            return (
              <div key={mi} className="entity-card" style={{ borderLeftColor: colour }}>
                <div className="entity-card-header">
                  {elementDot(entity.type, entity.colour)}
                  <button
                    className="builder-label-btn entity-card-label"
                    onClick={() => openEdit(ci, { kind: 'edit-entity', path: [mi] }, entity.label, entity.type, entity.colour)}
                    title="Click to edit"
                  >
                    {entity.label || `(${entity.type})`}
                  </button>
                  <button className="builder-remove-btn" onClick={() => removeEntity(ci, [mi])}>×</button>
                </div>
                {entity.entities.map((child, ni) => renderEntityItem(ci, [mi, ni], child, 1))}
                <button
                  className="entity-add-inside-btn"
                  onClick={() => openModal(ci, { kind: 'entity', path: [mi] })}
                >
                  + Add inside {entity.label || entity.type}
                </button>
              </div>
            )
          })}

          <button className="builder-add-btn" onClick={() => openModal(ci, { kind: 'cell' })}>
            + Add element
          </button>
        </div>
      ))}

      <button
        className="button button-secondary"
        onClick={() => update({ cells: [...state.cells, { chromosomes: [], entities: [] }] })}
        style={{ marginTop: '0.75rem' }}
      >
        + Add cell
      </button>

      {modal && (
        <div className="builder-modal-overlay" onClick={() => setModal(null)}>
          <div className="builder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="builder-modal-title">
              {modal.isEdit ? 'Edit element' : modal.target.kind === 'cell' ? 'Add element' : 'Add entity'}
            </div>

            {!isChrEdit && (
              <>
                <label className="builder-modal-label">Type</label>
                <select
                  className="builder-modal-select"
                  value={newType}
                  onChange={(e) => {
                    const t = e.target.value as ElementType
                    setNewType(t)
                    // Reset colour when type changes so it defaults to new type's colour
                    if (!newColour || newColour === DEFAULT_COLOURS[newType]) setNewColour('')
                  }}
                >
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>{ELEMENT_LABELS[t]}</option>
                  ))}
                </select>
              </>
            )}

            <label className="builder-modal-label">Label</label>
            <input
              className="builder-modal-input"
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={`e.g. ${newType === 'chromosome' ? 'chr1' : newType === 'plasmid' ? 'pBAD' : 'Tn3'}`}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && confirmAdd()}
            />

            {!isChrEdit && (
              <>
                <label className="builder-modal-label">
                  Colour{' '}
                  <span style={{ color: 'var(--cellgen-text-muted)', fontWeight: 400 }}>
                    (default: {DEFAULT_COLOURS[newType] || '#888'})
                  </span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="color"
                    value={newColour || DEFAULT_COLOURS[newType] || '#888888'}
                    onChange={(e) => setNewColour(e.target.value)}
                    style={{ width: 36, height: 28, border: '1px solid var(--cellgen-border)', borderRadius: 4, cursor: 'pointer', padding: 2 }}
                  />
                  <input
                    className="builder-modal-input"
                    type="text"
                    value={newColour || DEFAULT_COLOURS[newType] || '#888888'}
                    onChange={(e) => setNewColour(e.target.value)}
                    placeholder={DEFAULT_COLOURS[newType] || '#888888'}
                    style={{ flex: 1 }}
                  />
                  {newColour && newColour !== DEFAULT_COLOURS[newType] && (
                    <button
                      className="builder-remove-btn"
                      title="Reset to default"
                      onClick={() => setNewColour('')}
                      style={{ marginLeft: 0 }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </>
            )}

            <div className="builder-modal-actions">
              <button className="button button-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="button button-primary" onClick={confirmAdd}>
                {modal.isEdit ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
