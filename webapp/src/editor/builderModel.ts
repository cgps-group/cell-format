import type { CellSet, ChromosomeNode, EntityNode } from "../cellgen/types";

export type ElementType =
  | "chromosome"
  | "plasmid"
  | "transposon"
  | "integron"
  | "insertion_sequence"
  | "phage"
  | "starship"
  | "gene"
  | "gene_cluster"
  | "element";

export const ELEMENT_LABELS: Record<ElementType, string> = {
  chromosome: "Chromosome",
  plasmid: "Plasmid",
  transposon: "Transposon",
  integron: "Integron",
  insertion_sequence: "Insertion sequence",
  phage: "Prophage",
  starship: "Starship",
  gene: "Gene",
  gene_cluster: "Gene cluster",
  element: "Element",
};

export const DEFAULT_COLOURS: Record<string, string> = {
  chromosome: "#3a6fba",
  plasmid: "#3a9943",
  transposon: "#e05252",
  integron: "#9b59b6",
  insertion_sequence: "#f39c12",
  phage: "#16a085",
  starship: "#6c5ce7",
  gene: "#c0392b",
  gene_cluster: "#d35400",
  element: "#aaaaaa",
};

export function resolveColour(type: ElementType, customColour?: string): string {
  return customColour || DEFAULT_COLOURS[type] || "#888";
}

// Recursive Entity item — children can themselves have children
export interface EntityItem {
  type: ElementType;
  label: string;
  colour?: string; // custom colour; undefined = use type default
  entities: EntityItem[];
}

export interface BuilderState {
  cells: Array<{
    chromosomes: Array<{ label: string; entities: EntityItem[] }>;
    entities: EntityItem[];
  }>;
}

function entityItemStr(m: EntityItem, nested = false): string {
  const inner = m.entities.map((child) => entityItemStr(child, true)).join(", ");
  const defaultCol = DEFAULT_COLOURS[m.type] || "#aaa";
  const attrParts: string[] = [];
  // A top-level plasmid remains the conventional default; every other typed
  // entity is explicit because braces do not imply a biological class.
  if (m.type !== "element" && (nested || m.type !== "plasmid")) {
    attrParts.push(`type="${m.type}"`);
  }
  if (m.colour && m.colour !== defaultCol) {
    attrParts.push(`colour="${m.colour}"`);
  }
  const attrs = attrParts.length ? `[${attrParts.join(", ")}]` : "";
  return `{${inner}}${m.label}${attrs}`;
}

export function stateToCellGen(state: BuilderState): string {
  return state.cells
    .map((cell) => {
      const parts: string[] = [];
      for (const chr of cell.chromosomes) {
        const inner = chr.entities.map((m) => entityItemStr(m, true)).join(", ");
        parts.push(`(${inner})${chr.label}`);
      }
      for (const entity of cell.entities) {
        parts.push(entityItemStr(entity, false));
      }
      return parts.join(", ");
    })
    .join(" ; ");
}

function entityNodeToItem(m: EntityNode, nested = false): EntityItem {
  const explicitType = m.attributes.type as ElementType | undefined;
  const type: ElementType = explicitType ?? (nested ? "element" : "plasmid");
  return {
    type,
    label: m.label,
    colour: m.attributes.colour || undefined,
    entities: m.children.map((child) => entityNodeToItem(child, true)),
  };
}

export function cellSetToBuilderState(cs: CellSet): BuilderState {
  return {
    cells: cs.cells.map((cell) => ({
      chromosomes: cell.replicons
        .filter((r): r is ChromosomeNode => r.kind === "chromosome")
        .map((ch) => ({
          label: ch.label,
          entities: ch.children.map((m) => entityNodeToItem(m, true)),
        })),
      entities: cell.replicons
        .filter((r): r is EntityNode => r.kind === "entity")
        .map((m) => entityNodeToItem(m, false)),
    })),
  };
}

// Path into the EntityItem tree: array of indices navigating into .entities
export type EntityPath = number[];

export function getAtPath(root: EntityItem[], path: EntityPath): EntityItem {
  let node = root[path[0]];
  for (let i = 1; i < path.length; i++) node = node.entities[path[i]];
  return node;
}

// Modal identifies *where* to add or what to edit
export type ModalTarget =
  | { kind: "cell" }
  | { kind: "chr"; chrIdx: number }
  | { kind: "chr-entity"; chrIdx: number; path: EntityPath }
  | { kind: "entity"; path: EntityPath }
  | { kind: "edit-chr"; chrIdx: number }
  | { kind: "edit-chr-entity"; chrIdx: number; path: EntityPath }
  | { kind: "edit-entity"; path: EntityPath };

export interface ModalState {
  cellIdx: number;
  target: ModalTarget;
  isEdit: boolean;
}

function cloneEntity(item: EntityItem): EntityItem {
  return { ...item, entities: item.entities.map(cloneEntity) };
}

export function cloneBuilderState(state: BuilderState): BuilderState {
  return {
    cells: state.cells.map((cell) => ({
      chromosomes: cell.chromosomes.map((chromosome) => ({
        ...chromosome,
        entities: chromosome.entities.map(cloneEntity),
      })),
      entities: cell.entities.map(cloneEntity),
    })),
  };
}
