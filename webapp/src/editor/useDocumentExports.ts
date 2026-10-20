import { useEffect, useRef, useState } from 'react'
import { diagramPNG, downloadBlob } from '../utils/downloads'

export function useDocumentExports(text: string, svg: string | null) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(timer.current)
    }
  }, [])
  useEffect(() => {
    setCopied(false)
    clearTimeout(timer.current)
  }, [text])

  const reportError = (cause: unknown) => {
    if (mounted.current)
      setError(cause instanceof Error ? cause.message : 'Could not export this document.')
  }
  const copy = async () => {
    setError('')
    try {
      await navigator.clipboard.writeText(text)
      if (!mounted.current) return
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch (cause) {
      reportError(cause)
    }
  }
  const downloadPNG = async () => {
    if (!svg) return
    setError('')
    try {
      const blob = await diagramPNG(svg)
      if (mounted.current) downloadBlob(blob, 'cellgen.png')
    } catch (cause) {
      reportError(cause)
    }
  }
  return {
    copied,
    error,
    copy,
    downloadPNG,
    downloadText: () => downloadBlob(new Blob([text], { type: 'text/plain' }), 'cellgen.txt'),
    downloadSVG: () => {
      if (svg) downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'cellgen.svg')
    },
  }
}
