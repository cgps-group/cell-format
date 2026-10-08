import { useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { FileUpload } from './components/FileUpload'
import { ThemeToggle } from './components/ThemeToggle'
import { parseCellGen } from './cellgen/parser'
import { renderSVG } from './cellgen/renderer'
import { renderContainmentSVG } from './cellgen/containmentRenderer'
import { parseGenBank, parseGFF, detectFileType } from './cellgen/genbank'
import { InteractiveBuilder } from './components/InteractiveBuilder'
import './App.css'

declare const __APP_VERSION__: string

const EXAMPLES = [
  { label: 'Chr + plasmid', value: '()chr1,{}pBAD' },
  { label: 'Chr with integron', value: '({}integron)my_chr' },
  { label: 'Transposon + integron', value: '( {}transposon1 )chromosome , { {}transposon2, {}integron }plasmid' },
  { label: 'Two cells', value: '()chromosome1,{}plasmidA ; ()chromosome2,{}plasmidA' },
  { label: 'KPC in Tn4401 (pKpQIL)', value: '()chromosome, { { {}blaKPC-3[type="gene"] }Tn4401[type="transposon"] }pKpQIL' },
  { label: 'OXA-48 in Tn1999', value: '()chromosome, { { {}blaOXA-48[type="gene"] }Tn1999[type="transposon"] }pOXA-48a' },
  { label: 'CTX-M on ISEcp1', value: '()chromosome, { { {}blaCTX-M-15[type="gene"] }ISEcp1[type="insertion_sequence"] }pCTX-M-3' },
  { label: 'Kp CAV1193', value: '()CAV1193, {}pCAV1193-166, {}pCAV1193-258, {}pCAV1193-78, { { {}blaKPC-3[type="gene"] }Tn4401[type="transposon"] }pKPC_CAV1193' },
  { label: 'Fungal Starship (schematic)', value: '({ {}DUF3435_captain[type="gene", role="captain"], {}cargo_gene_cluster[type="gene_cluster", role="cargo"] }Starship[type="starship", representation="schematic"])chromosome[organism="Macrophomina phaseolina"]' },
]

export default function App() {
  const [text, setText] = useState(EXAMPLES[0].value)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadError, setUploadError] = useState('')
  const [retainUncontainedGenes, setRetainUncontainedGenes] = useState(false)
  const [selectedFeatureIds, setSelectedFeatureIds] = useState('')
  const [importSummary, setImportSummary] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [builderSyncVersion, setBuilderSyncVersion] = useState(0)
  const [copied, setCopied] = useState(false)
  const [diagramView, setDiagramView] = useState<'circular' | 'containment'>('circular')
  const fromBuilder = useRef(false)

  const parsed = parseCellGen(text)
  const svgOutput = parsed.ok
    ? diagramView === 'circular'
      ? renderSVG(parsed.value)
      : renderContainmentSVG(parsed.value)
    : null

  const handleBuilderUpdate = useCallback((cellGenString: string) => {
    fromBuilder.current = true
    setText(cellGenString)
  }, [])

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    fromBuilder.current = false
    const val = e.target.value
    setText(val)
    const result = parseCellGen(val)
    if (result.ok || val.trim() === '') setBuilderSyncVersion((v) => v + 1)
  }

  const loadExample = (value: string) => {
    fromBuilder.current = false
    setText(value)
    setBuilderSyncVersion((v) => v + 1)
  }

  const handleFilesChange = useCallback((files: File[]) => {
    setUploadFiles(files)
    setImportSummary('')
    setUploadError('')
  }, [])

  const importFile = useCallback(() => {
    const file = uploadFiles[0]
    if (!file) return
    setUploadError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const type = detectFileType(file.name, content)
      if (type === 'unknown') {
        setUploadError('Unrecognised file type. Upload a GenBank (.gb, .gbk) or GFF3 (.gff, .gff3) file.')
        return
      }
      try {
        const options = { retainUncontainedGenes,
          selectedFeatureIds: selectedFeatureIds.split(',').map(value => value.trim()).filter(Boolean) }
        const result = type === 'genbank' ? parseGenBank(content, options) : parseGFF(content, options)
        fromBuilder.current = false
        setText(result.cellgen)
        const unmatched = result.unmatchedSelectedIds.length
          ? ` Unmatched selected IDs: ${result.unmatchedSelectedIds.join(', ')}.` : ''
        setImportSummary(`Imported ${result.replicons.length} sequence record(s); retained ${result.retainedFeatures} features and omitted ${result.omittedGenes} uncontained genes.${unmatched}`)
        setBuilderSyncVersion((v) => v + 1)
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Could not read this annotation file.')
      }
    }
    reader.onerror = () => setUploadError('Could not read this file. Try choosing it again.')
    reader.readAsText(file)
  }, [uploadFiles, retainUncontainedGenes, selectedFeatureIds])

  const downloadSVG = () => {
    if (!svgOutput) return
    const blob = new Blob([svgOutput], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cellgen.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPNG = () => {
    if (!svgOutput) return
    const blob = new Blob([svgOutput], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth * 2   // 2× for retina
      canvas.height = img.naturalHeight * 2
      const ctx = canvas.getContext('2d')!
      ctx.scale(2, 2)
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, img.naturalWidth, img.naturalHeight)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      const pngUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = pngUrl
      a.download = 'cellgen.png'
      a.click()
    }
    img.src = url
  }

  const downloadCellGen = () => {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cellgen.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyFormat = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-brand">
            <svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="11" cy="16" r="9" fill="#dde8f8" stroke="#3a6fba" strokeWidth="2.5"/>
              <circle cx="24" cy="10" r="5" fill="#e6f5e6" stroke="#3a9943" strokeWidth="2"/>
              <rect x="17" y="10" width="5" height="3" rx="1" fill="#e05252" transform="rotate(-30 19.5 11.5)"/>
            </svg>
            <div>
              <span className="app-header-name">CellGen</span>
              <span className="app-header-sub">Cellular Genome Organisation Visualiser</span>
            </div>
          </div>
          <nav className="app-header-nav">
            <span className="app-header-version">v{__APP_VERSION__}</span>
            <ThemeToggle />
            <Link to="/about" className="app-header-link-btn">About</Link>
            <a href="https://github.com/cgps-group/cell-format" target="_blank" rel="noreferrer">GitHub</a>
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
            onClick={() => setShowImport((v) => !v)}
          >
            {showImport ? '− Hide import' : '+ Import GenBank / GFF'}
          </button>
        </div>

        {showImport && (
          <div className="upload-row">
            <p>Choose an annotated GenBank (.gb, .gbk, .genbank) or GFF3 (.gff, .gff3) file. GFF3 may include embedded FASTA; sequence is optional when coordinates are supplied.</p>
            <FileUpload
              files={uploadFiles}
              onFilesChange={handleFilesChange}
              label="Choose file"
              accept=".gb,.gbk,.genbank,.gff,.gff3"
              multiple={false}
              hint="All sequence records in one file are grouped into one cell. Unknown contigs remain unclassified."
            />
            <label className="import-selection"><input type="checkbox" checked={retainUncontainedGenes} onChange={event => { setRetainUncontainedGenes(event.target.checked); setImportSummary('') }} /> Retain all genes outside annotated mobile elements</label>
            <label className="import-selection" htmlFor="selected-feature-ids">Retain specific genes by exact annotation ID, gene name or locus tag (comma separated)</label>
            <input id="selected-feature-ids" className="import-ids" type="text" value={selectedFeatureIds} onChange={event => { setSelectedFeatureIds(event.target.value); setImportSummary('') }} placeholder="e.g. blaKPC-2, locus_042" />
            <button className="button button-secondary" type="button" onClick={importFile} disabled={!uploadFiles.length}>Import selected file</button>
            {uploadError && <div className="validation-error" role="alert">{uploadError}</div>}
          </div>
        )}
        {importSummary && <p className="import-summary" role="status">{importSummary}</p>}

        {/* Format string — full width, above the two panels */}
        <div className="format-bar panel">
          <div className="format-bar-header">
            <div className="format-preview-label">CellGen string</div>
            <div className="format-bar-actions">
              <button className="button button-secondary" onClick={downloadCellGen} disabled={!text}>
                Download .txt
              </button>
              <button className="button button-secondary" onClick={downloadSVG} disabled={!svgOutput}>
                Download SVG
              </button>
              <button className="button button-primary" onClick={downloadPNG} disabled={!svgOutput}>
                Download PNG
              </button>
            </div>
          </div>
          <textarea
            className={`cellgen-editor format-preview-textarea${!parsed.ok ? ' error' : ''}`}
            value={text}
            onChange={handleTextareaChange}
            spellCheck={false}
            placeholder="e.g. ()chr1,{}pBAD"
            rows={2}
          />
          <div className="format-bar-below">
            {!parsed.ok ? (
              <div className="validation-error">
                <div><strong>{parsed.error.code}</strong>: {parsed.error.message}</div>
                <div>Line {parsed.error.line}, column {parsed.error.column}</div>
                {parsed.error.context && (
                  <pre>{parsed.error.context}{'\n'}{' '.repeat(Math.max(0, parsed.error.column - 1))}^</pre>
                )}
              </div>
            ) : <div />}
            <button className="copy-btn" onClick={copyFormat} disabled={!text} title="Copy to clipboard">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="editor-layout">
          {/* Left: builder */}
          <div className="panel">
            <div className="panel-title">Interactive builder</div>
            <InteractiveBuilder
              onUpdate={handleBuilderUpdate}
              syncFrom={parsed.ok ? parsed.value : null}
              syncVersion={builderSyncVersion}
            />
          </div>

          {/* Right: SVG preview */}
          <div className="panel">
            <div className="diagram-panel-header">
              <div className="panel-title">Diagram preview</div>
              <div className="view-toggle" role="group" aria-label="Diagram representation">
                <button
                  type="button"
                  className={`view-toggle-btn${diagramView === 'circular' ? ' active' : ''}`}
                  aria-pressed={diagramView === 'circular'}
                  onClick={() => setDiagramView('circular')}
                >
                  Circular
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn${diagramView === 'containment' ? ' active' : ''}`}
                  aria-pressed={diagramView === 'containment'}
                  onClick={() => setDiagramView('containment')}
                >
                  Containment
                </button>
              </div>
            </div>
            <div className="svg-viewer">
              {svgOutput ? (
                <div dangerouslySetInnerHTML={{ __html: svgOutput }} />
              ) : (
                <span style={{ color: 'var(--cellgen-text-muted)', fontSize: '0.9rem' }}>
                  Fix the format error to see the diagram
                </span>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        CellGen · cellular genome organisation ·{' '}
        <a href="https://github.com/cgps-group/cell-format/issues" target="_blank" rel="noreferrer">
          Report a bug
        </a>
      </footer>
    </div>
  )
}
