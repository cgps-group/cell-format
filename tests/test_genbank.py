from pathlib import Path

from cellgen.genbank import from_genbank_file, from_gff_file
from cellgen.serialise import to_cellgen
from cellgen.types import ChromosomeNode, EntityNode

FIXTURES = Path(__file__).parent / "fixtures"


def test_real_plasann_outputs_preserve_mobile_elements_and_classify_plasmids():
    for sample, mobile_count, gene_count in [("pbr322", 2, 6), ("pkpqil", 6, 141)]:
        path = FIXTURES / "plasann" / f"{sample}.gbk"
        default = from_genbank_file(path).cells[0].replicons[0]
        assert default.attributes["type"] == "plasmid"
        assert len(default.children) == mobile_count
        assert all(node.attributes["type"] == "mobile_element" for node in default.children)
        complete = from_genbank_file(path, retain_uncontained_genes=True)
        def count_genes(node):
            return (node.attributes.get("type") == "gene") + sum(count_genes(child) for child in node.children)
        assert count_genes(complete.cells[0].replicons[0]) == gene_count
        from cellgen.parser import parse
        assert to_cellgen(parse(to_cellgen(complete))) == to_cellgen(complete)
        if sample == "pkpqil":
            tn4401 = default.children[0]
            assert tn4401.label == "Tn4401a"
            # Preserve the tool's label, including its disagreement with the
            # deposited reference's KPC-3 annotation at these coordinates.
            assert any(child.label == "blaKPC-2" for child in tn4401.children)


def test_plasann_selection_and_mge_presence_do_not_imply_plasmid_identity(tmp_path):
    source = (FIXTURES / "plasann" / "pbr322.gbk").read_text()
    path = tmp_path / "no-plasmid-metadata.gbk"
    path.write_text(source.replace('/mol_type="plasmid DNA"', '/mol_type="genomic DNA"'))
    result = from_genbank_file(path, selected_feature_ids={"roM"})
    root = result.cells[0].replicons[0]
    assert root.attributes["type"] == "unknown"
    assert [child.label for child in root.children] == ["Tn6308", "roM", "Tn5393.7"]


def test_real_prokka_genbank_gene_cds_pairs_are_single_selectable_loci():
    source = FIXTURES / "prokka" / "pbr322.gbk"
    root = from_genbank_file(source, retain_uncontained_genes=True).cells[0].replicons[0]
    assert root.attributes["type"] == "plasmid"
    assert root.attributes["length"] == "4361"
    assert len(root.children) == 5
    selected = from_genbank_file(source, selected_feature_ids={"TEST_00002"})
    assert [child.label for child in selected.cells[0].replicons[0].children] == ["TEST_00002"]
    assert len(from_genbank_file(source).cells[0].replicons[0].children) == 0


def test_real_prokka_gff_preserves_length_and_both_gene_and_cds_ids(tmp_path):
    source = FIXTURES / "prokka" / "pbr322.gff"
    root = from_gff_file(source, retain_uncontained_genes=True).cells[0].replicons[0]
    assert root.attributes["type"] == "unknown"  # Prokka does not write plasmid metadata to GFF.
    assert root.attributes["length"] == "4361"
    assert len(root.children) == 5
    for identifier in ["TEST_00002", "TEST_00002_gene"]:
        selected = from_gff_file(source, selected_feature_ids={identifier})
        assert [child.label for child in selected.cells[0].replicons[0].children] == ["TEST_00002"]
    without_sequence = tmp_path / "prokka.gff"
    without_sequence.write_text(source.read_text().split("##FASTA")[0])
    assert to_cellgen(from_gff_file(without_sequence, retain_uncontained_genes=True)) == to_cellgen(
        from_gff_file(source, retain_uncontained_genes=True))


def test_genbank_equal_span_distinct_genes_are_not_collapsed(tmp_path):
    from Bio import SeqIO
    record = SeqIO.read(FIXTURES / "prokka" / "pbr322.gbk", "genbank")
    record.features[1].qualifiers = {"gene": ["different_gene"], "locus_tag": ["different_locus"]}
    path = tmp_path / "distinct.gbk"
    SeqIO.write(record, path, "genbank")
    assert len(from_genbank_file(path, retain_uncontained_genes=True).cells[0].replicons[0].children) == 6


def test_reference_tn21_does_not_promote_integron_mentions_to_whole_integrons():
    root = from_genbank_file(FIXTURES / "prokka" / "tn21-reference.gbk").cells[0].replicons[0]
    def structures(node):
        return ([node.label] if node.attributes.get("type") == "integron" else []) + [
            label for child in node.children for label in structures(child)]
    assert structures(root) == ["Integron In2"]


def test_multi_record_assembly_preserves_replicons_and_nesting():
    result = from_genbank_file(FIXTURES / "assembly.gbk")
    replicons = result.cells[0].replicons
    assert len(replicons) == 2
    assert isinstance(replicons[0], ChromosomeNode)
    assert isinstance(replicons[1], EntityNode)
    assert replicons[1].attributes["type"] == "plasmid"
    assert replicons[0].children[0].label == "Tn4401"
    assert replicons[0].children[0].children[0].label == "blaKPC-2"
    assert all(child.label != "coreA" for child in replicons[0].children)
    assert replicons[1].children[0].label == "class1_integron"
    assert [child.label for child in replicons[1].children[0].children] == [
        "intI1",
        "blaCTX-M-15",
    ]
    assert to_cellgen(result) == (FIXTURES / "assembly.cellgen").read_text().strip()


