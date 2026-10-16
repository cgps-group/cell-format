/**
 * GenBank / GFF3 parser that extracts genomic elements and generates
 * a CellGen format string.
 *
 * GenBank: parses LOCUS, DEFINITION, FEATURES sections.
 * GFF3: parses ##sequence-region and feature lines.
 */

interface RepliconInfo {
  id: string
  type: 'chromosome' | 'plasmid' | 'mge' | 'unknown'
  label: string
  mges: string[]
}

export interface ImportOptions { retainUncontainedGenes?: boolean; selectedFeatureIds?: string[] }
export interface ImportResult {
  cellgen: string
  replicons: RepliconInfo[]
  retainedFeatures: number
  omittedGenes: number
  unmatchedSelectedIds: string[]
}

interface GenBankFeature {
  type: string
  label: string
  start: number
  end: number
  strand: string
  children: GenBankFeature[]
  identifiers?: string[]
  id?: string
  parentId?: string
}

interface GenBankRecord {
  id: string
  accession: string
  type: 'chromosome' | 'plasmid' | 'mge' | 'unknown'
  length: number
  topology: string
  features: GenBankFeature[]
}

// Keywords used to classify replicons and features
function classifyByLabel(label: string): 'chromosome' | 'plasmid' | 'unknown' {
  const l = label.toLowerCase()
  if (l.includes('plasmid')) return 'plasmid'
  if (l.includes('chromosome')) return 'chromosome'
  return 'unknown'
}

// ── GenBank parser ────────────────────────────────────────────────────────────

export function parseGenBank(text: string, options: ImportOptions = {}): ImportResult {
  const lines = text.split('\n')
  const records: GenBankRecord[] = []
  let current: GenBankRecord | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // New record starts with LOCUS
    if (line.startsWith('LOCUS')) {
      const parts = line.split(/\s+/)
      const id = parts[1] ?? 'unknown'
      const bpIndex = parts.findIndex(part => part === 'bp')
      const length = bpIndex > 0 ? Number(parts[bpIndex - 1]) : 0
      const topology = parts.includes('circular') ? 'circular' : parts.includes('linear') ? 'linear' : ''
      current = { id, accession: id, type: classifyByLabel(id), length, topology, features: [] }
      records.push(current)
      continue
    }

    if (line.startsWith('ACCESSION') && current) {
      current.accession = line.replace('ACCESSION', '').trim().split(/\s+/)[0] || current.id
      continue
    }

    if (line.startsWith('VERSION') && current) {
      current.accession = line.replace('VERSION', '').trim().split(/\s+/)[0] || current.accession
      continue
    }

    if (line.startsWith('DEFINITION') && current) {
      const def = line.replace('DEFINITION', '').trim().toLowerCase()
      if (def.includes('plasmid')) current.type = 'plasmid'
      else if (def.includes('chromosome')) current.type = 'chromosome'
      continue
    }

    const match = line.match(/^\s{5}(\w+)\s+(.+)$/)
    if (!match || !current) continue
    const rawType = match[1].toLowerCase()
    if (rawType === 'source') {
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\s{5}\w+\s+/.test(lines[j]) || lines[j].startsWith('ORIGIN') || lines[j].startsWith('//')) break
        if (lines[j].includes('/plasmid=')) current.type = 'plasmid'
        if (lines[j].includes('/chromosome=')) current.type = 'chromosome'
      }
      continue
    }
    if (!['mobile_element', 'transposon', 'integron', 'insertion_sequence', 'cds', 'gene'].includes(rawType)) continue
    const nums = [...match[2].matchAll(/\d+/g)].map(item => Number(item[0]))
    if (!nums.length) continue
    const start = Math.min(...nums)
    const end = Math.max(...nums)
    const strand = match[2].includes('complement') ? '-' : '+'
    const qualifiers: Record<string, string> = {}
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s{5}\w+\s+/.test(lines[j]) || lines[j].startsWith('ORIGIN') || lines[j].startsWith('//')) break
      const qualifier = lines[j].match(/\/(\w+)="([^"]*)"/)
      if (qualifier) qualifiers[qualifier[1]] = qualifier[2]
    }
    let type = rawType === 'cds' ? 'gene' : rawType
    const mobile = qualifiers.mobile_element_type?.toLowerCase() ?? ''
    if (mobile.includes('insertion sequence')) type = 'insertion_sequence'
    else if (mobile.includes('integron')) type = 'integron'
    else if (mobile.includes('transposon')) type = 'transposon'
    const labelSource = qualifiers.mobile_element_type || qualifiers.gene || qualifiers.label || qualifiers.locus_tag || qualifiers.product || type
    const label = labelSource.split(':').pop()?.trim() || type
    current.features.push({ type, label, start, end, strand, children: [],
      identifiers: [qualifiers.gene, qualifiers.locus_tag, qualifiers.label].filter((value): value is string => Boolean(value)) })
  }

  if (!records.length) throw new Error('No GenBank LOCUS records found.')
  const replicons: RepliconInfo[] = []
  const rendered: string[] = []
  let retainedFeatures = 0
  let omittedGenes = 0
  const availableIds = new Set<string>()
  records.forEach(record => {
    record.features.forEach(feature => feature.identifiers?.forEach(id => availableIds.add(id)))
    const roots = buildGenBankHierarchy(record.features, options)
    const count = (features: GenBankFeature[]): number => features.reduce((sum, feature) => sum + 1 + count(feature.children), 0)
    retainedFeatures += count(roots)
    record.features.forEach(feature => {
      if (feature.type === 'gene' && !roots.includes(feature) && !record.features.some(parent => parent.children.includes(feature))) omittedGenes++
    })
    const fullSpan = records.length === 1
      ? roots.find(root => root.type !== 'gene' && root.start === 1 && root.end === record.length)
      : undefined
    if (fullSpan) {
      rendered.push(genBankFeatureToCellGen(fullSpan, { accession: record.accession }))
      replicons.push({ id: record.accession, type: 'mge', label: fullSpan.label, mges: fullSpan.children.map(child => child.label) })
      return
    }
    const children = roots.map(root => genBankFeatureToCellGen(root)).join(', ')
    const inner = children ? `${children}` : ''
    const attrs: Record<string, string> = { type: record.type, accession: record.accession }
    if (record.topology) attrs.topology = record.topology
    if (record.length) attrs.length = String(record.length)
    const opener = record.type === 'chromosome' ? '(' : '{'
    const closer = record.type === 'chromosome' ? ')' : '}'
    rendered.push(`${opener}${inner}${closer}${safeLabel(record.accession)}${attrsToCellGen(attrs)}`)
    replicons.push({ id: record.accession, type: record.type, label: record.accession, mges: roots.map(root => root.label) })
  })
  return { cellgen: rendered.join(', '), replicons, retainedFeatures, omittedGenes,
    unmatchedSelectedIds: (options.selectedFeatureIds ?? []).filter(id => !availableIds.has(id)) }
}

