# Published resistance-associated structures

These CellGen records contain selected features from three published structures:

| Record | Sequence accession | Publication |
| --- | --- | --- |
| Tn21 | [AF071413.3](https://www.ebi.ac.uk/ena/browser/view/AF071413.3) | [Liebert et al., 1999](https://doi.org/10.1128/MMBR.63.3.507-522.1999) |
| pKpQIL | [GU595196.1](https://www.ebi.ac.uk/ena/browser/view/GU595196.1) | [Leavitt et al., 2010](https://doi.org/10.1128/AAC.00175-10) |
| pOXA-48a | [JN626286.1](https://www.ebi.ac.uk/ena/browser/view/JN626286.1) | [Poirel et al., 2012](https://doi.org/10.1128/AAC.05289-11) |

The records were curated from the cited publications and accession-version annotations. Coordinates are one-based and inclusive. The aadA1 cassette and CDS are separate nested entities. Tn21 is represented as a standalone transposon; no plasmid parent is inferred. For pOXA-48a, the publication establishes the Tn1999 arrangement and two IS1999 copies; coordinates for those elements are omitted because the sequence record does not specify their complete boundaries. The sequence record uses the plasmid label pOXA-48, retained in `source_label`.

Run the query script from the repository checkout with Python 3.10 or later; no additional packages are required:

```sh
python3 examples/published_structures/query_structures.py
```

The script parses the three records using the repository's Python package and regenerates `query-results.json` and `query-results.tsv`. It selects genes by exact label and retrieves enclosing entities from their ancestor paths. Ordered ancestor queries allow intervening entities. A missing match means that the requested feature is not represented in these selected records.

`sources.json` records the source URLs and SHA256 hashes of the accession-version EMBL files used during curation. Figure 3 exports are in `figures/Figure_3_published_structures.*`.
