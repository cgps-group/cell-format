import { useId } from 'react'

interface FileUploadProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  label: string
  accept?: string
  multiple?: boolean
  hint?: string
}

export function FileUpload({
  files,
  onFilesChange,
  label,
  accept,
  multiple = false,
  hint,
}: FileUploadProps) {
  const inputId = useId()

  return (
    <div className="file-upload">
      <label className="file-upload-label" htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        className="file-upload-input"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))}
      />
      {hint && <p className="file-upload-hint">{hint}</p>}
      {files.length > 0 && <p className="file-upload-selection">Selected: {files.map((file) => file.name).join(', ')}</p>}
    </div>
  )
}
