# Web visualiser

Open [cell-format.vercel.app](https://cell-format.vercel.app/) to create and view CellGen records. The application runs in your browser.

## Create or edit a record

Choose an example, paste a record into the CellGen string field, or use the interactive builder to add chromosomes and other entities. Add an entity inside another to record containment. Click a label to edit it.

The string and diagram update as you edit. Invalid syntax produces an error with its line and column. Switch between **Circular** and **Containment** to view the same record in either representation.

Use **Clear** beside the download buttons to start again. It clears the record, diagram, selected file, import options and import messages, then returns focus to the CellGen string field. Your theme and diagram view stay selected.

## Import annotations

Expand **Import GenBank / GFF**, choose an annotated file and click **Import selected file**. You can retain all genes outside annotated mobile elements, or select specific genes by annotation ID, gene name or locus tag.

All sequence records in one file are grouped into one cell. See the [import guide](import.md) for supported annotations, classification rules and options.

## Export

Download the current record as plain text, or export the selected diagram view as SVG or PNG. Use **Copy** to copy the CellGen string to the clipboard.

## Run locally

From a checkout of the repository:

```bash
cd webapp
npm ci
npm run dev
```

Open the local address printed by the development server.

To build the app:

```bash
npm run build
```

The output is written to `webapp/dist/`. Run `npm run check` for the unit tests, lint checks and production build. See the [TypeScript guide](typescript.md) for the parser, renderers and visualiser architecture.

## Regenerate the README images

With the local visualiser running, open another terminal in `webapp/` and run:

```bash
node scripts/render-readme-examples.mjs http://localhost:5173
```

Use the server's actual address if it uses a different port. The script enters each README example into the visualiser and downloads its SVG and PNG exports into `docs/images/`. The README displays the PNG files; the SVG files are also available for reuse.
