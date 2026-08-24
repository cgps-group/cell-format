from pathlib import Path

from cellgen import parse


RESULTS = Path(__file__).parent.parent / "analysis" / "results"


def test_figure3_records_are_valid_whole_cells():
    parsed = parse((RESULTS / "figure3_records.cellgen").read_text())
    assert len(parsed.cells) == 3
    assert [len(cell.replicons) for cell in parsed.cells] == [2, 6, 7]
    assert [
        sum(rep.attributes.get("type") == "plasmid" for rep in cell.replicons)
        for cell in parsed.cells
    ] == [1, 5, 6]
