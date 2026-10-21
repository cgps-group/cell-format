import type { DiagramView } from "../editor/diagram";

interface Props {
  svg: string | null;
  empty?: boolean;
  view: DiagramView;
  onViewChange: (view: DiagramView) => void;
}

export function DiagramPreview({ svg, view, onViewChange, empty = false }: Props) {
  return (
    <div className="panel">
      <div className="diagram-panel-header">
        <div className="panel-title">Diagram preview</div>
        <div className="view-toggle" role="group" aria-label="Diagram representation">
          <button
            type="button"
            className={`view-toggle-btn${view === "circular" ? " active" : ""}`}
            aria-pressed={view === "circular"}
            onClick={() => onViewChange("circular")}
          >
            Circular
          </button>
          <button
            type="button"
            className={`view-toggle-btn${view === "containment" ? " active" : ""}`}
            aria-pressed={view === "containment"}
            onClick={() => onViewChange("containment")}
          >
            Containment
          </button>
        </div>
      </div>
      <div className="svg-viewer">
        {svg ? (
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <span style={{ color: "var(--cellgen-text-muted)", fontSize: "0.9rem" }}>
            {empty
              ? "Add an entity or enter a CellGen string to see the diagram"
              : "Fix the format error to see the diagram"}
          </span>
        )}
      </div>
    </div>
  );
}
