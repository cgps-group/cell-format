import type { ParseResult } from '../cellgen/types'
import { useDocumentExports } from '../editor/useDocumentExports'

interface Props {
  text: string
  parsed: ParseResult
  svg: string | null
  onTextChange: (text: string) => void
}

export function FormatEditor({ text, parsed, svg, onTextChange }: Props) {
  const exports = useDocumentExports(text, svg)
  return (
    <div className="format-bar panel">
      <div className="format-bar-header">
        <div className="format-preview-label">CellGen string</div>
        <div className="format-bar-actions">
          <button
            className="button button-secondary"
            onClick={exports.downloadText}
            disabled={!text}
          >
            Download .txt
          </button>
          <button className="button button-secondary" onClick={exports.downloadSVG} disabled={!svg}>
            Download SVG
          </button>
          <button className="button button-primary" onClick={exports.downloadPNG} disabled={!svg}>
            Download PNG
          </button>
        </div>
      </div>
      <textarea
        aria-label="CellGen string"
        className={`cellgen-editor format-preview-textarea${!parsed.ok ? ' error' : ''}`}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        spellCheck={false}
        placeholder="e.g. ()chr1,{}pBAD"
        rows={2}
      />
      {exports.error && (
        <div className="validation-error" role="alert">
          {exports.error}
        </div>
      )}
      <div className="format-bar-below">
        {!parsed.ok ? (
          <div className="validation-error">
            <div>
              <strong>{parsed.error.code}</strong>: {parsed.error.message}
            </div>
            <div>
              Line {parsed.error.line}, column {parsed.error.column}
            </div>
            {parsed.error.context && (
              <pre>
                {parsed.error.context}
                {'\n'}
                {' '.repeat(Math.max(0, parsed.error.column - 1))}^
              </pre>
            )}
          </div>
        ) : (
          <div />
        )}
        <button
          className="copy-btn"
          onClick={exports.copy}
          disabled={!text}
          title="Copy to clipboard"
        >
          {exports.copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
