"""Query curated CellGen records. Run from any directory with Python >=3.10."""
from pathlib import Path
import csv
import json
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'python'))
from cellgen import parse, to_cellgen


def visit(node, ancestors=()):
    yield node, ancestors
    for child in node.children:
        yield from visit(child, (*ancestors, node))


def enclosing(ancestors, kind):
    return next((a.label for a in reversed(ancestors)
                 if a.attributes.get('type') == kind), 'Not represented')


def ancestor_chain(ancestors, requirements):
    """Match nearest-to-outermost ancestors in order, allowing intermediates."""
    candidates = iter(reversed(ancestors))
    for kind, label in requirements:
        if not any(a.attributes.get('type') == kind and
                   (label is None or a.label == label) for a in candidates):
            return False
    return True


def main():
    rows, genes = [], []
    for name in ('Tn21', 'pKpQIL', 'pOXA-48a'):
        text = (HERE / f'{name}.cellgen').read_text().strip()
        parsed = parse(text)
        assert to_cellgen(parsed) == text, name
        for cell in parsed.cells:
            for root in cell.replicons:
                for node, ancestors in visit(root):
                    if node.attributes.get('type') != 'gene':
                        continue
                    genes.append((name, node, ancestors))
                    rows.append({
                        'record': name, 'gene': node.label,
                        **{kind: enclosing(ancestors, kind) for kind in
                           ('gene_cassette', 'integron', 'transposon', 'plasmid')},
                        'path': ' > '.join([a.label for a in ancestors] + [node.label]),
                    })
    queries = [
        {'query': 'gene label equals aadA1',
         'matches': [r['record'] for r in rows if r['gene'] == 'aadA1']},
        {'query': 'gene label equals blaKPC-3 with transposon ancestor Tn4401a and plasmid ancestor pKpQIL',
         'matches': [name for name, gene, ancestors in genes if gene.label == 'blaKPC-3'
                     and ancestor_chain(ancestors, [('transposon', 'Tn4401a'), ('plasmid', 'pKpQIL')])]},
        {'query': 'gene label equals blaOXA-48 with transposon ancestor Tn1999',
         'matches': [name for name, gene, ancestors in genes if gene.label == 'blaOXA-48'
                     and ancestor_chain(ancestors, [('transposon', 'Tn1999')])]},
        {'query': 'a gene has an integron ancestor inside a transposon',
         'matches': [name for name, gene, ancestors in genes
                     if ancestor_chain(ancestors, [('integron', None), ('transposon', None)])]},
        {'query': 'gene label equals blaNDM-1',
         'matches': [r['record'] for r in rows if r['gene'] == 'blaNDM-1']},
    ]
    assert [q['matches'] for q in queries] == [['Tn21'], ['pKpQIL'], ['pOXA-48a'], ['Tn21'], []]
    result = {'gene_contexts': rows, 'queries': queries}
    (HERE / 'query-results.json').write_text(json.dumps(result, indent=2) + '\n')
    with (HERE / 'query-results.tsv').open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), delimiter='\t')
        writer.writeheader()
        writer.writerows(rows)
    print('Verified three record round trips, three gene contexts and five structural queries.')


if __name__ == '__main__':
    main()
