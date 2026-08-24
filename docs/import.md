# GenBank and GFF3 import

```bash
cellgen convert assembly.gbk
cellgen convert annotation.gff3
```

A multi-record GenBank file is treated as one assembled cell. Records identified as chromosomes become `( )` elements; plasmid records become `{ }` elements with `type="plasmid"`.

A single record with a full-length mobile-element annotation is treated as a standalone entity. This supports TnCentral-style and Matryoshka-generated GenBank records without incorrectly labelling the element as a chromosome.

The Python importer recognises mobile elements, transposons, insertion sequences, integrons, CDS and gene features. It preserves type, coordinates and strand, then assigns each feature to its smallest strict coordinate-enclosing mobile element. Explicit sequence-record accessions, topology and length are retained as attributes. Whole-genome records often contain thousands of CDS or gene features that do not describe containment, so uncontained genes are omitted while genes inside annotated mobile elements are retained.

Import is an interpretation of annotations already present in the file. It does not discover unannotated mobile elements.
