import { useRef } from "react";

import type { parseCellGen } from "../cellgen/parser";

interface Props {
  text: string;
  parsed: ReturnType<typeof parseCellGen>;
  svgOutput: string | null;
  onTextChange: (text: string) => void;
  onClear: () => void;
  copied: boolean;
  downloadCellGen: () => void;
  downloadSVG: () => void;
  downloadPNG: () => void;
  copyFormat: () => void;
}

export function FormatEditor({
  text,
  parsed,
  svgOutput,
  onTextChange,
  onClear,
  copied,
  downloadCellGen,
  downloadSVG,
  downloadPNG,
  copyFormat,
}: Props) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const hasError = !parsed.ok && !!text.trim();

  return (
    <div className="format-bar panel">
      <div className="format-bar-header">
        <div className="format-preview-label">CellGen string</div>
        <div className="format-bar-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              onClear();
              editor.current?.focus();
            }}
          >
            Clear
          </button>
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
        ref={editor}
        className={`cellgen-editor format-preview-textarea${hasError ? " error" : ""}`}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        spellCheck={false}
        placeholder="e.g. ()chr1,{}pBAD"
        rows={2}
      />
      <div className="format-bar-below">
        {!parsed.ok && hasError ? (
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
                {"\n"}
                {" ".repeat(Math.max(0, parsed.error.column - 1))}^
              </pre>
            )}
          </div>
        ) : (
          <div />
        )}
        <button
          className="copy-btn"
          onClick={copyFormat}
          disabled={!text}
          title="Copy to clipboard"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
