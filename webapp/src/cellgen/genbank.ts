/**
 * GenBank / GFF3 parser that extracts genomic elements and generates
 * a CellGen format string.
 *
 * GenBank: parses LOCUS, DEFINITION, FEATURES sections.
 * GFF3: parses ##sequence-region and feature lines.
 */

interface RepliconInfo {
  id: string
  type: 'chromosome' | 'plasmid' | 'mge'
  label: string
  mges: string[]
}

interface GenBankFeature {
  type: string
  label: string
  start: number
  end: number
  strand: string
  children: GenBankFeature[]
}

interface GenBankRecord {
  id: string
  accession: string
  type: 'chromosome' | 'plasmid' | 'mge'
  length: number
  topology: string
  features: GenBankFeature[]
}

// Keywords used to classify replicons and features
const CHROMOSOME_KEYWORDS = ['chromosome', 'chr', 'main', 'genome']
const PLASMID_KEYWORDS = ['plasmid', 'pbad', 'p', 'contig']
const MGE_KEYWORDS = ['transposon', 'tn', 'integron', 'intg', 'insertion', 'is', 'phage', 'prophage', 'icr', 'imex']

function classifyByLabel(label: string): 'chromosome' | 'plasmid' | 'mge' {
  const l = label.toLowerCase()
  if (MGE_KEYWORDS.some(k => l.includes(k))) return 'mge'
  if (PLASMID_KEYWORDS.some(k => l.startsWith(k) || l.includes('plasmid'))) return 'plasmid'
  if (CHROMOSOME_KEYWORDS.some(k => l.includes(k))) return 'chromosome'
  return 'chromosome' // default: assume chromosome
}

function repliconToCellGen(rep: RepliconInfo): string {
  const mgeStr = rep.mges.map(m => `{}${m}`).join(', ')
  const inner = mgeStr ? ` ${mgeStr} ` : ''
  if (rep.type === 'chromosome') {
    return `(${inner})${rep.label}`
  } else {
    return `{${inner}}${rep.label}`
  }
}

// ── GenBank parser ────────────────────────────────────────────────────────────

export function parseGenBank(text: string): { cellgen: string; replicons: RepliconInfo[] } {
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
    current.features.push({ type, label, start, end, strand, children: [] })
  }

  const replicons: RepliconInfo[] = []
  const rendered: string[] = []
  records.forEach(record => {
    const roots = buildGenBankHierarchy(record.features)
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
  return { cellgen: rendered.join(', '), replicons }
}

function buildGenBankHierarchy(features: GenBankFeature[]): GenBankFeature[] {
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
  const structuralRoots = roots.filter(root => root.type !== 'gene')
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

export function parseGFF(text: string): { cellgen: string; replicons: RepliconInfo[] } {
  const replicons: Map<string, RepliconInfo> = new Map()
  const lines = text.split('\n')

  for (const line of lines) {
    if (line.startsWith('#')) {
      // ##sequence-region seqname start end
      const m = line.match(/^##sequence-region\s+(\S+)/)
      if (m) {
        const id = m[1]
        if (!replicons.has(id)) {
          replicons.set(id, { id, type: classifyByLabel(id), label: id, mges: [] })
        }
      }
      continue
    }
    if (!line.trim()) continue

    const cols = line.split('\t')
    if (cols.length < 9) continue

    const seqId = cols[0]
    const featureType = cols[2].toLowerCase()
    const attrs = cols[8]

    // Ensure replicon exists
    if (!replicons.has(seqId)) {
      replicons.set(seqId, { id: seqId, type: classifyByLabel(seqId), label: seqId, mges: [] })
    }
    const rep = replicons.get(seqId)!

    // Update type from feature type
    if (featureType === 'chromosome') rep.type = 'chromosome'
    else if (featureType === 'plasmid') rep.type = 'plasmid'

    // Extract MGEs
    if (['mobile_genetic_element', 'transposable_element', 'integron', 'transposon',
         'insertion_sequence', 'repeat_region'].includes(featureType)) {
      // Parse Name= or ID= from attributes
      const nameMatch = attrs.match(/(?:Name|ID)=([^;]+)/)
      let mgeLabel = nameMatch ? nameMatch[1] : featureType
      mgeLabel = mgeLabel.split(':').pop() ?? mgeLabel
      mgeLabel = mgeLabel.replace(/[^a-zA-Z0-9_\-. ]/g, '').trim()
      if (mgeLabel && !rep.mges.includes(mgeLabel)) {
        rep.mges.push(mgeLabel)
      }
    }
  }

  return buildResult([...replicons.values()])
}

function buildResult(replicons: RepliconInfo[]): { cellgen: string; replicons: RepliconInfo[] } {
  if (replicons.length === 0) {
    return { cellgen: '', replicons: [] }
  }

  // Group into a single cell (all replicons together)
  const parts = replicons.map(repliconToCellGen)
  return {
    cellgen: parts.join(', '),
    replicons,
  }
}

export function detectFileType(filename: string, content: string): 'genbank' | 'gff' | 'unknown' {
  if (filename.match(/\.(gb|gbk|genbank)$/i)) return 'genbank'
  if (filename.match(/\.(gff|gff3)$/i)) return 'gff'
  if (content.startsWith('LOCUS') || content.startsWith('##FASTA') === false && content.includes('     source')) return 'genbank'
  if (content.startsWith('##gff-version') || content.startsWith('##GFF')) return 'gff'
  return 'unknown'
}
