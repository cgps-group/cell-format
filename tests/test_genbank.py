from pathlib import Path

from cellgen.genbank import from_genbank_file
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
    assert replicons[1].children[0].label == "intI1"
    assert replicons[1].children[0].children[0].label == "blaCTX-M-15"
    assert to_cellgen(result) == (FIXTURES / "assembly.cellgen").read_text().strip()


def test_standalone_full_span_mobile_element_is_not_a_chromosome():
    result = from_genbank_file(FIXTURES / "tncentral_element.gbk")
    root = result.cells[0].replicons[0]
    assert isinstance(root, EntityNode)
    assert root.label == "Tn4401"
    assert root.attributes["type"] == "transposon"
    assert [child.label for child in root.children] == ["ISKpn7", "blaKPC-2"]
    assert to_cellgen(result) == (FIXTURES / "tncentral_element.cellgen").read_text().strip()
