# Real-World CellGen Examples

These examples use publicly available complete genome assemblies from NCBI RefSeq to demonstrate the CellGen format on real bacterial genomes.

---

## Example 1 — Simple chromosome-only genome
**Organism:** *Escherichia coli* K-12 MG1655  
**NCBI:** GCF_000005845.2 (NC_000913.3)  
**Structure:** Single circular chromosome, no plasmids

```
()NC_000913.3[organism="Escherichia coli K-12", length="4641652"]
```

Simplified:
```
()chromosome
```

This is the minimal CellGen representation. MG1655 is a lab strain cured of most mobile elements; it serves as a baseline reference.

---

## Example 2 — Chromosome with multiple plasmids
**Organism:** *Klebsiella pneumoniae* MGH 78578  
**NCBI:** GCF_000016305.1  
**Structure:** 1 chromosome (5.3 Mb) + 5 plasmids (pKPN3–pKPN7)

```
()chromosome, {}pKPN3, {}pKPN4, {}pKPN5, {}pKPN6, {}pKPN7
```

With accession labels:
```
()NC_009648.1, {}NC_009649.1, {}NC_009650.1, {}NC_009651.1, {}NC_009652.1, {}NC_009653.1
```

This demonstrates a clinically important multi-replicon genome typical of hospital-acquired *Klebsiella* isolates. The plasmids include resistance and virulence determinants.

---

## Example 3 — AMR plasmid with mobile elements
**Organism:** *Klebsiella pneumoniae* carrying OXA-48 plasmid (representative)  
**Structure:** Chromosome + AMR plasmid carrying a transposon with blaOXA-48

```
( {}Tn1999 )chromosome, { {}Tn1999 }pOXA-48
```

The Tn1999 transposon appears in the plasmid (primary location) and may also be integrated in the chromosome (secondary event). This shared-element notation is a key feature of the CellGen format.

---

## Example 4 — Integron-bearing plasmid
**Organism:** *Escherichia coli* with class 1 integron  
**Structure:** Chromosome + conjugative plasmid carrying a class 1 integron with gene cassettes

```
()chromosome, { {}IntI1 }pR64
```

With nested cassettes:
```
()chromosome, { { {}aadA1, {}dfrA1 }IntI1 }pR64[mob_type="MOBF", rep_type="IncI1"]
```

---

## Example 5 — Two strains sharing a plasmid (outbreak scenario)
**Scenario:** Two clinical isolates from a hospital outbreak, both carrying the same carbapenem-resistance plasmid  
**Structure:** Two distinct chromosomes, one shared plasmid

```
()isolate_A, {}pKPC ; ()isolate_B, {}pKPC
```

The semicolon separates two cells. The shared label `pKPC` indicates the same plasmid element in both cells — a key use case for epidemiological analysis.

---

## Example 6 — Complete plasmid classification with MOB-suite attributes
**Organism:** *Enterococcus faecium* clinical isolate  
**Structure:** Chromosome + 2 plasmids typed by MOB-suite

```
()chromosome, {}pEFM1[rep_type="Rep_1", mob_type="MOBV"], {}pEFM2[rep_type="Rep_3", mob_type="MOBC"]
```

Attributes capture the output of plasmid typing tools (MOB-suite, PlasmidFinder) directly in the format string.

---

## Generating these automatically

Use the Python package to convert a MOB-suite output directory:

```bash
pip install cellgen[genbank]
cellgen convert --mobsuite mob_recon_output/ --svg diagram.svg
```

Or from a Bakta-annotated GenBank:

```bash
cellgen convert assembly.gbk --svg diagram.svg
```
