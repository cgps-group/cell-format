import { renderSVG } from "../cellgen/renderer";
import { renderContainmentSVG } from "../cellgen/containmentRenderer";
import type { CellSet } from "../cellgen/types";

export type DiagramView = "circular" | "containment";

export function renderDiagram(document: CellSet, view: DiagramView): string {
  return view === "circular" ? renderSVG(document) : renderContainmentSVG(document);
}
