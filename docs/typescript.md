# TypeScript parser

The web visualiser is built on the reference TypeScript implementation in [`webapp/src/cellgen`](https://github.com/cgps-group/cell-format/tree/main/webapp/src/cellgen). The source entry point is `index.ts`.

```typescript
import { parseCellGen, toCellGen } from './cellgen'

const result = parseCellGen('()chromosome,{}pKPC[type="plasmid"]')

if (result.ok) {
  console.log(result.value.cells[0].replicons)
  console.log(toCellGen(result.value))
} else {
  console.error(result.error.code)
  console.error(result.error.line, result.error.column)
  console.error(result.error.context)
}
```

`parseCellGen()` returns a discriminated result rather than throwing for invalid user input:

```typescript
type ParseResult =
  | { ok: true; value: CellSet }
  | { ok: false; error: ParseError }
```

The public entry point exports:

- `parseCellGen()` and `validateCellGen()`
- `toCellGen()`
- `parseGenBank()`, `parseGFF()` and `detectFileType()`
- `renderSVG()` and `renderContainmentSVG()`
- the CellGen node and diagnostic types

The TypeScript implementation is currently repository source and is not published as an npm package. Applications can use it from a checkout, while independent implementations should follow the [format specification](specification.md) and the shared conformance cases in `tests/test_suite.json`.

## Check the implementation

```bash
cd webapp
npm install
npm run check
```

This runs the parser, serialiser, importer and renderer tests, linting and the production build.
