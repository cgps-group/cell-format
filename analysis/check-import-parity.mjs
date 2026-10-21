// Compare actual imported trees, including every label, coordinate and attribute.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [workdir, moduleDir] = process.argv.slice(2)
if (!workdir || !moduleDir) throw new Error('Usage: node analysis/check-import-parity.mjs WORKDIR COMPILED_MODULE_DIR')
const { parseGenBank, parseGFF } = await import(pathToFileURL(path.resolve(moduleDir, 'genbank.js')))
const { parseCellGen } = await import(pathToFileURL(path.resolve(moduleDir, 'parser.js')))
const cases = JSON.parse(fs.readFileSync(path.join(workdir, 'parity-inputs.json'), 'utf8'))
const tree = node => ({ label: node.label, attributes: node.attributes, children: node.children.map(tree) })
for (const entry of cases) {
  const options = { retainUncontainedGenes: entry.mode === 'all-genes' }
  if (entry.mode.startsWith('selected')) {
    options.selectedFeatureIds = entry.selected_ids ?? [entry.mode === 'selected-gene' ? 'TEST_00002_gene' : 'TEST_00002']
  }
  const convert = entry.file.endsWith('.gbk') ? parseGenBank : parseGFF
  const converted = convert(fs.readFileSync(path.join(workdir, entry.file), 'utf8'), options)
  const result = parseCellGen(converted.cellgen)
  assert.equal(result.ok, true, `${entry.sample}: CellGen parse failed`)
  assert.deepEqual(tree(result.value.cells[0].replicons[0]), entry.tree,
    `${entry.sample} / ${entry.source} / ${entry.mode}`)
  assert.equal(converted.retainedFeatures, entry.retained)
  assert.deepEqual(converted.unmatchedSelectedIds, [])
}
console.log(`Browser/Python: ${cases.length} full-tree comparisons passed`)