function buildGenBankHierarchy(features: GenBankFeature[], options: ImportOptions = {}): GenBankFeature[] {
  const roots: GenBankFeature[] = []
  features.forEach(feature => { feature.children = [] })
  features.forEach(feature => {
    const parents = features.filter(candidate => candidate.type !== 'gene'
      && candidate.start <= feature.start && feature.end <= candidate.end
      && (candidate.start !== feature.start || candidate.end !== feature.end))
    if (!parents.length) roots.push(feature)
    else parents.sort((a, b) => (a.end - a.start) - (b.end - b.start))[0].children.push(feature)
  })
  const sort = (feature: GenBankFeature) => {
    feature.children.sort((a, b) => a.start - b.start)
    feature.children.forEach(sort)
  }
  // Keep genes nested within structural entities, but omit the thousands of
  // uncontained CDS/gene records found in a normal whole-genome annotation.
  const selected = new Set(options.selectedFeatureIds ?? [])
  const structuralRoots = roots.filter(root => root.type !== 'gene' || options.retainUncontainedGenes
    || root.identifiers?.some(identifier => selected.has(identifier)))
  structuralRoots.sort((a, b) => a.start - b.start)
  structuralRoots.forEach(sort)
  return structuralRoots
}

function safeLabel(label: string): string {
  if (/^[A-Za-z0-9_.:-]+$/.test(label)) return label
  return `"${label.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function attrsToCellGen(attrs: Record<string, string>): string {
  return '[' + Object.entries(attrs).map(([key, value]) => `${key}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(', ') + ']'
}

function genBankFeatureToCellGen(feature: GenBankFeature, extra: Record<string, string> = {}): string {
  const inner = feature.children.map(child => genBankFeatureToCellGen(child)).join(', ')
  const attrs = { type: feature.type, start: String(feature.start), end: String(feature.end), strand: feature.strand, ...extra }
  return `{${inner}}${safeLabel(feature.label)}${attrsToCellGen(attrs)}`
}

// ── GFF3 parser ───────────────────────────────────────────────────────────────

