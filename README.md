# Cell organisation format

## Objective
To describe the composition and organisation of bacterial genomes accounting for the distribution of mobile genetic elements.

## Motivation
We are becoming capable of describing the genomic composition of bacteria and identifying the location of mobile genetic elements. Long-read sequencing 

## Definition
Each element is 

### Units

* `` : cell ***(do we need this?)***
* `()` : chromosome
* `{}` : plasmid
* `<>` : transposon
* `[]` : integron
* `` : phage

## Examples

* A cell with a single chromosome and single plasmid

```
(chromosome){plasmid1}
```

* A cell with a single chromosome, a single plasmid, and another copy of the plasmid integrated in the chromosome

```
(chromosome{plasmid1}){plasmid1}
```

* A cell with a single chromosome and two plasmids, where each plasmid carry identical copies of an integron

```
(chromosome){plasmid1[integronA]}{plasmid2[integronA]}
```

* A cell with a single chromosome carrying a transposon and a plasmid carrying a transposon and an integron

```
(chromosome<transposon1>){plasmid<transposon2>[integronA]}
```

### Authors

#### Centre for Genomic Pathogen Surveilance, University of Oxford
* Julio Diaz Caballero
* David Aanensen