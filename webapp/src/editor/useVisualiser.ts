import { useState, useCallback } from "react";
import { parseCellGen } from "../cellgen/parser";
import { parseGenBank, parseGFF, detectFileType } from "../cellgen/genbank";
import type { CellSet } from "../cellgen/types";
import { renderDiagram } from "./diagram";
import type { DiagramView } from "./diagram";
import { EXAMPLES } from "./examples";

export function useVisualiser() {
  const [text, setText] = useState(EXAMPLES[0].value);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [retainUncontainedGenes, setRetainUncontainedGenes] = useState(false);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState("");
  const [importSummary, setImportSummary] = useState("");
  const [showImport, setShowImport] = useState(false);
  // Only external edits replace this snapshot. Builder edits keep their local state.
  const [builderInput, setBuilderInput] = useState<CellSet | null>(() => {
    const result = parseCellGen(EXAMPLES[0].value);
    return result.ok ? result.value : null;
  });
  const [diagramView, setDiagramView] = useState<DiagramView>("circular");

  const parsed = parseCellGen(text);
  const svgOutput = parsed.ok ? renderDiagram(parsed.value, diagramView) : null;

  const handleBuilderUpdate = useCallback((cellGenString: string) => {
    setText(cellGenString);
  }, []);

  const handleTextChange = (val: string) => {
    setText(val);
    const result = parseCellGen(val);
    if (result.ok || val.trim() === "") setBuilderInput(result.ok ? result.value : null);
  };

  const loadExample = (value: string) => {
    setText(value);
    const result = parseCellGen(value);
    setBuilderInput(result.ok ? result.value : null);
  };

  const handleFilesChange = useCallback((files: File[]) => {
    setUploadFiles(files);
    setImportSummary("");
    setUploadError("");
  }, []);

  const importFile = useCallback(() => {
    const file = uploadFiles[0];
    if (!file) return;
    setUploadError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const type = detectFileType(file.name, content);
      if (type === "unknown") {
        setUploadError(
          "Unrecognised file type. Upload a GenBank (.gb, .gbk) or GFF3 (.gff, .gff3) file.",
        );
        return;
      }
      try {
        const options = {
          retainUncontainedGenes,
          selectedFeatureIds: selectedFeatureIds
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        };
        const result =
          type === "genbank" ? parseGenBank(content, options) : parseGFF(content, options);
        setText(result.cellgen);
        const unmatched = result.unmatchedSelectedIds.length
          ? ` Unmatched selected IDs: ${result.unmatchedSelectedIds.join(", ")}.`
          : "";
        setImportSummary(
          `Imported ${result.replicons.length} sequence record(s); retained ${result.retainedFeatures} features and omitted ${result.omittedGenes} uncontained genes.${unmatched}`,
        );
        const imported = parseCellGen(result.cellgen);
        setBuilderInput(imported.ok ? imported.value : null);
      } catch (error) {
        setUploadError(
          error instanceof Error ? error.message : "Could not read this annotation file.",
        );
      }
    };
    reader.onerror = () => setUploadError("Could not read this file. Try choosing it again.");
    reader.readAsText(file);
  }, [uploadFiles, retainUncontainedGenes, selectedFeatureIds]);

  return {
    text,
    parsed,
    svgOutput,
    builderInput,
    showImport,
    setShowImport,
    uploadFiles,
    uploadError,
    retainUncontainedGenes,
    selectedFeatureIds,
    importSummary,
    handleBuilderUpdate,
    handleTextChange,
    loadExample,
    handleFilesChange,
    importFile,
    diagramView,
    setDiagramView,
    onRetainGenesChange: (value: boolean) => {
      setRetainUncontainedGenes(value);
      setImportSummary("");
    },
    onSelectedIdsChange: (value: string) => {
      setSelectedFeatureIds(value);
      setImportSummary("");
    },
  };
}
