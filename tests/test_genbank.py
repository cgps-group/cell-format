from pathlib import Path

from cellgen.genbank import from_genbank_file, from_gff_file
from cellgen.serialise import to_cellgen
from cellgen.types import ChromosomeNode, EntityNode

FIXTURES = Path(__file__).parent / "fixtures"


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
