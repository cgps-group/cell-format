import { useState, useEffect } from "react";
import type { CellSet } from "../cellgen/types";
import {
  DEFAULT_COLOURS,
  cellSetToBuilderState,
  stateToCellGen,
  getAtPath,
  cloneBuilderState,
} from "./builderModel";
import type {
  BuilderState,
  ElementType,
  ModalState,
  ModalTarget,
  EntityPath,
} from "./builderModel";

export function useInteractiveBuilder(input: CellSet | null, onUpdate: (text: string) => void) {
  const [state, setState] = useState<BuilderState>({ cells: [{ chromosomes: [], entities: [] }] });
  const [modal, setModal] = useState<ModalState | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<ElementType>("chromosome");
  const [newColour, setNewColour] = useState("");

  useEffect(() => {
    if (input) {
      setState(cellSetToBuilderState(input));
    } else {
      setState({ cells: [{ chromosomes: [], entities: [] }] });
    }
  }, [input]);

  const update = (next: BuilderState) => {
    setState(next);
    onUpdate(stateToCellGen(next));
  };

  const openModal = (cellIdx: number, target: ModalTarget) => {
    setModal({ cellIdx, target, isEdit: false });
    setNewLabel("");
    setNewType(target.kind === "cell" ? "chromosome" : "element");
    setNewColour("");
  };

  const openEdit = (
    cellIdx: number,
    target: ModalTarget,
    currentLabel: string,
    currentType: ElementType,
    currentColour?: string,
  ) => {
    setModal({ cellIdx, target, isEdit: true });
    setNewLabel(currentLabel);
    setNewType(currentType);
    setNewColour(currentColour || "");
  };

  const confirmAdd = () => {
    if (!modal) return;
    const label = newLabel.trim();
    const defaultCol = DEFAULT_COLOURS[newType] || "#888";
    const colour = newColour && newColour !== defaultCol ? newColour : undefined;
    const next = cloneBuilderState(state);
    const cell = next.cells[modal.cellIdx];

    if (modal.isEdit) {
      const t = modal.target;
      if (t.kind === "edit-chr") {
        cell.chromosomes[t.chrIdx].label = label;
      } else if (t.kind === "edit-chr-entity") {
        const root = cell.chromosomes[t.chrIdx].entities;
        const item = t.path.length === 1 ? root[t.path[0]] : getAtPath(root, t.path);
        item.label = label;
        item.type = newType;
        item.colour = colour;
      } else if (t.kind === "edit-entity") {
        const item =
          t.path.length === 1 ? cell.entities[t.path[0]] : getAtPath(cell.entities, t.path);
        item.label = label;
        item.type = newType;
        item.colour = colour;
      }
    } else {
      if (modal.target.kind === "cell") {
        if (newType === "chromosome") {
          cell.chromosomes.push({ label, entities: [] });
        } else {
          cell.entities.push({ type: newType, label, colour, entities: [] });
        }
      } else if (modal.target.kind === "chr") {
        cell.chromosomes[modal.target.chrIdx].entities.push({
          type: newType,
          label,
          colour,
          entities: [],
        });
      } else if (modal.target.kind === "chr-entity") {
        const { chrIdx, path } = modal.target;
        const root = cell.chromosomes[chrIdx].entities;
        const target = path.length === 1 ? root[path[0]] : getAtPath(root, path);
        target.entities.push({ type: newType, label, colour, entities: [] });
      } else if (modal.target.kind === "entity") {
        const { path } = modal.target;
        const root = cell.entities;
        if (path.length === 1) {
          root[path[0]].entities.push({ type: newType, label, colour, entities: [] });
        } else {
          getAtPath(root, path).entities.push({ type: newType, label, colour, entities: [] });
        }
      }
    }

    update(next);
    setModal(null);
  };

  const removeCell = (idx: number) => {
    const cells = state.cells.filter((_, i) => i !== idx);
    update({ cells: cells.length ? cells : [{ chromosomes: [], entities: [] }] });
  };

  const removeChromosome = (ci: number, chri: number) => {
    const next = cloneBuilderState(state);
    next.cells[ci].chromosomes.splice(chri, 1);
    update(next);
  };

  const removeEntity = (ci: number, path: EntityPath) => {
    const next = cloneBuilderState(state);
    const root = next.cells[ci].entities;
    if (path.length === 1) {
      root.splice(path[0], 1);
    } else {
      const parent = getAtPath(root, path.slice(0, -1));
      parent.entities.splice(path[path.length - 1], 1);
    }
    update(next);
  };

  const removeChrNestedEntity = (ci: number, chrIdx: number, path: EntityPath) => {
    const next = cloneBuilderState(state);
    const root = next.cells[ci].chromosomes[chrIdx].entities;
    if (path.length === 1) {
      root.splice(path[0], 1);
    } else {
      const parent = getAtPath(root, path.slice(0, -1));
      parent.entities.splice(path[path.length - 1], 1);
    }
    update(next);
  };

  const isChrEdit = modal?.target.kind === "edit-chr";

  const typeOptions =
    modal?.target.kind === "cell"
      ? ([
          "chromosome",
          "plasmid",
          "starship",
          "transposon",
          "integron",
          "insertion_sequence",
          "phage",
          "gene",
          "gene_cluster",
          "element",
        ] as ElementType[])
      : ([
          "element",
          "gene",
          "gene_cluster",
          "transposon",
          "integron",
          "insertion_sequence",
          "phage",
          "starship",
          "plasmid",
        ] as ElementType[]);

  return {
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
  };
}
