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

## Visualiser architecture

The website composes the import panel, format editor, interactive builder and diagram preview in `webapp/src/App.tsx`.

- `src/editor/document.ts` owns typed document operations and immutable nested edits. Editor-only IDs keep cards stable when siblings are removed. The model extends the parser's node types, retaining all attributes and replicon order; `toCellGen()` is the only writer of CellGen syntax.
- `src/editor/useCellGenDocument.ts` connects that model to React. Valid text and imports replace the document. Incomplete text remains a draft while the builder retains its previous model. Clearing the text explicitly clears the builder. Builder actions produce a canonical string directly, without synchronisation effects or version counters.
- `src/components/InteractiveBuilder.tsx` displays the document and emits named operations. `EntityEditor.tsx` owns the temporary edit form. Custom entity types remain available when editing imported records.
- `src/components/AnnotationImport.tsx` owns file selection and import feedback. File reads superseded by a new selection or options change are ignored.
- `src/editor/diagram.ts` prepares the selected SVG for both preview and export. Browser download and PNG conversion live in `src/utils/downloads.ts`; clipboard and export feedback live in `src/editor/useDocumentExports.ts`.

The parser, importers and renderers remain independent of React. The layout and available controls are unchanged by this separation.

Browser checks start their own server rather than reusing an unrelated local development server. If port 5173 is occupied:

```bash
cd webapp
CELLGEN_TEST_PORT=5175 npm run test:e2e
```
