/** CellGen 0.1 recursive-descent parser. */

import type { Attributes, Cell, CellSet, ChromosomeNode, EntityNode, ParseError, ParseResult } from './types'

const BARE_LABEL = /[A-Za-z0-9_.:-]/
const KEY_START = /[A-Za-z_]/
const KEY_CHAR = /[A-Za-z0-9_.:-]/

interface InternalError extends ParseError { kind: 'error' }

class Parser {
  private pos = 0
  constructor(private readonly input: string) {}

  private skipWS(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) this.pos++
  }

  private peek(): string {
    this.skipWS()
    return this.input[this.pos] ?? ''
  }

  private take(): string {
    this.skipWS()
    return this.input[this.pos++] ?? ''
  }

  private error(code: string, message: string, expected = '', found?: string, position?: number): InternalError {
    const at = position ?? this.pos
    const actual = found ?? this.input[at] ?? ''
    const before = this.input.slice(0, at)
    const line = before.split('\n').length
    const lineStart = before.lastIndexOf('\n') + 1
    const lineEndFound = this.input.indexOf('\n', at)
    const lineEnd = lineEndFound < 0 ? this.input.length : lineEndFound
    return {
      kind: 'error', code, message, position: at, line, column: at - lineStart + 1,
      found: actual, expected, context: this.input.slice(lineStart, lineEnd),
    }
  }

  private expect(char: string, code: string): void {
    this.skipWS()
    const at = this.pos
    const got = this.take()
    if (got !== char) {
      throw this.error(code, `Expected '${char}' but found '${got || 'end of input'}'`, char, got, at)
    }
  }

  parse(): CellSet {
    const cells: Cell[] = [this.parseCell()]
    while (this.peek() === ';') {
      this.take()
      if (!this.peek()) throw this.error('TRAILING_SEPARATOR', 'A semicolon must be followed by another cell', '(')
      cells.push(this.parseCell())
    }
    if (this.peek()) {
      const token = this.peek()
      throw this.error('UNEXPECTED_TOKEN', `Unexpected character '${token}' after the cell`, '', token)
    }
    return { cells }
  }

  private parseCell(): Cell {
    const replicons = [this.parseReplicon()]
    while (true) {
      const token = this.peek()
      if (token === ',') {
        this.take()
        if (!['(', '{'].includes(this.peek())) {
          throw this.error('TRAILING_SEPARATOR', 'A comma must be followed by a chromosome or entity', '( or {')
        }
        replicons.push(this.parseReplicon())
      } else if (token === '' || token === ';') {
        break
      } else if (token === '(' || token === '{') {
        throw this.error('MISSING_SEPARATOR', "Expected ',' between cellular elements", ',')
      } else {
        break
      }
    }
    return { replicons }
  }

  private parseReplicon(): ChromosomeNode | EntityNode {
    const token = this.peek()
    if (token === '(') return this.parseChromosome()
    if (token === '{') return this.parseEntity()
    throw this.error('EXPECTED_ELEMENT',
      `Expected '(' for a chromosome or '{' for an entity but found '${token || 'end of input'}'`, '( or {')
  }

  private parseChromosome(): ChromosomeNode {
    this.expect('(', 'EXPECTED_CHROMOSOME')
    const children = this.parseChildren(')')
    this.expect(')', 'UNCLOSED_CHROMOSOME')
    return { kind: 'chromosome', label: this.parseLabel(), children, attributes: this.parseAttributes() }
  }

  private parseEntity(): EntityNode {
    this.expect('{', 'EXPECTED_ENTITY')
    const children = this.parseChildren('}')
    this.expect('}', 'UNCLOSED_ENTITY')
    return { kind: 'entity', label: this.parseLabel(), children, attributes: this.parseAttributes() }
  }

  private parseChildren(closer: ')' | '}'): EntityNode[] {
    const children: EntityNode[] = []
    if (this.peek() === closer) return children
    if (this.peek() === '(') throw this.error('NESTED_CHROMOSOME', 'Chromosomes cannot be nested', '{')
    if (!this.peek()) {
      const code = closer === ')' ? 'UNCLOSED_CHROMOSOME' : 'UNCLOSED_ENTITY'
      throw this.error(code, `Unclosed container; expected '${closer}'`, closer)
    }
    children.push(this.parseEntity())
    while (true) {
      const token = this.peek()
      if (token === closer) return children
      if (token === ',') {
        this.take()
        if (this.peek() === closer) {
          throw this.error('TRAILING_SEPARATOR', `A comma cannot appear immediately before '${closer}'`, '{')
        }
        if (this.peek() === '(') throw this.error('NESTED_CHROMOSOME', 'Chromosomes cannot be nested', '{')
        children.push(this.parseEntity())
      } else if (!token) {
        const code = closer === ')' ? 'UNCLOSED_CHROMOSOME' : 'UNCLOSED_ENTITY'
        throw this.error(code, `Unclosed container; expected '${closer}'`, closer)
      } else if (token === '{') {
        throw this.error('MISSING_SEPARATOR', "Expected ',' between contained entities", ',')
      } else {
        throw this.error('UNEXPECTED_TOKEN', `Expected ',' or '${closer}' but found '${token}'`, `, or ${closer}`)
      }
    }
  }

  private parseLabel(): string {
    this.skipWS()
    if (this.input[this.pos] === '"') return this.parseQuoted('label')
    const start = this.pos
    while (this.pos < this.input.length && BARE_LABEL.test(this.input[this.pos])) this.pos++
    return this.input.slice(start, this.pos)
  }

  private parseAttributes(): Attributes {
    if (this.peek() !== '[') return {}
    this.take()
    if (this.peek() === ']') {
      throw this.error('EMPTY_ATTRIBUTES', 'An attribute block must contain a key-value pair', 'attribute key')
    }
    const attrs: Attributes = {}
    while (true) {
      const key = this.parseKey()
      if (Object.prototype.hasOwnProperty.call(attrs, key)) {
        throw this.error('DUPLICATE_ATTRIBUTE', `Attribute '${key}' is repeated`, '', key)
      }
      this.expect('=', 'MISSING_EQUALS')
      if (this.peek() !== '"') {
        throw this.error('UNQUOTED_VALUE', 'Attribute values must be enclosed in double quotes', '"')
      }
      attrs[key] = this.parseQuoted('attribute value')
      const token = this.peek()
      if (token === ']') {
        this.take()
        return attrs
      }
      if (token !== ',') {
        if (!token) throw this.error('UNCLOSED_ATTRIBUTES', "Unclosed attribute block; expected ']'", ']')
        throw this.error('MISSING_SEPARATOR', "Expected ',' between attributes", ',')
      }
      this.take()
      if (this.peek() === ']') {
        throw this.error('TRAILING_SEPARATOR', "A comma cannot appear immediately before ']'", 'attribute key')
      }
    }
  }

  private parseKey(): string {
    this.skipWS()
    const start = this.pos
    if (!KEY_START.test(this.input[this.pos] ?? '')) {
      throw this.error('INVALID_ATTRIBUTE_KEY', 'Attribute keys must start with a letter or underscore', 'attribute key')
    }
    this.pos++
    while (this.pos < this.input.length && KEY_CHAR.test(this.input[this.pos])) this.pos++
    return this.input.slice(start, this.pos)
  }

  private parseQuoted(role: string): string {
    this.expect('"', 'EXPECTED_QUOTE')
    let value = ''
    const escapes: Record<string, string> = { '"': '"', '\\': '\\', n: '\n', r: '\r', t: '\t' }
    while (this.pos < this.input.length) {
      const char = this.input[this.pos++]
      if (char === '"') return value
      if (char !== '\\') {
        value += char
        continue
      }
      if (this.pos >= this.input.length) {
        throw this.error('INVALID_ESCAPE', `Unfinished escape in ${role}`, 'escaped character')
      }
      const escaped = this.input[this.pos++]
      if (!(escaped in escapes)) {
        throw this.error('INVALID_ESCAPE', `Unsupported escape '\\${escaped}' in ${role}`, '', escaped, this.pos - 1)
      }
      value += escapes[escaped]
    }
    throw this.error('UNCLOSED_QUOTE', `Unclosed ${role}; expected a closing double quote`, '"')
  }
}

export function parseCellGen(input: string): ParseResult {
  if (!input.trim()) {
    return { ok: false, error: { code: 'EMPTY_INPUT', message: 'Input is empty', position: 0,
      line: 1, column: 1, found: '', expected: '', context: '' } }
  }
  try {
    return { ok: true, value: new Parser(input).parse() }
  } catch (error) {
    if (error && typeof error === 'object' && 'kind' in error && error.kind === 'error') {
      const diagnostic = error as InternalError
      return { ok: false, error: {
        code: diagnostic.code, message: diagnostic.message, position: diagnostic.position,
        line: diagnostic.line, column: diagnostic.column, found: diagnostic.found,
        expected: diagnostic.expected, context: diagnostic.context,
      } }
    }
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: String(error), position: 0,
      line: 1, column: 1, found: '', expected: '', context: '' } }
  }
}

export function validateCellGen(input: string): string[] {
  const result = parseCellGen(input)
  if (result.ok) return []
  const caret = ' '.repeat(Math.max(0, result.error.column - 1)) + '^'
  return [`${result.error.code}: ${result.error.message} (line ${result.error.line}, column ${result.error.column})\n${result.error.context}\n${caret}`]
}
