import { useState } from 'react'
import type { DocumentAction, EditorDocument, EditorNode, EditorEntity } from '../editor/document'
import { entityColour } from '../editor/entityTypes'
import { EntityEditor } from './EntityEditor'

interface Props {
  value: EditorDocument
  onChange: (action: DocumentAction) => void
}

interface Target {
  cellId: string
  node?: EditorNode
  parent?: EditorNode
  nested?: boolean
}

function nodeType(node: EditorNode, nested = false): string {
  return node.kind === 'chromosome'
    ? 'chromosome'
    : (node.attributes.type ?? (nested ? 'element' : 'plasmid'))
}

function EntityDot({ type, colour }: { type: string; colour?: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: type === 'chromosome' || type === 'plasmid' ? '50%' : 2,
        background: entityColour(type, colour),
        marginRight: 6,
        flexShrink: 0,
        verticalAlign: 'middle',
      }}
    />
  )
}

interface NodeCardProps {
  node: EditorNode
  nested?: boolean
  onEdit: (node: EditorNode, nested: boolean) => void
  onAdd: (node: EditorNode) => void
  onRemove: (node: EditorNode) => void
}

function NodeCard({ node, nested = false, onEdit, onAdd, onRemove }: NodeCardProps) {
  const type = nodeType(node, nested)
  const chromosome = node.kind === 'chromosome'
  return (
    <div
      className={chromosome ? 'builder-replicon builder-chr' : 'entity-card'}
      style={{ borderLeftColor: entityColour(type, node.attributes.colour) }}
    >
      <div className={chromosome ? 'builder-replicon-header' : 'entity-card-header'}>
        <EntityDot type={type} colour={node.attributes.colour} />
        <button
          className={`builder-label-btn${chromosome ? '' : ' entity-card-label'}`}
          onClick={() => onEdit(node, nested)}
          title="Click to edit"
        >
          {node.label || `(${type})`}
        </button>
        <button
          className="builder-remove-btn"
          title="Remove"
          aria-label={`Remove ${node.label || type}`}
          onClick={() => onRemove(node)}
        >
          ×
        </button>
      </div>
      {node.children.map((child) => (
        <NodeCard
          key={child.id}
          node={child}
          nested
          onEdit={onEdit}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      ))}
      <button
        className={chromosome ? 'builder-add-nested-btn' : 'entity-add-inside-btn'}
        onClick={() => onAdd(node)}
      >
        {chromosome ? '+ Add entity to chromosome' : `+ Add inside ${node.label || type}`}
      </button>
    </div>
  )
}

export function InteractiveBuilder({ value, onChange }: Props) {
  const [target, setTarget] = useState<Target | null>(null)
  const initialType = target?.node
    ? nodeType(target.node, target.nested)
    : target?.parent
      ? 'element'
      : 'chromosome'
  const initialColour = target?.node?.attributes.colour || ''

  const saveEntity = (label: string, type: string, colour: string) => {
    if (!target) return
    if (target.node) {
      onChange({
        type: 'updateNode',
        cellId: target.cellId,
        nodeId: target.node.id,
        changes: {
          label,
          ...(type !== initialType ? { entityType: type } : {}),
          ...(colour !== initialColour
            ? { colour: colour === entityColour(type) ? '' : colour }
            : {}),
        },
      })
    } else {
      const attributes: Record<string, string> = {}
      if (type !== 'chromosome' && type !== 'element' && (type !== 'plasmid' || target.parent))
        attributes.type = type
      if (colour && colour !== entityColour(type)) attributes.colour = colour
      const entity: EditorEntity = {
        id: crypto.randomUUID(),
        kind: 'entity',
        label,
        attributes,
        children: [],
      }
      if (target.parent)
        onChange({
          type: 'addEntity',
          cellId: target.cellId,
          parentId: target.parent.id,
          node: entity,
        })
      else
        onChange({
          type: 'addReplicon',
          cellId: target.cellId,
          node: type === 'chromosome' ? { ...entity, kind: 'chromosome' } : entity,
        })
    }
    setTarget(null)
  }

  return (
    <div className="builder">
      {value.cells.map((cell, index) => (
        <div key={cell.id} className="builder-cell">
          <div className="builder-cell-header">
            <span className="builder-cell-title">Cell {index + 1}</span>
            {value.cells.length > 1 && (
              <button
                className="builder-remove-btn"
                title="Remove cell"
                onClick={() => onChange({ type: 'removeCell', cellId: cell.id })}
              >
                ×
              </button>
            )}
          </div>
          {cell.replicons.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onEdit={(item, nested) => setTarget({ cellId: cell.id, node: item, nested })}
              onAdd={(parent) => setTarget({ cellId: cell.id, parent })}
              onRemove={(item) =>
                onChange({ type: 'removeNode', cellId: cell.id, nodeId: item.id })
              }
            />
          ))}
          <button className="builder-add-btn" onClick={() => setTarget({ cellId: cell.id })}>
            + Add entity
          </button>
        </div>
      ))}
      <button
        className="button button-secondary"
        onClick={() =>
          onChange({ type: 'addCell', cell: { id: crypto.randomUUID(), replicons: [] } })
        }
        style={{ marginTop: '0.75rem' }}
      >
        + Add cell
      </button>
      {target && (
        <EntityEditor
          key={`${target.cellId}/${target.node?.id || target.parent?.id || 'new'}`}
          isEdit={!!target.node}
          chromosome={target.node?.kind === 'chromosome'}
          allowChromosome={!target.parent && !target.node}
          initialLabel={target.node?.label || ''}
          initialType={initialType}
          initialColour={initialColour}
          onSave={saveEntity}
          onCancel={() => setTarget(null)}
        />
      )}
    </div>
  )
}
