import { Link } from "react-router-dom";
import { AnnotationImport } from "./components/AnnotationImport";
import { DiagramPreview } from "./components/DiagramPreview";
import { FormatEditor } from "./components/FormatEditor";
import { InteractiveBuilder } from "./components/InteractiveBuilder";
import { ThemeToggle } from "./components/ThemeToggle";
import { EXAMPLES } from "./editor/examples";
import { useVisualiser } from "./editor/useVisualiser";
import { useDocumentExports } from "./editor/useDocumentExports";
import "./App.css";

declare const __APP_VERSION__: string;

export default function App() {
  const {
    text,
    parsed,
    svgOutput,
    builderInput,
    showImport,
    setShowImport,
    importSummary,
    handleBuilderUpdate,
    handleTextChange,
    loadExample,
    diagramView,
    setDiagramView,
    uploadFiles,
    handleFilesChange,
    retainUncontainedGenes,
    onRetainGenesChange,
    selectedFeatureIds,
    onSelectedIdsChange,
    importFile,
    uploadError,
  } = useVisualiser();
  const exports = useDocumentExports(text, svgOutput);
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-brand">
            <svg
              width="28"
              height="28"
              viewBox="0 0 32 32"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="11" cy="16" r="9" fill="#dde8f8" stroke="#3a6fba" strokeWidth="2.5" />
              <circle cx="24" cy="10" r="5" fill="#e6f5e6" stroke="#3a9943" strokeWidth="2" />
              <rect
                x="17"
                y="10"
                width="5"
                height="3"
                rx="1"
                fill="#e05252"
                transform="rotate(-30 19.5 11.5)"
              />
            </svg>
            <div>
              <span className="app-header-name">CellGen</span>
              <span className="app-header-sub">Cellular Genome Organisation Visualiser</span>
            </div>
          </div>
          <nav className="app-header-nav">
            <span className="app-header-version">v{__APP_VERSION__}</span>
            <ThemeToggle />
            <Link to="/about" className="app-header-link-btn">
              About
            </Link>
            <a href="https://github.com/cgps-group/cell-format" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {/* Examples bar */}
        <div className="examples-bar">
          {EXAMPLES.map((ex) => (
            <button key={ex.label} className="example-btn" onClick={() => loadExample(ex.value)}>
              {ex.label}
            </button>
          ))}
        </div>

        {/* Import toggle */}
        <div className="import-toggle-row">
          <button
            className="import-toggle-btn"
            aria-expanded={showImport}
            aria-controls="import-panel"
            onClick={() => setShowImport((v) => !v)}
          >
            {showImport ? "− Hide import" : "+ Import GenBank / GFF"}
          </button>
        </div>

        {showImport && (
          <AnnotationImport
            uploadFiles={uploadFiles}
            onFilesChange={handleFilesChange}
            retainUncontainedGenes={retainUncontainedGenes}
            onRetainGenesChange={onRetainGenesChange}
            selectedFeatureIds={selectedFeatureIds}
            onSelectedIdsChange={onSelectedIdsChange}
            onImport={importFile}
            uploadError={uploadError}
            importSummary={importSummary}
          />
        )}
        {!showImport && importSummary && (
          <p className="import-summary" role="status">
            {importSummary}
          </p>
        )}
        <FormatEditor
          text={text}
          parsed={parsed}
          svgOutput={svgOutput}
          onTextChange={handleTextChange}
          {...exports}
        />

        <div className="editor-layout">
          {/* Left: builder */}
          <div className="panel">
            <div className="panel-title">Interactive builder</div>
            <InteractiveBuilder onUpdate={handleBuilderUpdate} input={builderInput} />
          </div>

          <DiagramPreview svg={svgOutput} view={diagramView} onViewChange={setDiagramView} />
        </div>
      </main>

      <footer className="app-footer">
        CellGen · cellular genome organisation ·{" "}
        <a href="https://github.com/cgps-group/cell-format/issues" target="_blank" rel="noreferrer">
          Report a bug
        </a>
      </footer>
    </div>
  );
}
