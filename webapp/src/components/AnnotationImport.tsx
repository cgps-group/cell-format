import { useEffect, useRef, useState } from 'react'
import { detectFileType, parseGenBank, parseGFF } from '../cellgen/genbank'
import { FileUpload } from './FileUpload'

interface Props {
  visible: boolean
  onImport: (value: string) => void
}

export function AnnotationImport({ visible, onImport }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [retainUncontainedGenes, setRetainUncontainedGenes] = useState(false)
  const [selectedFeatureIds, setSelectedFeatureIds] = useState('')
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const request = useRef(0)
  useEffect(
    () => () => {
      request.current += 1
    },
    [],
  )

  const clearResult = () => {
    request.current += 1
    setBusy(false)
    setError('')
    setSummary('')
  }

  const importFile = async () => {
    const file = files[0]
    if (!file) return
    const currentRequest = ++request.current
    setError('')
    setSummary('')
    setBusy(true)
    try {
      const content = await file.text()
      if (request.current !== currentRequest) return
      const type = detectFileType(file.name, content)
      if (type === 'unknown')
        throw new Error(
          'Unrecognised file type. Upload a GenBank (.gb, .gbk) or GFF3 (.gff, .gff3) file.',
        )
      const options = {
        retainUncontainedGenes,
        selectedFeatureIds: selectedFeatureIds
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      }
      const result =
        type === 'genbank' ? parseGenBank(content, options) : parseGFF(content, options)
      onImport(result.cellgen)
      const unmatched = result.unmatchedSelectedIds.length
        ? ` Unmatched selected IDs: ${result.unmatchedSelectedIds.join(', ')}.`
        : ''
      setSummary(
        `Imported ${result.replicons.length} sequence record(s); retained ${result.retainedFeatures} features and omitted ${result.omittedGenes} uncontained genes.${unmatched}`,
      )
    } catch (cause) {
      if (request.current === currentRequest)
        setError(cause instanceof Error ? cause.message : 'Could not read this annotation file.')
    } finally {
      if (request.current === currentRequest) setBusy(false)
    }
  }

  if (!visible)
    return summary ? (
      <p className="import-summary" role="status">
        {summary}
      </p>
    ) : null
  return (
    <section id="import-panel" className="upload-row panel" aria-label="Import GenBank or GFF3">
      <p className="import-description">
        Choose an annotated GenBank (.gb, .gbk, .genbank) or GFF3 (.gff, .gff3) file. GFF3 may
        include embedded FASTA; sequence is optional when coordinates are supplied.
      </p>
      <FileUpload
        files={files}
        onFilesChange={(value) => {
          setFiles(value)
          clearResult()
        }}
        label="Choose file"
        accept=".gb,.gbk,.genbank,.gff,.gff3"
        multiple={false}
        hint="All sequence records in one file are grouped into one cell. Unknown contigs remain unclassified."
      />
      <label className="import-selection">
        <input
          type="checkbox"
          checked={retainUncontainedGenes}
          onChange={(event) => {
            setRetainUncontainedGenes(event.target.checked)
            clearResult()
          }}
        />{' '}
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
          onChange={(event) => {
            setSelectedFeatureIds(event.target.value)
            clearResult()
          }}
          placeholder="e.g. blaKPC-2, locus_042"
        />
      </div>
      <div className="import-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={importFile}
          disabled={!files.length || busy}
        >
          {busy ? 'Importing…' : 'Import selected file'}
        </button>
      </div>
      {error && (
        <div className="validation-error" role="alert">
          {error}
        </div>
      )}
      {summary && (
        <p className="import-summary" role="status">
          {summary}
        </p>
      )}
    </section>
  )
}
