export const ENTITY_LABELS: Record<string, string> = {
  chromosome: 'Chromosome',
  plasmid: 'Plasmid',
  transposon: 'Transposon',
  integron: 'Integron',
  insertion_sequence: 'Insertion sequence',
  phage: 'Prophage',
  starship: 'Starship',
  gene: 'Gene',
  gene_cluster: 'Gene cluster',
  element: 'Element',
}

export const ENTITY_COLOURS: Record<string, string> = {
  chromosome: '#3a6fba',
  plasmid: '#3a9943',
  transposon: '#e05252',
  integron: '#9b59b6',
  insertion_sequence: '#f39c12',
  phage: '#16a085',
  starship: '#6c5ce7',
  gene: '#c0392b',
  gene_cluster: '#d35400',
  element: '#aaaaaa',
}

export function entityColour(type: string, colour?: string): string {
  return colour || ENTITY_COLOURS[type] || '#888888'
}
