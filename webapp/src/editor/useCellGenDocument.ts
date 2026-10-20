import { useCallback, useMemo, useReducer } from 'react'
import { parseCellGen } from '../cellgen/parser'
import { createDocumentState, editorReducer, textChange } from './document'

export function useCellGenDocument(initialText: string) {
  const [state, dispatch] = useReducer(editorReducer, initialText, createDocumentState)
  const parsed = useMemo(() => parseCellGen(state.text), [state.text])
  const replaceText = useCallback((text: string) => dispatch(textChange(text)), [])
  return { ...state, parsed, replaceText, dispatch }
}
