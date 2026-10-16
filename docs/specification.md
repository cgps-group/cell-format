# Format specification

## Grammar

```ebnf
Document        = Cell , { ";" , Cell } ;
Cell            = CellularElement , { "," , CellularElement } ;
CellularElement = Chromosome | Entity ;
Chromosome      = "(" , [ EntitySet ] , ")" , Annotation ;
Entity          = "{" , [ EntitySet ] , "}" , Annotation ;
EntitySet       = Entity , { "," , Entity } ;
Annotation      = [ Label ] , [ Attributes ] ;
Attributes      = "[" , KeyValue , { "," , KeyValue } , "]" ;
KeyValue        = Key , "=" , Quoted ;
Label           = BareLabel | Quoted ;
```

`BareLabel` and attribute keys use letters, digits, `_`, `.`, `:`, and `-`; keys must start with a letter or underscore. Labels containing spaces or reserved characters must be double-quoted.

Quoted labels and values support `\\"`, `\\\\`, `\\n`, `\\r`, and `\\t` escapes.

## Rules

- `( )` denotes a chromosome, and only a chromosome.
- `{ }` denotes any other biological entity. Curly braces do not imply mobility.
- Chromosomes cannot be nested.
- Sibling elements and attributes require commas.
- A semicolon separates cells.
- A cell contains at least one top-level element. It need not contain a chromosome: a standalone plasmid or mobile-element record is valid. An empty chromosome `()chr` is valid and means that no child entity is represented, not that sequence is absent.
- A document may contain multiple cells separated by semicolons. Neither parser infers cell boundaries from a multi-record annotation file; importers group that file as one cell.
- Attribute keys must be unique on an element.
- Trailing separators and empty attribute blocks are invalid.

Parsers accept insignificant whitespace and produce a canonical serialisation with consistent separators and escaping.

The Methods sentence describing empty chromosomes and multiple cells as invalid conflicts with this grammar and both current parsers. Recommended replacement: “A CellGen record contains one or more cells, separated by semicolons. Each cell contains one or more top-level chromosomes or entities. Chromosomes and entities may have no represented children; an empty pair of brackets means no child entity is recorded.” Whether to require a chromosome for a *particular biological analysis* is a separate input policy, not a syntax rule.