def test_standalone_full_span_mobile_element_is_not_a_chromosome():
    result = from_genbank_file(FIXTURES / "tncentral_element.gbk")
    root = result.cells[0].replicons[0]
    assert isinstance(root, EntityNode)
    assert root.label == "Tn4401"
    assert root.attributes["type"] == "transposon"
    assert [child.label for child in root.children] == ["ISKpn7", "blaKPC-2"]
    assert to_cellgen(result) == (FIXTURES / "tncentral_element.cellgen").read_text().strip()


def test_explicit_selection_retains_uncontained_gene_on_source_replicon():
    default = from_genbank_file(FIXTURES / "assembly.gbk")
    selected = from_genbank_file(FIXTURES / "assembly.gbk", retain_uncontained_genes=True)
    assert not any(node.label == "coreA" for node in default.cells[0].replicons[0].children)
    assert any(node.label == "coreA" for node in selected.cells[0].replicons[0].children)
    specifically = from_genbank_file(FIXTURES / "assembly.gbk", selected_feature_ids={"coreA"})
    assert [node.label for node in specifically.cells[0].replicons[0].children] == ["Tn4401", "coreA"]


def test_gff_coordinates_nested_genes_and_unknown_contigs(tmp_path):
    path = tmp_path / "test.gff3"
    path.write_text("""##gff-version 3
##sequence-region contig_1 1 100
contig_1\t.\tmobile_genetic_element\t10\t80\t.\t+\t.\tID=m1;Name=Tn1
contig_1\t.\tgene\t20\t30\t.\t+\t.\tID=g1;Name=blaX
contig_1\t.\tgene\t90\t95\t.\t-\t.\tID=g2;Name=outside
contig_1\t.\tmobile_genetic_element\t81\t89\t.\t-\t.\tID=m2;Name=Tn1
##FASTA
>contig_1
AAAAAAAAAA
""")
    result = from_gff_file(path)
    root = result.cells[0].replicons[0]
    assert isinstance(root, EntityNode)
    assert root.attributes["type"] == "unknown"
    assert [node.label for node in root.children] == ["Tn1", "Tn1"]
    assert root.children[0].children[0].label == "blaX"
    assert root.children[0].attributes["start"] == "10"
    assert root.children[0].attributes["end"] == "80"
    assert root.attributes["length"] == "100"
    selected = from_gff_file(path, retain_uncontained_genes=True)
    assert selected.cells[0].replicons[0].children[-1].label == "outside"
    specifically = from_gff_file(path, selected_feature_ids={"g2"})
    assert specifically.cells[0].replicons[0].children[-1].label == "outside"


def test_gff_gene_cds_parent_pair_is_one_locus_and_non_one_region_is_not_length(tmp_path):
    path = tmp_path / "partial.gff3"
    path.write_text("""##gff-version 3
##sequence-region ctg 100 200
ctg\t.\tgene\t120\t150\t.\t+\t.\tID=g1;Name=blaX
ctg\t.\tCDS\t120\t150\t.\t+\t0\tID=cds1;Parent=g1;Name=blaX
""")
    result = from_gff_file(path, selected_feature_ids={"g1"})
    root = result.cells[0].replicons[0]
    assert [child.label for child in root.children] == ["blaX"]
    assert "length" not in root.attributes
    assert root.attributes["region_start"] == "100"


def test_multisequence_gff_without_fasta_and_equal_boundary_siblings(tmp_path):
    path = tmp_path / "multi.gff3"
    path.write_text("""##gff-version 3
##sequence-region chr 1 100
##sequence-region opaque 1 50
chr\t.\tchromosome\t1\t100\t.\t+\t.\tID=chr
opaque\t.\ttransposon\t2\t40\t.\t+\t.\tID=t1;Name=TnA
opaque\t.\tinsertion_sequence\t2\t40\t.\t-\t.\tID=i1;Name=ISA
opaque\t.\tgene\t10\t20\t.\t+\t.\tID=g1;Name=blaY
""")
    result = from_gff_file(path)
    chromosome, contig = result.cells[0].replicons
    assert isinstance(chromosome, ChromosomeNode)
    assert chromosome.children == []
    assert contig.attributes["type"] == "unknown"
    assert [node.label for node in contig.children] == ["TnA", "ISA"]
    # Equal-boundary parent candidates tie in source order.
    assert contig.children[0].children[0].label == "blaY"


def test_gff_rejects_bad_coordinates(tmp_path):
    path = tmp_path / "bad.gff3"
    path.write_text("chr\t.\tgene\t20\t10\t.\t+\t.\tID=bad\n")
    import pytest
    with pytest.raises(ValueError, match="line 1"):
        from_gff_file(path)