export function parseGFF(text: string, options: ImportOptions = {}): ImportResult {
  const records = new Map<string, { rep: RepliconInfo; features: GenBankFeature[]; length: number; region?: [number, number] }>()
  const get = (id: string) => {
    if (!records.has(id)) records.set(id, {
      rep: { id, type: classifyByLabel(id), label: id, mges: [] }, features: [], length: 0,
    })
    return records.get(id)!
  }
  let inFasta = false
  let fastaId = ''
  const mgeTypes = new Set(['mobile_genetic_element', 'transposable_element', 'integron',
    'transposon', 'insertion_sequence', 'repeat_region'])
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim()
    if (line === '##FASTA') { inFasta = true; return }
    if (inFasta) {
      if (line.startsWith('>')) { fastaId = line.slice(1).split(/\s+/)[0]; get(fastaId) }
      else if (line && fastaId) get(fastaId).length += line.length
      return
    }
    if (!line) return
    if (line.startsWith('##sequence-region')) {
      const parts = line.split(/\s+/)
      if (parts.length !== 4 || !/^\d+$/.test(parts[2]) || !/^\d+$/.test(parts[3]) || Number(parts[3]) < Number(parts[2]))
        throw new Error(`Invalid sequence-region at line ${index + 1}.`)
      get(parts[1]).region = [Number(parts[2]), Number(parts[3])]
      if (parts[2] === '1') get(parts[1]).length = Number(parts[3])
      return
    }
    if (line.startsWith('#')) return
    const cols = line.split('\t')
    if (cols.length !== 9) throw new Error(`Expected nine GFF3 columns at line ${index + 1}.`)
    const [id, , rawType, rawStart, rawEnd, , strand, , rawAttrs] = cols
    const start = Number(rawStart), end = Number(rawEnd)
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start)
      throw new Error(`Invalid GFF3 coordinates at line ${index + 1}.`)
    const record = get(id)
    const type = rawType.toLowerCase()
    if (type === 'chromosome' || type === 'plasmid') record.rep.type = type
    if (!mgeTypes.has(type) && type !== 'gene' && type !== 'cds') return
    const attrs = Object.fromEntries(rawAttrs.split(';').map(part => part.split('=', 2)).filter(part => part.length === 2))
    const label = decodeURIComponent(attrs.Name || attrs.gene || attrs.ID || type)
    record.features.push({ type: type === 'cds' ? 'gene' : type, label,
      start, end, strand, children: [], id: attrs.ID, parentId: attrs.Parent,
      identifiers: [attrs.ID, attrs.Name, attrs.gene, attrs.locus_tag].filter((value): value is string => Boolean(value)) })
  })
  if (!records.size) throw new Error('No GFF3 sequence records found.')
  const replicons: RepliconInfo[] = []
  const rendered: string[] = []
  let retainedFeatures = 0, omittedGenes = 0
  const availableIds = new Set<string>()
  for (const record of records.values()) {
    record.features.forEach(feature => feature.identifiers?.forEach(id => availableIds.add(id)))
    const geneIds = new Set(record.features.filter(feature => feature.type === 'gene' && feature.id && !feature.parentId)
      .map(feature => `${feature.start}:${feature.end}:${feature.id}`))
    const features = record.features.filter(feature => !(feature.type === 'gene' && feature.parentId
      && geneIds.has(`${feature.start}:${feature.end}:${feature.parentId}`)))
    const roots = buildGenBankHierarchy(features, options)
    const count = (nodes: GenBankFeature[]): number => nodes.reduce((sum, node) => sum + 1 + count(node.children), 0)
    retainedFeatures += count(roots)
    omittedGenes += features.filter(feature => feature.type === 'gene'
      && !roots.includes(feature) && !features.some(parent => parent.children.includes(feature))).length
    const rep = record.rep
    rep.mges = roots.map(root => root.label)
    replicons.push(rep)
    const attrs: Record<string, string> = { type: rep.type, accession: rep.id }
    if (record.region) { attrs.region_start = String(record.region[0]); attrs.region_end = String(record.region[1]) }
    if (record.length) attrs.length = String(record.length)
    const open = rep.type === 'chromosome' ? '(' : '{'
    const close = rep.type === 'chromosome' ? ')' : '}'
    rendered.push(`${open}${roots.map(node => genBankFeatureToCellGen(node)).join(', ')}${close}${safeLabel(rep.id)}${attrsToCellGen(attrs)}`)
  }
  return { cellgen: rendered.join(', '), replicons, retainedFeatures, omittedGenes,
    unmatchedSelectedIds: (options.selectedFeatureIds ?? []).filter(id => !availableIds.has(id)) }
}

export function detectFileType(filename: string, content: string): 'genbank' | 'gff' | 'unknown' {
  if (filename.match(/\.(gb|gbk|genbank)$/i)) return 'genbank'
  if (filename.match(/\.(gff|gff3)$/i)) return 'gff'
  if (content.startsWith('LOCUS') || content.startsWith('##FASTA') === false && content.includes('     source')) return 'genbank'
  if (content.startsWith('##gff-version') || content.startsWith('##GFF')) return 'gff'
  return 'unknown'
}
