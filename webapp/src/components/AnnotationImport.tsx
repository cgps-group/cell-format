import { FileUpload } from "./FileUpload";
interface Props {
  uploadFiles: File[];
  onFilesChange: (files: File[]) => void;
  retainUncontainedGenes: boolean;
  onRetainGenesChange: (retain: boolean) => void;
  selectedFeatureIds: string;
  onSelectedIdsChange: (ids: string) => void;
  onImport: () => void;
  uploadError: string;
  importSummary: string;
}

export function AnnotationImport({
  uploadFiles,
  onFilesChange,
  retainUncontainedGenes,
  onRetainGenesChange,
  selectedFeatureIds,
  onSelectedIdsChange,
  onImport,
  uploadError,
  importSummary,
}: Props) {
  return (
    <section id="import-panel" className="upload-row panel" aria-label="Import GenBank or GFF3">
      <p className="import-description">
        Choose an annotated GenBank (.gb, .gbk, .genbank) or GFF3 (.gff, .gff3) file. GFF3 may
        include embedded FASTA; sequence is optional when coordinates are supplied.
      </p>
      <FileUpload
        files={uploadFiles}
        onFilesChange={onFilesChange}
        label="Choose file"
        accept=".gb,.gbk,.genbank,.gff,.gff3"
        multiple={false}
        hint="All sequence records in one file are grouped into one cell. Unknown contigs remain unclassified."
      />
      <label className="import-selection">
        <input
          type="checkbox"
          checked={retainUncontainedGenes}
          onChange={(event) => onRetainGenesChange(event.target.checked)}
        />{" "}
        Retain all genes outside annotated mobile elements
      </label>
      <div className="import-gene-field">
        <label htmlFor="selected-feature-ids">
          Retain specific genes by exact annotation ID, gene name or locus tag (comma separated)
        </label>
        <input
          id="selected-feature-ids"
          className="import-ids"
          type="text"
          value={selectedFeatureIds}
          onChange={(event) => onSelectedIdsChange(event.target.value)}
          placeholder="e.g. blaKPC-2, locus_042"
        />
      </div>
      <div className="import-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onImport}
          disabled={!uploadFiles.length}
        >
          Import selected file
        </button>
      </div>
      {uploadError && (
        <div className="validation-error" role="alert">
          {uploadError}
        </div>
      )}
      {importSummary && (
        <p className="import-summary" role="status">
          {importSummary}
        </p>
      )}
    </section>
  );
}
