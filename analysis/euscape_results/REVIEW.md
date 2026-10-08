# EuSCAPE KPC carrier evidence for expert review

This pack reconstructs the ten-genome Figure 3 analysis from **saved** EuSCAPE contig sequences, detector tables and Matryoshka JSON produced in the separate 25 August 2026 analysis checkout. It is not a new run of AMRFinder+, ISEScan, IntegronFinder or the reference scan. The original EuSCAPE archive is not redistributed here; its recorded SHA-256 is in `../euscape_evidence/archive.sha256`. The selected source contig IDs and KPC coordinates are in `../euscape_evidence/screening.tsv`; these are archive contig identifiers, not public accession numbers. The ten exact contig sequences, detector calls and Matryoshka records are in `../euscape_evidence/`.

## Selection and reconstruction

`prepare_euscape.py` screens `_unicycler.gff` members of the archive for exactly one `KPC` gene/product match, a largest contig at least 5 Mb, and a KPC-bearing contig below 500 kb. It orders eligible assemblies by contig count and then sample ID, taking ten. This is a convenience screen for resolved examples, not a random or epidemiologically representative sample. The screening table records excluded as well as selected candidates. The source archive hash is `4e87c4f65e90ded591ef06c8d2e24467d54dc61a44c1aed6bb56a07cb25aa740`.

The saved workflow invoked AMRFinder+ 4.2.7 (database 2026-08-07.1), ISEScan 1.7.3, IntegronFinder 2.0.3, and Matryoshka at local commit `d041ab1449911355282ca34a5f3d0abf86a7c5ed`. Matryoshka also scanned its bundled reference FASTAs using BLAST. The saved JSON includes reference accessions and alignment scores for emitted reference calls. The exact bundled reference FASTA checksums and BLAST version were not recorded; a fresh detector rerun would need those pinned. `run_euscape_matryoshka.py` describes the original command sequence. The saved detector tables are included for each sample; no new detections were added by this review.

`euscape_figure3.py` flattens saved Matryoshka calls, collapses same-identity calls overlapping at least 80% of the shorter interval, and retains the highest score, then specificity/source tie break. It reconstructs containment by the smallest strictly enclosing, biologically permitted interval. Same-boundary features remain siblings. The exported full CellGen record contains the source contig represented as a plasmid and all retained calls. The similarity calculation instead uses **only the Tn4401-family carrier subtree containing blaKPC**, rooted at a generic `plasmid` fact. It compares a multiset of `entity` and immediate `contains` facts; coordinates and sample-specific labels are excluded. The score is `100 × shared facts / union facts`. `pairwise_facts.tsv` exposes the shared and exclusive facts for every ordered pair; `figure3_pairwise.tsv` gives their counts and scores. Consequently a 100% score is structural equality under this normalisation, not identical DNA, plasmid identity or evidence of transmission.

The original saved JSON reproduced the prior `original_pairwise.tsv` and `original_metrics.tsv` byte-for-byte when the original `contains` predicate is restored. The only logic change is that a `res_site` explicitly labelled family `Tn4401` cannot take an IS parent by coordinate enclosure alone. This changes 68 of 100 ordered matrix entries. AT022's Tn4401-labelled resolution site was previously put under overlapping IS1182 **outside** the inferred Tn4401a carrier, so the carrier subtree omitted it. IE024 already had its Tn4401a site directly under Tn4401a; AT022–IE024 changes 55.6% to 77.8% because AT022 gains its source-labelled site. DE016's site moves from internal IS21 to Tn4401; DE016–GR158 remains 63.6% because their normalised fact multisets still intersect in the same count. BE091–IT222 changes 71.4% to 100.0%. The new `figure3_pairwise.tsv`, `figure3_metrics.tsv`, ten CellGen records, ten SVG diagrams, and Figure 3 SVG/PDF/PNG were regenerated from the saved calls. `detector_calls.tsv` records all flattened calls, coordinates, score, source, reference accession, retention and rebuilt parent.

The carrier entity-count changes by sample are AT022 3→4, BE091 3→4, BE098 4→5, DE016 5→5, GR158 5→5, IE024 5→5, IT152 3→4, IT222 4→4, IT242 3→4 and PL039 5→5. Where the count grows, a source-labelled resolution site previously assigned to an overlapping IS outside the KPC-bearing Tn subtree enters that subtree. Where the count stays constant, parent-child facts or depth can still change; DE016 and GR158 decrease from depth 4 to 3. These are changes in computed annotations, not new detector calls.

## Questions requiring biological review

| Observation | Direct evidence | Interpretation to check |
| --- | --- | --- |
| AT022 Tn4401a has no nested IS feature | Tn4401a reference call spans 83,914–93,820; blaKPC-2 spans 85,840–86,718. ISEScan reports an IS1182 call at 82,683–85,496, which **overlaps** but is not contained by the Tn4401a interval. No other saved IS call lies fully within it. The Tn4401-labelled resolution site at 84,114–84,234 falls in both intervals, explaining its old IS1182 parent. | This is missing nested IS annotation under the strict containment rule, not proof that the IS is absent from the sequence. Inspect raw sequence, reference alignment boundaries and expected Tn4401 structure before a biological claim. |
| Family and element names differ | For example, DE016 `IS21_259` has family `IS21`; AT022 `Tn4401a` has family `Tn4401`. `detector_calls.tsv` keeps both. | The diagram abbreviates numbered ISEScan call names to families for comparison, while the audit table preserves original names. Confirm whether manuscript figures should print family, element variant or both. |
| DE016 resolution site appeared inside IS21 | IS21 spans 76–903; `res_Tn4401` spans 201–321; the Tn4401 reference call spans 1–3,872. Pure interval nesting put the resolution site under IS21. | The saved call labels the site with **Tn4401** family, so this review prevents Tn4401-labelled resolution sites from acquiring an IS parent. It becomes a Tn4401 child. This is a modelling correction to a source-labelled site, not independent validation of the site's biology. |
| Two DE016 Tn4401 calls | Saved reference calls span 1–3,872 and 49,693–55,685 on the same 55,685-bp contig, with different source-reference accessions. | Confirm whether both are complete/partial Tn4401 copies or boundary artefacts. The KPC carrier calculation selects the copy containing blaKPC-2 at 1,068–1,946. |

All ten rows in `screening.tsv`, sequences in `fasta/`, raw JSON in `matryoshka/`, call table, comparison facts, CellGen records and diagrams are intended for an expert to inspect together. The figure should be described as a comparison of *annotated KPC-carrier hierarchies*, not a phylogenetic or transmission analysis.

## Reproduction from saved calls

From the repository root with `cellgen`, BioPython, matplotlib and CairoSVG installed:

```bash
PYTHONPATH=python python analysis/euscape_figure3.py --data analysis/euscape_evidence --results analysis/euscape_results
PYTHONPATH=python python analysis/euscape_audit.py
PYTHONPATH=python python analysis/euscape_make_figure3.py
```

These commands do not rerun the external detectors. The original archive preparation and detector command scripts are supplied for provenance, but need the source archive and a pinned Matryoshka environment.
