# Cell organisation format - Wolvercote format

## Objective
To describe the composition and organisation of bacterial genomes focusing on the distribution of mobile genetic elements.

## Motivation
Long-read sequencing has enabled the description of the complete genomic composition of bacterial cells and the identification of the location of its mobile genetic elements. Through hybrid assemblies, we are capable of characterizing complete plasmids and accurately describing transposons, previously a challenging task due to its repetitive nature. As we are able to better understand the genomic organization of bacterial cells, we need a common language to describe the location of its mobile genetic elements in the context of all its replicons. For this purpose, we present a computer-friendly format, inspired by the Newick format for trees, which aims to be readable to the human eye.

## Definition

Describe main format

## Annotation

Describe the ability to annotate using `:`

### Grammar

```
CellSet → Cell | Cell ";" CellSet
Cell → CellContent | CellContent "," Cell
CellContent → ChromosomeSet | ChromosomeSet "," NonChromosomeSet
ChromosomeSet → Chromosome | Chromosome "," ChromosomeSet
NonChromosomeSet → NonChromosome | NonChromosome ", NonChromosomeSet
Chromosome → "(" NonChromosome ")" Label | "(" NonChromosome ")" Label AttributeSet
NonChromosome →  empty | "{" NonChromosome "}" Label | "{" NonChromosome "}" Label AttributeSet
Label → empty | string
```

## Examples

### Example 1

* A cell with a single chromosome carrying an integron

<img src="img/sample-1.png" alt="drawing" width="40%"/>

```
({}integron)my_chr
```

### Example 2

* A cell with a single chromosome and single plasmid

<img src="img/sample-2.png" alt="drawing" width="40%"/>

```
()chr1,{}pBAD
```

### Example 3

* A cell with a single chromosome, a single plasmid, and another copy of the plasmid integrated in the chromosome

<img src="img/sample-3.png" alt="drawing" width="40%"/>

```
({}plasmid1)chromosome,{}plasmid1
```

### Example 4

* A cell with a single chromosome and two plasmids, where each plasmid carry identical copies of an integron

<img src="img/sample-4.png" alt="drawing" width="40%"/>

```
()chromosome, { {}integronA }plasmid1, { {}integronA }plasmid2
```

### Example 5

* A cell with a single chromosome carrying a transposon and a plasmid carrying a transposon and an integron

<img src="img/sample-5.png" alt="drawing" width="40%"/>

```
( {}transposon1 )chromosome , { {}transposon2, {}integron }plasmid
```

### Example 6

* Two cells from different species but both carrying the same plasmid

<img src="img/sample-6.png" alt="drawing" width="40%"/>

```
()chromosome1,{}plasmidA ; ()chromosome2,{}plasmidA
```

### Example 7

* A cell with a single chromosome with one attribute

```
()chromosome[attribute="value"]
```

### Example 8

* A cell with a single chromosome with two attributes

```
()chromosome[attribute="value", attribute 2="value a,value b,value c"]
```

### Authors

#### Centre for Genomic Pathogen Surveilance, University of Oxford
* Julio Diaz Caballero
* Nabil-Fareed Alikhan
* Khalil AbuDahab
* David Aanensen