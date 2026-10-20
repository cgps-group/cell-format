import { useId, useState } from 'react'
import { ENTITY_COLOURS, ENTITY_LABELS, entityColour } from '../editor/entityTypes'

interface Props {
  isEdit: boolean
  chromosome: boolean
  allowChromosome: boolean
  initialLabel: string
  initialType: string
  initialColour: string
  onSave: (label: string, type: string, colour: string) => void
  onCancel: () => void
}

export function EntityEditor(props: Props) {
  const id = useId()
  const [label, setLabel] = useState(props.initialLabel)
  const [type, setType] = useState(props.initialType)
  const [colour, setColour] = useState(props.initialColour)
  const types = props.allowChromosome
    ? [
        'chromosome',
        'plasmid',
        'starship',
        'transposon',
        'integron',
        'insertion_sequence',
        'phage',
        'gene',
        'gene_cluster',
        'element',
      ]
    : [
        'element',
        'gene',
        'gene_cluster',
        'transposon',
        'integron',
        'insertion_sequence',
        'phage',
        'starship',
        'plasmid',
      ]
  if (!types.includes(type)) types.push(type)

  return (
    <div className="builder-modal-overlay" onClick={props.onCancel}>
      <form
        className="builder-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') props.onCancel()
        }}
        onSubmit={(event) => {
          event.preventDefault()
          props.onSave(label.trim(), type, colour)
        }}
      >
        <div className="builder-modal-title" id={`${id}-title`}>
          {props.isEdit ? 'Edit entity' : 'Add entity'}
        </div>
        {!props.chromosome && (
          <>
            <label className="builder-modal-label" htmlFor={`${id}-type`}>
              Type
            </label>
            <select
              id={`${id}-type`}
              className="builder-modal-select"
              value={type}
              onChange={(event) => {
                const nextType = event.target.value
                if (!colour || colour === ENTITY_COLOURS[type]) setColour('')
                setType(nextType)
              }}
            >
              {types.map((value) => (
                <option key={value} value={value}>
                  {ENTITY_LABELS[value] || value}
                </option>
              ))}
            </select>
          </>
        )}
        <label className="builder-modal-label" htmlFor={`${id}-label`}>
          Label
        </label>
        <input
          id={`${id}-label`}
          className="builder-modal-input"
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={`e.g. ${type === 'chromosome' ? 'chr1' : type === 'plasmid' ? 'pBAD' : 'Tn3'}`}
          autoFocus
        />
        {!props.chromosome && (
          <>
            <label className="builder-modal-label" htmlFor={`${id}-colour`}>
              Colour{' '}
              <span style={{ color: 'var(--cellgen-text-muted)', fontWeight: 400 }}>
                (default: {entityColour(type)})
              </span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="color"
                aria-label="Colour picker"
                value={entityColour(type, colour)}
                onChange={(event) => setColour(event.target.value)}
                style={{
                  width: 36,
                  height: 28,
                  border: '1px solid var(--cellgen-border)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  padding: 2,
                }}
              />
              <input
                id={`${id}-colour`}
                className="builder-modal-input"
                type="text"
                value={entityColour(type, colour)}
                onChange={(event) => setColour(event.target.value)}
                placeholder={entityColour(type)}
                style={{ flex: 1 }}
              />
              {colour && colour !== ENTITY_COLOURS[type] && (
                <button
                  type="button"
                  className="builder-remove-btn"
                  title="Reset to default"
                  onClick={() => setColour('')}
                  style={{ marginLeft: 0 }}
                >
                  ×
                </button>
              )}
            </div>
          </>
        )}
        <div className="builder-modal-actions">
          <button type="button" className="button button-secondary" onClick={props.onCancel}>
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            {props.isEdit ? 'Save' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  )
}
