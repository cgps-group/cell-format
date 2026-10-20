import type { CellSet } from "../cellgen/types";
import { DEFAULT_COLOURS, ELEMENT_LABELS, resolveColour } from "../editor/builderModel";
import type { ElementType, EntityItem, EntityPath } from "../editor/builderModel";
import { useInteractiveBuilder } from "../editor/useInteractiveBuilder";

function elementDot(type: ElementType, customColour?: string) {
  const colour = resolveColour(type, customColour);
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: type === "chromosome" || type === "plasmid" ? "50%" : 2,
        background: colour,
        marginRight: 6,
        flexShrink: 0,
        verticalAlign: "middle",
      }}
    />
  );
}

interface Props {
  input: CellSet | null;
  onUpdate: (text: string) => void;
}

export function InteractiveBuilder({ input, onUpdate }: Props) {
  const {
    state,
    modal,
    setModal,
    newLabel,
    setNewLabel,
    newType,
    setNewType,
    newColour,
    setNewColour,
    update,
    openModal,
    openEdit,
    confirmAdd,
    removeCell,
    removeChromosome,
    removeEntity,
    removeChrNestedEntity,
    isChrEdit,
    typeOptions,
  } = useInteractiveBuilder(input, onUpdate);
  function renderEntityItem(ci: number, path: EntityPath, item: EntityItem, depth: number) {
    const colour = resolveColour(item.type, item.colour);
    return (
      <div key={path.join("-")} className="entity-card" style={{ borderLeftColor: colour }}>
        <div className="entity-card-header">
          {elementDot(item.type, item.colour)}
          <button
            className="builder-label-btn entity-card-label"
            onClick={() =>
              openEdit(ci, { kind: "edit-entity", path }, item.label, item.type, item.colour)
            }
            title="Click to edit"
          >
            {item.label || `(${item.type})`}
          </button>
          <button
            className="builder-remove-btn"
            title="Remove"
            onClick={() => removeEntity(ci, path)}
          >
            ×
          </button>
        </div>
        {item.entities.map((child, ni) => renderEntityItem(ci, [...path, ni], child, depth + 1))}
        <button
          className="entity-add-inside-btn"
          onClick={() => openModal(ci, { kind: "entity", path })}
        >
          + Add inside {item.label || item.type}
        </button>
      </div>
    );
  }

  function renderChrEntityItem(ci: number, chrIdx: number, path: EntityPath, item: EntityItem) {
    const colour = resolveColour(item.type, item.colour);
    return (
      <div key={path.join("-")} className="entity-card" style={{ borderLeftColor: colour }}>
        <div className="entity-card-header">
          {elementDot(item.type, item.colour)}
          <button
            className="builder-label-btn entity-card-label"
            onClick={() =>
              openEdit(
                ci,
                { kind: "edit-chr-entity", chrIdx, path },
                item.label,
                item.type,
                item.colour,
              )
            }
            title="Click to edit"
          >
            {item.label || `(${item.type})`}
          </button>
          <button
            className="builder-remove-btn"
            title="Remove"
            onClick={() => removeChrNestedEntity(ci, chrIdx, path)}
          >
            ×
          </button>
        </div>
        {item.entities.map((child, ni) => renderChrEntityItem(ci, chrIdx, [...path, ni], child))}
        <button
          className="entity-add-inside-btn"
          onClick={() => openModal(ci, { kind: "chr-entity", chrIdx, path })}
        >
          + Add inside {item.label || item.type}
        </button>
      </div>
    );
  }

  return (
    <div className="builder">
      {state.cells.map((cell, ci) => (
        <div key={ci} className="builder-cell">
          <div className="builder-cell-header">
            <span className="builder-cell-title">Cell {ci + 1}</span>
            {state.cells.length > 1 && (
              <button
                className="builder-remove-btn"
                onClick={() => removeCell(ci)}
                title="Remove cell"
              >
                ×
              </button>
            )}
          </div>

          {cell.chromosomes.map((chr, chri) => (
            <div key={chri} className="builder-replicon builder-chr">
              <div className="builder-replicon-header">
                {elementDot("chromosome")}
                <button
                  className="builder-label-btn"
                  onClick={() =>
                    openEdit(ci, { kind: "edit-chr", chrIdx: chri }, chr.label, "chromosome")
                  }
                  title="Click to edit"
                >
                  {chr.label || "(chromosome)"}
                </button>
                <button className="builder-remove-btn" onClick={() => removeChromosome(ci, chri)}>
                  ×
                </button>
              </div>
              {chr.entities.map((m, mi) => renderChrEntityItem(ci, chri, [mi], m))}
              <button
                className="builder-add-nested-btn"
                onClick={() => openModal(ci, { kind: "chr", chrIdx: chri })}
              >
                + Add entity to chromosome
              </button>
            </div>
          ))}

          {cell.entities.map((entity, mi) => {
            const colour = resolveColour(entity.type, entity.colour);
            return (
              <div key={mi} className="entity-card" style={{ borderLeftColor: colour }}>
                <div className="entity-card-header">
                  {elementDot(entity.type, entity.colour)}
                  <button
                    className="builder-label-btn entity-card-label"
                    onClick={() =>
                      openEdit(
                        ci,
                        { kind: "edit-entity", path: [mi] },
                        entity.label,
                        entity.type,
                        entity.colour,
                      )
                    }
                    title="Click to edit"
                  >
                    {entity.label || `(${entity.type})`}
                  </button>
                  <button className="builder-remove-btn" onClick={() => removeEntity(ci, [mi])}>
                    ×
                  </button>
                </div>
                {entity.entities.map((child, ni) => renderEntityItem(ci, [mi, ni], child, 1))}
                <button
                  className="entity-add-inside-btn"
                  onClick={() => openModal(ci, { kind: "entity", path: [mi] })}
                >
                  + Add inside {entity.label || entity.type}
                </button>
              </div>
            );
          })}

          <button className="builder-add-btn" onClick={() => openModal(ci, { kind: "cell" })}>
            + Add entity
          </button>
        </div>
      ))}

      <button
        className="button button-secondary"
        onClick={() => update({ cells: [...state.cells, { chromosomes: [], entities: [] }] })}
        style={{ marginTop: "0.75rem" }}
      >
        + Add cell
      </button>

      {modal && (
        <div className="builder-modal-overlay" onClick={() => setModal(null)}>
          <div className="builder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="builder-modal-title">{modal.isEdit ? "Edit entity" : "Add entity"}</div>

            {!isChrEdit && (
              <>
                <label className="builder-modal-label">Type</label>
                <select
                  className="builder-modal-select"
                  value={newType}
                  onChange={(e) => {
                    const t = e.target.value as ElementType;
                    setNewType(t);
                    // Reset colour when type changes so it defaults to new type's colour
                    if (!newColour || newColour === DEFAULT_COLOURS[newType]) setNewColour("");
                  }}
                >
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>
                      {ELEMENT_LABELS[t]}
                    </option>
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
              placeholder={`e.g. ${newType === "chromosome" ? "chr1" : newType === "plasmid" ? "pBAD" : "Tn3"}`}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && confirmAdd()}
            />

            {!isChrEdit && (
              <>
                <label className="builder-modal-label">
                  Colour{" "}
                  <span style={{ color: "var(--cellgen-text-muted)", fontWeight: 400 }}>
                    (default: {DEFAULT_COLOURS[newType] || "#888"})
                  </span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="color"
                    value={newColour || DEFAULT_COLOURS[newType] || "#888888"}
                    onChange={(e) => setNewColour(e.target.value)}
                    style={{
                      width: 36,
                      height: 28,
                      border: "1px solid var(--cellgen-border)",
                      borderRadius: 4,
                      cursor: "pointer",
                      padding: 2,
                    }}
                  />
                  <input
                    className="builder-modal-input"
                    type="text"
                    value={newColour || DEFAULT_COLOURS[newType] || "#888888"}
                    onChange={(e) => setNewColour(e.target.value)}
                    placeholder={DEFAULT_COLOURS[newType] || "#888888"}
                    style={{ flex: 1 }}
                  />
                  {newColour && newColour !== DEFAULT_COLOURS[newType] && (
                    <button
                      className="builder-remove-btn"
                      title="Reset to default"
                      onClick={() => setNewColour("")}
                      style={{ marginLeft: 0 }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </>
            )}

            <div className="builder-modal-actions">
              <button className="button button-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="button button-primary" onClick={confirmAdd}>
                {modal.isEdit ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
