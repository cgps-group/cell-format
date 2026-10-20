export const EXAMPLES = [
  { label: 'Chr + plasmid', value: '()chr1,{}pBAD' },
  { label: 'Chr with integron', value: '({}integron)my_chr' },
  {
    label: 'Transposon + integron',
    value: '( {}transposon1 )chromosome , { {}transposon2, {}integron }plasmid',
  },
  { label: 'Two cells', value: '()chromosome1,{}plasmidA ; ()chromosome2,{}plasmidA' },
  {
    label: 'KPC in Tn4401 (pKpQIL)',
    value: '()chromosome, { { {}blaKPC-3[type="gene"] }Tn4401[type="transposon"] }pKpQIL',
  },
  {
    label: 'OXA-48 in Tn1999',
    value: '()chromosome, { { {}blaOXA-48[type="gene"] }Tn1999[type="transposon"] }pOXA-48a',
  },
  {
    label: 'CTX-M on ISEcp1',
    value:
      '()chromosome, { { {}blaCTX-M-15[type="gene"] }ISEcp1[type="insertion_sequence"] }pCTX-M-3',
  },
  {
    label: 'Kp CAV1193',
    value:
      '()CAV1193, {}pCAV1193-166, {}pCAV1193-258, {}pCAV1193-78, { { {}blaKPC-3[type="gene"] }Tn4401[type="transposon"] }pKPC_CAV1193',
  },
  {
    label: 'Fungal Starship',
    value:
      '({ {}DUF3435_captain[type="gene", role="captain"], {}cargo_gene_cluster[type="gene_cluster", role="cargo"] }Starship[type="starship", representation="schematic"])chromosome[organism="Macrophomina phaseolina"]',
  },
]
