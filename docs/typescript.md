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

- `src/editor/useVisualiser.ts` owns the text draft, import options and feedback, selected diagram view and builder input snapshot. Valid external edits replace that snapshot; incomplete text keeps the previous builder contents. Builder edits update the text without reloading the builder.
- `src/editor/builderModel.ts` contains the existing builder data shapes, conversions and path operations, independent of React. `src/editor/useInteractiveBuilder.ts` owns builder edits and temporary modal state. `src/components/InteractiveBuilder.tsx` renders the existing cards and modal.
- `src/components/AnnotationImport.tsx`, `FormatEditor.tsx` and `DiagramPreview.tsx` receive explicit inputs and callbacks. Their markup and controls are unchanged.
- `src/editor/diagram.ts` selects the existing renderer for both preview and export. `src/editor/useDocumentExports.ts` contains the existing browser downloads and clipboard feedback.

This is a code organisation and style refactor. It preserves the existing builder conversion rules, import handling, download encoding and clipboard timing. The parser, importers, renderers, styles and example records are unchanged.

Browser checks start their own server rather than reusing an unrelated local development server. If port 5173 is occupied:

```bash
cd webapp
CELLGEN_TEST_PORT=5175 npm run test:e2e
```

To compare screenshots, controls, editor workflows and exported file bytes against an independently served baseline checkout, start that checkout on a separate port and run:

```bash
CELLGEN_TEST_PORT=5177 CELLGEN_BASELINE_URL=http://127.0.0.1:5176 npm run test:e2e -- --grep 'unchanged interface'
```

The optional comparison suite covers desktop and narrow screens in both themes. It is skipped when no baseline URL is supplied.
