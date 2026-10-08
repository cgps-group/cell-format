import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).parent.parent
SPEC = importlib.util.spec_from_file_location("euscape_figure3", ROOT / "analysis" / "euscape_figure3.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
import sys
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_saved_euscape_scores_reproduce_and_resolution_site_parent_is_transposon(tmp_path):
    data = ROOT / "analysis" / "euscape_evidence"
    MODULE.build(data, tmp_path)
    assert (tmp_path / "figure3_pairwise.tsv").read_bytes() == (
        ROOT / "analysis" / "euscape_results" / "figure3_pairwise.tsv").read_bytes()
    raw = MODULE.flatten(json.loads((data / "matryoshka" / "EuSCAPE_DE016.json").read_text()))
    roots = MODULE.rebuild_hierarchy(MODULE.collapse_duplicate_calls(raw))
    transposons = [root for root in roots if root.element_type == "transposon"]
    assert any(child.element_type == "res_site" for root in transposons for child in root.children)
    assert not any(child.element_type == "res_site"
                   for root in transposons for nested in root.children for child in nested.children
                   if nested.element_type == "IS")


def test_original_scores_reproduce_when_old_parent_rule_is_restored(tmp_path):
    def old_contains(parent, child):
        return (parent is not child and parent.start <= child.start
                and child.end <= parent.end
                and (parent.start, parent.end) != (child.start, child.end)
                and (parent.element_type, child.element_type) not in MODULE.FORBIDDEN)
    original = MODULE.contains
    try:
        MODULE.contains = old_contains
        MODULE.build(ROOT / "analysis" / "euscape_evidence", tmp_path)
    finally:
        MODULE.contains = original
    for name in ("pairwise", "metrics"):
        assert (tmp_path / f"figure3_{name}.tsv").read_bytes() == (
            ROOT / "analysis" / "euscape_results" / f"original_{name}.tsv").read_bytes()
